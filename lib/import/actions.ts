"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { getGroup } from "@/lib/data/groups";
import { createClient } from "@/lib/supabase/server";
import {
  ExpenseParseError,
  parseExpenseText,
  type ParsedExpense,
} from "@/lib/ai/parse-expense";
import { MAX_MESSAGE_LENGTH } from "@/lib/expenses/definitions";
import {
  importExpensesSchema,
  type ImportItem,
  type ImportResult,
} from "./definitions";

// One message → local model. Called per row from the review screen, because
// each call can take ~1 minute on CPU.
export async function readMessageWithAi(
  groupId: string,
  text: string,
): Promise<{ ok: true; expense: ParsedExpense } | { ok: false; message: string }> {
  await requireUser();
  const input = z.string().trim().min(1).max(MAX_MESSAGE_LENGTH).safeParse(text);
  if (!input.success) return { ok: false, message: "Message is empty or too long." };

  const group = await getGroup(groupId);
  if (!group) return { ok: false, message: "Group not found." };

  try {
    const expense = await parseExpenseText(input.data, {
      memberNames: group.members.map((m) => m.name),
    });
    return { ok: true, expense };
  } catch (error) {
    if (error instanceof ExpenseParseError) {
      return {
        ok: false,
        message:
          error.reason === "unavailable"
            ? "AI model isn't reachable. Is Ollama running?"
            : error.reason === "no_amount"
              ? "No amount found."
              : "AI couldn't understand this one.",
      };
    }
    throw error;
  }
}

// Same message at the same minute = same expense, even if exported again
// from another phone (Android has no seconds, contact names differ).
function importKey(item: ImportItem) {
  const minute = new Date(item.spentAt);
  minute.setUTCSeconds(0, 0);
  return createHash("sha256")
    .update(`${minute.toISOString()}|${item.rawText.trim().toLowerCase()}`)
    .digest("hex");
}

export async function importExpenses(input: {
  groupId: string;
  items: ImportItem[];
}): Promise<ImportResult> {
  await requireUser();
  const parsed = importExpensesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Some rows are incomplete. Check amounts, payers and participants." };
  }

  const { groupId, items } = parsed.data;
  const group = await getGroup(groupId);
  if (!group) return { ok: false, message: "Group not found." };

  const supabase = await createClient();
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  // Sequential on purpose: each RPC is its own transaction, so one bad row
  // doesn't block the rest, and duplicates are skipped by import_key.
  for (const item of items) {
    const { data, error } = await supabase.rpc("create_expense", {
      p_group_id: groupId,
      p_payer_id: item.payerId,
      p_amount: item.amount,
      p_currency: item.currency,
      p_description: item.description,
      p_raw_text: item.rawText,
      p_participant_ids: item.participantIds,
      p_spent_at: item.spentAt,
      p_import_key: importKey(item),
    });

    if (error) {
      console.error("importExpenses row failed:", error);
      failed++;
    } else if (data === null) {
      skipped++;
    } else {
      saved++;
    }
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/import`);
  return { ok: true, saved, skipped, failed };
}
