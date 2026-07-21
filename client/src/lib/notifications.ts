import { LogIn, LogOut, AlertTriangle, Sparkles, GitCompareArrows, Wrench } from "lucide-react";
import { HKRoomState } from "@/hooks/useHousekeeping";
import { MonthlyReport, Room } from "@/types";
import { nightsBetween, reportDebt, todayIso } from "@/lib/utils";

export type NotificationCategory = "ARRIVAL" | "DEPARTURE" | "OVERDUE" | "CLEANING" | "CONFLICT" | "MAINTENANCE";

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
}

export const CATEGORY_META: Record<NotificationCategory, { label: string; icon: typeof LogIn; tint: string }> = {
  ARRIVAL: { label: "Заезды сегодня", icon: LogIn, tint: "tint-sky" },
  DEPARTURE: { label: "Выезды сегодня", icon: LogOut, tint: "tint-violet" },
  OVERDUE: { label: "Просроченная оплата", icon: AlertTriangle, tint: "tint-rose" },
  CLEANING: { label: "Уборка завершена", icon: Sparkles, tint: "tint-emerald" },
  CONFLICT: { label: "Конфликт бронирований", icon: GitCompareArrows, tint: "tint-rose" },
  MAINTENANCE: { label: "Требует ремонта", icon: Wrench, tint: "tint-amber" },
};


function overlaps(a: MonthlyReport, b: MonthlyReport) {
  const aStart = a.date.slice(0, 10);
  const aEnd = a.checkOut ? a.checkOut.slice(0, 10) : aStart;
  const bStart = b.date.slice(0, 10);
  const bEnd = b.checkOut ? b.checkOut.slice(0, 10) : bStart;
  return aStart < bEnd && bStart < aEnd;
}

const ACTIVE_STATUSES = new Set(["RESERVED", "CHECKED_IN"]);

export function buildNotifications(
  reports: MonthlyReport[],
  rooms: Room[],
  hkByRoom: Record<string, HKRoomState>
): AppNotification[] {
  const today = todayIso();
  const notifications: AppNotification[] = [];
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  for (const r of reports) {
    if (!ACTIVE_STATUSES.has(r.status)) continue;

    if (r.date.slice(0, 10) === today) {
      notifications.push({
        id: `arrival-${r.id}`,
        category: "ARRIVAL",
        title: `Заезд: номер ${r.room.roomNumber}`,
        description: `${r.guestName || "Гость"} · ${nightsBetween(r.date, r.checkOut)} ноч. · ${r.branch.name}`,
        createdAt: r.date,
        severity: "info",
      });
    }

    if (r.checkOut && r.checkOut.slice(0, 10) === today) {
      notifications.push({
        id: `departure-${r.id}`,
        category: "DEPARTURE",
        title: `Выезд: номер ${r.room.roomNumber}`,
        description: `${r.guestName || "Гость"} · ${r.branch.name}`,
        createdAt: r.checkOut,
        severity: "info",
      });
    }

    const debt = reportDebt(r);
    if (debt > 0 && r.date.slice(0, 10) <= today) {
      notifications.push({
        id: `overdue-${r.id}`,
        category: "OVERDUE",
        title: `Долг по номеру ${r.room.roomNumber}`,
        description: `${r.guestName || "Гость"} должен ${debt.toLocaleString("ru-RU")} ${r.currency}`,
        createdAt: r.date,
        severity: "critical",
      });
    }
  }

  // Conflicts: two active bookings on the same room with overlapping dates.
  const byRoom = new Map<string, MonthlyReport[]>();
  for (const r of reports) {
    if (!ACTIVE_STATUSES.has(r.status)) continue;
    byRoom.set(r.roomId, [...(byRoom.get(r.roomId) ?? []), r]);
  }
  for (const [roomId, roomReports] of byRoom) {
    for (let i = 0; i < roomReports.length; i++) {
      for (let j = i + 1; j < roomReports.length; j++) {
        if (overlaps(roomReports[i], roomReports[j])) {
          const room = roomById.get(roomId);
          notifications.push({
            id: `conflict-${roomReports[i].id}-${roomReports[j].id}`,
            category: "CONFLICT",
            title: `Пересечение бронирований: номер ${room?.roomNumber ?? "?"}`,
            description: `${roomReports[i].guestName || "Гость"} и ${roomReports[j].guestName || "Гость"} на одни даты`,
            createdAt: today,
            severity: "critical",
          });
        }
      }
    }
  }

  for (const room of rooms) {
    const hk = hkByRoom[room.id];
    if (!hk) continue;
    if (hk.status === "Clean" && hk.lastCleaned && hk.lastCleaned.slice(0, 10) === today) {
      notifications.push({
        id: `cleaning-${room.id}-${hk.lastCleaned}`,
        category: "CLEANING",
        title: `Уборка завершена: номер ${room.roomNumber}`,
        description: hk.housekeeper ? `Выполнено: ${hk.housekeeper}` : "Номер готов к заселению",
        createdAt: hk.lastCleaned,
        severity: "info",
      });
    }
    if (hk.status === "Maintenance" || hk.status === "OutOfOrder") {
      notifications.push({
        id: `maintenance-${room.id}`,
        category: "MAINTENANCE",
        title: `Номер ${room.roomNumber} ${hk.status === "Maintenance" ? "на обслуживании" : "не работает"}`,
        description: `Приоритет: ${hk.priority}`,
        createdAt: today,
        severity: "warning",
      });
    }
  }

  return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
