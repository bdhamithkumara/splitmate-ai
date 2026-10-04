"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { getGroup } from "@/lib/data/groups";
import {
  ExpenseParseError,
  matchMember,
  parseExpense,
  type ParsedExpense,
} from "@/lib/ai";
import type { GroupMember } from "@/lib/data/groups";
import {
  previewExpenseSchema,
  type ExpensePreview,
  type PreviewExpenseState,
} from "./definitions";

// Parses a message into an editable preview. Nothing is saved here.
export async function previewExpense(
  _state: PreviewExpenseState,
  formData: FormData,
): Promise<PreviewExpenseState> {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "");
  const parsed = previewExpenseSchema.safeParse({
    groupId: formData.get("groupId"),
    text,
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, text };
  }

  // RLS: returns null unless the user belongs to this group.
  const group = await getGroup(parsed.data.groupId);
  if (!group) return { message: "Group not found.", text };

  const me = group.members.find((m) => m.user_id === user.id);
  if (!me) return { message: "You're not a member of this group.", text };

  try {
    const { expense, source } = await parseExpense(
      parsed.data.text,
      group.members,
    );
    return {
      text,
      preview: resolvePreview(parsed.data.text, expense, source, group.members, me),
    };
  } catch (error) {
    if (error instanceof ExpenseParseError) {
      console.error("previewExpense:", error.message);
      return {
        text,
        message:
          error.reason === "unavailable"
            ? "The AI model isn't reachable. Is Ollama running?"
            : error.reason === "no_amount"
              ? "I couldn't find an amount in that message."
              : "I couldn't understand that message. Try something like “Uber 1200 Kasun”.",
      };
    }
    throw error;
  }
}

function resolvePreview(
  rawText: string,
  expense: ParsedExpense,
  source: "rules" | "ai",
  members: GroupMember[],
  me: GroupMember,
): ExpensePreview {
  const notes: string[] = [];

  // Payer: the named member, otherwise whoever is adding the expense.
  let payer = me;
  if (expense.payer) {
    const match = matchMember(expense.payer, members);
    if (match) payer = match;
    else notes.push(`“${expense.payer}” isn't in this group, so the payer is set to you.`);
  } else {
    notes.push("No payer mentioned, so it's set to you.");
  }

  // Participants: the named members, otherwise the whole group.
  let participantIds: string[];
  if (expense.participants) {
    const ids = new Set<string>();
    for (const name of expense.participants) {
      const match = matchMember(name, members);
      if (match) ids.add(match.id);
      else notes.push(`“${name}” isn't in this group and was skipped.`);
    }
    // "with Kasun" and no payer named: the sender (now the payer) shared it too.
    if (!expense.payer) ids.add(payer.id);
    participantIds = [...ids];
  } else {
    participantIds = members.map((m) => m.id);
    notes.push("No participants mentioned, so it's split with the whole group.");
  }

  if (participantIds.length === 0) participantIds = [payer.id];

  return {
    id: crypto.randomUUID(),
    rawText,
    amount: expense.amount ?? 0,
    currency: expense.currency ?? "LKR",
    description: expense.description,
    payerId: payer.id,
    participantIds,
    source,
    notes,
  };
}
