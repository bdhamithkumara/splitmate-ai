import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/definitions";
import { createClient } from "@/lib/supabase/server";

// Landing point for email confirmation links and (later) OAuth providers.
// Exchanges the one-time PKCE code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", origin));
}
