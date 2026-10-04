// Turn a parsed message into concrete member ids. Pure — used by the single
// message preview (server) and the chat import review (browser).
import { matchMember, type MemberRef } from "@/lib/ai/match-members";
import type { ParsedExpense } from "@/lib/ai/parse-expense";

export type ResolvedExpense = {
  payerId: string | null;
  participantIds: string[];
  notes: string[];
};

export function resolveExpense(
  expense: ParsedExpense,
  source: "rules" | "ai",
  members: MemberRef[],
  // who paid when the message doesn't say: "you" in the app, the sender in an import
  fallbackPayer: { id: string; label: string } | null,
): ResolvedExpense {
  const notes: string[] = [];

  let payerId: string | null = null;
  if (expense.payer) {
    const match = matchMember(expense.payer, members);
    if (match) payerId = match.id;
    else notes.push(`“${expense.payer}” isn't in this group.`);
  }
  if (!payerId && fallbackPayer) {
    payerId = fallbackPayer.id;
    if (!expense.payer) notes.push(`No payer mentioned, so it's ${fallbackPayer.label}.`);
  }

  let participantIds: string[];
  if (expense.participants) {
    const ids = new Set<string>();
    for (const name of expense.participants) {
      const match = matchMember(name, members);
      if (match) ids.add(match.id);
      else notes.push(`“${name}” isn't in this group and was skipped.`);
    }
    // "tuk tuk with Kasun" (AI-parsed, nobody named as payer): whoever paid
    // shared it too. Not for "3000 (Sidath,Dhamith)", which lists everyone.
    if (source === "ai" && !expense.payer && payerId) ids.add(payerId);
    participantIds = [...ids];
  } else {
    participantIds = members.map((m) => m.id);
    notes.push("No participants mentioned, so it's split with the whole group.");
  }

  if (participantIds.length === 0 && payerId) participantIds = [payerId];

  return { payerId, participantIds, notes };
}
