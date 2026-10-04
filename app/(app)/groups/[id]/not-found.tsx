import Link from "next/link";

export default function GroupNotFound() {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Group not found</h1>
      <p className="text-sm text-zinc-500">
        It doesn&apos;t exist, or you&apos;re not a member of it.
      </p>
      <Link href="/dashboard" className="text-sm font-medium underline">
        Back to your groups
      </Link>
    </div>
  );
}
