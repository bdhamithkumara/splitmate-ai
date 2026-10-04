import "server-only";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type GroupExpense = {
  id: string;
  payer_id: string;
  amount: number;
  currency: string;
  description: string | null;
  raw_text: string | null;
  created_at: string;
  expense_splits: { member_id: string; amount: number }[];
};

// All expenses for a group, newest first. RLS limits this to groups the user
// belongs to. Fine for friend-sized groups; paginate if this grows large.
export async function getGroupExpenses(groupId: string): Promise<GroupExpense[]> {
  await requireUser();
  if (!z.uuid().safeParse(groupId).success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, payer_id, amount, currency, description, raw_text, created_at, expense_splits(member_id, amount)",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getGroupExpenses failed:", error);
    throw new Error("Could not load expenses.");
  }

  // numeric columns can arrive as strings depending on precision
  return (data ?? []).map((e) => ({
    ...e,
    amount: Number(e.amount),
    expense_splits: e.expense_splits.map((s) => ({
      member_id: s.member_id,
      amount: Number(s.amount),
    })),
  })) as GroupExpense[];
}
