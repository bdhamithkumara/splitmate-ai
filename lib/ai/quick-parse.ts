// Rule-based parser for the common short formats, so they skip the (slow)
// local model entirely:
//   "Uber 1200 Kasun"                       description amount payer
//   "3000 (Sidath,Dhamith)"                 amount (participants)
//   "Pizza 3600 Sidath (Kasun, Hasaru)"     description amount payer (participants)
//   "Rs.850 tuk tuk"                        currency + amount anywhere
// Returns null whenever the message is anything less than unambiguous; the
// caller then falls back to the model.
import type { ParsedExpense } from "./parse-expense";
import { matchMember, type MemberRef } from "./match-members";

// Words that mean the sentence has structure we don't try to interpret here.
const STOP_WORDS = new Set([
  "paid", "pay", "pays", "by", "with", "for", "and", "&", "gave", "give",
  "owe", "owes", "split", "each", "to", "from", "per", "except", "but", "not",
  "me", "i", "we", "us",
]);

const CURRENCY_WORDS: Record<string, string> = {
  rs: "LKR",
  "rs.": "LKR",
  lkr: "LKR",
  usd: "USD",
  $: "USD",
};

const AMOUNT =
  /^(rs\.?|lkr|\$)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(k)?(?:\/-)?$/i;

export function quickParse(
  text: string,
  members: MemberRef[],
): ParsedExpense | null {
  const input = text.trim();
  if (!input || input.length > 200) return null;

  // At most one "(A, B and C)" group, which lists participants.
  const groups = [...input.matchAll(/\(([^()]*)\)/g)];
  if (groups.length > 1) return null;

  let participants: string[] | null = null;
  if (groups.length === 1) {
    const names = groups[0][1]
      .split(/,|&|\/|\band\b/i)
      .map((name) => name.trim())
      .filter(Boolean);
    const matched = names.map((name) => matchMember(name, members));
    if (names.length === 0 || matched.some((m) => m === null)) return null;
    participants = [...new Set(matched.map((m) => m!.name))];
  }

  const tokens = input
    .replace(/\([^()]*\)/, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.some((t) => STOP_WORDS.has(t.toLowerCase()))) return null;

  let currency: string | null = null;
  let amount: number | null = null;
  let amountIndex = -1;
  const words: { token: string; index: number }[] = [];

  for (const [index, token] of tokens.entries()) {
    const lower = token.toLowerCase();
    if (lower in CURRENCY_WORDS) {
      if (currency) return null;
      currency = CURRENCY_WORDS[lower];
      continue;
    }

    const match = AMOUNT.exec(token);
    if (match) {
      if (amount !== null) return null; // two numbers: ambiguous
      const [, prefix, whole, fraction, thousands] = match;
      if (prefix) {
        if (currency) return null;
        currency = CURRENCY_WORDS[prefix.toLowerCase()];
      }
      amount = Number(`${whole.replaceAll(",", "")}.${fraction ?? "0"}`);
      if (thousands) amount *= 1000;
      amountIndex = index;
      continue;
    }

    if (/\d/.test(token)) return null; // e.g. "2pcs", "3x"
    words.push({ token, index });
  }

  if (amount === null || !(amount > 0)) return null;

  const before = words.filter((w) => w.index < amountIndex).map((w) => w.token);
  const after = words.filter((w) => w.index > amountIndex).map((w) => w.token);

  // A trailing known member is the payer: "Uber 1200 Kasun", "850 tuk tuk Kasun".
  let payer: string | null = null;
  const last = after.at(-1);
  const lastMember = last ? matchMember(last, members) : null;
  if (lastMember) {
    payer = lastMember.name;
    after.pop();
  }

  // Everything else is the description. Any other member name in it
  // ("Kasun 1200") could be payer or participant, so leave it to the model.
  const description = [...before, ...after];
  if (description.some((word) => matchMember(word, members))) return null;

  return {
    amount: Math.round(amount * 100) / 100,
    currency: currency ?? "LKR",
    payer,
    participants,
    description: description.length > 0 ? description.join(" ") : null,
  };
}
