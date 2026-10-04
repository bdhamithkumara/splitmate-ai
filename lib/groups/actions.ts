"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  addMemberSchema,
  createGroupSchema,
  type GroupFormState,
} from "./definitions";

const UNIQUE_VIOLATION = "23505";

export async function createGroup(
  _state: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();
  const values = { name: String(formData.get("name") ?? "") };
  const parsed = createGroupSchema.safeParse(values);

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("create_group", {
    group_name: parsed.data.name,
    creator_name: user.name,
  });

  if (error || typeof groupId !== "string") {
    console.error("createGroup failed:", error);
    return { message: "Could not create the group. Please try again.", values };
  }

  revalidatePath("/dashboard");
  redirect(`/groups/${groupId}`);
}

export async function addMember(
  _state: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  await requireUser();
  const values = { name: String(formData.get("name") ?? "") };
  const parsed = addMemberSchema.safeParse({
    groupId: formData.get("groupId"),
    name: values.name,
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { groupId, name } = parsed.data;
  const supabase = await createClient();
  // RLS rejects the insert unless the current user is in this group.
  const { error } = await supabase
    .from("members")
    .insert({ group_id: groupId, name });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        errors: { name: [`${name} is already in this group.`] },
        values,
      };
    }
    console.error("addMember failed:", error);
    return { message: "Could not add the member. Please try again.", values };
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  return { success: true, message: `Added ${name}.` };
}
