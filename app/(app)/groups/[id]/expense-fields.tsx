"use client";

import { useState } from "react";
import type { SaveExpenseState } from "@/lib/expenses/definitions";
import { formatMoney } from "@/lib/format";

type Member = { id: string; name: string };

export type ExpenseFieldValues = {
  amount: number;
  description: string | null;
  payerId: string;
  participantIds: string[];
};

// Amount, description, payer and participant inputs shared by the new-expense
// preview and the edit form. Fields are controlled because React resets
// uncontrolled inputs after every form action, which would drop edits when a
// save fails validation. Posts as: amount, description, payerId, participantIds.
export function ExpenseFields({
  members,
  currency,
  initial,
  errors,
  footer,
}: {
  members: Member[];
  currency: string;
  initial: ExpenseFieldValues;
  errors?: NonNullable<SaveExpenseState>["errors"];
  footer: (valid: boolean) => React.ReactNode;
}) {
  const [amount, setAmount] = useState(String(initial.amount));
  const [description, setDescription] = useState(initial.description ?? "");
  const [payerId, setPayerId] = useState(initial.payerId);
  const [participantIds, setParticipantIds] = useState(
    () => new Set(initial.participantIds),
  );

  const total = Number(amount);
  const share =
    participantIds.size > 0 && total > 0 ? total / participantIds.size : null;

  function toggle(id: string) {
    setParticipantIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block text-xs text-zinc-500">Amount ({currency})</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={errors?.amount ? true : undefined}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 aria-invalid:border-red-500 dark:border-zinc-700"
          />
          {errors?.amount && (
            <span className="block text-red-600">{errors.amount[0]}</span>
          )}
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-xs text-zinc-500">Description</span>
          <input
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={100}
            placeholder="e.g. dinner"
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="block text-xs text-zinc-500">Paid by</span>
          <select
            name="payerId"
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs text-zinc-500">Split equally between</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm has-checked:border-zinc-900 has-checked:bg-zinc-100 dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-900"
            >
              <input
                type="checkbox"
                name="participantIds"
                value={m.id}
                checked={participantIds.has(m.id)}
                onChange={() => toggle(m.id)}
              />
              {m.name}
            </label>
          ))}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {share === null
            ? "Pick at least one person and a valid amount."
            : `About ${formatMoney(share, currency)} each · ${participantIds.size} ${participantIds.size === 1 ? "person" : "people"}`}
        </p>
        {errors?.participantIds && (
          <p className="text-sm text-red-600">{errors.participantIds[0]}</p>
        )}
      </fieldset>

      {footer(share !== null)}
    </>
  );
}
