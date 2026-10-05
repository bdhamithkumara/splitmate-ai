"use client";

import { useActionState } from "react";
import { signup } from "@/lib/auth/actions";
import { Field, FormMessage, SubmitButton } from "@/components/form-ui";

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signup, undefined);

  if (state?.success) {
    return <FormMessage tone="success" message={state.message} />;
  }

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage message={state?.message} />
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        defaultValue={state?.values?.name}
        errors={state?.errors?.name}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state?.values?.email}
        errors={state?.errors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        errors={state?.errors?.password}
      />
      <SubmitButton pending={pending}>
        {pending ? "Creating account…" : "Create account"}
      </SubmitButton>
    </form>
  );
}
