"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { confirmedBillSchema } from "@/domain/bill";
import { routing } from "@/i18n/routing";
import { leadInputSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { confirmBill, latestBill } from "@/server/leads";
import { allowRequest, clientIp } from "@/server/rate-limit";
import { createLead } from "@/server/leads";

export async function submitLead(raw: unknown) {
  const ip = await clientIp();
  if (!(await allowRequest(`lead:${ip}`, 10, 600))) return { ok: false as const, error: "tooMany" as const };
  const parsed = leadInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "failed" as const };
  const lead = await createLead(parsed.data);
  return { ok: true as const, token: lead.accessToken };
}

export async function confirmBillAction(token: string, raw: unknown, locale: string) {
  const lead = await db.lead.findUnique({ where: { accessToken: token } });
  if (!lead) return { ok: false as const };
  const parsed = confirmedBillSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const };
  const reading = await latestBill(lead.id);
  if ((routing.locales as readonly string[]).includes(locale) && locale !== lead.locale) {
    await db.lead.update({ where: { id: lead.id }, data: { locale } });
  }
  await confirmBill(lead.id, reading?.id ?? null, parsed.data, "HOMEOWNER");
  return { ok: true as const };
}

export async function saveAccess(token: string, password: unknown) {
  const parsedPassword = z.string().min(8).max(200).safeParse(password);
  if (!parsedPassword.success) return { ok: false as const, error: "saveFailed" as const };
  const ip = await clientIp();
  if (!(await allowRequest(`account:${ip}`, 10, 3600))) return { ok: false as const, error: "saveFailed" as const };

  const lead = await db.lead.findUnique({ where: { accessToken: token } });
  if (!lead) return { ok: false as const, error: "saveFailed" as const };
  const existing = await db.user.findUnique({ where: { login: lead.phone } });
  // Never link a lead to an account on the strength of a phone number alone: the phone is unverified.
  if (existing) return { ok: false as const, error: "alreadySaved" as const };

  const passwordHash = await bcrypt.hash(parsedPassword.data, 10);
  const user = await db.user.create({
    data: { name: lead.name, login: lead.phone, passwordHash, role: "HOMEOWNER" },
  });
  await db.lead.update({ where: { id: lead.id }, data: { userId: user.id } });
  revalidatePath("/[locale]/l/[token]/result", "page");
  return { ok: true as const };
}

export async function loginAction(raw: { login: string; password: string; next?: string }, locale: string) {
  const ip = await clientIp();
  if (!(await allowRequest(`login:${ip}`, 20, 600))) return { ok: false as const };
  try {
    await signIn("credentials", { login: raw.login, password: raw.password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false as const };
    throw error;
  }
  const account = await db.user.findUnique({ where: { login: raw.login.trim().toLowerCase() }, select: { role: true } });
  const home = account?.role === "HOMEOWNER" ? `/${locale}/my` : "/staff/leads";
  // Only same-site paths are honoured, so a crafted ?next= cannot send people elsewhere.
  const next = raw.next && /^\/(?![/\\])/.test(raw.next) ? raw.next : home;
  return { ok: true as const, next };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
