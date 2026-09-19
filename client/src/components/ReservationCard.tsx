import { STATUS_META, STATUS_BAR_CLASS } from "@/lib/bookingStatus";
import { MonthlyReport } from "@/types";
import { cn, formatMoney, reportDebt } from "@/lib/utils";
import { barGeometry, STRIPE } from "@/lib/barGeometry";

const ROW_H = 40;

/**
 * A single reservation block on the chessboard, drawn as a parallelogram:
 * the check-in edge rises "/" out of the middle of the arrival cell and the
 * check-out edge falls "/" through the middle of the departure cell, so two
 * adjacent stays (checkout + same-day check-in) tessellate along one diagonal.
 *
 * Painted as a confident solid status band with a subtle top highlight and a
 * darker slanted check-in edge. This remains legible when the board is dense
 * and makes each operational state identifiable at a glance. Colours come from
 * .bar-* classes (CSS variables, light + dark) — see index.css.
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
  onMoveStart: (e: React.PointerEvent, mode: "move" | "resize") => void;
  onOpenDetails: () => void;
  onHover: (x: number, y: number) => void;
  onLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  // Half-day convention shared with room blocks — see lib/barGeometry.
  const geo = barGeometry(checkInIdx, checkOutIdx, daysInMonth, cellWidth);
  if (!geo) return null;
  const { left, width, slantRight, lt, rb, clipStripe, clipBody } = geo;

  const debt = reportDebt(booking);
  const partial = booking.paymentStatus === "Частично";

  const label = booking.guestName || booking.source.name;
  const showPrice = width > 110;
  const statusInfo = STATUS_META[booking.status];

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenDetails();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}, ${statusInfo.label}, ${formatMoney(booking.price, booking.currency)}`}
      onPointerDown={(e) => onMoveStart(e, "move")}
      onKeyDown={handleKeyDown}
      onMouseEnter={(e) => onHover(e.clientX, e.clientY)}
      onMouseMove={(e) => onHover(e.clientX, e.clientY)}
      onMouseLeave={onLeave}
      onContextMenu={onContextMenu}
      title={`${label} · ${formatMoney(booking.price, booking.currency)} · ${statusInfo.label}`}
      className={cn(
        "group/bar absolute cursor-pointer transition-[filter,transform,opacity] duration-150 hover:z-30 hover:saturate-[1.15] focus-visible:z-30 focus-visible:outline-none active:cursor-grabbing",
        STATUS_BAR_CLASS[booking.status],
        dimmed && "opacity-20 grayscale",
        dragging && "z-40 opacity-95 drop-shadow-[0_8px_18px_rgba(0,0,0,0.22)] dark:drop-shadow-[0_8px_18px_rgba(0,0,0,0.65)]"
      )}
      style={{ left, width, top: 4, height: ROW_H - 8, touchAction: "none" }}
    >
      {/* скошенная кромка заезда — насыщенный цвет статуса */}
      <span className="absolute inset-0" style={{ clipPath: clipStripe, background: "var(--bar-edge)" }} />
      {/* тело — насыщенная заливка с мягким верхним бликом */}
      <span
        className="absolute inset-0 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] font-semibold"
        style={{
          clipPath: clipBody,
          background: "linear-gradient(180deg, var(--bar-highlight), var(--bar-fill))",
          color: "var(--bar-text)",
          paddingLeft: (lt ? lt * 0.8 : 0) + STRIPE + 5,
          paddingRight: rb ? rb * 0.8 + 3 : 6,
        }}
      >
        <span className="truncate">{label}</span>
        {showPrice && (
          <span className="ml-auto shrink-0 text-[11px] font-medium opacity-90">
            {Math.round(booking.price / 1000)}к
          </span>
        )}
      </span>
      {/* оплата: красная точка — долг, оранжевая — частичная */}
      {(debt > 0 || partial) && (
        <span
          className={cn("absolute z-10 h-2 w-2 rounded-full ring-2 ring-card", debt > 0 ? "bg-destructive" : "bg-warning")}
          style={{ top: -2, right: rb ? rb / 2 - 2 : 0 }}
        />
      )}
      {/* ручка изменения срока (правый край) */}
      {slantRight && (
        <span
          onPointerDown={(e) => onMoveStart(e, "resize")}
          className="absolute inset-y-0 right-0 z-10 w-2.5 cursor-ew-resize opacity-0 transition-opacity group-hover/bar:opacity-100"
          title="Потяните, чтобы изменить срок"
        >
          <span className="absolute inset-y-1.5 right-1 w-0.5 rounded-full opacity-70" style={{ background: "var(--bar)" }} />
        </span>
      )}
    </div>
  );
}
