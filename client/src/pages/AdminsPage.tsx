import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";

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
import { useAdmins, useCreateAdmin, useDeleteAdmin, useUpdateAdmin } from "@/hooks/useAdmins";
import { useBranches } from "@/hooks/useBranches";
import { Admin } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const baseFields = {
  fullName: z.string().trim().min(1, "Укажите ФИО"),
  phone: z.string().trim().min(1, "Укажите телефон"),
  branchId: z.string().trim().min(1, "Выберите филиал"),
  username: z.string().trim().min(3, "Логин должен быть не короче 3 символов"),
};

const createFormSchema = z.object({
  ...baseFields,
  password: z.string().min(6, "Пароль должен быть не короче 6 символов"),
});

const editFormSchema = z.object({
  ...baseFields,
  password: z.union([z.string().min(6, "Пароль должен быть не короче 6 символов"), z.literal("")]),
});

type AdminFormValues = z.infer<typeof createFormSchema>;

export default function AdminsPage() {
  const { data: admins, isLoading } = useAdmins();
  const { data: branches } = useBranches();
  const createAdmin = useCreateAdmin();
  const updateAdmin = useUpdateAdmin();
  const deleteAdmin = useDeleteAdmin();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(editing ? editFormSchema : createFormSchema),
    defaultValues: { fullName: "", phone: "", branchId: "", username: "", password: "" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ fullName: "", phone: "", branchId: "", username: "", password: "" });
    setDialogOpen(true);
  }

  function openEdit(admin: Admin) {
    setEditing(admin);
    form.reset({
      fullName: admin.fullName,
      phone: admin.phone,
      branchId: admin.branchId,
      username: admin.username ?? "",
      password: "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: AdminFormValues) {
    try {
      if (editing) {
        const data = { ...values, password: values.password || undefined };
        await updateAdmin.mutateAsync({ id: editing.id, data });
        toast.success("Администратор обновлён");
      } else {
        await createAdmin.mutateAsync(values);
        toast.success("Администратор создан");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAdmin.mutateAsync(deleteTarget.id);
      toast.success("Администратор удалён");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const filtered = (admins ?? []).filter(
    (a) =>
      a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.phone.toLowerCase().includes(search.toLowerCase())
  );

  const noBranches = (branches ?? []).length === 0;

  return (
    <div>
      <PageHeader
        title="Администраторы"
        description="Управляйте администраторами, закреплёнными за филиалами, и их учётными данными."
        action={
          <Button onClick={openCreate} disabled={noBranches}>
            <Plus className="h-4 w-4" /> Добавить администратора
          </Button>
        }
      />

      {noBranches && (
        <div className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
          Сначала создайте филиал, чтобы добавить администратора.
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск администраторов..."
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
          icon={Users}
          title="Пока нет администраторов"
          description="Добавьте администратора, чтобы начать работу."
          action={
            <Button onClick={openCreate} disabled={noBranches}>
              <Plus className="h-4 w-4" /> Добавить администратора
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Логин</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium text-foreground">{admin.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{admin.username ?? "-"}</TableCell>
                <TableCell>{admin.phone}</TableCell>
                <TableCell>{admin.branch?.name ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(admin.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(admin)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(admin)}>
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
            <DialogTitle>{editing ? "Редактировать администратора" : "Добавить администратора"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">ФИО</Label>
              <Input id="fullName" placeholder="например, Иванов Иван" {...form.register("fullName")} />
              {form.formState.errors.fullName && (
                <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" placeholder="например, +998901234567" {...form.register("phone")} />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
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
                      <SelectValue placeholder="Выбрать" />
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

            <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/50 p-3">
              <div className="col-span-2 -mb-1 text-xs font-medium text-muted-foreground">
                Данные для входа в систему
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">Логин</Label>
                <Input id="username" placeholder="например, ivanov" {...form.register("username")} />
                {form.formState.errors.username && (
                  <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{editing ? "Новый пароль" : "Пароль"}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={editing ? "Оставьте пустым, чтобы не менять" : "••••••••"}
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Сохранить изменения" : "Создать администратора"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteAdmin.isPending}
        title="Удалить администратора?"
        description={`Администратор «${deleteTarget?.fullName}» и его учётная запись будут удалены без возможности восстановления.`}
      />
    </div>
  );
}
