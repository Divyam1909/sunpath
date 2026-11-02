import { PriceRules, SettingsForm, SubsidyRules, TariffRules } from "@/components/staff/rule-editors";
import { istDate } from "@/domain/format";
import { loadRules } from "@/server/estimate";
import { requireAdmin } from "@/server/guards";
import { getSettings } from "@/server/settings";

export default async function AdminPage() {
  await requireAdmin();
  const [rules, settings] = await Promise.all([loadRules(), getSettings()]);
  const today = istDate();
  const unverified = rules.subsidy.filter((rule) => rule.verifyBeforeLaunch);

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-xl font-medium">Rules</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Each quote copies the rules it used, so editing here never changes a quote already sent. To change a rule from a date, end the old one and add a new one.
        </p>
      </div>

      {unverified.length > 0 ? (
        <aside data-testid="verify-banner" className="rounded-xl border border-destructive/40 p-5 text-sm leading-relaxed">
          <p className="font-medium">Verify before launch</p>
          <p className="mt-1 max-w-prose">
            The client says the central residential scheme pays ₹30,000 per kW up to 2 kW plus ₹18,000 for the third kW, capped at ₹78,000. Check this against the official scheme, then untick the flag on the rule.
          </p>
        </aside>
      ) : null}

      <section aria-labelledby="subsidy-heading" className="grid gap-3">
        <h2 id="subsidy-heading" className="text-lg font-medium">Subsidy rules</h2>
        <SubsidyRules rules={rules.subsidy} today={today} />
      </section>

      <section aria-labelledby="price-heading" className="grid gap-3">
        <h2 id="price-heading" className="text-lg font-medium">Prices</h2>
        <p className="text-sm text-muted-foreground">These prices are assumptions (A05) until Company A supplies its rate card.</p>
        <PriceRules rules={rules.price} today={today} />
      </section>

      <section aria-labelledby="tariff-heading" className="grid gap-3">
        <h2 id="tariff-heading" className="text-lg font-medium">Electricity tariffs</h2>
        <p className="max-w-prose text-sm text-muted-foreground">The slabs behind each customer&apos;s bill before and after solar. FAC changes monthly, so copy it from a recent bill.</p>
        <TariffRules rules={rules.tariff} today={today} />
      </section>

      <section aria-labelledby="settings-heading" className="grid gap-3">
        <h2 id="settings-heading" className="text-lg font-medium">Settings</h2>
        <SettingsForm settings={settings} />
      </section>
    </div>
  );
}
