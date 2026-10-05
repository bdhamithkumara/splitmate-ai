"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-ui";
import { resetInvite } from "@/lib/invites/actions";

export function InviteCard({
  groupId,
  groupName,
  inviteUrl,
}: {
  groupId: string;
  groupName: string;
  inviteUrl: string | null;
}) {
  const [state, action, pending] = useActionState(resetInvite, undefined);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked (e.g. non-HTTPS on a phone): the input is selectable
    }
  }

  const resetForm = (label: string) => (
    <form action={action} onSubmit={() => setConfirmReset(false)}>
      <input type="hidden" name="groupId" value={groupId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Creating…" : label}
      </button>
    </form>
  );

  if (!inviteUrl) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Share one link in your WhatsApp group. Friends sign up, pick their
          name, and see all expenses and balances.
        </p>
        <FormMessage message={state?.message} />
        {resetForm("Create invite link")}
      </div>
    );
  }

  const whatsappText = `Join "${groupName}" on SplitMate AI to see our shared expenses: ${inviteUrl}`;

  return (
    <div className="space-y-3">
      <FormMessage message={state?.message} />
      <div className="flex gap-2">
        <label htmlFor="invite-url" className="sr-only">
          Invite link
        </label>
        <input
          id="invite-url"
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-green-700 underline dark:text-green-400"
        >
          Share on WhatsApp
        </a>
        {confirmReset ? (
          <span className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">
              The current link will stop working.
            </span>
            {resetForm("Reset link")}
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="underline"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-xs text-zinc-500 underline hover:text-foreground"
          >
            Reset link
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Anyone with this link can join after signing in. Reset it if it was
        shared by mistake.
      </p>
    </div>
  );
}
