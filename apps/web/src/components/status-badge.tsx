"use client";

import { statusBadgeClass, statusLabel } from "@/lib/status";
import { useLanguage } from "@/components/language-provider";

export function StatusBadge({ status }: { status: string }) {
  const { locale } = useLanguage();
  return <span className={`badge ${statusBadgeClass(status)}`}>{statusLabel(status, locale)}</span>;
}
