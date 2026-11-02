"use client";

import { NextIntlClientProvider } from "next-intl";
import { confirmBillAsStaff } from "@/app/staff/actions";
import { BillCheckForm } from "@/components/public/bill-check-form";
import type { ConfirmedBill } from "@/domain/bill";

interface Props {
  leadId: string;
  initial: ConfirmedBill;
  lowConfidence: string[];
  messages: Record<string, unknown>;
}

export function StaffBillCheck({ leadId, initial, lowConfidence, messages }: Props) {
  return (
    <NextIntlClientProvider locale="en" messages={messages as never} timeZone="Asia/Kolkata">
      <BillCheckForm
        initial={initial}
        lowConfidence={lowConfidence}
        submitLabel="Save values and rescore"
        onConfirm={(bill) => confirmBillAsStaff(leadId, bill)}
      />
    </NextIntlClientProvider>
  );
}
