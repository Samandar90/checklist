import { CalendarClock, Lock, Wrench } from "lucide-react";
import { RoomBlock, RoomBlockKind } from "@/types";

/**
 * Presentation metadata for room blocks — the non-booking reasons a room is
 * closed for sale. Mirrors server/src/lib/roomBlocks.ts. Bars use .bar-* CSS
 * variable sets (index.css) exactly like booking statuses do, so a block is
 * painted with the same machinery as a stay but hatched and in its own colours.
 */
export const BLOCK_META: Record<
  RoomBlockKind,
  { label: string; action: string; icon: typeof Lock; barClass: string; tint: string; hint: string }
> = {
  HOLD: {
    label: "Временное хранение",
    action: "Временное хранение номера",
    icon: CalendarClock,
    barClass: "bar-hold",
    tint: "tint-violet",
    hint: "Номер держится за гостем до указанного времени, потом сам возвращается в продажу.",
  },
  BLOCK: {
    label: "Даты заблокированы",
    action: "Блокировать даты",
    icon: Lock,
    barClass: "bar-block",
    tint: "tint-slate",
    hint: "Номер закрыт для продажи на эти даты, пока блокировку не снимут.",
  },
  OUT_OF_ORDER: {
    label: "Номер не работает",
    action: "Номер не работает",
    icon: Wrench,
    barClass: "bar-ooo",
    tint: "tint-rose",
    hint: "Номер неисправен и не продаётся, пока его не починят и не снимут блокировку.",
  },
};

export const BLOCK_KINDS: RoomBlockKind[] = ["HOLD", "BLOCK", "OUT_OF_ORDER"];

/** Short text for the bar: "Хранение · Иванов", "Даты заблокированы", … */
export function blockTitle(b: RoomBlock): string {
  if (b.kind === "HOLD") return b.guestName ? `Хранение · ${b.guestName}` : "Хранение";
  return BLOCK_META[b.kind].label;
}

/** A hold past its deadline no longer closes the room (the server hides those too). */
export function holdExpired(b: RoomBlock, now = new Date()): boolean {
  return b.kind === "HOLD" && !!b.holdUntil && new Date(b.holdUntil).getTime() <= now.getTime();
}
