import { STATUS_META, STATUS_BAR_GRADIENT } from "@/lib/bookingStatus";
import { MonthlyReport } from "@/types";
import { cn, formatMoney, reportDebt } from "@/lib/utils";

const ROW_H = 40;
/** Horizontal size of the slanted check-in / check-out edge, px. */
const SLANT = 12;

/**
 * A single reservation block on the chessboard, drawn as a parallelogram:
 * the check-in edge rises "/" out of the middle of the arrival cell and the
 * check-out edge falls "/" through the middle of the departure cell, so two
 * adjacent stays (checkout + same-day check-in) tessellate along one diagonal.
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
  // Half-day convention: the bar runs from the middle of the check-in cell to
  // the middle of the check-out cell, clipped to the visible month.
  const rawStart = checkInIdx + 0.5;
  const rawEnd = checkOutIdx + 0.5;
  const startUnit = Math.max(0, rawStart);
  const endUnit = Math.min(daysInMonth, rawEnd);
  if (endUnit <= startUnit) return null;

  // Slanted only where the real check-in / check-out is visible in this month;
  // a stay clipped by the month boundary gets a straight cut edge.
  const slantLeft = rawStart >= 0;
  const slantRight = rawEnd <= daysInMonth;

  // The slant is centered on the half-cell line so neighbouring bars share one
  // diagonal; ±1px keeps a hairline gap between them.
  const leftBase = startUnit * cellWidth - (slantLeft ? SLANT / 2 : 0);
  const rightBase = endUnit * cellWidth + (slantRight ? SLANT / 2 : 0);
  const left = leftBase + 1;
  const width = rightBase - leftBase - 2;

  const lt = slantLeft ? SLANT : 0;
  const rb = slantRight ? SLANT : 0;
  const clip = `polygon(${lt}px 0%, 100% 0%, calc(100% - ${rb}px) 100%, 0% 100%)`;

  const debt = reportDebt(booking);
  // Border encodes payment state, like the reference board: red = debt,
  // amber = deposit/partial, otherwise a neutral hairline.
  const borderColor =
    booking.paymentStatus === "Долг"
      ? "#e11d48"
      : booking.paymentStatus === "Частично"
        ? "#f59e0b"
        : "rgba(15, 23, 42, 0.25)";

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
      onMouseDown={(e) => onMoveStart(e, "move")}
      onKeyDown={handleKeyDown}
      onMouseEnter={(e) => onHover(e.clientX, e.clientY)}
      onMouseMove={(e) => onHover(e.clientX, e.clientY)}
      onMouseLeave={onLeave}
      onContextMenu={onContextMenu}
      title={`${label} · ${formatMoney(booking.price, booking.currency)} · ${statusInfo.label}`}
      className={cn(
        "group/bar absolute cursor-pointer drop-shadow-[0_1px_2px_rgba(16,24,40,0.25)] transition-[filter,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:z-30 hover:-translate-y-[1.5px] hover:drop-shadow-[0_6px_12px_rgba(16,24,40,0.35)] focus-visible:z-30 focus-visible:outline-none active:translate-y-0 active:cursor-grabbing",
        dimmed && "opacity-20 grayscale",
        dragging && "z-40 opacity-85 drop-shadow-[0_10px_20px_rgba(16,24,40,0.45)]"
      )}
      style={{ left, width, top: 4, height: ROW_H - 8 }}
    >
      {/* контур (окантовка по статусу оплаты) */}
      <span className="absolute inset-0" style={{ clipPath: clip, background: borderColor }} />
      {/* стеклянная заливка: градиент статуса + содержимое */}
      <span
        className="absolute flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs font-medium text-white transition-[filter] group-hover/bar:brightness-110"
        style={{
          inset: 1.5,
          clipPath: clip,
          background: STATUS_BAR_GRADIENT[booking.status],
          paddingLeft: lt ? lt * 0.8 + 3 : 6,
          paddingRight: rb ? rb * 0.8 + 3 : 6,
        }}
      >
        <span className="truncate">{label}</span>
        {showPrice && (
          <span className="ml-auto shrink-0 text-[11px] font-normal opacity-85">
            {Math.round(booking.price / 1000)}к
          </span>
        )}
      </span>
      {/* световой блик по верхней кромке — эффект стекла */}
      <span
        className="pointer-events-none absolute"
        style={{
          inset: 1.5,
          clipPath: clip,
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.32), rgba(255,255,255,0.08) 42%, transparent 60%)",
        }}
      />
      {/* индикатор долга — красная точка на правом верхнем углу, как в референсе */}
      {debt > 0 && (
        <span
          className="absolute z-10 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white"
          style={{ top: -2, right: rb ? rb / 2 - 2 : 0 }}
        />
      )}
      {/* ручка изменения срока (правый край) */}
      {slantRight && (
        <span
          onMouseDown={(e) => onMoveStart(e, "resize")}
          className="absolute inset-y-0 right-0 z-10 w-2.5 cursor-ew-resize opacity-0 transition-opacity group-hover/bar:opacity-100"
          title="Потяните, чтобы изменить срок"
        >
          <span className="absolute inset-y-1.5 right-1 w-0.5 rounded-full bg-white/60" />
        </span>
      )}
    </div>
  );
}
