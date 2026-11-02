import { cn } from "@/lib/utils";

export const LEAD_STAGE_LABELS: Record<string, string> = {
  NEW: "Waiting for bill",
  SCORED: "Scored",
  SURVEY_BOOKED: "Survey booked",
  SURVEYED: "Surveyed",
  QUOTED: "Quoted",
  WON: "Won",
  CLOSED: "Closed",
};

export const STAGE_LABELS: Record<string, string> = {
  ADVANCE_RECEIVED: "Advance received",
  DOCUMENTS: "Documents",
  INSTALLATION_SCHEDULED: "Installation scheduled",
  INSTALLED: "Installed",
  NET_METERING_APPLIED: "Net metering applied",
  NET_METER_INSTALLED: "Net meter installed",
  SUBSIDY_APPLIED: "Subsidy applied",
  SUBSIDY_CREDITED: "Subsidy credited",
};

export const DOC_LABELS: Record<string, string> = {
  ID_PROOF: "ID proof",
  PROPERTY_PROOF: "Property papers",
  BANK_DETAILS: "Cancelled cheque or passbook",
  SITE_LAYOUT: "Site layout",
  INSTALLATION_PHOTOS: "Installation photos",
  COMMISSIONING_REPORT: "Commissioning report",
  NET_METER_APPLICATION: "Net-meter application",
  NET_METER_CERTIFICATE: "Net-meter certificate",
  SUBSIDY_APPLICATION: "Subsidy application",
};

const SCORE_STYLES: Record<string, string> = {
  HIGH: "bg-primary text-primary-foreground",
  MEDIUM: "bg-teal-tint text-primary",
  LOW: "bg-muted text-muted-foreground",
};

const SCORE_LABELS: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export function ScoreBadge({ score }: { score: string | null }) {
  if (!score) return <span className="text-muted-foreground">-</span>;
  return (
    <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-[0.8125rem] font-medium", SCORE_STYLES[score])}>{SCORE_LABELS[score]}</span>
  );
}
