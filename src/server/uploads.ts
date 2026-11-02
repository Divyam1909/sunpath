import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation";

export const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Trusts the file's bytes, not the name or the browser's claimed type. */
export function sniffMimeType(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

export type BillUpload = { ok: true; bytes: Buffer; mimeType: string } | { ok: false; error: string; status: number };

/** Reads and checks the file on a bill upload. Both bill routes share these limits. */
export async function readBillUpload(request: Request): Promise<BillUpload> {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return { ok: false, error: "noFile", status: 400 };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooLarge", status: 413 };

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMimeType(bytes);
  if (!mimeType || !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(mimeType)) return { ok: false, error: "badType", status: 415 };
  return { ok: true, bytes, mimeType };
}
