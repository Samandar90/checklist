import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value) + " " + currency;
}

export function formatDate(value: string | Date) {
  const d = new Date(value);
  return d.toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatDateTime(value: string | Date) {
  const d = new Date(value);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Number of nights between two ISO dates (checkOut null ⇒ 1 night). */
export function nightsBetween(date: string, checkOut?: string | null) {
  if (!checkOut) return 1;
  const diff = Math.round((new Date(checkOut).getTime() - new Date(date).getTime()) / DAY_MS);
  return diff > 0 ? diff : 1;
}

/** Add `days` to a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addDaysIso(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Outstanding debt for a report. `paidAmount === null/undefined` means fully paid. */
export function reportDebt(report: { price: number; paidAmount?: number | null }) {
  return report.price - (report.paidAmount ?? report.price);
}

export function paymentStatusClass(status: string) {
  switch (status) {
    case "Оплачено":
      return "bg-emerald-50 text-emerald-700";
    case "Частично":
      return "bg-amber-50 text-amber-700";
    case "Долг":
      return "bg-red-50 text-red-700";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}
