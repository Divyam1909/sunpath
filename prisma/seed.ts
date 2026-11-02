import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedRules } from "./seed-rules";

config({ path: [".env.local", ".env"] });

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  await seedRules(db);
  const hash = (p: string) => bcrypt.hash(p, 10);
  for (const u of [
    { name: "Sneha Kulkarni", login: "sales@sunpath.demo", password: "sales-demo-1", role: "SALES" as const },
    { name: "Vivek Deshmukh", login: "admin@sunpath.demo", password: "admin-demo-1", role: "ADMIN" as const },
  ]) {
    const passwordHash = await hash(u.password);
    await db.user.upsert({
      where: { login: u.login },
      update: { passwordHash },
      create: { name: u.name, login: u.login, passwordHash, role: u.role },
    });
  }
}

main().finally(() => db.$disconnect());
