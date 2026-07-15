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
 * Solid fill classes for the calendar chessboard bars — the single source of truth
 * for reservation-status color so it's never re-guessed per component.
 * Muted PMS palette (steel blue / green / slate gray like the reference board):
 * RESERVED = blue, CHECKED_IN = green, CHECKED_OUT = gray (the three states staff
 * scan for); CANCELLED / NO_SHOW keep the same hue family as their STATUS_META tint
 * so they read as distinct terminal states rather than being mistaken for CHECKED_OUT.
 */
export const STATUS_BAR_CLASS: Record<BookingStatus, string> = {
  RESERVED: "bg-[#4f96d8] text-white",
  CHECKED_IN: "bg-[#43a563] text-white",
  CHECKED_OUT: "bg-[#808a96] text-white",
  CANCELLED: "bg-[#c0576b] text-white",
  NO_SHOW: "bg-[#d79a3f] text-white",
};

/**
 * Glassy vertical gradients for the chessboard bars — same hues as
 * STATUS_BAR_CLASS but with a lit top edge, like the primary buttons.
 */
export const STATUS_BAR_GRADIENT: Record<BookingStatus, string> = {
  RESERVED: "linear-gradient(to bottom, #61a4e2, #3d7cbd)",
  CHECKED_IN: "linear-gradient(to bottom, #53b671, #389252)",
  CHECKED_OUT: "linear-gradient(to bottom, #8e98a4, #6b7684)",
  CANCELLED: "linear-gradient(to bottom, #cf6a7e, #b04c60)",
  NO_SHOW: "linear-gradient(to bottom, #e0a94f, #c78b31)",
};

/** Plain solid-dot classes matching STATUS_BAR_CLASS, for small legend/filter swatches. */
export const STATUS_DOT_CLASS: Record<BookingStatus, string> = {
  RESERVED: "bg-[#4f96d8]",
  CHECKED_IN: "bg-[#43a563]",
  CHECKED_OUT: "bg-[#808a96]",
  CANCELLED: "bg-[#c0576b]",
  NO_SHOW: "bg-[#d79a3f]",
};
