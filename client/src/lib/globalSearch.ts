import { User2, BedDouble, CalendarRange, Receipt, Building2, Users } from "lucide-react";
import { Admin, Branch, Expense, MonthlyReport, Room } from "@/types";
import { formatMoney } from "@/lib/utils";

export type SearchEntityType = "guest" | "booking" | "room" | "invoice" | "branch" | "admin";

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string;
  to: string;
}

export const ENTITY_META: Record<SearchEntityType, { label: string; icon: typeof User2 }> = {
  guest: { label: "Гости", icon: User2 },
  booking: { label: "Бронирования", icon: CalendarRange },
  room: { label: "Номера", icon: BedDouble },
  invoice: { label: "Счета", icon: Receipt },
  branch: { label: "Филиалы", icon: Building2 },
  admin: { label: "Администраторы", icon: Users },
};

function guestsFromReports(reports: MonthlyReport[]): SearchResult[] {
  const map = new Map<string, MonthlyReport>();
  for (const r of reports) {
    const name = r.guestName?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const prev = map.get(key);
    if (!prev || r.date > prev.date) map.set(key, r);
  }
  return Array.from(map.entries()).map(([key, r]) => ({
    id: `guest-${key}`,
    type: "guest",
    title: r.guestName!,
    subtitle: `Последний визит: номер ${r.room.roomNumber} · ${r.branch.name}`,
    to: "/guests",
  }));
}

function bookingsFromReports(reports: MonthlyReport[]): SearchResult[] {
  return reports.map((r) => ({
    id: `booking-${r.id}`,
    type: "booking",
    title: `${r.guestName || "Без имени"} · номер ${r.room.roomNumber}`,
    subtitle: `${r.branch.name} · ${formatMoney(r.price, r.currency)}`,
    to: "/reports",
  }));
}

function invoicesFromExpenses(expenses: Expense[]): SearchResult[] {
  return expenses.map((e) => ({
    id: `invoice-${e.id}`,
    type: "invoice",
    title: `${e.category} · ${formatMoney(e.amount, e.currency)}`,
    subtitle: `${e.branch.name}${e.note ? ` · ${e.note}` : ""}`,
    to: "/expenses",
  }));
}

function roomsFromRooms(rooms: Room[]): SearchResult[] {
  return rooms.map((r) => ({
    id: `room-${r.id}`,
    type: "room",
    title: `Номер ${r.roomNumber}`,
    subtitle: `${r.type || "Без типа"} · ${r.branch?.name ?? ""}`,
    to: "/rooms",
  }));
}

function branchesFromBranches(branches: Branch[]): SearchResult[] {
  return branches.map((b) => ({
    id: `branch-${b.id}`,
    type: "branch",
    title: b.name,
    subtitle: `${b._count?.rooms ?? 0} номеров · ${b._count?.admins ?? 0} администраторов`,
    to: "/branches",
  }));
}

function adminsFromAdmins(admins: Admin[]): SearchResult[] {
  return admins.map((a) => ({
    id: `admin-${a.id}`,
    type: "admin",
    title: a.fullName,
    subtitle: a.phone,
    to: "/admins",
  }));
}

export function buildSearchIndex(data: {
  reports?: MonthlyReport[];
  rooms?: Room[];
  branches?: Branch[];
  admins?: Admin[];
  expenses?: Expense[];
}): SearchResult[] {
  return [
    ...guestsFromReports(data.reports ?? []),
    ...bookingsFromReports(data.reports ?? []),
    ...roomsFromRooms(data.rooms ?? []),
    ...invoicesFromExpenses(data.expenses ?? []),
    ...branchesFromBranches(data.branches ?? []),
    ...adminsFromAdmins(data.admins ?? []),
  ];
}

export function searchIndex(index: SearchResult[], query: string, limitPerType = 5): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matched = index.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(q));
  const counts: Record<string, number> = {};
  const result: SearchResult[] = [];
  for (const item of matched) {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
    if (counts[item.type] <= limitPerType) result.push(item);
  }
  return result;
}
