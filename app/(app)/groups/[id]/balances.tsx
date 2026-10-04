import type { GroupExpense } from "@/lib/data/expenses";
import { computeBalances } from "@/lib/expenses/balances";
import { formatMoney } from "@/lib/format";

type Member = { id: string; name: string };

export function Balances({
  expenses,
  members,
  myMemberId,
}: {
  expenses: GroupExpense[];
  members: Member[];
  myMemberId: string | undefined;
}) {
  if (expenses.length === 0) {
    return <p className="text-sm text-zinc-500">No expenses yet.</p>;
  }

  const nameOf = (id: string) => {
    if (id === myMemberId) return "You";
    return members.find((m) => m.id === id)?.name ?? "Former member";
  };

  return (
    <div className="space-y-6">
      {computeBalances(expenses).map(({ currency, net, settlements }) => (
        <div key={currency} className="space-y-3">
          {settlements.length === 0 ? (
            <p className="text-sm text-zinc-500">
              All settled up in {currency}. 🎉
            </p>
          ) : (
            <ul className="space-y-2">
              {settlements.map((s) => (
                <li
                  key={`${s.fromId}-${s.toId}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
                >
                  <span>
                    <strong className="font-medium">{nameOf(s.fromId)}</strong>{" "}
                    {s.fromId === myMemberId ? "owe" : "owes"}{" "}
                    <strong className="font-medium">{nameOf(s.toId)}</strong>
                  </span>
                  <span className="font-mono">{formatMoney(s.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-zinc-500">
              Net balance per person
            </summary>
            <ul className="mt-2 space-y-1">
              {members.map((m) => {
                const value = net.get(m.id) ?? 0;
                return (
                  <li key={m.id} className="flex justify-between">
                    <span>{m.name}</span>
                    <span
                      className={
                        value > 0
                          ? "font-mono text-green-700 dark:text-green-400"
                          : value < 0
                            ? "font-mono text-red-700 dark:text-red-400"
                            : "font-mono text-zinc-500"
                      }
                    >
                      {value > 0 ? "+" : ""}
                      {formatMoney(value, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      ))}
    </div>
  );
}
