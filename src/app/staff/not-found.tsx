import Link from "next/link";

export default function StaffNotFound() {
  return (
    <div className="rounded-xl bg-muted px-6 py-12 text-center">
      <p className="font-medium">That record doesn&apos;t exist</p>
      <Link href="/staff/leads" className="mt-1 inline-block text-sm text-primary underline underline-offset-4">Back to leads</Link>
    </div>
  );
}
