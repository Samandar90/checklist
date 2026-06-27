import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wallet, X, Search } from "lucide-react";

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
import { Pagination } from "@/components/ui/pagination";

import { useTableControls } from "@/hooks/useTableControls";
import { useBranches } from "@/hooks/useBranches";
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/useExpenses";
import { Expense, ExpenseFilters, expenseCategories } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";

const currencies = ["UZS", "USD", "EUR"];

const expenseFormSchema = z.object({
  date: z.string().trim().min(1, "Укажите дату"),
  branchId: z.string().trim().min(1, "Выберите филиал"),
  category: z.enum(expenseCategories, { errorMap: () => ({ message: "Выберите категорию" }) }),
  amount: z.number({ invalid_type_error: "Укажите сумму" }).positive("Сумма должна быть положительной"),
  currency: z.string().trim().min(1, "Выберите валюту"),
  note: z.string().trim().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function expenseMatches(e: Expense, q: string) {
  return (
    e.branch.name.toLowerCase().includes(q) ||
    e.category.toLowerCase().includes(q) ||
    (e.note ?? "").toLowerCase().includes(q)
  );
}

const emptyForm: ExpenseFormValues = {
  date: todayIso(),
  branchId: "",
  category: "Прочее",
  amount: 0,
  currency: "UZS",
  note: "",
};

export default function ExpensesPage() {
  const { data: branches } = useBranches();
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const { data: expenses, isLoading } = useExpenses(filters);
  const controls = useTableControls(expenses ?? [], expenseMatches, 10);

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: emptyForm,
  });

  const hasBranches = (branches ?? []).length > 0;
  const total = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    form.reset({
      date: expense.date.slice(0, 10),
      branchId: expense.branchId,
      category: expense.category,
      amount: expense.amount,
      currency: expense.currency,
      note: expense.note ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: ExpenseFormValues) {
    try {
      if (editing) {
        await updateExpense.mutateAsync({ id: editing.id, data: values });
        toast.success("Расход обновлён");
      } else {
        await createExpense.mutateAsync(values);
        toast.success("Расход добавлен");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteExpense.mutateAsync(deleteTarget.id);
      toast.success("Расход удалён");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader
        title="Расходы"
        description="Учёт расходов филиалов для расчёта чистой прибыли."
        action={
          <Button onClick={openCreate} disabled={!hasBranches}>
            <Plus className="h-4 w-4" /> Добавить расход
          </Button>
        }
      />

      {!hasBranches && (
        <div className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
          Сначала создайте хотя бы один филиал.
        </div>
      )}

      {/* Фильтры */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-52 space-y-1.5">
            <Label>Поиск</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={controls.search}
                onChange={(e) => controls.setSearch(e.target.value)}
                placeholder="Филиал, категория…"
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>С</Label>
            <Input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label>По</Label>
            <Input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
              className="w-40"
            />
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
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
              <X className="h-3.5 w-3.5" /> Сбросить
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6 max-w-xs">
        <CardHeader className="pb-2">
          <CardTitle>Сумма расходов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-foreground">{total.toLocaleString("ru-RU")}</div>
          <p className="mt-1 text-xs text-muted-foreground">{(expenses ?? []).length} записей</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (expenses ?? []).length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Расходы не найдены"
          description="Добавьте первый расход или измените фильтры."
        />
      ) : controls.totalItems === 0 ? (
        <EmptyState
          icon={Search}
          title="Ничего не найдено"
          description="По вашему запросу нет расходов. Измените поиск."
        />
      ) : (
        <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Сумма</TableHead>
              <TableHead>Заметка</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {controls.pageItems.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>{formatDate(expense.date)}</TableCell>
                <TableCell>{expense.branch.name}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell className="font-medium text-foreground">
                  {formatMoney(expense.amount, expense.currency)}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {expense.note || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(expense)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(expense)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          page={controls.page}
          totalPages={controls.totalPages}
          totalItems={controls.totalItems}
          pageSize={controls.pageSize}
          onPageChange={controls.setPage}
        />
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать расход" : "Добавить расход"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="exp-date">Дата</Label>
              <Input id="exp-date" type="date" {...form.register("date")} />
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

            <div className="space-y-1.5">
              <Label>Категория</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выбрать" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.category && (
                <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">Сумма</Label>
              <Controller
                control={form.control}
                name="amount"
                render={({ field }) => <CurrencyInput id="amount" value={field.value} onChange={field.onChange} />}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
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
              <Label htmlFor="note">Заметка</Label>
              <Textarea id="note" placeholder="Необязательная заметка" {...form.register("note")} />
            </div>

            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Сохранить изменения" : "Добавить расход"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteExpense.isPending}
        title="Удалить расход?"
        description="Эта запись о расходе будет удалена без возможности восстановления."
      />
    </div>
  );
}
