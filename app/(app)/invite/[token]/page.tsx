import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { getInvite } from "@/lib/data/invites";
import { JoinForm } from "./join-form";

export const metadata: Metadata = {
  title: "Join group · SplitMate AI",
};

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  // proxy.ts already sent signed-out visitors to /login?next=/invite/<token>
  const [user, invite] = await Promise.all([requireUser(), getInvite(token)]);

  if (!invite) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-xl font-semibold">This invite link doesn&apos;t work</h1>
        <p className="text-sm text-zinc-500">
          It may have been reset. Ask a friend in the group for the new link.
        </p>
        <Link href="/dashboard" className="text-sm font-medium underline">
          Go to your groups
        </Link>
      </div>
    );
  }

  if (invite.already_member) redirect(`/groups/${invite.group_id}`);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1 text-center">
        <p className="text-sm text-zinc-500">You&apos;ve been invited to</p>
        <h1 className="text-2xl font-semibold">{invite.group_name}</h1>
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <JoinForm token={token} members={invite.members} myName={user.name} />
      </section>
    </div>
  );
}
