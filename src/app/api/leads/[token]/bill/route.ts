import { NextResponse, type NextRequest } from "next/server";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation";
import { db } from "@/server/db";
import { sniffMimeType, uploadBill } from "@/server/leads";
import { allowRequest, clientIp } from "@/server/rate-limit";

export const maxDuration = 60;

const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });

export async function POST(request: NextRequest, { params }: RouteContext<"/api/leads/[token]/bill">) {
  const { token } = await params;
  const lead = await db.lead.findUnique({ where: { accessToken: token }, select: { id: true } });
  if (!lead) return fail("notFound", 404);

  const ip = await clientIp();
  const allowed = (await allowRequest(`bill:ip:${ip}`, 20, 600)) && (await allowRequest(`bill:lead:${lead.id}`, 10, 3600));
  if (!allowed) return fail("rateLimited", 429);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("noFile", 400);
  if (file.size > MAX_UPLOAD_BYTES) return fail("tooLarge", 413);

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMimeType(bytes);
  if (!mimeType || !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(mimeType)) return fail("badType", 415);

  const reading = await uploadBill(lead.id, bytes, mimeType);
  return NextResponse.json({ status: reading.status });
}
