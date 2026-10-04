// Reads WhatsApp "Export chat" text. Pure — runs in the browser so the chat
// never leaves the user's device; only selected expense lines are sent on.
//
// Supported line headers (date separators / , . or -, 12h or 24h clock):
//   Android: 04/10/2026, 20:15 - Kasun: Uber 1200
//            4/10/26, 8:15 PM - Kasun: Uber 1200
//   iPhone:  [04/10/2026, 20:15:32] Kasun: Uber 1200
//            [4/10/26, 8:15:32 PM] Kasun: Uber 1200

export type DateOrder = "DMY" | "MDY" | "YMD";

type RawMessage = {
  date: [number, number, number]; // as written, before choosing the order
  hour: number;
  minute: number;
  second: number;
  sender: string;
  text: string;
};

export type ChatMessage = {
  index: number;
  sentAt: Date;
  sender: string;
  text: string;
};

export type ParsedChat = {
  raw: RawMessage[];
  detectedOrder: DateOrder;
  // true when every date fits both DD/MM and MM/DD
  ambiguous: boolean;
};

const HEADER =
  /^\[?(\d{1,4})[./-](\d{1,2})[./-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:[\s  ]*([AaPp])\.?\s?[Mm]\.?)?\]?\s*(?:-\s+)?(.*)$/;

// Invisible direction marks WhatsApp sprinkles into exports.
const INVISIBLE = /[‎‏‪-‮﻿]/g;

export function parseWhatsAppChat(content: string): ParsedChat {
  const raw: RawMessage[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(INVISIBLE, "");
    const match = HEADER.exec(line);

    if (!match) {
      // continuation of a multi-line message
      const last = raw.at(-1);
      if (last && line.trim()) last.text += `\n${line}`;
      continue;
    }

    const [, a, b, c, h, min, sec, ampm, rest] = match;
    const colon = rest.indexOf(": ");
    // no "Name: " → system message ("Kasun added Hasaru", encryption notice)
    if (colon <= 0) continue;

    let hour = Number(h);
    if (ampm) {
      const pm = ampm.toLowerCase() === "p";
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }

    raw.push({
      date: [Number(a), Number(b), Number(c)],
      hour,
      minute: Number(min),
      second: Number(sec ?? 0),
      sender: rest.slice(0, colon).trim(),
      text: rest.slice(colon + 2),
    });
  }

  return { raw, ...detectDateOrder(raw) };
}

function detectDateOrder(raw: RawMessage[]) {
  if (raw.some((m) => m.date[0] > 31)) {
    return { detectedOrder: "YMD" as const, ambiguous: false };
  }
  const firstOver12 = raw.some((m) => m.date[0] > 12);
  const secondOver12 = raw.some((m) => m.date[1] > 12);
  if (firstOver12 && !secondOver12) return { detectedOrder: "DMY" as const, ambiguous: false };
  if (secondOver12 && !firstOver12) return { detectedOrder: "MDY" as const, ambiguous: false };
  // Can't tell: default to day-first (Sri Lanka).
  return { detectedOrder: "DMY" as const, ambiguous: true };
}

export function toMessages(chat: ParsedChat, order: DateOrder): ChatMessage[] {
  const messages: ChatMessage[] = [];

  chat.raw.forEach((m, index) => {
    const [a, b, c] = m.date;
    const [y, mo, d] =
      order === "YMD" ? [a, b, c] : order === "MDY" ? [c, a, b] : [c, b, a];
    const year = y < 100 ? 2000 + y : y;
    // Chat times are the phone's local time.
    const sentAt = new Date(year, mo - 1, d, m.hour, m.minute, m.second);
    // drop impossible dates (e.g. wrong order chosen → month 13)
    if (sentAt.getMonth() !== mo - 1 || sentAt.getDate() !== d) return;
    messages.push({ index, sentAt, sender: m.sender, text: m.text.trim() });
  });

  return messages;
}

// Cheap pre-filter: messages that contain something that looks like money.
// Times ("8:30"), dates and phone numbers are ignored.
export function looksLikeExpense(text: string): boolean {
  if (text.length > 300) return false;
  if (/<media omitted>|omitted>?$|^(this message was deleted|you deleted this message)/i.test(text)) {
    return false;
  }
  const cleaned = text
    .replace(/\d{1,2}[:.]\d{2}\s*(?:am|pm)?/gi, " ")
    .replace(/\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/g, " ")
    .replace(/\+?\d[\d\s-]{8,}\d/g, " ");
  return /(?:^|[^\d])(\d{2,}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?k)(?![\d])/i.test(cleaned);
}
