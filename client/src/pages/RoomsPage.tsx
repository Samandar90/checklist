import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BedDouble, Search } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRooms, useCreateRoom, useDeleteRoom, useUpdateRoom } from "@/hooks/useRooms";
import { useBranches } from "@/hooks/useBranches";
import { Room } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const roomFormSchema = z.object({
  roomNumber: z.string().trim().min(1, "Укажите номер комнаты"),
  branchId: z.string().trim().min(1, "Выберите филиал"),
});
type RoomFormValues = z.infer<typeof roomFormSchema>;

export default function RoomsPage() {
  const { data: rooms, isLoading } = useRooms();
  const { data: branches } = useBranches();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: { roomNumber: "", branchId: "" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ roomNumber: "", branchId: "" });
    setDialogOpen(true);
  }

  function openEdit(room: Room) {
    setEditing(room);
    form.reset({ roomNumber: room.roomNumber, branchId: room.branchId });
    setDialogOpen(true);
  }

  async function onSubmit(values: RoomFormValues) {
    try {
      if (editing) {
        await updateRoom.mutateAsync({ id: editing.id, data: values });
        toast.success("Номер обновлён");
      } else {
        await createRoom.mutateAsync(values);
        toast.success("Номер создан");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRoom.mutateAsync(deleteTarget.id);
      toast.success("Номер удалён");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const filtered = (rooms ?? []).filter((r) =>
    r.roomNumber.toLowerCase().includes(search.toLowerCase())
  );

  const noBranches = (branches ?? []).length === 0;

  return (
    <div>
      <PageHeader
        title="Номера"
        description="Управляйте номерами, закреплёнными за филиалами."
        action={
          <Button onClick={openCreate} disabled={noBranches}>
            <Plus className="h-4 w-4" /> Добавить номер
          </Button>
        }
      />

      {noBranches && (
        <div className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
          Сначала создайте филиал, чтобы добавить номер.
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск номеров..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BedDouble} title="Пока нет номеров" description="Добавьте номер, чтобы начать работу." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Номер комнаты</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium text-foreground">{room.roomNumber}</TableCell>
                <TableCell>{room.branch?.name ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(room.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(room)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(room)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать номер" : "Добавить номер"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="roomNumber">Номер комнаты</Label>
              <Input id="roomNumber" placeholder="например, 101" {...form.register("roomNumber")} />
              {form.formState.errors.roomNumber && (
                <p className="text-xs text-destructive">{form.formState.errors.roomNumber.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Филиал</Label>
              <Controller
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите филиал" />
                    </SelectTrigger>
                    <SelectContent>
                      {(branches ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.branchId && (
                <p className="text-xs text-destructive">{form.formState.errors.branchId.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Сохранить изменения" : "Создать номер"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteRoom.isPending}
        title="Удалить номер?"
        description={`Номер «${deleteTarget?.roomNumber}» будет удалён без возможности восстановления.`}
      />
    </div>
  );
}
