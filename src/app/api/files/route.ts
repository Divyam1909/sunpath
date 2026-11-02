import { NextResponse, type NextRequest } from "next/server";
import { fileStore, usesDiskStore, verifyDiskSignature } from "@/server/storage";

// Serves the disk adapter's signed URLs in local development. Production uses Blob signed URLs directly.
export async function GET(request: NextRequest) {
  if (!usesDiskStore) return new NextResponse(null, { status: 404 });
  const { searchParams } = request.nextUrl;
  const key = searchParams.get("key") ?? "";
  const expires = Number(searchParams.get("expires"));
  const type = searchParams.get("type") ?? "application/octet-stream";
  if (!verifyDiskSignature(key, expires, searchParams.get("sig") ?? "")) {
    return new NextResponse("Link expired", { status: 403 });
  }
  const bytes = await fileStore.read(key);
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": type, "Cache-Control": "private, no-store" },
  });
}
