"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-ui";
import { matchMember } from "@/lib/ai/match-members";
import { acceptInvite } from "@/lib/invites/actions";

type InviteMember = { id: string; name: string; claimed: boolean };

export function JoinForm({
  token,
  members,
  myName,
}: {
  token: string;
  members: InviteMember[];
  myName: string;
}) {
  const [state, action, pending] = useActionState(acceptInvite, undefined);
  const open = members.filter((m) => !m.claimed);

  // Preselect the member that matches the name used at signup.
  const [choice, setChoice] = useState(
    () => matchMember(myName, open)?.id ?? (open.length === 0 ? "new" : ""),
  );
  const [name, setName] = useState(myName);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1">
        <h2 className="text-sm font-medium">Who are you?</h2>
        <p className="text-xs text-zinc-500">
          Pick your name so expenses already added for you become yours.
        </p>
      </div>

      <FormMessage message={state?.message} />

      <fieldset className="space-y-2">
        <legend className="sr-only">Choose your member</legend>
        {members.map((m) => (
          <label
            key={m.id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
              m.claimed
                ? "cursor-not-allowed border-zinc-200 text-zinc-400 dark:border-zinc-800"
                : "cursor-pointer border-zinc-300 has-checked:border-zinc-900 has-checked:bg-zinc-100 dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-900"
            }`}
          >
            <input
              type="radio"
              name="choice"
              value={m.id}
              disabled={m.claimed}
              checked={choice === m.id}
              onChange={() => setChoice(m.id)}
            />
            <span className="flex-1">{m.name}</span>
            {m.claimed && <span className="text-xs">already joined</span>}
          </label>
        ))}

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm has-checked:border-zinc-900 has-checked:bg-zinc-100 dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-900">
          <input
            type="radio"
            name="choice"
            value="new"
            checked={choice === "new"}
            onChange={() => setChoice("new")}
          />
          I&apos;m not on the list
        </label>
      </fieldset>

      {choice === "new" && (
        <label className="block space-y-1 text-sm">
          <span className="block text-xs text-zinc-500">Your name in this group</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={50}
            aria-invalid={state?.errors?.name ? true : undefined}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 aria-invalid:border-red-500 dark:border-zinc-700"
          />
          {state?.errors?.name && (
            <span className="block text-red-600">{state.errors.name[0]}</span>
          )}
        </label>
      )}

      <button
        type="submit"
        disabled={pending || choice === ""}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Joining…" : "Join group"}
      </button>
    </form>
  );
}
