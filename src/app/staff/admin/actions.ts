"use server";

import { revalidatePath } from "next/cache";
import { findOverlap, priceRuleSchema, subsidyRuleSchema } from "@/domain/rules";
import { settingsSchema } from "@/domain/settings";
import { db } from "@/server/db";
import { loadRules } from "@/server/estimate";
import { requireAdmin } from "@/server/guards";
import { saveSettings } from "@/server/settings";

const dates = (rule: { effectiveFrom: string; effectiveTo: string | null }) => ({
  effectiveFrom: new Date(rule.effectiveFrom),
  effectiveTo: rule.effectiveTo ? new Date(rule.effectiveTo) : null,
});

const overlapMessage = (name: string, from: string, to: string | null) =>
  `These dates overlap "${name}" (${from} to ${to ?? "open-ended"}). End that rule first, or change these dates.`;

export async function saveSubsidyRule(raw: unknown) {
  await requireAdmin();
  const parsed = subsidyRuleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const rule = parsed.data;
  const { subsidy } = await loadRules();
  const clash = findOverlap(rule, subsidy);
  if (clash) return { ok: false, error: overlapMessage(clash.schemeName, clash.effectiveFrom, clash.effectiveTo) };

  const { id, ...fields } = rule;
  const data = { ...fields, ...dates(rule) };
  if (id) await db.subsidyRule.update({ where: { id }, data });
  else await db.subsidyRule.create({ data });
  revalidatePath("/staff/admin");
  return { ok: true };
}

export async function savePriceRule(raw: unknown) {
  await requireAdmin();
  const parsed = priceRuleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const rule = parsed.data;
  const { price } = await loadRules();
  const clash = findOverlap(rule, price);
  if (clash) return { ok: false, error: overlapMessage(clash.name, clash.effectiveFrom, clash.effectiveTo) };

  const { id, ...fields } = rule;
  const data = { ...fields, ...dates(rule) };
  if (id) await db.priceRule.update({ where: { id }, data });
  else await db.priceRule.create({ data });
  revalidatePath("/staff/admin");
  return { ok: true };
}

export async function saveSettingsAction(raw: unknown) {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the fields: every value needs a number in range." };
  await saveSettings(parsed.data);
  revalidatePath("/staff/admin");
  return { ok: true };
}
