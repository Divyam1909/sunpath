import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: [".env.local", ".env"], quiet: true });

function migrationUrl() {
  // Migrations need a direct (unpooled) connection on Neon. `prisma generate` needs no URL.
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) return "";
  // Neon's free tier suspends when idle, and waking it can outlast the default 5-second timeout.
  const parsed = new URL(url);
  parsed.searchParams.set("connect_timeout", "30");
  return parsed.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed/index.ts" },
  datasource: { url: migrationUrl() },
});
