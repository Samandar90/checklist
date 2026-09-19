import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BLOCK_META, holdExpired } from "@/lib/roomBlocks";
import { RoomBlock } from "@/types";
import { cn, formatDate, formatDateTime, isoDay, nightsBetween, pluralRu } from "@/lib/utils";

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("text-right", valueClass ?? "text-foreground")}>{value}</span>
    </div>
  );
}

/**
 * Details of a room block and the only place its actions live: lift it,
 * change its dates / note, and for a hold — turn it into a real booking
 * (the wizard opens with the room, dates and guest prefilled; the hold is
 * released by the server in the same transaction that creates the booking).
 */
export default function RoomBlockModal({
  block,
  open,
  onOpenChange,
  onEdit,
  onConvert,
  onDeleteRequest,
}: {
  block: RoomBlock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (block: RoomBlock) => void;
  onConvert: (block: RoomBlock) => void;
  onDeleteRequest: (block: RoomBlock) => void;
}) {
  if (!block) return null;
  const meta = BLOCK_META[block.kind];
  const Icon = meta.icon;
  const nights = nightsBetween(isoDay(new Date(block.startDate)), isoDay(new Date(block.endDate)));
  const expired = holdExpired(block);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", meta.tint)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">{meta.label}</DialogTitle>
              <DialogDescription>
                Номер {block.room.roomNumber}
                {block.room.type ? ` · ${block.room.type}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-5 space-y-2">
          <Row
            label="Период"
            value={`${formatDate(block.startDate)} → ${formatDate(block.endDate)} · ${nights} ${pluralRu(nights, "ночь", "ночи", "ночей")}`}
          />
          {block.kind === "HOLD" && <Row label="Гость" value={block.guestName || "—"} />}
          {block.kind === "HOLD" && block.holdUntil && (
            <Row
              label="Держать до"
              value={`${formatDateTime(block.holdUntil)}${expired ? " · истекло" : ""}`}
              valueClass={expired ? "text-destructive" : undefined}
            />
          )}
          {block.note && <Row label={block.kind === "OUT_OF_ORDER" ? "Причина" : "Заметка"} value={block.note} />}
          <Row label="Кем" value={block.createdBy?.fullName ?? "Главный аккаунт"} />
          <Row label="Создано" value={formatDateTime(block.createdAt)} />
        </div>

        <DialogFooter className="mt-6 gap-2 sm:justify-between">
          <Button variant="outline" className="text-destructive" onClick={() => onDeleteRequest(block)}>
            <Trash2 className="h-4 w-4" /> Снять
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEdit(block)}>
              <Pencil className="h-4 w-4" /> Изменить
            </Button>
            {block.kind === "HOLD" && (
              <Button onClick={() => onConvert(block)}>
                <CalendarPlus className="h-4 w-4" /> Оформить бронь
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
