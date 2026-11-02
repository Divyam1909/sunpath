"use client";

import { Button } from "@/components/ui/button";

export default function StaffError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl bg-muted px-6 py-12 text-center">
      <p className="font-medium">This page did not load</p>
      <p className="mt-1 text-sm text-muted-foreground">No data was changed. Try again, and check your connection if it keeps failing.</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
