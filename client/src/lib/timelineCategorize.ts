import { CalendarPlus, Trash2, CreditCard, DoorOpen, Sparkles, Pencil } from "lucide-react";
import { AuditFieldChange, AuditLog } from "@/types";

export type TimelineCategory = "booking" | "payment" | "room" | "status" | "other";

export const CATEGORY_META: Record<TimelineCategory, { label: string; icon: typeof CalendarPlus; tint: string }> = {
  booking: { label: "Бронирование", icon: CalendarPlus, tint: "tint-indigo" },
  payment: { label: "Оплата", icon: CreditCard, tint: "tint-emerald" },
  room: { label: "Номер", icon: DoorOpen, tint: "tint-sky" },
  status: { label: "Статус", icon: Sparkles, tint: "tint-amber" },
  other: { label: "Изменение", icon: Pencil, tint: "tint-slate" },
};

const PAYMENT_FIELDS = new Set(["paymentStatus", "paidAmount", "price", "paymentMethod"]);

export function parseChanges(raw: string | null): AuditFieldChange[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AuditFieldChange[];
  } catch {
    return [];
  }
}

export interface CategorizedLog {
  log: AuditLog;
  changes: AuditFieldChange[];
  categories: TimelineCategory[];
  primary: TimelineCategory;
}

export function categorize(log: AuditLog): CategorizedLog {
  const changes = parseChanges(log.changes);

  if (log.action === "CREATE" || log.action === "DELETE") {
    return { log, changes, categories: ["booking"], primary: "booking" };
  }

  const categories = new Set<TimelineCategory>();
  for (const c of changes) {
    if (c.field === "status") categories.add("status");
    else if (c.field === "roomId") categories.add("room");
    else if (PAYMENT_FIELDS.has(c.field)) categories.add("payment");
    else categories.add("other");
  }
  if (categories.size === 0) categories.add("other");

  const priority: TimelineCategory[] = ["status", "room", "payment", "other"];
  const primary = priority.find((p) => categories.has(p)) ?? "other";

  return { log, changes, categories: Array.from(categories), primary };
}

const ICON_OVERRIDE = { DELETE: Trash2 };

export function iconFor(entry: CategorizedLog) {
  if (entry.log.action === "DELETE") return ICON_OVERRIDE.DELETE;
  return CATEGORY_META[entry.primary].icon;
}
