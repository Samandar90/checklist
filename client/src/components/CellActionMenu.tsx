import { useEffect } from "react";
import { Plus, X } from "lucide-react";
import { BLOCK_KINDS, BLOCK_META } from "@/lib/roomBlocks";
import { Room, RoomBlockKind } from "@/types";
import { cn, formatDate, isoDay, nightsBetween, pluralRu } from "@/lib/utils";

export type CellAction = "BOOKING" | RoomBlockKind;

function MenuItem({
  icon: Icon,
  label,
  primary,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-secondary",
        primary ? "text-primary" : "text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

/**
 * The menu that opens once free nights are selected on the chessboard — the
 * classic PMS popover: the dates, then "new booking", "temporary hold",
 * "block dates" and "out of order". Anchored to the pointer and clamped to the
 * viewport; a click anywhere else, the cross or Esc closes it.
 */
export default function CellActionMenu({
  room,
  start,
  end,
  x,
  y,
  onClose,
  onAction,
}: {
  room: Room;
  /** First selected night. */
  start: Date;
  /** Exclusive — the morning after the last selected night. */
  end: Date;
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: CellAction) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const W = 288;
  const H = 268;
  const left = Math.max(12, Math.min(x + 8, window.innerWidth - W - 12));
  const top = Math.max(12, Math.min(y + 8, window.innerHeight - H - 12));
  const startIso = isoDay(start);
  const endIso = isoDay(end);
  const nights = nightsBetween(startIso, endIso);

  return (
    <>
      {/* прозрачная подложка: клик мимо меню закрывает его и не начинает новое выделение */}
      <div className="fixed inset-0 z-40" onPointerDown={onClose} />
      <div
        role="menu"
        aria-label="Действия с выбранными датами"
        className="glass-strong fixed z-50 rounded-2xl p-2 animate-fade-in"
        style={{ left, top, width: W }}
      >
        <div className="flex items-start justify-between gap-2 px-2.5 pb-2 pt-1.5">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground">
              Номер {room.roomNumber}
              {room.type ? ` · ${room.type}` : ""}
            </div>
            <div className="mt-0.5 space-y-0.5 text-[12px] text-muted-foreground">
              <div>
                Заезд: <span className="text-foreground">{formatDate(startIso)}</span>
              </div>
              <div>
                Выезд: <span className="text-foreground">{formatDate(endIso)}</span> · {nights}{" "}
                {pluralRu(nights, "ночь", "ночи", "ночей")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="border-t border-border/70 pt-1">
          <MenuItem icon={Plus} label="Создать новое бронирование" primary onClick={() => onAction("BOOKING")} />
          {BLOCK_KINDS.map((k) => (
            <MenuItem key={k} icon={BLOCK_META[k].icon} label={BLOCK_META[k].action} onClick={() => onAction(k)} />
          ))}
        </div>
      </div>
    </>
  );
}
