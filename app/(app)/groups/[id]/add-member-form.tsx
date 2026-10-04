"use client";

import { useActionState } from "react";
import { addMember } from "@/lib/groups/actions";
import { FormMessage } from "@/components/form-ui";
import { InlineForm } from "@/components/inline-form";

export function AddMemberForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState(addMember, undefined);

  return (
    <div className="space-y-3">
      <FormMessage
        message={state?.message}
        tone={state?.success ? "success" : "error"}
      />
      <InlineForm
        action={action}
        pending={pending}
        label="Member name"
        placeholder="Add a member, e.g. Kasun"
        defaultValue={state?.values?.name}
        errors={state?.errors?.name}
        submitLabel="Add"
        pendingLabel="Adding…"
        hidden={{ groupId }}
      />
    </div>
  );
}
