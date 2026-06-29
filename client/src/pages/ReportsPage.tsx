import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardList, Download, X, Search, Eye, LogIn, LogOut, Ban, UserX, Columns3, BookmarkPlus, Bookmark } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";

import { useTableControls } from "@/hooks/useTableControls";
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
  useBulkReportAction,
  BulkBookingAction,
} from "@/hooks/useReports";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useSavedViews } from "@/hooks/useSavedViews";

import { Badge } from "@/components/ui/badge";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import BookingDetailsDrawer from "@/components/BookingDetailsDrawer";
import { MonthlyReport, ReportFilters, paymentMethods, paymentStatuses } from "@/types";
import { getErrorMessage } from "@/lib/api";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  reportDebt,
  paymentStatusClass,
  nightsBetween,
  addDaysIso,
} from "@/lib/utils";
import { exportReportsToCsv } from "@/lib/csv";

const COLUMNS = [
  { id: "guest", label: "Гость" },
  { id: "branch", label: "Филиал" },
  { id: "admin", label: "Администратор" },
  { id: "room", label: "Номер" },
  { id: "source", label: "Источник" },
  { id: "price", label: "Цена" },
  { id: "payment", label: "Оплата" },
  { id: "status", label: "Статус" },
  { id: "notes", label: "Заметки" },
];

const BULK_ACTIONS: { action: BulkBookingAction; label: string; icon: typeof LogIn; destructive?: boolean }[] = [
  { action: "CHECK_IN", label: "Заселить", icon: LogIn },
  { action: "CHECK_OUT", label: "Выселить", icon: LogOut },
  { action: "NO_SHOW", label: "Не заехал", icon: UserX },
  { action: "CANCEL", label: "Отменить", icon: Ban },
  { action: "DELETE", label: "Удалить", icon: Trash2, destructive: true },
];

const currencies = ["UZS", "USD", "EUR"];

const paymentMethodOptions = paymentMethods.map((m) => ({ value: m, label: m }));
const paymentStatusOptions = [
  { value: "Оплачено" as const, label: "Оплачено", activeCls: "bg-emerald-500 text-white shadow-sm" },
  { value: "Частично" as const, label: "Частично", activeCls: "bg-amber-500 text-white shadow-sm" },
  { value: "Долг" as const, label: "Долг", activeCls: "bg-red-500 text-white shadow-sm" },
];

const reportFormSchema = z
  .object({
    date: z.string().trim().min(1, "Укажите дату заезда"),
    checkOut: z.string().trim().min(1, "Укажите дату выезда"),
    guestName: z.string().trim().optional(),
    branchId: z.string().trim().min(1, "Выберите филиал"),
    adminId: z.string().trim().min(1, "Выберите администратора"),
    roomId: z.string().trim().min(1, "Выберите номер"),
    sourceId: z.string().trim().min(1, "Выберите источник бронирования"),
    price: z.number({ invalid_type_error: "Укажите цену" }).positive("Цена должна быть положительной"),
    currency: z.string().trim().min(1, "Выберите валюту"),
    paymentMethod: z.enum(paymentMethods, { errorMap: () => ({ message: "Выберите способ оплаты" }) }),
    paymentStatus: z.enum(paymentStatuses, { errorMap: () => ({ message: "Выберите статус оплаты" }) }),
    paidAmount: z.number({ invalid_type_error: "Укажите сумму" }).min(0).optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.checkOut && data.date && new Date(data.checkOut) <= new Date(data.date)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checkOut"], message: "Выезд должен быть позже заезда" });
    }
    if (data.paymentStatus === "Частично") {
      if (!data.paidAmount || data.paidAmount <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paidAmount"], message: "Укажите оплаченную сумму" });
      } else if (data.paidAmount >= data.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paidAmount"],
          message: "Должна быть меньше цены",
        });
      }
    }
  });
type ReportFormValues = z.infer<typeof reportFormSchema>;

const months = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function reportMatches(r: MonthlyReport, q: string) {
  return (
    r.branch.name.toLowerCase().includes(q) ||
    r.admin.fullName.toLowerCase().includes(q) ||
    r.room.roomNumber.toLowerCase().includes(q) ||
    r.source.name.toLowerCase().includes(q) ||
    (r.notes ?? "").toLowerCase().includes(q) ||
    r.paymentMethod.toLowerCase().includes(q) ||
    r.paymentStatus.toLowerCase().includes(q)
  );
}

export default function ReportsPage() {
  const { data: branches } = useBranches();
  const { data: admins } = useAdmins();
  const { data: rooms } = useRooms();
  const { data: sources } = useSources();

  const [filters, setFilters] = useState<ReportFilters>({});
  const { data: reports, isLoading } = useReports(filters);
  const { data: summary } = useReportSummary(filters);
  const controls = useTableControls(reports ?? [], reportMatches, 10);

  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  const deleteReport = useDeleteReport();
  const bulkAction = useBulkReportAction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MonthlyReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonthlyReport | null>(null);
  const [viewing, setViewing] = useState<MonthlyReport | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  const columns = useColumnVisibility("reports-columns", COLUMNS.map((c) => c.id));
  const savedViews = useSavedViews<ReportFilters>("reports-saved-views");

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      date: todayIso(),
      checkOut: addDaysIso(todayIso(), 1),
      guestName: "",
      branchId: "",
      adminId: "",
      roomId: "",
      sourceId: "",
      price: 0,
      currency: "UZS",
      paymentMethod: "Наличные",
      paymentStatus: "Оплачено",
      paidAmount: undefined,
      notes: "",
    },
  });

  const selectedBranchId = form.watch("branchId");
  const selectedPaymentStatus = form.watch("paymentStatus");

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
      checkOut: addDaysIso(todayIso(), 1),
      guestName: "",
      branchId: "",
      adminId: "",
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
      checkOut: report.checkOut ? report.checkOut.slice(0, 10) : addDaysIso(report.date.slice(0, 10), 1),
      guestName: report.guestName ?? "",
      branchId: report.branchId,
      adminId: report.adminId,
      roomId: report.roomId,
      sourceId: report.sourceId,
      price: report.price,
      currency: report.currency,
      paymentMethod: report.paymentMethod,
      paymentStatus: report.paymentStatus,
      paidAmount: report.paidAmount ?? undefined,
      notes: report.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: ReportFormValues) {
    try {
      if (editing) {
        await updateReport.mutateAsync({ id: editing.id, data: { ...values, status: editing.status } });
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

  function handleExport(subset?: MonthlyReport[]) {
    const data = subset ?? reports ?? [];
    if (data.length === 0) {
      toast.error("Нет отчётов для экспорта");
      return;
    }
    exportReportsToCsv(data);
    toast.success("CSV-файл экспортирован");
  }

  function clearFilters() {
    setFilters({});
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    const pageIds = controls.pageItems.map((r) => r.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function runBulkAction(action: BulkBookingAction) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (action === "DELETE") {
      setBulkDeleteOpen(true);
      return;
    }
    try {
      await bulkAction.mutateAsync({ ids, action });
      toast.success(`Применено к ${ids.length} бронированиям`);
      setSelected(new Set());
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmBulkDelete() {
    const ids = Array.from(selected);
    try {
      await bulkAction.mutateAsync({ ids, action: "DELETE" });
      toast.success(`Удалено ${ids.length} бронирований`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
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
            <Button variant="outline" onClick={() => handleExport()}>
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
          <div className="w-56 space-y-1.5">
            <Label>Поиск</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={controls.search}
                onChange={(e) => controls.setSearch(e.target.value)}
                placeholder="Филиал, админ, номер…"
                className="pl-8"
              />
            </div>
          </div>

          <div className="w-40 space-y-1.5">
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

          <div className="w-28 space-y-1.5">
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

          <div className="w-56 space-y-1.5">
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

          <div className="w-56 space-y-1.5">
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

          <div className="w-56 space-y-1.5">
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

          <div className="relative ml-auto">
            <Button variant="outline" size="sm" onClick={() => setViewsMenuOpen((o) => !o)}>
              <Bookmark className="h-3.5 w-3.5" /> Сохранённые виды
            </Button>
            {viewsMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 text-sm shadow-xl animate-pop-in">
                <button
                  onClick={() => {
                    const name = window.prompt("Название вида фильтров:");
                    if (name) savedViews.save(name, filters);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-foreground transition-colors hover:bg-secondary"
                >
                  <BookmarkPlus className="h-[15px] w-[15px] text-muted-foreground" /> Сохранить текущий вид
                </button>
                {savedViews.views.length > 0 && <div className="my-1 border-t border-border" />}
                {savedViews.views.map((v) => (
                  <div key={v.name} className="flex items-center justify-between px-3 py-2 hover:bg-secondary">
                    <button onClick={() => { setFilters(v.filters); setViewsMenuOpen(false); }} className="truncate text-left text-foreground">
                      {v.name}
                    </button>
                    <button onClick={() => savedViews.remove(v.name)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setColumnsMenuOpen((o) => !o)}>
              <Columns3 className="h-3.5 w-3.5" /> Колонки
            </Button>
            {columnsMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-56 overflow-hidden rounded-xl border border-border bg-card py-1 text-sm shadow-xl animate-pop-in">
                {COLUMNS.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-foreground transition-colors hover:bg-secondary">
                    <input type="checkbox" checked={columns.isVisible(c.id)} onChange={() => columns.toggle(c.id)} className="accent-primary" />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Сводка */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-4 lg:divide-y-0 lg:divide-x">
          <div className="p-5">
            <span className="text-[12.5px] font-medium text-muted-foreground">Общая выручка</span>
            <div className="mt-2.5 text-[26px] font-semibold tabular-nums tracking-tight text-foreground">
              {(summary?.totalRevenue ?? 0).toLocaleString("ru-RU")}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{summary?.totalReports ?? 0} отчётов</p>
          </div>

          <div className="p-5">
            <span className="text-[12.5px] font-medium text-muted-foreground">По филиалам</span>
            <div className="mt-2.5 space-y-1.5">
              {(summary?.byBranch ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Нет данных</p>
              ) : (
                summary?.byBranch.map((b) => (
                  <div key={b.name} className="flex justify-between text-sm">
                    <span className="truncate text-muted-foreground">{b.name}</span>
                    <span className="tabular-nums font-medium text-foreground">{b.total.toLocaleString("ru-RU")}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-5">
            <span className="text-[12.5px] font-medium text-muted-foreground">По администраторам</span>
            <div className="mt-2.5 space-y-1.5">
              {(summary?.byAdmin ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Нет данных</p>
              ) : (
                summary?.byAdmin.map((a) => (
                  <div key={a.name} className="flex justify-between text-sm">
                    <span className="truncate text-muted-foreground">{a.name}</span>
                    <span className="tabular-nums font-medium text-foreground">{a.total.toLocaleString("ru-RU")}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-5">
            <span className="text-[12.5px] font-medium text-muted-foreground">По источникам</span>
            <div className="mt-2.5 space-y-1.5">
              {(summary?.bySource ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Нет данных</p>
              ) : (
                summary?.bySource.map((s) => (
                  <div key={s.name} className="flex justify-between text-sm">
                    <span className="truncate text-muted-foreground">{s.name}</span>
                    <span className="tabular-nums font-medium text-foreground">{s.total.toLocaleString("ru-RU")}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

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
      ) : controls.totalItems === 0 ? (
        <EmptyState
          icon={Search}
          title="Ничего не найдено"
          description="По вашему запросу нет отчётов. Измените поиск."
        />
      ) : (
        <>
        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
            <span className="text-sm font-medium text-foreground">Выбрано: {selected.size}</span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {BULK_ACTIONS.map((a) => (
                <Button
                  key={a.action}
                  variant="outline"
                  size="sm"
                  disabled={bulkAction.isPending}
                  onClick={() => runBulkAction(a.action)}
                  className={a.destructive ? "text-destructive hover:text-destructive" : undefined}
                >
                  <a.icon className="h-3.5 w-3.5" /> {a.label}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport((reports ?? []).filter((r) => selected.has(r.id)))}
              >
                <Download className="h-3.5 w-3.5" /> Экспорт
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Снять выбор
              </Button>
            </div>
          </div>
        )}
        <div className="max-h-[65vh] overflow-y-auto rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="sticky top-0 z-10 bg-card">
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={controls.pageItems.length > 0 && controls.pageItems.every((r) => selected.has(r.id))}
                  onChange={toggleSelectPage}
                />
              </TableHead>
              <TableHead>Дата</TableHead>
              {columns.isVisible("branch") && <TableHead>Филиал</TableHead>}
              {columns.isVisible("admin") && <TableHead>Администратор</TableHead>}
              {columns.isVisible("room") && <TableHead>Номер</TableHead>}
              {columns.isVisible("source") && <TableHead>Источник</TableHead>}
              {columns.isVisible("guest") && <TableHead>Гость</TableHead>}
              {columns.isVisible("price") && <TableHead>Цена</TableHead>}
              {columns.isVisible("payment") && <TableHead>Оплата</TableHead>}
              {columns.isVisible("status") && <TableHead>Статус</TableHead>}
              {columns.isVisible("notes") && <TableHead>Заметки</TableHead>}
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {controls.pageItems.map((report) => (
              <TableRow key={report.id} className={selected.has(report.id) ? "bg-primary/[0.04]" : undefined}>
                <TableCell>
                  <input type="checkbox" className="accent-primary" checked={selected.has(report.id)} onChange={() => toggleSelected(report.id)} />
                </TableCell>
                <TableCell>
                  {formatDate(report.date)}
                  <span className="block text-[11px] text-muted-foreground">
                    → {report.checkOut ? formatDate(report.checkOut) : "+1"} · {nightsBetween(report.date, report.checkOut)} ноч.
                  </span>
                  {report.updatedAt && (
                    <span
                      className="mt-0.5 block text-[10px] font-medium text-amber-600"
                      title={`Изменён: ${formatDateTime(report.updatedAt)}`}
                    >
                      ред.
                    </span>
                  )}
                </TableCell>
                {columns.isVisible("branch") && <TableCell>{report.branch.name}</TableCell>}
                {columns.isVisible("admin") && <TableCell>{report.admin.fullName}</TableCell>}
                {columns.isVisible("room") && <TableCell>{report.room.roomNumber}</TableCell>}
                {columns.isVisible("source") && <TableCell>{report.source.name}</TableCell>}
                {columns.isVisible("guest") && <TableCell>{report.guestName || "-"}</TableCell>}
                {columns.isVisible("price") && (
                  <TableCell className="font-medium text-foreground">
                    {formatMoney(report.price, report.currency)}
                  </TableCell>
                )}
                {columns.isVisible("payment") && <TableCell>{report.paymentMethod}</TableCell>}
                {columns.isVisible("status") && (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <BookingStatusBadge status={report.status} />
                      <Badge className={paymentStatusClass(report.paymentStatus)} title="Статус оплаты">{report.paymentStatus}</Badge>
                    </div>
                    {reportDebt(report) > 0 && (
                      <span className="mt-0.5 block text-xs text-destructive">
                        Долг: {formatMoney(reportDebt(report), report.currency)}
                      </span>
                    )}
                  </TableCell>
                )}
                {columns.isVisible("notes") && (
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {report.notes || "-"}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewing(report)}>
                      <Eye className="h-4 w-4" />
                    </Button>
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
        </div>
        <Pagination
          page={controls.page}
          totalPages={controls.totalPages}
          totalItems={controls.totalItems}
          pageSize={controls.pageSize}
          onPageChange={controls.setPage}
        />
        </>
      )}

      {/* Диалог создания / редактирования */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать отчёт" : "Добавить ежемесячный отчёт"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="date">Заезд</Label>
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <Input
                    id="date"
                    type="date"
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      const co = form.getValues("checkOut");
                      if (!co || new Date(co) <= new Date(e.target.value)) {
                        form.setValue("checkOut", addDaysIso(e.target.value, 1));
                      }
                    }}
                  />
                )}
              />
              {form.formState.errors.date && (
                <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkOut">Выезд</Label>
              <Controller
                control={form.control}
                name="checkOut"
                render={({ field }) => (
                  <Input
                    id="checkOut"
                    type="date"
                    min={form.watch("date")}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                )}
              />
              {form.formState.errors.checkOut && (
                <p className="text-xs text-destructive">{form.formState.errors.checkOut.message}</p>
              )}
            </div>

            <div className="col-span-2 -mt-2">
              <p className="text-xs text-muted-foreground">
                Ночей: <span className="font-medium text-foreground">{nightsBetween(form.watch("date"), form.watch("checkOut"))}</span>
              </p>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="guestName">Имя гостя</Label>
              <Input id="guestName" placeholder="например, Иван Иванов" {...form.register("guestName")} />
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

            <div className="space-y-1.5">
              <Label>Администратор</Label>
              <Controller
                control={form.control}
                name="adminId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выбрать" />
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
                      <SelectValue placeholder="Выбрать" />
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

            <div className="col-span-2 space-y-1.5">
              <Label>Способ оплаты</Label>
              <Controller
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <Segmented options={paymentMethodOptions} value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Статус оплаты</Label>
              <Controller
                control={form.control}
                name="paymentStatus"
                render={({ field }) => (
                  <Segmented
                    options={paymentStatusOptions}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      if (v !== "Частично") form.setValue("paidAmount", undefined);
                    }}
                  />
                )}
              />
            </div>

            {selectedPaymentStatus === "Частично" && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="paidAmount">Оплачено сейчас</Label>
                <Controller
                  control={form.control}
                  name="paidAmount"
                  render={({ field }) => (
                    <CurrencyInput id="paidAmount" value={field.value ?? 0} onChange={field.onChange} />
                  )}
                />
                {(() => {
                  const remaining = (form.watch("price") || 0) - (form.watch("paidAmount") || 0);
                  return remaining > 0 ? (
                    <p className="text-xs text-amber-600">
                      Остаток долга: {remaining.toLocaleString("ru-RU")}
                    </p>
                  ) : null;
                })()}
                {form.formState.errors.paidAmount && (
                  <p className="text-xs text-destructive">{form.formState.errors.paidAmount.message}</p>
                )}
              </div>
            )}

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

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={confirmBulkDelete}
        loading={bulkAction.isPending}
        title={`Удалить ${selected.size} бронирований?`}
        description="Выбранные записи будут удалены без возможности восстановления."
      />

      <BookingDetailsDrawer
        report={viewing}
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={(r) => {
          setViewing(null);
          openEdit(r);
        }}
        onDelete={(r) => {
          setViewing(null);
          setDeleteTarget(r);
        }}
      />
    </div>
  );
}
