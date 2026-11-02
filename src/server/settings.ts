import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "@/domain/settings";
import { db } from "@/server/db";

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return settingsSchema.parse({ ...DEFAULT_SETTINGS, ...stored });
}

export async function saveSettings(settings: Settings) {
  const parsed = settingsSchema.parse(settings);
  await db.$transaction(
    Object.entries(parsed).map(([key, value]) =>
      db.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
}
