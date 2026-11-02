import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { uploadBill } from "@/server/leads";
import { allowRequest, clientIp } from "@/server/rate-limit";
import { readBillUpload } from "@/server/uploads";

export const maxDuration = 60;

const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });

export async function POST(request: NextRequest, { params }: RouteContext<"/api/leads/[token]/bill">) {
  const { token } = await params;
  const lead = await db.lead.findUnique({ where: { accessToken: token }, select: { id: true } });
  if (!lead) return fail("notFound", 404);

  const ip = await clientIp();
  const allowed = (await allowRequest(`bill:ip:${ip}`, 20, 600)) && (await allowRequest(`bill:lead:${lead.id}`, 10, 3600));
  if (!allowed) return fail("rateLimited", 429);

  const upload = await readBillUpload(request);
  if (!upload.ok) return fail(upload.error, upload.status);

  const reading = await uploadBill(lead.id, upload.bytes, upload.mimeType);
  return NextResponse.json({ status: reading.status });
}
