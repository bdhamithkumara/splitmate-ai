// Turns a WhatsApp-style message into structured expense JSON using a local
// Ollama model. lib/ai stays free of Next.js / "@/" imports so
// scripts/try-parser.mjs can run it directly with Node.
import { Ollama, type Message } from "ollama";
import { z } from "zod";
import { matchMember } from "./match-members";

export const parsedExpenseSchema = z.object({
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  payer: z.string().nullable(),
  participants: z.array(z.string()).nullable(),
  description: z.string().nullable(),
});

export type ParsedExpense = z.infer<typeof parsedExpenseSchema>;

export type ExpenseParseErrorReason =
  | "unavailable"
  | "invalid_output"
  | "no_amount";

export class ExpenseParseError extends Error {
  readonly reason: ExpenseParseErrorReason;

  constructor(message: string, reason: ExpenseParseErrorReason) {
    super(message);
    this.name = "ExpenseParseError";
    this.reason = reason;
  }
}

const DEFAULT_CURRENCY = "LKR";

// Ollama constrains generation to this JSON schema (structured outputs).
const RESPONSE_FORMAT = z.toJSONSchema(parsedExpenseSchema);

const SYSTEM_PROMPT = `You extract shared expenses from short WhatsApp-style messages written by friends in Sri Lanka.

Return ONLY a JSON object with these keys:
- "amount": the total cost as a number. Remove commas. "4.5k" means 4500. null if no amount.
- "currency": 3-letter ISO code if the message states one ("Rs", "rs.", "LKR" -> "LKR"; "$" -> "USD"). null if not stated.
- "payer": the name of the person who paid, or null if not clear.
- "participants": every person sharing the cost, or null if not stated.
- "description": what the money was spent on in 1-3 words, or null if not stated.

Rules:
- "<name> paid ..." and "... paid by <name>" mean <name> is the payer.
- In "<item> <amount> <name>", the single name is the payer.
- Names inside parentheses are participants, not the payer.
- "with A and B" lists participants. If someone paid, include the payer in participants too.
- "with A" when nobody is said to have paid: payer is null, A is a participant.
- If the message does not say who shares the cost, participants is null. Never list only the payer.
- Copy names exactly as written, with a capital first letter. Never invent names.
- If a name clearly refers to one of the group members, use the member's spelling.`;

// Fixed member list for the examples. The real list goes in the final user
// message, so everything before it stays identical between calls and Ollama
// can reuse its cached prompt instead of re-reading it (slow on CPU).
const EXAMPLE_MEMBERS = ["Kasun", "Hasaru", "Dhamith", "Sidath"];

// Few-shot examples: the three from the project spec plus the cases the
// model got wrong in testing (participants = [payer], "with" read as payer).
const EXAMPLES: Array<[string, ParsedExpense]> = [
  [
    "Kasun paid 4500 LKR for dinner with Hasaru and Dhamith",
    {
      amount: 4500,
      currency: "LKR",
      payer: "Kasun",
      participants: ["Kasun", "Hasaru", "Dhamith"],
      description: "dinner",
    },
  ],
  [
    "3000 (Sidath,Dhamith)",
    {
      amount: 3000,
      currency: null,
      payer: null,
      participants: ["Sidath", "Dhamith"],
      description: null,
    },
  ],
  [
    "Uber 1200 Kasun",
    {
      amount: 1200,
      currency: null,
      payer: "Kasun",
      participants: null,
      description: "Uber",
    },
  ],
  [
    "Groceries 2000 paid by Sidath",
    {
      amount: 2000,
      currency: null,
      payer: "Sidath",
      participants: null,
      description: "groceries",
    },
  ],
  [
    "Movie tickets 1500 with Sidath and Kasun",
    {
      amount: 1500,
      currency: null,
      payer: null,
      participants: ["Sidath", "Kasun"],
      description: "movie tickets",
    },
  ],
];

const userMessage = (text: string, memberNames: string[]) =>
  `Group members: ${memberNames.length > 0 ? memberNames.join(", ") : "unknown"}\nMessage: ${text}`;

const REQUEST_TIMEOUT_MS = 120_000;

export type ParseExpenseOptions = {
  memberNames?: string[];
  host?: string;
  model?: string;
};

export async function parseExpenseText(
  text: string,
  {
    memberNames = [],
    host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434",
    model = process.env.OLLAMA_MODEL ?? "gemma3:4b",
  }: ParseExpenseOptions = {},
): Promise<ParsedExpense> {
  const ollama = new Ollama({ host });

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...EXAMPLES.flatMap(([input, output]): Message[] => [
      { role: "user", content: userMessage(input, EXAMPLE_MEMBERS) },
      { role: "assistant", content: JSON.stringify(output) },
    ]),
    { role: "user", content: userMessage(text, memberNames) },
  ];

  let content: string;
  const timeout = setTimeout(() => ollama.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await ollama.chat({
      model,
      messages,
      format: RESPONSE_FORMAT,
      stream: false,
      keep_alive: "10m",
      options: { temperature: 0 },
    });
    content = response.message.content;
  } catch (error) {
    throw new ExpenseParseError(
      `Could not reach the AI model (${model} at ${host}): ${String(error)}`,
      "unavailable",
    );
  } finally {
    clearTimeout(timeout);
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new ExpenseParseError(`Model returned invalid JSON: ${content}`, "invalid_output");
  }

  const parsed = parsedExpenseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExpenseParseError(
      `Model output didn't match the schema: ${content}`,
      "invalid_output",
    );
  }

  return normalize(parsed.data, text);
}

// Small models invent names (e.g. listing the whole group). Only keep names
// that actually appear in the message, and treat "just the payer" as unstated.
function normalize(expense: ParsedExpense, text: string): ParsedExpense {
  if (expense.amount === null || !(expense.amount > 0)) {
    throw new ExpenseParseError("No amount found in the message.", "no_amount");
  }

  const words: string[] = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const mentioned = (name: string) =>
    words.some((word) => matchMember(word, [{ id: name, name }]) !== null);

  const clean = (value: string | null) => value?.trim() || null;
  const payerName = clean(expense.payer);
  let payer = payerName && mentioned(payerName) ? payerName : null;

  const unique = new Map<string, string>();

  // "tuk tuk with Kasun": nobody paid, Kasun only appears after "with", so
  // Kasun is a participant. Models often get this one wrong.
  if (payer && !/\bpa(?:id|ys?)\b/i.test(text)) {
    const withIndex = words.indexOf("with");
    const payerIndex = words.findIndex(
      (word) => matchMember(word, [{ id: payer!, name: payer! }]) !== null,
    );
    if (withIndex !== -1 && payerIndex > withIndex) {
      unique.set(payer.toLowerCase(), payer);
      payer = null;
    }
  }

  for (const raw of expense.participants ?? []) {
    const name = raw.trim();
    if (name && mentioned(name)) unique.set(name.toLowerCase(), name);
  }
  const participants = [...unique.values()];
  const onlyPayer =
    participants.length === 1 &&
    payer !== null &&
    participants[0].toLowerCase() === payer.toLowerCase();

  return {
    amount: expense.amount,
    currency: clean(expense.currency)?.toUpperCase() ?? DEFAULT_CURRENCY,
    payer,
    participants: participants.length > 0 && !onlyPayer ? participants : null,
    description: clean(expense.description),
  };
}
