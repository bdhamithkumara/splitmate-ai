import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up · SplitMate AI",
};

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-sm text-zinc-500">
          Split dinners, groceries and rides with your friends.
        </p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
