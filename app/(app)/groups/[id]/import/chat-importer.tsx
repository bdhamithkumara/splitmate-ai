"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { FormMessage } from "@/components/form-ui";
import { matchMember } from "@/lib/ai/match-members";
import { quickParse } from "@/lib/ai/quick-parse";
import { readChatExport } from "@/lib/chat/read-export";
import {
  looksLikeExpense,
  parseWhatsAppChat,
  toMessages,
  type ChatMessage,
  type DateOrder,
  type ParsedChat,
} from "@/lib/chat/whatsapp";
import { resolveExpense } from "@/lib/expenses/resolve";
import { importExpenses, readMessageWithAi } from "@/lib/import/actions";
import { MAX_IMPORT_ITEMS, type ImportItem } from "@/lib/import/definitions";
import type { ParsedExpense } from "@/lib/ai/parse-expense";
import { ReviewRow, type Row } from "./review-row";

type Member = { id: string; name: string };
type Step = "upload" | "range" | "senders" | "review" | "done";
type Props = {
  groupId: string;
  members: Member[];
  lastImportAt: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" in local time, for <input type="date">.
function toDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromDateInput(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const sendersKey = (groupId: string) => `splitmate:senders:${groupId}`;

function loadSavedSenders(groupId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(sendersKey(groupId)) ?? "{}");
  } catch {
    return {};
  }
}

export function ChatImporter({ groupId, members, lastImportAt }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const [fileName, setFileName] = useState("");
  const [chat, setChat] = useState<ParsedChat | null>(null);
  const [order, setOrder] = useState<DateOrder>("DMY");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [senderMap, setSenderMap] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [result, setResult] = useState<{ saved: number; skipped: number; failed: number }>();

  const stopAi = useRef(false);
  const [aiQueue, setAiQueue] = useState(false);

  const messages = useMemo(
    () => (chat ? toMessages(chat, order) : []),
    [chat, order],
  );
  const chatStart = messages[0]?.sentAt;
  const chatEnd = messages.at(-1)?.sentAt;

  const candidates = useMemo(() => {
    if (!from || !to) return [];
    const start = fromDateInput(from).getTime();
    const end = fromDateInput(to).getTime() + DAY_MS;
    return messages.filter(
      (m) =>
        m.sentAt.getTime() >= start &&
        m.sentAt.getTime() < end &&
        looksLikeExpense(m.text),
    );
  }, [messages, from, to]);

  const senders = useMemo(
    () => [...new Set(candidates.map((m) => m.sender))].sort(),
    [candidates],
  );

  // ---- step 1: upload -------------------------------------------------------
  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    setLoading(true);
    try {
      const parsed = parseWhatsAppChat(await readChatExport(file));
      const parsedMessages = toMessages(parsed, parsed.detectedOrder);
      if (parsedMessages.length === 0) {
        throw new Error(
          "No WhatsApp messages found. Export the chat from WhatsApp (Without media) and upload that file.",
        );
      }

      const first = parsedMessages[0].sentAt;
      const last = parsedMessages.at(-1)!.sentAt;
      const resumeFrom =
        lastImportAt && new Date(lastImportAt) > first && new Date(lastImportAt) <= last
          ? new Date(lastImportAt)
          : first;

      setFileName(file.name);
      setChat(parsed);
      setOrder(parsed.detectedOrder);
      setFrom(toDateInput(resumeFrom));
      setTo(toDateInput(last));
      setStep("range");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setLoading(false);
    }
  }

  function changeOrder(next: DateOrder) {
    if (!chat) return;
    const nextMessages = toMessages(chat, next);
    setOrder(next);
    if (nextMessages.length > 0) {
      setFrom(toDateInput(nextMessages[0].sentAt));
      setTo(toDateInput(nextMessages.at(-1)!.sentAt));
    }
  }

  function preset(kind: "last" | "30" | "month" | "all") {
    if (!chatStart || !chatEnd) return;
    const clamp = (d: Date) =>
      d < chatStart ? chatStart : d > chatEnd ? chatEnd : d;
    const now = new Date();
    const start =
      kind === "last" && lastImportAt
        ? new Date(lastImportAt)
        : kind === "30"
          ? new Date(now.getTime() - 30 * DAY_MS)
          : kind === "month"
            ? new Date(now.getFullYear(), now.getMonth(), 1)
            : chatStart;
    setFrom(toDateInput(clamp(start)));
    setTo(toDateInput(chatEnd));
  }

  // ---- step 2 → 3: senders ---------------------------------------------------
  function goToSenders() {
    const saved = loadSavedSenders(groupId);
    const map: Record<string, string> = {};
    for (const sender of senders) {
      const savedId = saved[sender];
      const auto =
        matchMember(sender, members) ??
        matchMember(sender.split(/\s+/)[0] ?? "", members);
      map[sender] =
        savedId === "" || members.some((m) => m.id === savedId)
          ? savedId
          : (auto?.id ?? "");
    }
    setSenderMap(map);
    setStep("senders");
  }

  // ---- step 3 → 4: build review rows -----------------------------------------
  function goToReview() {
    try {
      localStorage.setItem(
        sendersKey(groupId),
        JSON.stringify({ ...loadSavedSenders(groupId), ...senderMap }),
      );
    } catch {
      // storage unavailable — mapping just won't be remembered
    }

    setRows(
      candidates
        .filter((m) => senderMap[m.sender] !== undefined)
        .map((message) => {
          const quick = quickParse(message.text, members);
          return quick
            ? applyParse(baseRow(message), quick, "rules")
            : baseRow(message);
        }),
    );
    setStep("review");
  }

  function senderPayer(sender: string) {
    const id = senderMap[sender];
    return id ? { id, label: `the sender (${sender})` } : null;
  }

  function baseRow(message: ChatMessage): Row {
    return {
      key: message.index,
      message,
      status: "needs_ai",
      selected: false,
      amount: "",
      currency: "LKR",
      description: "",
      payerId: senderMap[message.sender] ?? "",
      participantIds: [],
      notes: [],
    };
  }

  function applyParse(row: Row, parsed: ParsedExpense, source: "rules" | "ai"): Row {
    const resolved = resolveExpense(
      parsed,
      source,
      members,
      senderPayer(row.message.sender),
    );
    const next: Row = {
      ...row,
      status: "ready",
      source,
      amount: String(parsed.amount ?? ""),
      currency: parsed.currency ?? "LKR",
      description: parsed.description ?? "",
      payerId: resolved.payerId ?? "",
      participantIds: resolved.participantIds,
      notes: resolved.notes,
      error: undefined,
    };
    return { ...next, selected: isValid(next) };
  }

  const updateRow = (key: number, change: (row: Row) => Row) =>
    setRows((current) => current.map((r) => (r.key === key ? change(r) : r)));

  async function readWithAi(row: Row) {
    updateRow(row.key, (r) => ({ ...r, status: "reading", error: undefined }));
    const response = await readMessageWithAi(groupId, row.message.text);
    updateRow(row.key, (r) =>
      response.ok
        ? applyParse(r, response.expense, "ai")
        : { ...r, status: "error", error: response.message },
    );
  }

  async function readAllWithAi() {
    stopAi.current = false;
    setAiQueue(true);
    for (const row of rows.filter((r) => r.status === "needs_ai" || r.status === "error")) {
      if (stopAi.current) break;
      await readWithAi(row);
    }
    setAiQueue(false);
  }

  // ---- step 4 → 5: import ----------------------------------------------------
  const selected = rows.filter((r) => r.selected && isValid(r));
  const needsAi = rows.filter((r) => r.status === "needs_ai" || r.status === "error").length;

  async function runImport() {
    setError(undefined);
    setLoading(true);
    const items: ImportItem[] = selected.map((r) => ({
      payerId: r.payerId,
      participantIds: r.participantIds,
      amount: Number(r.amount),
      currency: r.currency,
      description: r.description.trim() || null,
      rawText: r.message.text,
      spentAt: r.message.sentAt.toISOString(),
    }));

    const totals = { saved: 0, skipped: 0, failed: 0 };
    try {
      for (let i = 0; i < items.length; i += MAX_IMPORT_ITEMS) {
        const response = await importExpenses({
          groupId,
          items: items.slice(i, i + MAX_IMPORT_ITEMS),
        });
        if (!response.ok) {
          setError(response.message);
          return;
        }
        totals.saved += response.saved;
        totals.skipped += response.skipped;
        totals.failed += response.failed;
      }
      setResult(totals);
      setStep("done");
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ---- render ------------------------------------------------------------------
  return (
    <div className="space-y-4">
      <Steps step={step} />
      <FormMessage message={error} />

      {step === "upload" && (
        <Card>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-10 text-center hover:border-zinc-500 dark:border-zinc-700">
            <span className="text-sm font-medium">
              {loading ? "Reading chat…" : "Choose WhatsApp export (.zip or .txt)"}
            </span>
            <span className="text-xs text-zinc-500">Nothing is uploaded yet.</span>
            <input
              type="file"
              accept=".zip,.txt,application/zip,text/plain"
              className="sr-only"
              disabled={loading}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </Card>
      )}

      {step === "range" && chatStart && chatEnd && (
        <Card>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{fileName}</p>
            <p className="text-zinc-500">
              {messages.length.toLocaleString()} messages ·{" "}
              {chatStart.toLocaleDateString(undefined, { dateStyle: "medium" })} →{" "}
              {chatEnd.toLocaleDateString(undefined, { dateStyle: "medium" })}
            </p>
          </div>

          {chat?.ambiguous && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Dates could be day/month or month/day.
              <select
                value={order}
                onChange={(e) => changeOrder(e.target.value as DateOrder)}
                className="rounded border border-amber-300 bg-transparent px-2 py-0.5 dark:border-amber-800"
              >
                <option value="DMY">Day first (04/10 = 4 Oct)</option>
                <option value="MDY">Month first (04/10 = Apr 10)</option>
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {lastImportAt && <Chip onClick={() => preset("last")}>Since last import</Chip>}
            <Chip onClick={() => preset("month")}>This month</Chip>
            <Chip onClick={() => preset("30")}>Last 30 days</Chip>
            <Chip onClick={() => preset("all")}>Everything</Chip>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DateField label="From" value={from} min={toDateInput(chatStart)} max={to} onChange={setFrom} />
            <DateField label="To" value={to} min={from} max={toDateInput(chatEnd)} onChange={setTo} />
          </div>

          <p className="text-sm">
            <strong className="font-semibold">{candidates.length}</strong>{" "}
            possible {candidates.length === 1 ? "expense" : "expenses"} in this range
          </p>

          <div className="flex justify-between gap-2">
            <SecondaryButton onClick={() => setStep("upload")}>Back</SecondaryButton>
            <PrimaryButton disabled={candidates.length === 0} onClick={goToSenders}>
              Continue
            </PrimaryButton>
          </div>
        </Card>
      )}

      {step === "senders" && (
        <Card>
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Who is who?</h2>
            <p className="text-xs text-zinc-500">
              Names come from the exporting phone&apos;s contacts. Match each to a
              group member. This is remembered for next time.
            </p>
          </div>
          <ul className="space-y-2">
            {senders.map((sender) => (
              <li key={sender} className="grid items-center gap-2 text-sm sm:grid-cols-2">
                <span className="truncate font-medium">{sender}</span>
                <select
                  value={senderMap[sender] ?? ""}
                  onChange={(e) =>
                    setSenderMap((map) => ({ ...map, [sender]: e.target.value }))
                  }
                  className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="">Not a member (their messages need a payer picked)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <div className="flex justify-between gap-2">
            <SecondaryButton onClick={() => setStep("range")}>Back</SecondaryButton>
            <PrimaryButton onClick={goToReview}>Find expenses</PrimaryButton>
          </div>
        </Card>
      )}

      {step === "review" && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p>
                <strong className="font-semibold">{rows.length - needsAi}</strong> read ·{" "}
                <strong className="font-semibold">{needsAi}</strong> need AI ·{" "}
                <strong className="font-semibold">{selected.length}</strong> selected
              </p>
              {needsAi > 0 &&
                (aiQueue ? (
                  <SecondaryButton onClick={() => (stopAi.current = true)}>
                    Stop AI
                  </SecondaryButton>
                ) : (
                  <SecondaryButton onClick={readAllWithAi}>
                    Read all {needsAi} with AI (~{needsAi} min)
                  </SecondaryButton>
                ))}
            </div>
          </Card>

          <ul className="space-y-3">
            {rows.map((row) => (
              <ReviewRow
                key={row.key}
                row={row}
                members={members}
                aiBusy={aiQueue}
                onChange={(change) => updateRow(row.key, (r) => {
                  const next = { ...r, ...change };
                  return "selected" in change ? next : { ...next, selected: isValid(next) };
                })}
                onReadWithAi={() => readWithAi(row)}
              />
            ))}
          </ul>

          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            <SecondaryButton onClick={() => setStep("senders")}>Back</SecondaryButton>
            <PrimaryButton
              disabled={selected.length === 0 || loading || aiQueue}
              onClick={runImport}
            >
              {loading ? "Importing…" : `Import ${selected.length} ${selected.length === 1 ? "expense" : "expenses"}`}
            </PrimaryButton>
          </div>
        </>
      )}

      {step === "done" && result && (
        <Card>
          <h2 className="text-lg font-semibold">Import finished</h2>
          <ul className="space-y-1 text-sm">
            <li>✅ {result.saved} imported</li>
            {result.skipped > 0 && <li>↩️ {result.skipped} already imported before (skipped)</li>}
            {result.failed > 0 && <li>⚠️ {result.failed} failed — check the terminal log</li>}
          </ul>
          <Link
            href={`/groups/${groupId}`}
            className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            See balances
          </Link>
        </Card>
      )}
    </div>
  );
}

function isValid(row: Row) {
  return (
    row.status === "ready" &&
    Number(row.amount) > 0 &&
    row.payerId !== "" &&
    row.participantIds.length > 0
  );
}

// ---- small presentational pieces ------------------------------------------

function Steps({ step }: { step: Step }) {
  const steps: [Step, string][] = [
    ["upload", "Upload"],
    ["range", "Date range"],
    ["senders", "Senders"],
    ["review", "Review"],
  ];
  const current = steps.findIndex(([s]) => s === step);
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
      {steps.map(([key, label], i) => (
        <li
          key={key}
          className={
            i === current || (step === "done" && i === steps.length - 1)
              ? "font-semibold text-foreground"
              : undefined
          }
        >
          {i + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      {children}
    </section>
  );
}

function DateField(props: {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block text-xs text-zinc-500">{props.label}</span>
      <input
        type="date"
        value={props.value}
        min={props.min}
        max={props.max}
        onChange={(e) => e.target.value && props.onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
      />
    </label>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
    >
      {children}
    </button>
  );
}

function PrimaryButton(props: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {props.children}
    </button>
  );
}

function SecondaryButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
    >
      {props.children}
    </button>
  );
}
