import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, issueSignedToken, presignUrl, put } from "@vercel/blob";

/** Short-lived on purpose: bills and documents are personal data. */
const SIGNED_URL_TTL_SECONDS = 300;

export interface FileStore {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  signedUrl(key: string, contentType: string): Promise<string>;
}

/** Private Vercel Blob store. Nothing here is reachable without a signed URL. */
class BlobFileStore implements FileStore {
  async put(key: string, bytes: Buffer, contentType: string) {
    await put(key, bytes, { access: "private", contentType, addRandomSuffix: false });
  }

  async read(key: string) {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) throw new Error(`Blob not found: ${key}`);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  async signedUrl(key: string) {
    const validUntil = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
    const token = await issueSignedToken({ pathname: key, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(token, { operation: "get", pathname: key, access: "private", validUntil });
    return presignedUrl;
  }
}

const diskRoot = path.resolve(".data/uploads");

function signature(key: string, expires: number) {
  const secret = process.env.FILE_SIGNING_SECRET;
  if (!secret) throw new Error("FILE_SIGNING_SECRET is not set");
  return createHmac("sha256", secret).update(`${key}.${expires}`).digest("hex");
}

/** Local development stand-in with the same contract: files under .data, served by /api/files with HMAC URLs. */
class DiskFileStore implements FileStore {
  private resolve(key: string) {
    const full = path.resolve(diskRoot, key);
    if (!full.startsWith(diskRoot + path.sep)) throw new Error("Bad storage key");
    return full;
  }

  async put(key: string, bytes: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }

  read(key: string) {
    return readFile(this.resolve(key));
  }

  async signedUrl(key: string, contentType: string) {
    const expires = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
    const query = new URLSearchParams({ key, expires: String(expires), type: contentType, sig: signature(key, expires) });
    return `/api/files?${query}`;
  }
}

export function verifyDiskSignature(key: string, expires: number, sig: string) {
  if (Date.now() > expires) return false;
  const expected = Buffer.from(signature(key, expires));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const fileStore: FileStore = process.env.BLOB_READ_WRITE_TOKEN ? new BlobFileStore() : new DiskFileStore();
export const usesDiskStore = !process.env.BLOB_READ_WRITE_TOKEN;
