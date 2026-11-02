"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookSurvey, eraseLeadAction, logCall, recordSurvey } from "@/app/staff/actions";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function useAction() {
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: boolean }>) => {
    setFailed(false);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setFailed(true);
    });
  };
  return { failed, pending, run };
}

const Failure = ({ show }: { show: boolean }) =>
  show ? <p role="alert" className="text-sm text-destructive">That did not save. Check the fields and try again.</p> : null;

export function BookSurveyForm({ leadId }: { leadId: string }) {
  const { failed, pending, run } = useAction();
  const [date, setDate] = useState("");
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => bookSurvey(leadId, date));
      }}
    >
      <Field id="survey-date" label="Survey date">
        <Input id="survey-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Failure show={failed} />
      <Button type="submit" disabled={pending} className="justify-self-start">Book survey</Button>
    </form>
  );
}

export function LogCallForm({ leadId }: { leadId: string }) {
  const { failed, pending, run } = useAction();
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("BOOK_SURVEY");
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => logCall(leadId, { notes, outcome }));
      }}
    >
      <Field id="call-notes" label="What did they say?">
        <Textarea id="call-notes" required value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Field id="call-outcome" label="Outcome">
        <select id="call-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="h-11 rounded-lg border border-input bg-background px-3">
          <option value="BOOK_SURVEY">Worth a survey visit</option>
          <option value="KEEP_OPEN">Call again later</option>
          <option value="CLOSE">Not going ahead: close the lead</option>
        </select>
      </Field>
      <Failure show={failed} />
      <Button type="submit" disabled={pending} className="justify-self-start">Save call</Button>
    </form>
  );
}

export function RecordSurveyForm({ leadId, roofSqFt }: { leadId: string; roofSqFt: number }) {
  const { failed, pending, run } = useAction();
  const [area, setArea] = useState(String(roofSqFt));
  const [shading, setShading] = useState("NONE");
  const [qualified, setQualified] = useState(true);
  const [notes, setNotes] = useState("");
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => recordSurvey(leadId, { roofAreaSqFt: Number(area), shading, qualified, notes }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="survey-area" label="Measured roof area, sq ft">
          <Input id="survey-area" inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value)} />
        </Field>
        <Field id="survey-shading" label="Shading">
          <select id="survey-shading" value={shading} onChange={(e) => setShading(e.target.value)} className="h-11 rounded-lg border border-input bg-background px-3">
            <option value="NONE">None</option>
            <option value="PARTIAL">Partial</option>
            <option value="HEAVY">Heavy</option>
          </select>
        </Field>
      </div>
      <Field id="survey-notes" label="Survey notes">
        <Textarea id="survey-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-4 accent-primary" checked={qualified} onChange={(e) => setQualified(e.target.checked)} />
        This household could genuinely buy (counts toward the qualified-survey metric)
      </label>
      <Failure show={failed} />
      <Button type="submit" disabled={pending} className="justify-self-start">Save survey</Button>
    </form>
  );
}

export function EraseLead({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <section className="grid gap-2 border-t pt-6">
      <h2 className="text-lg font-medium">Erase customer data</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        For a deletion request under the DPDP Act. This permanently removes the lead, bill, quotes, project, documents and messages.
      </p>
      {confirming ? (
        <div className="flex gap-2">
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await eraseLeadAction(leadId);
                router.push("/staff/leads");
              })
            }
          >
            Yes, erase permanently
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Keep</Button>
        </div>
      ) : (
        <Button variant="outline" className="justify-self-start" onClick={() => setConfirming(true)}>Erase customer data</Button>
      )}
    </section>
  );
}
