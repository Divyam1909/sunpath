"use server";

import { z } from "zod";
import { sendStageMessage } from "@/server/projects";
import { recordAdvance } from "@/server/quotes";
import { allowRequest, clientIp } from "@/server/rate-limit";

const input = z.object({ token: z.string().min(16).max(64), kw: z.number().positive().max(1000), locale: z.string().max(5) });

export async function payAdvanceAction(token: string, kw: number, locale: string) {
  const parsed = input.safeParse({ token, kw, locale });
  if (!parsed.success) return { ok: false as const };
  if (!(await allowRequest(`advance:${await clientIp()}`, 20, 600))) return { ok: false as const };
  const result = await recordAdvance(parsed.data.token, parsed.data.kw);
  if (!result) return { ok: false as const };
  if (result.created) await sendStageMessage(result.project.id);
  return { ok: true as const, projectToken: result.project.token };
}
