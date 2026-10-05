import type { GroupExpense } from "@/lib/data/expenses";
import { ExpenseItem } from "./expense-item";

type Member = { id: string; name: string };

export function ExpenseList({
  groupId,
  expenses,
  members,
}: {
  groupId: string;
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

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
      {expenses.map((expense) => (
        <ExpenseItem
          key={expense.id}
          groupId={groupId}
          expense={expense}
          members={members}
        />
      ))}
    </ul>
  );
}
