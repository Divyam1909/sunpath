import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6" aria-hidden>
      <div className="grid gap-6 sm:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-10 w-1/3" />
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <Skeleton key={row} className="h-12" />
      ))}
    </div>
  );
}
