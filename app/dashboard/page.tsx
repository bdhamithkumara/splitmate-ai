import type { Metadata } from "next";
import { logout } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/dal";
import { getMyGroups } from "@/lib/data/groups";

export const metadata: Metadata = {
  title: "Dashboard · SplitMate AI",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const groups = await getMyGroups();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">
            SplitMate AI
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-500 sm:inline">
              {user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Groups</h1>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            You&apos;re not in any groups yet.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <li
                key={group.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <p className="mt-4 mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Members
                </p>
                <ul className="space-y-1 text-sm">
                  {group.members.map((member) => (
                    <li key={member.id}>{member.name}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
