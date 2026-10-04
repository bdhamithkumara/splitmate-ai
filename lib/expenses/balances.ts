// Net balances and "who pays whom" settlements, computed in integer cents so
// rounding never drifts. Pure functions — no database access.

export type ExpenseForBalance = {
  payer_id: string;
  amount: number;
  currency: string;
  expense_splits: { member_id: string; amount: number }[];
};

export type Settlement = {
  fromId: string;
  toId: string;
  amount: number;
};

export type CurrencyBalances = {
  currency: string;
  // positive: is owed money; negative: owes money
  net: Map<string, number>;
  settlements: Settlement[];
};

const toCents = (value: number) => Math.round(Number(value) * 100);

export function computeBalances(
  expenses: ExpenseForBalance[],
): CurrencyBalances[] {
  const byCurrency = new Map<string, Map<string, number>>();

  for (const expense of expenses) {
    const net = byCurrency.get(expense.currency) ?? new Map<string, number>();
    byCurrency.set(expense.currency, net);

    const add = (id: string, cents: number) =>
      net.set(id, (net.get(id) ?? 0) + cents);

    add(expense.payer_id, toCents(expense.amount));
    for (const split of expense.expense_splits) {
      add(split.member_id, -toCents(split.amount));
    }
  }

  return [...byCurrency.entries()]
    .map(([currency, netCents]) => ({
      currency,
      net: new Map(
        [...netCents].map(([id, cents]) => [id, cents / 100] as const),
      ),
      settlements: settle(netCents),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

// Greedy: repeatedly match the biggest debtor with the biggest creditor.
// Produces at most (people - 1) payments.
function settle(netCents: Map<string, number>): Settlement[] {
  const creditors = [...netCents]
    .filter(([, cents]) => cents > 0)
    .map(([id, cents]) => ({ id, cents }));
  const debtors = [...netCents]
    .filter(([, cents]) => cents < 0)
    .map(([id, cents]) => ({ id, cents: -cents }));

  const settlements: Settlement[] = [];

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.cents - a.cents);
    debtors.sort((a, b) => b.cents - a.cents);

    const creditor = creditors[0];
    const debtor = debtors[0];
    const cents = Math.min(creditor.cents, debtor.cents);

    settlements.push({ fromId: debtor.id, toId: creditor.id, amount: cents / 100 });
    creditor.cents -= cents;
    debtor.cents -= cents;

    if (creditor.cents === 0) creditors.shift();
    if (debtor.cents === 0) debtors.shift();
  }

  return settlements;
}
