import { createTranslator } from "next-intl";
import { db } from "@/server/db";
import { routing, type Locale } from "@/i18n/routing";

type Db = Pick<typeof db, "messageOutbox">;

export interface OutboxRequest {
  lead: { id: string; phone: string; name: string; locale: string };
  projectId?: string;
  template: string;
  values?: Record<string, string | number>;
}

function localeOf(value: string): Locale {
  return (routing.locales as readonly string[]).includes(value) ? (value as Locale) : routing.defaultLocale;
}

/** A27: renders the message in the customer's language and records it. The row is the mock delivery. */
export async function queueMessage(request: OutboxRequest, client: Db = db) {
  const { lead, projectId, template, values } = request;
  const locale = localeOf(lead.locale);
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "outbox" });
  const firstName = lead.name.split(" ")[0];
  const body = (t as unknown as (key: string, v: object) => string)(template, { name: firstName, ...values });
  return client.messageOutbox.create({
    data: { leadId: lead.id, projectId, toPhone: lead.phone, locale, templateKey: template, body },
  });
}
