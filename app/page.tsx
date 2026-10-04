import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/dal";

export default async function Home() {
  if (await getUser()) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-4 py-24 text-center dark:bg-black">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          SplitMate AI
        </h1>
        <p className="mx-auto max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Turn WhatsApp-style messages like{" "}
          <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
            Uber 1200 Kasun
          </code>{" "}
          into fair, tracked expense splits.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
