import { z } from "zod";
import { locales } from "@/i18n/routing";

export const OWNERSHIPS = ["OWNER", "TENANT"] as const;
export const ROOF_TYPES = ["RCC_FLAT", "METAL_SHEET", "TILED", "OTHER"] as const;

export const SQM_PER_SQFT = 0.092903;

// Shared by the lead form and the server action. Messages are keys into the `errors` translations.
export const leadInputSchema = z.object({
  ownership: z.enum(OWNERSHIPS, { error: "choose" }),
  roofType: z.enum(ROOF_TYPES, { error: "choose" }),
  roofAreaSqFt: z.coerce.number({ error: "roofArea" }).int("roofArea").min(50, "roofArea").max(100000, "roofArea"),
  monthlyBill: z.coerce.number({ error: "monthlyBill" }).int("monthlyBill").min(100, "monthlyBill").max(1000000, "monthlyBill"),
  pincode: z.string({ error: "pincode" }).trim().regex(/^[1-9]\d{5}$/, "pincode"),
  name: z.string({ error: "name" }).trim().min(2, "name").max(80, "name"),
  phone: z.string({ error: "phone" }).trim().regex(/^[6-9]\d{9}$/, "phone"),
  consent: z.literal(true, { error: "consent" }),
  locale: z.enum(locales),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export const CONSENT_VERSION = "2026-11-v1";
export const CONSENT_PURPOSE =
  "Company A uses your name, phone, address details and electricity bill to check if solar suits your home, " +
  "prepare your quote, and update you on your project.";

// Upload limits. Vercel rejects request bodies over 4.5 MB; the browser compresses photos first.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
