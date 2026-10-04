"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/data/groups";
import { ExpenseParseError, parseExpense, type ParsedExpense } from "@/lib/ai";
import type { GroupMember } from "@/lib/data/groups";
import {
  previewExpenseSchema,
  saveExpenseSchema,
  type ExpensePreview,
  type PreviewExpenseState,
  type SaveExpenseState,
} from "./definitions";
import { resolveExpense } from "./resolve";

// Saves the reviewed expense and its equal splits atomically (create_expense
// RPC). RLS rejects payers or participants outside the group.
export async function saveExpense(
  _state: SaveExpenseState,
  formData: FormData,
): Promise<SaveExpenseState> {
  await requireUser();
  const parsed = saveExpenseSchema.safeParse({
    groupId: formData.get("groupId"),
    payerId: formData.get("payerId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    description: formData.get("description") ?? undefined,
    rawText: formData.get("rawText") ?? undefined,
    participantIds: formData.getAll("participantIds"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { groupId, payerId, amount, currency, description, rawText, participantIds } =
    parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_expense", {
    p_group_id: groupId,
    p_payer_id: payerId,
    p_amount: amount,
    p_currency: currency,
    p_description: description ?? null,
    p_raw_text: rawText ?? null,
    p_participant_ids: participantIds,
  });

  if (error) {
    console.error("saveExpense failed:", error);
    return {
      message:
        error.code === "42501"
          ? "You can only add expenses for members of this group."
          : "Could not save the expense. Please try again.",
    };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true, message: "Expense saved." };
}

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
  const resolved = resolveExpense(expense, source, members, {
    id: me.id,
    label: "you",
  });

  return {
    id: crypto.randomUUID(),
    rawText,
    amount: expense.amount ?? 0,
    currency: expense.currency ?? "LKR",
    description: expense.description,
    payerId: resolved.payerId ?? me.id,
    participantIds: resolved.participantIds,
    source,
    notes: resolved.notes,
  };
}
