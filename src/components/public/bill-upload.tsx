"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, CircleCheck, LoaderCircle, Plus, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { assessPhoto, photoStats, type PhotoIssue } from "@/lib/photo-check";
import { SAMPLE_BILLS } from "@/lib/sample-bills";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation";

const COMPRESS_ABOVE_BYTES = 1_200_000;
const MAX_IMAGE_EDGE = 2000;
const CHECK_EDGE = 900;

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

/** Looks at the photo before anything is sent, so a retake costs a moment and no data. */
async function checkPhoto(file: File): Promise<PhotoIssue[]> {
  if (!file.type.startsWith("image/")) return [];
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, CHECK_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    return assessPhoto(photoStats(data, canvas.width, canvas.height), bitmap);
  } catch {
    return [];
  }
}

/** Joins the two sides of a bill into one image, as the charges and arrears are usually on the back. */
async function joinSides(front: File, back: File) {
  const [top, bottom] = await Promise.all([createImageBitmap(front), createImageBitmap(back)]);
  const width = Math.min(Math.max(top.width, bottom.width), 1500);
  const heights = [top, bottom].map((image) => Math.round((image.height * width) / image.width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = heights[0] + heights[1];
  const context = canvas.getContext("2d")!;
  context.drawImage(top, 0, 0, width, heights[0]);
  context.drawImage(bottom, 0, heights[0], width, heights[1]);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  return blob ? new File([blob], "bill.jpg", { type: "image/jpeg" }) : front;
}

const KNOWN_ERRORS = ["tooLarge", "badType", "rateLimited"] as const;
type UploadError = (typeof KNOWN_ERRORS)[number] | "failed";

interface Picked {
  file: File;
  url: string;
  issues: PhotoIssue[];
}

interface Props {
  /** Where the file is posted. */
  url: string;
  /** Where to go after a successful read. */
  next: string;
  manualHref?: string;
  samples?: readonly { file: string; label: string }[];
}

export function BillUpload({ url, next, manualHref, samples = SAMPLE_BILLS.filter((s) => s.file !== "after-solar-bill.jpg") }: Props) {
  const t = useTranslations("upload");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);
  const [front, setFront] = useState<Picked | null>(null);
  const [back, setBack] = useState<Picked | null>(null);

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
      const response = await fetch(url, { method: "POST", body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: UploadError };
        setError(KNOWN_ERRORS.find((e) => e === body.error) ?? "failed");
        return setBusy(false);
      }
      router.push(next);
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

  async function pick(file: File, side: "front" | "back") {
    setError(null);
    // A PDF already has every page, so there is nothing to check or add.
    if (file.type === "application/pdf") return send(file);
    const picked = { file, url: URL.createObjectURL(file), issues: await checkPhoto(file) };
    if (side === "front") setFront(picked);
    else setBack(picked);
  }

  async function sendPicked() {
    if (!front) return;
    setBusy(true);
    const file = back ? await joinSides(front.file, back.file).catch(() => front.file) : front.file;
    await send(file);
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

  const issues = [...new Set([...(front?.issues ?? []), ...(back?.issues ?? [])])];

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
          if (file) pick(file, "front");
        }}
      />
      <input
        ref={backInput}
        type="file"
        data-testid="bill-back-file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("addBack")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) pick(file, "back");
        }}
      />

      {front ? (
        <section data-testid="photo-review" className="grid gap-4 rounded-xl border p-4">
          <div className="grid grid-cols-2 gap-3">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview that never leaves the browser */}
              <img src={front.url} alt={t("frontPreview")} className="aspect-[3/4] w-full rounded-lg bg-muted object-cover" />
              <figcaption className="mt-1 text-sm text-muted-foreground">{t("frontPreview")}</figcaption>
            </figure>
            {back ? (
              <figure className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview that never leaves the browser */}
                <img src={back.url} alt={t("backPreview")} className="aspect-[3/4] w-full rounded-lg bg-muted object-cover" />
                <Button type="button" variant="outline" size="icon" aria-label={t("removeBack")} className="absolute top-2 right-2" onClick={() => setBack(null)}>
                  <X aria-hidden />
                </Button>
                <figcaption className="mt-1 text-sm text-muted-foreground">{t("backPreview")}</figcaption>
              </figure>
            ) : (
              <button
                type="button"
                onClick={() => backInput.current?.click()}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-center text-sm font-medium text-primary hover:border-primary"
              >
                <Plus aria-hidden className="size-5" />
                {t("addBack")}
                <span className="font-normal text-muted-foreground">{t("addBackHint")}</span>
              </button>
            )}
          </div>

          {issues.length > 0 ? (
            <div data-testid="photo-issues" className="grid gap-1.5 rounded-lg bg-muted p-3 text-sm">
              {issues.map((issue) => (
                <p key={issue} className="flex gap-2 leading-relaxed">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {t(`issue.${issue}`)}
                </p>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-primary">
              <CircleCheck aria-hidden className="size-4" />
              {t("photoGood")}
            </p>
          )}

          <div className="grid gap-2">
            <Button size="lg" onClick={sendPicked}>{issues.length > 0 ? t("useAnyway") : t("readNow")}</Button>
            <Button variant="outline" onClick={() => input.current?.click()}>{t("retake")}</Button>
          </div>
        </section>
      ) : (
        <>
          <Button size="lg" onClick={() => input.current?.click()}>
            <Camera aria-hidden />
            {t("choose")}
          </Button>
          <p className="-mt-2 text-center text-[0.8125rem] text-muted-foreground">{t("formats")}</p>
        </>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}

      {manualHref ? (
        <Link href={manualHref} className="py-1 text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t("manual")}
        </Link>
      ) : null}

      {samples.length > 0 ? (
        <section className="mt-6 border-t pt-6">
          <h2 className="text-sm font-medium">{t("samplesTitle")}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {samples.map((sample) => (
              <li key={sample.file}>
                <button
                  type="button"
                  onClick={() => sendSample(sample.file)}
                  className="w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground/40"
                >
                  {t(`samples.${sample.file.replace(".jpg", "")}` as "samples.blurry-photo")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
