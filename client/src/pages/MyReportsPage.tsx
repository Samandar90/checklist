import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardList, Download } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
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

import { useRooms } from "@/hooks/useRooms";
import { useSources } from "@/hooks/useSources";
import {
  useReports,
  useCreateReport,
  useUpdateReport,
  useDeleteReport,
} from "@/hooks/useReports";

import { MonthlyReport, paymentMethods } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";
import { exportReportsToCsv } from "@/lib/csv";

const currencies = ["UZS", "USD", "EUR"];

const reportFormSchema = z.object({
  date: z.string().trim().min(1, "Укажите дату"),
  roomId: z.string().trim().min(1, "Выберите номер"),
  sourceId: z.string().trim().min(1, "Выберите источник бронирования"),
  price: z.number({ invalid_type_error: "Укажите цену" }).positive("Цена должна быть положительной"),
  currency: z.string().trim().min(1, "Выберите валюту"),
  paymentMethod: z.enum(paymentMethods, { errorMap: () => ({ message: "Выберите способ оплаты" }) }),
  notes: z.string().trim().optional(),
});
type ReportFormValues = z.infer<typeof reportFormSchema>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MyReportsPage() {
  const { user } = useAuth();
  const { data: rooms } = useRooms();
  const { data: sources } = useSources();
  const { data: reports, isLoading } = useReports({});

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
      roomId: "",
      sourceId: "",
      price: 0,
      currency: "UZS",
      paymentMethod: "Наличные",
      notes: "",
    },
  });

  const hasRequiredData = (rooms ?? []).length > 0 && (sources ?? []).length > 0;

  function openCreate() {
    setEditing(null);
    form.reset({
      date: todayIso(),
      roomId: "",
      sourceId: "",
      price: 0,
      currency: "UZS",
      paymentMethod: "Наличные",
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(report: MonthlyReport) {
    setEditing(report);
    form.reset({
      date: report.date.slice(0, 10),
      roomId: report.roomId,
      sourceId: report.sourceId,
      price: report.price,
      currency: report.currency,
      paymentMethod: report.paymentMethod,
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
    exportReportsToCsv(reports, "мои-отчёты.csv");
    toast.success("CSV-файл экспортирован");
  }

  const totalRevenue = (reports ?? []).reduce((sum, r) => sum + r.price, 0);

  return (
    <div>
      <PageHeader
        title="Мои отчёты"
        description={`${user?.fullName ?? user?.username} · ${user?.branchName ?? ""}`}
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
          В вашем филиале пока нет номеров или не настроены источники бронирования. Обратитесь к главному администратору.
        </div>
      )}

      <Card className="mb-6 max-w-xs">
        <CardHeader className="pb-2">
          <CardTitle>Моя выручка</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-foreground">{totalRevenue.toLocaleString("ru-RU")}</div>
          <p className="mt-1 text-xs text-muted-foreground">{(reports ?? []).length} отчётов</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (reports ?? []).length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="У вас пока нет отчётов"
          description="Добавьте первый отчёт, чтобы начать работу."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Номер</TableHead>
              <TableHead>Источник</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Оплата</TableHead>
              <TableHead>Заметки</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(reports ?? []).map((report) => (
              <TableRow key={report.id}>
                <TableCell>{formatDate(report.date)}</TableCell>
                <TableCell>{report.room.roomNumber}</TableCell>
                <TableCell>{report.source.name}</TableCell>
                <TableCell className="font-medium text-foreground">
                  {formatMoney(report.price, report.currency)}
                </TableCell>
                <TableCell>{report.paymentMethod}</TableCell>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать отчёт" : "Добавить отчёт"}</DialogTitle>
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
              <Label>Номер</Label>
              <Controller
                control={form.control}
                name="roomId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выбрать" />
                    </SelectTrigger>
                    <SelectContent>
                      {(rooms ?? []).map((r) => (
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
                      <SelectValue placeholder="Выбрать" />
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
              <Controller
                control={form.control}
                name="price"
                render={({ field }) => (
                  <CurrencyInput id="price" value={field.value} onChange={field.onChange} />
                )}
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

            <div className="space-y-1.5">
              <Label>Способ оплаты</Label>
              <Controller
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выбрать" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.paymentMethod && (
                <p className="text-xs text-destructive">{form.formState.errors.paymentMethod.message}</p>
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
