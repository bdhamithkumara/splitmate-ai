"use client";

import { useActionState } from "react";
import { createGroup } from "@/lib/groups/actions";
import { FormMessage } from "@/components/form-ui";
import { InlineForm } from "@/components/inline-form";

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroup, undefined);

  return (
    <div className="space-y-3">
      <FormMessage message={state?.message} />
      <InlineForm
        action={action}
        pending={pending}
        label="Group name"
        placeholder="e.g. Annex Boys"
        defaultValue={state?.values?.name}
        errors={state?.errors?.name}
        submitLabel="Create"
        pendingLabel="Creating…"
      />
    </div>
  );
}
