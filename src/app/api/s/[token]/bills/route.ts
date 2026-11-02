import { NextResponse, type NextRequest } from "next/server";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation";
import { db } from "@/server/db";
import { sniffMimeType, uploadBill } from "@/server/leads";
import { allowRequest, clientIp } from "@/server/rate-limit";
import { canCheckSavings } from "@/server/savings";

export const maxDuration = 60;

const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/** A bill after solar, read with the same reader as the first bill. */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/s/[token]/bills">) {
  const { token } = await params;
  const project = await db.project.findUnique({ where: { token }, select: { leadId: true, stage: true } });
  if (!project) return fail("notFound", 404);
  if (!canCheckSavings(project.stage)) return fail("tooEarly", 409);
  if (!(await allowRequest(`bill:ip:${await clientIp()}`, 20, 600))) return fail("rateLimited", 429);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("noFile", 400);
  if (file.size > MAX_UPLOAD_BYTES) return fail("tooLarge", 413);

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMimeType(bytes);
  if (!mimeType || !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(mimeType)) return fail("badType", 415);

  const reading = await uploadBill(project.leadId, bytes, mimeType, "AFTER_SOLAR");
  return NextResponse.json({ status: reading.status });
}
