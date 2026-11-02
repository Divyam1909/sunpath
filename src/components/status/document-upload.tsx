"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation";

interface Props {
  url: string;
  docType: string;
  label: string;
  uploadingLabel: string;
  failedLabel: string;
}

export function DocumentUpload({ url, docType, label, uploadingLabel, failedLabel }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send(file: File) {
    setFailed(false);
    if (file.size > MAX_UPLOAD_BYTES) return setFailed(true);
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("docType", docType);
    const response = await fetch(url, { method: "POST", body: form }).catch(() => null);
    setBusy(false);
    if (response?.ok) router.refresh();
    else setFailed(true);
  }

  return (
    <div className="grid justify-items-end gap-1">
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label={`${label}: ${docType}`}
        data-testid={`doc-file-${docType}`}
        accept={ALLOWED_UPLOAD_TYPES.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) send(file);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
        {busy ? uploadingLabel : label}
      </Button>
      {failed ? <p role="alert" className="max-w-56 text-right text-[0.8125rem] text-destructive">{failedLabel}</p> : null}
    </div>
  );
}
