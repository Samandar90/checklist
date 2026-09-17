import { CalendarClock, LogIn, LogOut, Ban, UserX } from "lucide-react";
import { BookingStatus } from "@/types";

export const STATUS_META: Record<BookingStatus, { label: string; icon: typeof LogIn; tint: string }> = {
  RESERVED: { label: "Забронировано", icon: CalendarClock, tint: "tint-sky" },
  CHECKED_IN: { label: "Заселён", icon: LogIn, tint: "tint-emerald" },
  CHECKED_OUT: { label: "Выехал", icon: LogOut, tint: "tint-slate" },
  CANCELLED: { label: "Отменено", icon: Ban, tint: "tint-rose" },
  NO_SHOW: { label: "Не заехал", icon: UserX, tint: "tint-amber" },
};

/**
 * Statuses that actually hold the room's nights — mirrors the server's
 * ROOM_HOLDING_STATUSES: a cancellation or a no-show frees the room.
 */
export const ROOM_HOLDING_STATUSES: BookingStatus[] = ["RESERVED", "CHECKED_IN", "CHECKED_OUT"];
export const holdsRoom = (s: BookingStatus) => ROOM_HOLDING_STATUSES.includes(s);

export const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = (
  Object.keys(STATUS_META) as BookingStatus[]
).map((value) => ({ value, label: STATUS_META[value].label }));

/**
 * Chessboard bar palette — solid operational bands with a darker slanted edge
 * and white text, so bookings remain distinct on a dense board.
 * Each class only sets CSS variables (see .bar-* in index.css, light + dark);
 * ReservationCard paints with the fill, edge and text variables from there.
 * RESERVED = blue, CHECKED_IN = green, CHECKED_OUT = grey — the three states
 * staff scan for; CANCELLED / NO_SHOW are red / orange terminal states.
 */
export const STATUS_BAR_CLASS: Record<BookingStatus, string> = {
  RESERVED: "bar-reserved",
  CHECKED_IN: "bar-checked-in",
  CHECKED_OUT: "bar-checked-out",
  CANCELLED: "bar-cancelled",
  NO_SHOW: "bar-no-show",
};

/** Solid (light-theme) status colours — muted operational palette. */
export const STATUS_BAR_COLOR: Record<BookingStatus, string> = {
  RESERVED: "#3155e7",
  CHECKED_IN: "#138a5b",
  CHECKED_OUT: "#64748b",
  CANCELLED: "#d94452",
  NO_SHOW: "#c97a0a",
};

/** Solid-dot classes matching STATUS_BAR_COLOR, for legend / filter swatches. */
export const STATUS_DOT_CLASS: Record<BookingStatus, string> = {
  RESERVED: "bar-reserved bg-(--bar)",
  CHECKED_IN: "bar-checked-in bg-(--bar)",
  CHECKED_OUT: "bar-checked-out bg-(--bar)",
  CANCELLED: "bar-cancelled bg-(--bar)",
  NO_SHOW: "bar-no-show bg-(--bar)",
};
