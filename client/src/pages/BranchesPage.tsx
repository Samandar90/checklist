import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches, useCreateBranch, useDeleteBranch, useUpdateBranch } from "@/hooks/useBranches";
import { Branch } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const branchFormSchema = z.object({
  name: z.string().trim().min(1, "Укажите название"),
});
type BranchFormValues = z.infer<typeof branchFormSchema>;

export default function BranchesPage() {
  const { data: branches, isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deleteBranch = useDeleteBranch();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: { name: "" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "" });
    setDialogOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    form.reset({ name: branch.name });
    setDialogOpen(true);
  }

  async function onSubmit(values: BranchFormValues) {
    try {
      if (editing) {
        await updateBranch.mutateAsync({ id: editing.id, data: values });
        toast.success("Филиал обновлён");
      } else {
        await createBranch.mutateAsync(values);
        toast.success("Филиал создан");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteBranch.mutateAsync(deleteTarget.id);
      toast.success("Филиал удалён");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const filtered = (branches ?? []).filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Филиалы"
        description="Управляйте филиалами вашей сети отелей."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Добавить филиал
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск филиалов..."
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
        <EmptyState
          icon={Building2}
          title="Пока нет филиалов"
          description="Создайте первый филиал, чтобы начать работу."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Администраторы</TableHead>
              <TableHead>Номера</TableHead>
              <TableHead>Отчёты</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium text-foreground">{branch.name}</TableCell>
                <TableCell>
                  <Badge>{branch._count?.admins ?? 0}</Badge>
                </TableCell>
                <TableCell>
                  <Badge>{branch._count?.rooms ?? 0}</Badge>
                </TableCell>
                <TableCell>
                  <Badge>{branch._count?.reports ?? 0}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(branch.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(branch)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(branch)}>
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
            <DialogTitle>{editing ? "Редактировать филиал" : "Добавить филиал"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Название филиала</Label>
              <Input id="name" placeholder="например, Филиал «Центр»" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Сохранить изменения" : "Создать филиал"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteBranch.isPending}
        title="Удалить филиал?"
        description={`Филиал «${deleteTarget?.name}» и все связанные администраторы, номера и отчёты будут удалены без возможности восстановления.`}
      />
    </div>
  );
}
