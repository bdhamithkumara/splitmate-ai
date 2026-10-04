import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type GroupMember = {
  id: string;
  name: string;
  user_id: string | null;
};

export type GroupWithMembers = {
  id: string;
  name: string;
  members: GroupMember[];
};

const GROUP_SELECT = "id, name, members(id, name, user_id)";

// No user_id filter on purpose: RLS only returns groups (and members) the
// signed-in user belongs to.
export async function getMyGroups(): Promise<GroupWithMembers[]> {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .order("created_at", { ascending: true })
    .order("name", { referencedTable: "members", ascending: true });

  if (error) {
    console.error("getMyGroups failed:", error);
    throw new Error("Could not load your groups.");
  }

  return (data ?? []) as GroupWithMembers[];
}

// Returns null when the group doesn't exist or the user isn't a member
// (RLS makes the two indistinguishable, which is what we want).
// Memoized so generateMetadata and the page share one query.
export const getGroup = cache(async function getGroup(
  id: string,
): Promise<GroupWithMembers | null> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .eq("id", id)
    .order("name", { referencedTable: "members", ascending: true })
    .maybeSingle();

  if (error) {
    console.error("getGroup failed:", error);
    throw new Error("Could not load this group.");
  }

  return data as GroupWithMembers | null;
});
