"use client";

import type { ChatMessage } from "@/lib/chat/whatsapp";
import { formatMoney } from "@/lib/format";

type Member = { id: string; name: string };

export type Row = {
  key: number;
  message: ChatMessage;
  status: "ready" | "needs_ai" | "reading" | "error";
  source?: "rules" | "ai";
  error?: string;
  selected: boolean;
  amount: string;
  currency: string;
  description: string;
  payerId: string;
  participantIds: string[];
  notes: string[];
};

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function ReviewRow({
  row,
  members,
  aiBusy,
  onChange,
  onReadWithAi,
}: {
  row: Row;
  members: Member[];
  aiBusy: boolean;
  onChange: (change: Partial<Row>) => void;
  onReadWithAi: () => void;
}) {
  const ready = row.status === "ready";
  const total = Number(row.amount);
  const share =
    ready && total > 0 && row.participantIds.length > 0
      ? total / row.participantIds.length
      : null;

  function toggleParticipant(id: string) {
    const ids = new Set(row.participantIds);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    onChange({ participantIds: [...ids] });
  }

  return (
    <li
      className={`space-y-3 rounded-2xl border bg-white p-4 dark:bg-zinc-950 ${
        row.selected
          ? "border-zinc-900 dark:border-zinc-100"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label="Import this expense"
          checked={row.selected}
          disabled={!ready}
          onChange={(e) => onChange({ selected: e.target.checked })}
          className="mt-1"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-zinc-500">
            {dateFormat.format(row.message.sentAt)} · {row.message.sender}
            {row.source && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-900">
                {row.source === "ai" ? "AI" : "Quick match"}
              </span>
            )}
          </p>
          <p className="text-sm break-words whitespace-pre-wrap">“{row.message.text}”</p>
        </div>
      </div>

      {!ready && (
        <div className="flex flex-wrap items-center gap-3 pl-7">
          <button
            type="button"
            onClick={onReadWithAi}
            disabled={row.status === "reading" || aiBusy}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {row.status === "reading" ? "Reading… (up to a minute)" : "Read with AI"}
          </button>
          {row.error && <span className="text-sm text-red-600">{row.error}</span>}
        </div>
      )}

      {ready && (
        <div className="space-y-3 pl-7">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              type="number"
              min="0.01"
              step="0.01"
              aria-label={`Amount (${row.currency})`}
              value={row.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
            />
            <input
              aria-label="Description"
              placeholder="Description"
              maxLength={100}
              value={row.description}
              onChange={(e) => onChange({ description: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
            />
            <select
              aria-label="Paid by"
              value={row.payerId}
              onChange={(e) => onChange({ payerId: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">Who paid?</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} paid
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-2 py-1 text-xs has-checked:border-zinc-900 has-checked:bg-zinc-100 dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-900"
              >
                <input
                  type="checkbox"
                  checked={row.participantIds.includes(m.id)}
                  onChange={() => toggleParticipant(m.id)}
                />
                {m.name}
              </label>
            ))}
          </div>

          <p className="text-xs text-zinc-500">
            {share !== null
              ? `${formatMoney(total, row.currency)} · about ${formatMoney(share, row.currency)} each`
              : "Needs an amount, a payer and at least one person."}
            {row.notes.length > 0 && ` · ${row.notes.join(" ")}`}
          </p>
        </div>
      )}
    </li>
  );
}
