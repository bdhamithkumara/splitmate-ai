import "server-only";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// The group's current invite token, if one was created. RLS: members only.
export async function getActiveInviteToken(groupId: string): Promise<string | null> {
  await requireUser();
  if (!z.uuid().safeParse(groupId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_invites")
    .select("token")
    .eq("group_id", groupId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("getActiveInviteToken failed:", error);
    return null;
  }
  return data?.token ?? null;
}

export type InviteDetails = {
  group_id: string;
  group_name: string;
  already_member: boolean;
  members: { id: string; name: string; claimed: boolean }[];
};

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

// What the invite page shows. Works for non-members (get_invite RPC);
// returns null for an unknown or reset link.
export async function getInvite(token: string): Promise<InviteDetails | null> {
  await requireUser();
  if (!tokenSchema.safeParse(token).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invite", { p_token: token });

  if (error) {
    console.error("getInvite failed:", error);
    throw new Error("Could not load this invite.");
  }
  return (data as InviteDetails | null) ?? null;
}
