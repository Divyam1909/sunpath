"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { SAMPLE_BILLS } from "@/lib/sample-bills";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation";

const COMPRESS_ABOVE_BYTES = 1_200_000;
const MAX_IMAGE_EDGE = 2000;

/** Phone photos run to many MB. Shrinks them in the browser so uploads stay quick on mobile data. */
async function compressImage(file: File) {
  if (!file.type.startsWith("image/") || file.size <= COMPRESS_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? new File([blob], "bill.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

const KNOWN_ERRORS = ["tooLarge", "badType", "rateLimited"] as const;
type UploadError = (typeof KNOWN_ERRORS)[number] | "failed";

export function BillUpload({ token }: { token: string }) {
  const t = useTranslations("upload");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);

  async function send(file: File) {
    setError(null);
    setBusy(true);
    try {
      const prepared = await compressImage(file);
      if (prepared.size > MAX_UPLOAD_BYTES) {
        setError("tooLarge");
        return setBusy(false);
      }
      const form = new FormData();
      form.set("file", prepared);
      const response = await fetch(`/api/leads/${token}/bill`, { method: "POST", body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: UploadError };
        setError(KNOWN_ERRORS.find((e) => e === body.error) ?? "failed");
        return setBusy(false);
      }
      router.push(`/l/${token}/check`);
    } catch {
      setError("failed");
      setBusy(false);
    }
  }

  async function sendSample(fileName: string) {
    setBusy(true);
    const blob = await fetch(`/samples/${fileName}`).then((r) => r.blob());
    await send(new File([blob], fileName, { type: "image/jpeg" }));
  }

  if (busy) {
    return (
      <div role="status" className="grid place-items-center gap-3 rounded-xl bg-muted px-6 py-16 text-center">
        <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden />
        <p className="font-medium">{t("reading")}</p>
        <p className="text-sm text-muted-foreground">{t("readingHint")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <input
        ref={input}
        type="file"
        data-testid="bill-file"
        accept={ALLOWED_UPLOAD_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label={t("choose")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) send(file);
        }}
      />
      <Button size="lg" onClick={() => input.current?.click()}>
        <Camera aria-hidden />
        {t("choose")}
      </Button>
      <p className="-mt-2 text-center text-[0.8125rem] text-muted-foreground">{t("formats")}</p>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}

      <Link href={`/l/${token}/check?manual=1`} className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
        {t("manual")}
      </Link>

      <section className="mt-6 border-t pt-6">
        <h2 className="text-sm font-medium">{t("samplesTitle")}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {SAMPLE_BILLS.map((sample) => (
            <li key={sample.file}>
              <button
                type="button"
                onClick={() => sendSample(sample.file)}
                className="w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground/40"
              >
                {sample.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
