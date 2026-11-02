import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { uploadBill } from "@/server/leads";
import { allowRequest, clientIp } from "@/server/rate-limit";
import { canCheckSavings } from "@/server/savings";
import { readBillUpload } from "@/server/uploads";

export const maxDuration = 60;

const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/** A bill after solar, read with the same reader as the first bill. */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/s/[token]/bills">) {
  const { token } = await params;
  const project = await db.project.findUnique({ where: { token }, select: { leadId: true, stage: true } });
  if (!project) return fail("notFound", 404);
  if (!canCheckSavings(project.stage)) return fail("tooEarly", 409);
  if (!(await allowRequest(`bill:ip:${await clientIp()}`, 20, 600))) return fail("rateLimited", 429);

  const upload = await readBillUpload(request);
  if (!upload.ok) return fail(upload.error, upload.status);

  const reading = await uploadBill(project.leadId, upload.bytes, upload.mimeType, "AFTER_SOLAR");
  return NextResponse.json({ status: reading.status });
}
