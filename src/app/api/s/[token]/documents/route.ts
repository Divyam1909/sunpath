import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { ALL_DOCS, storeProjectDocument } from "@/server/documents";
import { allowRequest, clientIp } from "@/server/rate-limit";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/s/[token]/documents">) {
  const { token } = await params;
  const project = await db.project.findUnique({ where: { token }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "notFound" }, { status: 404 });
  if (!(await allowRequest(`docs:${await clientIp()}`, 20, 600))) return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  const customerTypes = new Set(ALL_DOCS.filter((doc) => doc.byCustomer).map((doc) => doc.type));
  return storeProjectDocument(project.id, request, (type) => customerTypes.has(type), "CUSTOMER");
}
