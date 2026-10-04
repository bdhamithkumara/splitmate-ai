// Single text input + submit button on one line. Presentational only — the
// parent Client Component owns the action state.

type InlineFormProps = {
  action: (formData: FormData) => void;
  pending: boolean;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  errors?: string[];
  submitLabel: string;
  pendingLabel: string;
  hidden?: Record<string, string>;
};

export function InlineForm({
  action,
  pending,
  label,
  placeholder,
  defaultValue,
  errors,
  submitLabel,
  pendingLabel,
  hidden = {},
}: InlineFormProps) {
  return (
    <form action={action} className="space-y-1.5">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor="name" className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id="name"
          name="name"
          placeholder={placeholder}
          defaultValue={defaultValue}
          required
          maxLength={50}
          autoComplete="off"
          aria-invalid={errors ? true : undefined}
          aria-describedby={errors ? "name-error" : undefined}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 aria-invalid:border-red-500 dark:border-zinc-700 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
      {errors && (
        <ul id="name-error" className="space-y-0.5 text-sm text-red-600">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
