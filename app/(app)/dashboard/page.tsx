import type { Metadata } from "next";
import Link from "next/link";
import { getMyGroups } from "@/lib/data/groups";
import { CreateGroupForm } from "./create-group-form";

export const metadata: Metadata = {
  title: "Dashboard · SplitMate AI",
};

export default async function DashboardPage() {
  const groups = await getMyGroups();

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-medium">Create a group</h2>
        <CreateGroupForm />
      </section>

      <section>
        <h1 className="mb-4 text-2xl font-semibold">Groups</h1>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            You&apos;re not in any groups yet. Create one above.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="block h-full rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
