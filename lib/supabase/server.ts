import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

// For Server Components, Server Actions and Route Handlers.
// Create a new client per request — never share one across requests.
export async function createClient() {
  // Read cookies first: it marks the route as dynamic before anything can throw.
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't write cookies. Safe to ignore: proxy.ts
          // refreshes the session on every request.
        }
      },
    },
  });
}
