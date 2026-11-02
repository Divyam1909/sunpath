import { headers } from "next/headers";
import { db } from "@/server/db";

/** Fixed-window limiter in Postgres, so it holds across serverless instances. */
export async function allowRequest(key: string, limit: number, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const row = await db.rateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    update: { count: { increment: 1 } },
    create: { key, windowStart },
  });
  // Opportunistic cleanup: about 1% of calls clear rows older than a day.
  if (Math.random() < 0.01) {
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } } });
  }
  return row.count <= limit;
}

export async function clientIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
