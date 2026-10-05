"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-ui";
import type { GroupExpense } from "@/lib/data/expenses";
import { deleteExpense, updateExpense } from "@/lib/expenses/actions";
import type { SaveExpenseState } from "@/lib/expenses/definitions";
import { formatMoney } from "@/lib/format";
import { ExpenseFields } from "./expense-fields";

type Member = { id: string; name: string };

// Fixed locale + time zone so server and browser render the same string.
const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

export function ExpenseItem({
  groupId,
  expense,
  members,
}: {
  groupId: string;
  expense: GroupExpense;
  members: Member[];
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");

  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "Former member";

  if (mode === "edit") {
    return (
      <li className="py-3">
        <EditForm
          groupId={groupId}
          expense={expense}
          members={members}
          onClose={() => setMode("view")}
        />
      </li>
    );
  }

  return (
    <li className="space-y-1 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{expense.description || "Expense"}</span>
        <span className="font-mono">
          {formatMoney(expense.amount, expense.currency)}
        </span>
      </div>
      <p className="text-zinc-600 dark:text-zinc-400">
        {nameOf(expense.payer_id)} paid · split with{" "}
        {expense.expense_splits.map((s) => nameOf(s.member_id)).join(", ")}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 flex-wrap gap-x-2 text-xs text-zinc-400">
          <time dateTime={expense.spent_at}>
            {dateFormat.format(new Date(expense.spent_at))}
          </time>
          {expense.raw_text && (
            <span className="truncate">“{expense.raw_text}”</span>
          )}
        </p>
        {mode === "confirm-delete" ? (
          <DeleteConfirm
            groupId={groupId}
            expenseId={expense.id}
            label={`${expense.description || "Expense"} · ${formatMoney(expense.amount, expense.currency)}`}
            onCancel={() => setMode("view")}
          />
        ) : (
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="text-zinc-500 underline hover:text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setMode("confirm-delete")}
              className="text-red-600 underline hover:text-red-800 dark:hover:text-red-400"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function EditForm({
  groupId,
  expense,
  members,
  onClose,
}: {
  groupId: string;
  expense: GroupExpense;
  members: Member[];
  onClose: () => void;
}) {
  const [state, action, saving] = useActionState(
    async (previous: SaveExpenseState, formData: FormData) => {
      const result = await updateExpense(previous, formData);
      if (result?.success) onClose();
      return result;
    },
    undefined,
  );

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="expenseId" value={expense.id} />

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Edit expense</h3>
        {expense.raw_text && (
          <span className="truncate text-xs text-zinc-400">
            “{expense.raw_text}”
          </span>
        )}
      </div>

      <FormMessage message={state?.message} />

      <ExpenseFields
        members={members}
        currency={expense.currency}
        initial={{
          amount: expense.amount,
          description: expense.description,
          payerId: expense.payer_id,
          participantIds: expense.expense_splits.map((s) => s.member_id),
        }}
        errors={state?.errors}
        footer={(valid) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !valid}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      />
    </form>
  );
}

function DeleteConfirm({
  groupId,
  expenseId,
  label,
  onCancel,
}: {
  groupId: string;
  expenseId: string;
  label: string;
  onCancel: () => void;
}) {
  const [state, action, deleting] = useActionState(deleteExpense, undefined);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="expenseId" value={expenseId} />
      <span className="text-zinc-600 dark:text-zinc-400">
        {state?.message ?? `Delete “${label}”?`}
      </span>
      <button
        type="submit"
        disabled={deleting}
        className="rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {deleting ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={deleting}
        className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Cancel
      </button>
    </form>
  );
}
