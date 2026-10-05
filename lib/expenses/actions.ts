"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/data/groups";
import { ExpenseParseError, parseExpense, type ParsedExpense } from "@/lib/ai";
import type { GroupMember } from "@/lib/data/groups";
import {
  deleteExpenseSchema,
  previewExpenseSchema,
  recordSettlementSchema,
  saveExpenseSchema,
  updateExpenseSchema,
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

const NOT_FOUND = "P0002";
const RLS_DENIED = "42501";

// Edits an expense and rebuilds its equal splits atomically (update_expense
// RPC). Any group member may edit; RLS enforces that.
export async function updateExpense(
  _state: SaveExpenseState,
  formData: FormData,
): Promise<SaveExpenseState> {
  await requireUser();
  const parsed = updateExpenseSchema.safeParse({
    groupId: formData.get("groupId"),
    expenseId: formData.get("expenseId"),
    payerId: formData.get("payerId"),
    amount: formData.get("amount"),
    description: formData.get("description") ?? undefined,
    participantIds: formData.getAll("participantIds"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors };
  }

  const { groupId, expenseId, payerId, amount, description, participantIds } =
    parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_expense", {
    p_expense_id: expenseId,
    p_payer_id: payerId,
    p_amount: amount,
    p_description: description ?? null,
    p_participant_ids: participantIds,
  });

  if (error) {
    console.error("updateExpense failed:", error);
    return {
      message:
        error.code === NOT_FOUND
          ? "This expense no longer exists."
          : error.code === RLS_DENIED
            ? "You can only use members of this group."
            : "Could not save your changes. Please try again.",
    };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true, message: "Changes saved." };
}

// "Hasaru paid Kasun back": stored as a settlement (record_settlement RPC).
export async function recordSettlement(
  _state: SaveExpenseState,
  formData: FormData,
): Promise<SaveExpenseState> {
  await requireUser();
  const parsed = recordSettlementSchema.safeParse({
    groupId: formData.get("groupId"),
    fromId: formData.get("fromId"),
    toId: formData.get("toId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      errors: fieldErrors.amount ? { amount: fieldErrors.amount } : undefined,
      message: fieldErrors.amount ? undefined : "Invalid payment.",
    };
  }

  const { groupId, fromId, toId, amount, currency } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_settlement", {
    p_group_id: groupId,
    p_from_member_id: fromId,
    p_to_member_id: toId,
    p_amount: amount,
    p_currency: currency,
  });

  if (error) {
    console.error("recordSettlement failed:", error);
    return {
      message:
        error.code === RLS_DENIED
          ? "Both people must be members of this group."
          : "Could not record the payment. Please try again.",
    };
  }

  revalidatePath(`/groups/${groupId}`);
  return { success: true, message: "Payment recorded." };
}

export async function deleteExpense(
  _state: SaveExpenseState,
  formData: FormData,
): Promise<SaveExpenseState> {
  await requireUser();
  const parsed = deleteExpenseSchema.safeParse({
    groupId: formData.get("groupId"),
    expenseId: formData.get("expenseId"),
  });
  if (!parsed.success) return { message: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_expense", {
    p_expense_id: parsed.data.expenseId,
  });

  if (error && error.code !== NOT_FOUND) {
    console.error("deleteExpense failed:", error);
    return { message: "Could not delete the expense. Please try again." };
  }

  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { success: true };
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
