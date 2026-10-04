"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";
import { Field, FormMessage, SubmitButton } from "@/components/form-ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage message={state?.message} />
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
        autoComplete="current-password"
        errors={state?.errors?.password}
      />
      <SubmitButton pending={pending}>
        {pending ? "Logging in…" : "Log in"}
      </SubmitButton>
    </form>
  );
}
