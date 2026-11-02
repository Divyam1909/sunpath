"use client";

import { useState, useTransition } from "react";

export function useSave() {
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (action: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) onDone?.();
    });
  };
  return { result, pending, save };
}

export const Failure = ({ message }: { message?: string }) =>
  message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null;

export const range = (rule: { effectiveFrom: string; effectiveTo: string | null }) => `${rule.effectiveFrom} to ${rule.effectiveTo ?? "open-ended"}`;

export const SEGMENTS = (
  <>
    <option value="RESIDENTIAL">Residential</option>
    <option value="COMMERCIAL">Commercial</option>
  </>
);
export const selectClass = "h-11 w-full rounded-lg border border-input bg-background px-3";
