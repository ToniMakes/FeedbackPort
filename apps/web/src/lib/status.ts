import type { FeedbackStatus } from "@feedbackport/core";

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "待处理",
  planned: "已计划",
  in_progress: "进行中",
  done: "已完成",
  declined: "不予采纳",
};

export const STATUS_BADGE_CLASSES: Record<FeedbackStatus, string> = {
  open: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  planned: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as FeedbackStatus] ?? status;
}

export function statusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status as FeedbackStatus] ?? STATUS_BADGE_CLASSES.open;
}
