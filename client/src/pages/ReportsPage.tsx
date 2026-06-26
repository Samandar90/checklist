import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardList, Download, X } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useBranches } from "@/hooks/useBranches";
import { useAdmins } from "@/hooks/useAdmins";
import { useRooms } from "@/hooks/useRooms";
import { useSources } from "@/hooks/useSources";
import {
  useReports,
  useReportSummary,
  useCreateReport,
  useUpdateReport,
  useDeleteReport,
} from "@/hooks/useReports";

import { MonthlyReport, ReportFilters } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";
import { exportReportsToCsv } from "@/lib/csv";

const currencies = ["UZS", "USD", "EUR"];

const reportFormSchema = z.object({
  date: z.string().trim().min(1, "Укажите дату"),
  branchId: z.string().trim().min(1, "Выберите филиал"),
  adminId: z.string().trim().min(1, "Выберите администратора"),
  roomId: z.string().trim().min(1, "Выберите номер"),
  sourceId: z.string().trim().min(1, "Выберите источник бронирования"),
  price: z.number({ invalid_type_error: "Укажите цену" }).positive("Цена должна быть положительной"),
  currency: z.string().trim().min(1, "Выберите валюту"),
  notes: z.string().trim().optional(),
});
type ReportFormValues = z.infer<typeof reportFormSchema>;

const months = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { data: branches } = useBranches();
  const { data: admins } = useAdmins();
  const { data: rooms } = useRooms();
  const { data: sources } = useSources();

  const [filters, setFilters] = useState<ReportFilters>({});
  const { data: reports, isLoading } = useReports(filters);
  const { data: summary } = useReportSummary(filters);

  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  const deleteReport = useDeleteReport();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MonthlyReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonthlyReport | null>(null);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      date: todayIso(),
      branchId: "",
      adminId: "",
      roomId: "",
      sourceId: "",
      price: 0,
      currency: "UZS",
      notes: "",
    },
  });

  const selectedBranchId = form.watch("branchId");

  const filteredAdmins = useMemo(
    () => (admins ?? []).filter((a) => !selectedBranchId || a.branchId === selectedBranchId),
    [admins, selectedBranchId]
  );
  const filteredRooms = useMemo(
    () => (rooms ?? []).filter((r) => !selectedBranchId || r.branchId === selectedBranchId),
    [rooms, selectedBranchId]
  );

  const hasRequiredData =
    (branches ?? []).length > 0 &&
    (admins ?? []).length > 0 &&
    (rooms ?? []).length > 0 &&
    (sources ?? []).length > 0;

  function openCreate() {
    setEditing(null);
    form.reset({
      date: todayIso(),
      branchId: "",
      adminId: "",
      roomId: "",
      sourceId: "",
      price: 0,
      currency: "UZS",
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(report: MonthlyReport) {
    setEditing(report);
    form.reset({
      date: report.date.slice(0, 10),
      branchId: report.branchId,
      adminId: report.adminId,
      roomId: report.roomId,
      sourceId: report.sourceId,
      price: report.price,
      currency: report.currency,
      notes: report.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: ReportFormValues) {
    try {
      if (editing) {
        await updateReport.mutateAsync({ id: editing.id, data: values });
        toast.success("Отчёт обновлён");
      } else {
        await createReport.mutateAsync(values);
        toast.success("Отчёт создан");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteReport.mutateAsync(deleteTarget.id);
      toast.success("Отчёт удалён");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function handleExport() {
    if (!reports || reports.length === 0) {
      toast.error("Нет отчётов для экспорта");
      return;
    }
    exportReportsToCsv(reports);
    toast.success("CSV-файл экспортирован");
  }

  function clearFilters() {
    setFilters({});
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div>
      <PageHeader
        title="Ежемесячные отчёты"
        description="Фиксируйте и анализируйте ежемесячные отчёты по бронированиям."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Экспорт в CSV
            </Button>
            <Button onClick={openCreate} disabled={!hasRequiredData}>
              <Plus className="h-4 w-4" /> Добавить отчёт
            </Button>
          </div>
        }
      />

      {!hasRequiredData && (
        <div className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
          Для создания отчётов нужен хотя бы один филиал, администратор, номер и источник бронирования.
        </div>
      )}

      {/* Фильтры */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-36 space-y-1.5">
            <Label>Месяц</Label>
            <Select
              value={filters.month ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, month: v === "all" ? undefined : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все месяцы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все месяцы</SelectItem>
                {months.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32 space-y-1.5">
            <Label>Год</Label>
            <Select
              value={filters.year ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, year: v === "all" ? undefined : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все годы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все годы</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-44 space-y-1.5">
            <Label>Филиал</Label>
            <Select
              value={filters.branchId ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, branchId: v === "all" ? undefined : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все филиалы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все филиалы</SelectItem>
                {(branches ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-44 space-y-1.5">
            <Label>Администратор</Label>
            <Select
              value={filters.adminId ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, adminId: v === "all" ? undefined : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все администраторы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все администраторы</SelectItem>
                {(admins ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-44 space-y-1.5">
            <Label>Источник</Label>
            <Select
              value={filters.sourceId ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, sourceId: v === "all" ? undefined : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все источники" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все источники</SelectItem>
                {(sources ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Сбросить фильтры
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Сводка */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Общая выручка</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {(summary?.totalRevenue ?? 0).toLocaleString("ru-RU")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{summary?.totalReports ?? 0} отчётов</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Выручка по филиалам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(summary?.byBranch ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет данных</p>
            ) : (
              summary?.byBranch.map((b) => (
                <div key={b.name} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{b.name}</span>
                  <span className="font-medium text-foreground">{b.total.toLocaleString("ru-RU")}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Выручка по администраторам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(summary?.byAdmin ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет данных</p>
            ) : (
              summary?.byAdmin.map((a) => (
                <div key={a.name} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span className="font-medium text-foreground">{a.total.toLocaleString("ru-RU")}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Выручка по источникам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(summary?.bySource ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет данных</p>
            ) : (
              summary?.bySource.map((s) => (
                <div key={s.name} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-medium text-foreground">{s.total.toLocaleString("ru-RU")}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Таблица */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (reports ?? []).length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Отчёты не найдены"
          description="Попробуйте изменить фильтры или добавить новый отчёт."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead>Администратор</TableHead>
              <TableHead>Номер</TableHead>
              <TableHead>Источник</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Заметки</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(reports ?? []).map((report) => (
              <TableRow key={report.id}>
                <TableCell>{formatDate(report.date)}</TableCell>
                <TableCell>{report.branch.name}</TableCell>
                <TableCell>{report.admin.fullName}</TableCell>
                <TableCell>{report.room.roomNumber}</TableCell>
                <TableCell>{report.source.name}</TableCell>
                <TableCell className="font-medium text-foreground">
                  {formatMoney(report.price, report.currency)}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {report.notes || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(report)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(report)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Диалог создания / редактирования */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать отчёт" : "Добавить ежемесячный отчёт"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="date">Дата</Label>
              <Input id="date" type="date" {...form.register("date")} />
              {form.formState.errors.date && (
                <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Филиал</Label>
              <Controller
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("adminId", "");
                      form.setValue("roomId", "");
                    }}
                  >
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

            <div className="space-y-1.5">
              <Label>Администратор</Label>
              <Controller
                control={form.control}
                name="adminId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите администратора" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredAdmins.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.adminId && (
                <p className="text-xs text-destructive">{form.formState.errors.adminId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Номер</Label>
              <Controller
                control={form.control}
                name="roomId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите номер" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.roomNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.roomId && (
                <p className="text-xs text-destructive">{form.formState.errors.roomId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Источник бронирования</Label>
              <Controller
                control={form.control}
                name="sourceId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите источник" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sources ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.sourceId && (
                <p className="text-xs text-destructive">{form.formState.errors.sourceId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price">Цена</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                {...form.register("price", { valueAsNumber: true })}
              />
              {form.formState.errors.price && (
                <p className="text-xs text-destructive">{form.formState.errors.price.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Валюта</Label>
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Валюта" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.currency && (
                <p className="text-xs text-destructive">{form.formState.errors.currency.message}</p>
              )}
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="notes">Заметки</Label>
              <Textarea id="notes" placeholder="Необязательные заметки" {...form.register("notes")} />
            </div>

            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Сохранить изменения" : "Создать отчёт"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteReport.isPending}
        title="Удалить отчёт?"
        description="Эта запись отчёта будет удалена без возможности восстановления."
      />
    </div>
  );
}
