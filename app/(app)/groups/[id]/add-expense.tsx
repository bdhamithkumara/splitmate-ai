"use client";

import { useActionState, useState } from "react";
import { previewExpense, saveExpense } from "@/lib/expenses/actions";
import {
  MAX_MESSAGE_LENGTH,
  type ExpensePreview,
} from "@/lib/expenses/definitions";
import { FormMessage } from "@/components/form-ui";
import { formatMoney } from "@/lib/format";

type Member = { id: string; name: string };
type Props = { groupId: string; members: Member[] };

// Remounting the composer (new key) resets both forms after a save.
export function AddExpense(props: Props) {
  const [round, setRound] = useState(0);
  return (
    <ExpenseComposer
      key={round}
      {...props}
      onDone={() => setRound((r) => r + 1)}
    />
  );
}

function ExpenseComposer({
  groupId,
  members,
  onDone,
}: Props & { onDone: () => void }) {
  const [state, action, pending] = useActionState(previewExpense, undefined);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-2">
        <input type="hidden" name="groupId" value={groupId} />
        <label htmlFor="text" className="sr-only">
          Expense message
        </label>
        <textarea
          id="text"
          name="text"
          rows={2}
          required
          maxLength={MAX_MESSAGE_LENGTH}
          defaultValue={state?.text}
          placeholder="e.g. Uber 1200 Kasun · 3000 (Sidath,Dhamith) · Kasun paid 4500 for dinner with Hasaru"
          aria-invalid={state?.errors?.text ? true : undefined}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 aria-invalid:border-red-500 dark:border-zinc-700 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        />
        {state?.errors?.text && (
          <p className="text-sm text-red-600">{state.errors.text[0]}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Reading…" : "Read message"}
          </button>
          {pending && (
            <p role="status" className="text-xs text-zinc-500">
              Free-form messages go to the local AI and can take up to a
              minute.
            </p>
          )}
        </div>
      </form>

      <FormMessage message={state?.message} />

      {state?.preview && !pending && (
        <PreviewCard
          key={state.preview.id}
          groupId={groupId}
          preview={state.preview}
          members={members}
          onDone={onDone}
        />
      )}
    </div>
  );
}

function PreviewCard({
  groupId,
  preview,
  members,
  onDone,
}: {
  groupId: string;
  preview: ExpensePreview;
  members: Member[];
  onDone: () => void;
}) {
  const [saveState, saveAction, saving] = useActionState(saveExpense, undefined);
  // Controlled: React resets uncontrolled fields after every form action,
  // which would drop the user's edits when a save fails validation.
  const [amount, setAmount] = useState(String(preview.amount));
  const [description, setDescription] = useState(preview.description ?? "");
  const [payerId, setPayerId] = useState(preview.payerId);
  const [participantIds, setParticipantIds] = useState(
    () => new Set(preview.participantIds),
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

  if (saveState?.success) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
        <span role="status">{saveState.message}</span>
        <button type="button" onClick={onDone} className="font-medium underline">
          Add another
        </button>
      </div>
    );
  }

  const errors = saveState?.errors;

  return (
    <form
      action={saveAction}
      className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="currency" value={preview.currency} />
      <input type="hidden" name="rawText" value={preview.rawText} />

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Check before saving</h3>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {preview.source === "ai" ? "Read by AI" : "Quick match"}
        </span>
      </div>

      <FormMessage message={saveState?.message} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block text-xs text-zinc-500">
            Amount ({preview.currency})
          </span>
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
            : `About ${formatMoney(share, preview.currency)} each · ${participantIds.size} ${participantIds.size === 1 ? "person" : "people"}`}
        </p>
        {errors?.participantIds && (
          <p className="text-sm text-red-600">{errors.participantIds[0]}</p>
        )}
      </fieldset>

      {preview.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-zinc-500">
          {preview.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={saving || share === null}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {saving ? "Saving…" : "Save expense"}
      </button>
    </form>
  );
}
