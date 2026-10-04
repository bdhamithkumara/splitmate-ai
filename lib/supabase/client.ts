import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// For Client Components only (e.g. a future "Continue with Google" button).
export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key);
}
