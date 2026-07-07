import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

import { STATUS_META, STATUS_BAR_CLASS } from "@/lib/bookingStatus";
import { MonthlyReport } from "@/types";
import { cn, formatMoney, reportDebt } from "@/lib/utils";

const ROW_H = 42;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * A single reservation block on the chessboard.
 *
 * Deliberately dumb: no action buttons, no dropdown, no inline edit affordance.
 * The only interactions are drag-to-move / drag-to-resize (mouse) and "open the
 * details modal" (click, Enter/Space, or right-click) — every business action
 * lives in ReservationModal, which is the single place actions are taken from.
 */
export default function ReservationCard({
  booking,
  checkInIdx,
  checkOutIdx,
  daysInMonth,
  cellWidth,
  dimmed,
  dragging,
  onMoveStart,
  onOpenDetails,
  onHover,
  onLeave,
  onContextMenu,
}: {
  booking: MonthlyReport;
  checkInIdx: number;
  checkOutIdx: number;
  daysInMonth: number;
  cellWidth: number;
  dimmed: boolean;
  dragging: boolean;
  onMoveStart: (e: React.MouseEvent, mode: "move" | "resize") => void;
  onOpenDetails: () => void;
  onHover: (x: number, y: number) => void;
  onLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  // Bar spans from mid check-in cell to mid check-out cell (half-day convention),
  // clipped to the visible month so multi-month stays don't overflow.
  const rawStart = checkInIdx + 0.5;
  const rawEnd = checkOutIdx + 0.5;
  const startUnit = Math.max(0, rawStart);
  const endUnit = Math.min(daysInMonth, rawEnd);
  if (endUnit <= startUnit) return null;

  // Rounded only where the real check-in / check-out is visible in this month.
  const roundLeft = rawStart >= 0;
  const roundRight = rawEnd <= daysInMonth;

  const left = startUnit * cellWidth + 2;
  const width = (endUnit - startUnit) * cellWidth - 4;

  const debt = reportDebt(booking);
  const label = booking.guestName || booking.source.name;
  const showAvatar = width > 70;
  const showPrice = width > 96;
  const statusInfo = STATUS_META[booking.status];

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenDetails();
    }
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${label}, ${statusInfo.label}, ${formatMoney(booking.price, booking.currency)}`}
      whileHover={{ scale: 1.02, y: -1.5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => onMoveStart(e, "move")}
      onKeyDown={handleKeyDown}
      onMouseEnter={(e) => onHover(e.clientX, e.clientY)}
      onMouseMove={(e) => onHover(e.clientX, e.clientY)}
      onMouseLeave={onLeave}
      onContextMenu={onContextMenu}
      title={`${label} · ${formatMoney(booking.price, booking.currency)} · ${statusInfo.label}`}
      className={cn(
        "group/bar absolute flex cursor-pointer items-center gap-1.5 overflow-hidden whitespace-nowrap px-1.5 text-[11px] font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.12)] ring-1 ring-black/10 transition-shadow duration-200 hover:z-30 hover:shadow-[0_6px_16px_rgba(16,24,40,0.18)] focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing",
        STATUS_BAR_CLASS[booking.status],
        dimmed && "opacity-20 grayscale",
        dragging && "z-40 opacity-90 shadow-lg ring-2 ring-primary"
      )}
      style={{
        left,
        width,
        top: 5,
        height: ROW_H - 10,
        borderTopLeftRadius: roundLeft ? 9 : 2,
        borderBottomLeftRadius: roundLeft ? 9 : 2,
        borderTopRightRadius: roundRight ? 9 : 2,
        borderBottomRightRadius: roundRight ? 9 : 2,
      }}
    >
      {/* долг — диагональная штриховка поверх */}
      {debt > 0 && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(0,0,0,0.14) 0 5px, transparent 5px 10px)",
          }}
        />
      )}
      {showAvatar ? (
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/15 text-[9px] font-bold">
          {initials(label)}
        </span>
      ) : (
        <statusInfo.icon className="relative h-3 w-3 shrink-0 opacity-90" />
      )}
      <span className="relative truncate">{label}</span>
      {showPrice && (
        <span className="relative ml-auto shrink-0 font-medium opacity-90">
          {Math.round(booking.price / 1000)}к
        </span>
      )}
      {debt > 0 && <AlertCircle className="relative h-3 w-3 shrink-0" />}
      {/* ручка изменения срока (правый край) */}
      {roundRight && (
        <span
          onMouseDown={(e) => onMoveStart(e, "resize")}
          className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize opacity-0 transition-opacity group-hover/bar:opacity-100"
          title="Потяните, чтобы изменить срок"
        >
          <span className="absolute inset-y-1.5 right-0.5 w-0.5 rounded-full bg-white/50" />
        </span>
      )}
    </motion.div>
  );
}
