import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLastImportAt } from "@/lib/data/expenses";
import { getGroup } from "@/lib/data/groups";
import { ChatImporter } from "./chat-importer";

export const metadata: Metadata = {
  title: "Import WhatsApp chat · SplitMate AI",
};

export default async function ImportPage({
  params,
}: PageProps<"/groups/[id]/import">) {
  const { id } = await params;
  const [group, lastImportAt] = await Promise.all([
    getGroup(id),
    getLastImportAt(id),
  ]);

  if (!group) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/groups/${group.id}`}
          className="text-sm text-zinc-500 hover:text-foreground"
        >
          ← {group.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Import WhatsApp chat</h1>
        <p className="mt-1 text-sm text-zinc-500">
          In WhatsApp: open the group → ⋮ / group name → More → Export chat →
          Without media. Then upload the .zip or .txt here. The chat is read in
          your browser; only the expenses you import are saved.
        </p>
      </div>

      <ChatImporter
        groupId={group.id}
        members={group.members.map(({ id, name }) => ({ id, name }))}
        lastImportAt={lastImportAt}
      />
    </div>
  );
}
