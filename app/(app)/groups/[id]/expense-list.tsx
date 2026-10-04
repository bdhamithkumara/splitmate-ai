import type { GroupExpense } from "@/lib/data/expenses";
import { formatMoney } from "@/lib/format";

type Member = { id: string; name: string };

const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Colombo",
});

export function ExpenseList({
  expenses,
  members,
}: {
  expenses: GroupExpense[];
  members: Member[];
}) {
  if (expenses.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nothing here yet. Paste a WhatsApp message above to add the first one.
      </p>
    );
  }

  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "Former member";

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
      {expenses.map((expense) => (
        <li key={expense.id} className="space-y-1 py-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">
              {expense.description || "Expense"}
            </span>
            <span className="font-mono">
              {formatMoney(expense.amount, expense.currency)}
            </span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            {nameOf(expense.payer_id)} paid · split with{" "}
            {expense.expense_splits.map((s) => nameOf(s.member_id)).join(", ")}
          </p>
          <p className="flex flex-wrap gap-x-2 text-xs text-zinc-400">
            <time dateTime={expense.spent_at}>
              {dateFormat.format(new Date(expense.spent_at))}
            </time>
            {expense.raw_text && (
              <span className="truncate">“{expense.raw_text}”</span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
