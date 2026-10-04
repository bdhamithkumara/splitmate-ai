import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email: string | undefined;
  name: string;
};

// Verified on the server (JWT signature checked by getClaims), memoized per request.
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) return null;

  const { sub, email, user_metadata } = data.claims;
  const displayName =
    typeof user_metadata?.display_name === "string"
      ? user_metadata.display_name.trim()
      : "";

  return {
    id: sub,
    email,
    name: displayName || email?.split("@")[0] || "Me",
  };
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
