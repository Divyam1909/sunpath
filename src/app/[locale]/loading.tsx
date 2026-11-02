import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-20 sm:px-6" aria-hidden>
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="mt-4 h-5 w-full" />
      <Skeleton className="mt-2 h-5 w-2/3" />
      <Skeleton className="mt-10 h-40 w-full rounded-xl" />
      <Skeleton className="mt-4 h-12 w-full" />
    </div>
  );
}
