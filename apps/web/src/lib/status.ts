import type { FeedbackStatus } from "@feedbackport/core";
import { UI_COPY, type Locale } from "@/lib/ui-copy";

const STATUS_COPY: Record<FeedbackStatus, keyof (typeof UI_COPY)["en"]> = {
  open: "statusOpen",
  planned: "statusPlanned",
  in_progress: "statusInProgress",
  done: "statusDone",
  declined: "statusDeclined",
};

export const STATUS_BADGE_CLASSES: Record<FeedbackStatus, string> = {
  open: "bg-slate-100 text-slate-600",
  planned: "bg-violet-50 text-violet-700",
  in_progress: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
  declined: "bg-rose-50 text-rose-700",
};

export function statusLabel(status: string, locale: Locale = "en"): string {
  const key = STATUS_COPY[status as FeedbackStatus];
  return key ? UI_COPY[locale][key] : status;
}

export function statusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status as FeedbackStatus] ?? STATUS_BADGE_CLASSES.open;
}
