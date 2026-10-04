import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { getGroup } from "@/lib/data/groups";
import { AddExpense } from "./add-expense";
import { AddMemberForm } from "./add-member-form";

export async function generateMetadata({
  params,
}: PageProps<"/groups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const group = await getGroup(id);
  return { title: `${group?.name ?? "Group"} · SplitMate AI` };
}

export default async function GroupPage({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const [user, group] = await Promise.all([requireUser(), getGroup(id)]);

  if (!group) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-foreground"
        >
          ← All groups
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{group.name}</h1>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-xs font-medium tracking-wide text-zinc-500 uppercase">
          Add expense
        </h2>
        <AddExpense
          groupId={group.id}
          members={group.members.map(({ id, name }) => ({ id, name }))}
        />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-xs font-medium tracking-wide text-zinc-500 uppercase">
          Members · {group.members.length}
        </h2>
        <ul className="mb-6 divide-y divide-zinc-100 dark:divide-zinc-900">
          {group.members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>{member.name}</span>
              {member.user_id === user.id ? (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  You
                </span>
              ) : member.user_id === null ? (
                <span className="text-xs text-zinc-400">No account yet</span>
              ) : null}
            </li>
          ))}
        </ul>
        <AddMemberForm groupId={group.id} />
      </section>
    </div>
  );
}
