import { NextResponse } from "next/server";
import { REQUIRED_DOCS, STAGES } from "@/domain/project";
import { MAX_UPLOAD_BYTES } from "@/lib/validation";
import { db } from "@/server/db";
import { sniffMimeType } from "@/server/leads";
import { fileStore } from "@/server/storage";
import { newToken } from "@/server/tokens";

export const ALL_DOCS = STAGES.flatMap((stage) => REQUIRED_DOCS[stage]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Shared by the customer and staff upload routes. The route decides who may upload which type. */
export async function storeProjectDocument(projectId: string, request: Request, canUpload: (docType: string) => boolean, uploadedBy: string) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const docType = form?.get("docType");
  if (!(file instanceof File) || typeof docType !== "string") return NextResponse.json({ error: "noFile" }, { status: 400 });
  if (!canUpload(docType)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "tooLarge" }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMimeType(bytes);
  if (!mimeType) return NextResponse.json({ error: "badType" }, { status: 415 });

  const storageKey = `projects/${projectId}/${newToken()}.${EXTENSIONS[mimeType]}`;
  await fileStore.put(storageKey, bytes, mimeType);
  await db.projectDocument.create({
    data: { projectId, docType, fileName: file.name.slice(0, 120), mimeType, storageKey, uploadedBy },
  });
  return NextResponse.json({ ok: true });
}
