"use client";

import { useActionState, useState } from "react";
import { recordSettlement } from "@/lib/expenses/actions";
import { formatMoney } from "@/lib/format";

// "Settle" on a "X owes Y" row: record that X paid Y back, fully or partly.
export function SettleForm({
  groupId,
  fromId,
  toId,
  fromName,
  toName,
  amount,
  currency,
}: {
  groupId: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  amount: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(amount));
  const [state, action, pending] = useActionState(recordSettlement, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Settle
      </button>
    );
  }

  const paid = Number(value);

  return (
    <form action={action} className="w-full space-y-2 pt-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="fromId" value={fromId} />
      <input type="hidden" name="toId" value={toId} />
      <input type="hidden" name="currency" value={currency} />

      <label className="block space-y-1 text-xs">
        <span className="text-zinc-500">
          How much did {fromName} pay {toName}?
        </span>
        <div className="flex gap-2">
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            max={amount}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={state?.errors?.amount ? true : undefined}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={pending || !(paid > 0) || paid > amount}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Saving…" : "Record payment"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </label>

      {paid > 0 && paid < amount && (
        <p className="text-xs text-zinc-500">
          Partial payment: {formatMoney(amount - paid, currency)} will still be
          owed.
        </p>
      )}
      {(state?.message || state?.errors?.amount) && (
        <p className="text-xs text-red-600">
          {state?.errors?.amount?.[0] ?? state?.message}
        </p>
      )}
    </form>
  );
}
