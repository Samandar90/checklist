import { CalendarClock, LogIn, LogOut, Ban, UserX } from "lucide-react";
import { BookingStatus } from "@/types";

export const STATUS_META: Record<BookingStatus, { label: string; icon: typeof LogIn; tint: string }> = {
  RESERVED: { label: "Забронировано", icon: CalendarClock, tint: "tint-sky" },
  CHECKED_IN: { label: "Заселён", icon: LogIn, tint: "tint-emerald" },
  CHECKED_OUT: { label: "Выехал", icon: LogOut, tint: "tint-slate" },
  CANCELLED: { label: "Отменено", icon: Ban, tint: "tint-rose" },
  NO_SHOW: { label: "Не заехал", icon: UserX, tint: "tint-amber" },
};

export const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = (
  Object.keys(STATUS_META) as BookingStatus[]
).map((value) => ({ value, label: STATUS_META[value].label }));
