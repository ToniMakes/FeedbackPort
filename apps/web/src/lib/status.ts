import type { FeedbackStatus } from "@feedbackport/core";

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
  declined: "Declined",
};

export const STATUS_BADGE_CLASSES: Record<FeedbackStatus, string> = {
  open: "bg-slate-100 text-slate-600",
  planned: "bg-violet-50 text-violet-700",
  in_progress: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
  declined: "bg-rose-50 text-rose-700",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as FeedbackStatus] ?? status;
}

export function statusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status as FeedbackStatus] ?? STATUS_BADGE_CLASSES.open;
}
