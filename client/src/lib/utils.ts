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
