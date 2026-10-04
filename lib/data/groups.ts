import "server-only";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type GroupMember = {
  id: string;
  name: string;
};

export type GroupWithMembers = {
  id: string;
  name: string;
  members: GroupMember[];
};

// No user_id filter on purpose: RLS only returns groups (and members) the
// signed-in user belongs to.
export async function getMyGroups(): Promise<GroupWithMembers[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groups")
    .select("id, name, members(id, name)")
    .order("created_at", { ascending: true })
    .order("name", { referencedTable: "members", ascending: true });

  if (error) {
    console.error("getMyGroups failed:", error);
    throw new Error("Could not load your groups.");
  }

  return (data ?? []) as GroupWithMembers[];
}
