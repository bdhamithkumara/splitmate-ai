"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";

export type InviteFormState = { message?: string } | undefined;

// 144 bits of randomness, URL-safe.
const newToken = () => randomBytes(18).toString("base64url");

// Creates the group's invite link, or replaces it (old link stops working).
// RLS: only members of the group can do this.
export async function resetInvite(
  _state: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  await requireUser();
  const groupId = z.uuid().safeParse(formData.get("groupId"));
  if (!groupId.success) return { message: "Invalid group." };

  const supabase = await createClient();

  const { error: revokeError } = await supabase
    .from("group_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("group_id", groupId.data)
    .is("revoked_at", null);

  if (revokeError) {
    console.error("resetInvite revoke failed:", revokeError);
    return { message: "Could not create a new link. Please try again." };
  }

  const { error } = await supabase
    .from("group_invites")
    .insert({ group_id: groupId.data, token: newToken() });

  if (error) {
    console.error("resetInvite insert failed:", error);
    return { message: "Could not create a new link. Please try again." };
  }

  revalidatePath(`/groups/${groupId.data}`);
  return undefined;
}

export type AcceptInviteState =
  | { message?: string; errors?: { name?: string[] } }
  | undefined;

const acceptSchema = z.discriminatedUnion("choice", [
  z.object({ token: z.string().min(1), choice: z.literal("member"), memberId: z.uuid() }),
  z.object({
    token: z.string().min(1),
    choice: z.literal("new"),
    name: z
      .string()
      .trim()
      .min(1, { error: "Enter your name." })
      .max(50, { error: "Name must be at most 50 characters." }),
  }),
]);

export async function acceptInvite(
  _state: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  await requireUser();
  const choice = String(formData.get("choice") ?? "");
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    choice: choice === "new" ? "new" : "member",
    memberId: choice === "new" ? undefined : choice,
    name: formData.get("name"),
  });

  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors as { name?: string[] };
    return errors.name
      ? { errors: { name: errors.name } }
      : { message: "Pick your name, or choose “I'm not on the list”." };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("accept_invite", {
    p_token: input.token,
    p_member_id: input.choice === "member" ? input.memberId : null,
    p_new_name: input.choice === "new" ? input.name : null,
  });

  if (error || typeof groupId !== "string") {
    if (error?.code === "SM404") {
      return { message: "This invite link is invalid or has been reset. Ask for a new one." };
    }
    if (error?.code === "SM409") {
      return { message: "Someone already joined as that member. Pick another, or join with a new name." };
    }
    if (error?.code === UNIQUE_VIOLATION) {
      return { errors: { name: ["That name is already used in this group. Pick yours from the list, or add a surname."] } };
    }
    console.error("acceptInvite failed:", error);
    return { message: "Could not join the group. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect(`/groups/${groupId}`);
}
