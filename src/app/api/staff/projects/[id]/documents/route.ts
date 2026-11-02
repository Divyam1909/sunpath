import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { ALL_DOCS, storeProjectDocument } from "@/server/documents";
import { AuthError, requireStaff } from "@/server/guards";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/staff/projects/[id]/documents">) {
  let userId: string;
  try {
    userId = (await requireStaff()).id;
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const types = new Set(ALL_DOCS.map((doc) => doc.type));
  return storeProjectDocument(project.id, request, (type) => types.has(type), userId);
}
