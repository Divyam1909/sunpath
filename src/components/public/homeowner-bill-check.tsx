"use client";

import { useLocale } from "next-intl";
import { confirmBillAction } from "@/app/[locale]/actions";
import { BillCheckForm } from "@/components/public/bill-check-form";
import type { ConfirmedBill } from "@/domain/bill";
import { useRouter } from "@/i18n/navigation";

export function HomeownerBillCheck(props: { token: string; initial: ConfirmedBill; lowConfidence: string[] }) {
  const { token, initial, lowConfidence } = props;
  const router = useRouter();
  const locale = useLocale();
  return (
    <BillCheckForm
      initial={initial}
      lowConfidence={lowConfidence}
      onConfirm={async (bill) => {
        const result = await confirmBillAction(token, bill, locale);
        if (result.ok) router.push(`/l/${token}/result`);
        return result;
      }}
    />
  );
}
