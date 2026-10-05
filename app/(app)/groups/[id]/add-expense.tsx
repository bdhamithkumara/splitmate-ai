"use client";

import { useActionState, useState } from "react";
import { previewExpense, saveExpense } from "@/lib/expenses/actions";
import {
  MAX_MESSAGE_LENGTH,
  type ExpensePreview,
} from "@/lib/expenses/definitions";
import { FormMessage } from "@/components/form-ui";
import { ExpenseFields } from "./expense-fields";

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

      <ExpenseFields
        members={members}
        currency={preview.currency}
        initial={preview}
        errors={saveState?.errors}
        footer={(valid) => (
          <>
            {preview.notes.length > 0 && (
              <ul className="space-y-1 text-xs text-zinc-500">
                {preview.notes.map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            )}
            <button
              type="submit"
              disabled={saving || !valid}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {saving ? "Saving…" : "Save expense"}
            </button>
          </>
        )}
      />
    </form>
  );
}
