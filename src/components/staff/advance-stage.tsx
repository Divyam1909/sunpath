"use client";

import { useState, useTransition } from "react";
import { advanceProjectStage } from "@/app/staff/actions";
import { DOC_LABELS } from "@/components/staff/labels";
import { Button } from "@/components/ui/button";

export function AdvanceStage({ projectId, nextLabel }: { projectId: string; nextLabel: string }) {
  const [missing, setMissing] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await advanceProjectStage(projectId);
            setMissing(result.ok ? [] : result.missing);
          })
        }
        className="justify-self-start"
      >
        {pending ? "Moving" : `Move to ${nextLabel}`}
      </Button>
      {missing.length > 0 ? (
        <p role="alert" className="text-sm text-destructive">
          Still needed first: {missing.map((type) => DOC_LABELS[type]).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
