import { BLOCK_META, blockTitle } from "@/lib/roomBlocks";
import { barGeometry, STRIPE } from "@/lib/barGeometry";
import { RoomBlock } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const ROW_H = 40;

/**
 * A room block (hold / blocked dates / out of order) on the chessboard. Same
 * parallelogram as a stay, so it tessellates with neighbouring bookings, but
 * hatched instead of solid — at a glance it reads "closed", not "guest". Never
 * draggable: a block is edited or lifted from its modal (click / Enter /
 * right-click), which is the single place those actions are taken from.
 */
export default function RoomBlockCard({
  block,
  startIdx,
  endIdx,
  daysInMonth,
  cellWidth,
  dimmed,
  onOpen,
}: {
  block: RoomBlock;
  startIdx: number;
  endIdx: number;
  daysInMonth: number;
  cellWidth: number;
  dimmed: boolean;
  onOpen: () => void;
}) {
  const geo = barGeometry(startIdx, endIdx, daysInMonth, cellWidth);
  if (!geo) return null;
  const { left, width, lt, rb, clipStripe, clipBody } = geo;

  const meta = BLOCK_META[block.kind];
  const Icon = meta.icon;
  const title = blockTitle(block);
  const period = `${formatDate(block.startDate)} → ${formatDate(block.endDate)}`;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${title}, ${period}`}
      title={`${title} · ${period}${block.note ? ` · ${block.note}` : ""}`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpen();
      }}
      className={cn(
        "absolute cursor-pointer transition-[filter,opacity] duration-150 hover:z-30 hover:saturate-[1.15] focus-visible:z-30 focus-visible:outline-none",
        meta.barClass,
        dimmed && "opacity-20 grayscale"
      )}
      style={{ left, width, top: 4, height: ROW_H - 8 }}
    >
      {/* скошенная кромка начала — насыщенный цвет вида блокировки */}
      <span className="absolute inset-0" style={{ clipPath: clipStripe, background: "var(--bar-edge)" }} />
      {/* тело — штриховка: «закрыто», а не «гость» */}
      <span
        className="absolute inset-0 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] font-semibold"
        style={{
          clipPath: clipBody,
          background: "repeating-linear-gradient(135deg, var(--bar-fill) 0 6px, var(--bar-highlight) 6px 12px)",
          color: "var(--bar-text)",
          textShadow: "0 1px 1px rgba(0,0,0,0.25)",
          paddingLeft: (lt ? lt * 0.8 : 0) + STRIPE + 5,
          paddingRight: rb ? rb * 0.8 + 3 : 6,
        }}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{title}</span>
      </span>
    </div>
  );
}
