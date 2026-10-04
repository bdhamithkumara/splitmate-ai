// Presentational pieces shared by the login and signup forms.

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  errors?: string[];
};

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  errors,
}: FieldProps) {
  const errorId = `${name}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 aria-invalid:border-red-500 dark:border-zinc-700 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
      />
      {errors && (
        <ul id={errorId} className="space-y-0.5 text-sm text-red-600">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {children}
    </button>
  );
}

export function FormMessage({
  message,
  tone = "error",
}: {
  message?: string;
  tone?: "error" | "success";
}) {
  if (!message) return null;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          : "rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300"
      }
    >
      {message}
    </p>
  );
}
