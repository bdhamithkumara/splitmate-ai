import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "../form-ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in · SplitMate AI",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="text-sm text-zinc-500">Log in to see your groups.</p>
      </div>
      {error === "auth_callback" && (
        <FormMessage message="That link is invalid or has expired. Please log in again." />
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="text-center text-sm text-zinc-500">
        No account?{" "}
        <Link href="/signup" className="font-medium text-foreground underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
