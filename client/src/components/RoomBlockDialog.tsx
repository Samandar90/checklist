import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateRoomBlock, useUpdateRoomBlock } from "@/hooks/useRoomBlocks";
import { BLOCK_META } from "@/lib/roomBlocks";
import { Room, RoomBlock, RoomBlockKind } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { addDaysIso, cn, formatDate, isoDay, nightsBetween, pluralRu, todayIso } from "@/lib/utils";

export interface RoomBlockDraft {
  roomId: string;
  startDate: string;
  endDate: string;
}

/** "YYYY-MM-DDTHH:mm" in local time — what <input type="datetime-local"> speaks. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Default hold deadline: this time tomorrow, on the hour. */
function defaultHoldUntil(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}

const SUBMIT_LABEL: Record<RoomBlockKind, string> = {
  HOLD: "Поставить на хранение",
  BLOCK: "Заблокировать даты",
  OUT_OF_ORDER: "Закрыть номер",
};

const CREATED_TOAST: Record<RoomBlockKind, string> = {
  HOLD: "Номер поставлен на хранение",
  BLOCK: "Даты заблокированы",
  OUT_OF_ORDER: "Номер отмечен как неработающий",
};

/**
 * Create or edit a room block. Kind (and, when editing, the room) is fixed
 * up front — the chessboard menu already said what the user wants, so the
 * form only asks for what that kind needs: dates for all, a guest and a
 * deadline for a hold, a reason for an out-of-order room.
 */
export default function RoomBlockDialog({
  open,
  onOpenChange,
  kind,
  branchId,
  rooms,
  draft,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: RoomBlockKind;
  branchId: string;
  rooms: Room[];
  draft: RoomBlockDraft | null;
  editing: RoomBlock | null;
}) {
  const create = useCreateRoomBlock();
  const update = useUpdateRoomBlock();
  const meta = BLOCK_META[kind];
  const Icon = meta.icon;

  const [roomId, setRoomId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guestName, setGuestName] = useState("");
  const [note, setNote] = useState("");
  const [holdUntil, setHoldUntil] = useState("");

  // Seed once per open: from the block being edited, else from the selection.
  const firstRoomId = rooms[0]?.id ?? "";
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setRoomId(editing.roomId);
      setStartDate(isoDay(new Date(editing.startDate)));
      setEndDate(isoDay(new Date(editing.endDate)));
      setGuestName(editing.guestName ?? "");
      setNote(editing.note ?? "");
      setHoldUntil(editing.holdUntil ? toLocalInput(new Date(editing.holdUntil)) : defaultHoldUntil());
    } else {
      setRoomId(draft?.roomId ?? firstRoomId);
      setStartDate(draft?.startDate ?? todayIso());
      setEndDate(draft?.endDate ?? addDaysIso(todayIso(), 1));
      setGuestName("");
      setNote("");
      setHoldUntil(defaultHoldUntil());
    }
  }, [open, editing, draft, firstRoomId]);

  const nights = startDate && endDate ? nightsBetween(startDate, endDate) : 0;
  const datesValid = Boolean(startDate && endDate) && new Date(endDate) > new Date(startDate);
  const pending = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) return toast.error("Выберите номер");
    if (!datesValid) return toast.error("Дата окончания должна быть позже начала");
    if (kind === "HOLD" && !holdUntil) return toast.error("Укажите, до какого времени держать номер");

    const payload = {
      branchId,
      roomId,
      kind,
      startDate,
      endDate,
      note: note.trim() || null,
      guestName: kind === "HOLD" ? guestName.trim() || null : null,
      holdUntil: kind === "HOLD" ? new Date(holdUntil).toISOString() : null,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: payload });
        toast.success("Блокировка изменена");
      } else {
        await create.mutateAsync(payload);
        toast.success(CREATED_TOAST[kind]);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-3 pr-8">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", meta.tint)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle>{editing ? `Изменить: ${meta.label.toLowerCase()}` : meta.label}</DialogTitle>
                <DialogDescription>{meta.hint}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Номер</Label>
            <Select value={roomId} onValueChange={setRoomId} disabled={Boolean(editing)}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите номер" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.roomNumber}
                    {r.type ? ` · ${r.type}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rb-start">Начало</Label>
              <Input id="rb-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-end">Окончание</Label>
              <Input id="rb-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <p className={cn("-mt-2 text-xs", datesValid ? "text-muted-foreground" : "text-destructive")}>
            {datesValid
              ? `${nights} ${pluralRu(nights, "ночь", "ночи", "ночей")} · номер снова в продаже с ${formatDate(endDate)}`
              : "Окончание — утро, когда номер снова в продаже; оно должно быть позже начала"}
          </p>

          {kind === "HOLD" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rb-guest">Гость</Label>
                <Input id="rb-guest" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="За кем держим" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-until">Держать до</Label>
                <Input id="rb-until" type="datetime-local" value={holdUntil} onChange={(e) => setHoldUntil(e.target.value)} required />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rb-note">{kind === "OUT_OF_ORDER" ? "Причина" : "Заметка"}</Label>
            <Textarea
              id="rb-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={kind === "OUT_OF_ORDER" ? "Например: не работает кондиционер" : "Необязательно"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {editing ? "Сохранить" : SUBMIT_LABEL[kind]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
