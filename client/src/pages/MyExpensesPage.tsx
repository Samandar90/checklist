import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Wallet, Search } from "lucide-react";

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
import ExpenseDayList from "@/components/ExpenseDayList";

import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/useExpenses";
import { Expense, expenseCategories } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/api";


const expenseFormSchema = z.object({
  date: z.string().trim().min(1, "Укажите дату"),
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
  return e.category.toLowerCase().includes(q) || (e.note ?? "").toLowerCase().includes(q);
}

const emptyForm: ExpenseFormValues = {
  date: todayIso(),
  category: "Прочее",
  amount: 0,
  currency: "UZS",
  note: "",
};

export default function MyExpensesPage() {
  const { user } = useAuth();
  const { data: expenses, isLoading } = useExpenses({});
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visible = (expenses ?? []).filter((e) => !q || expenseMatches(e, q));

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

  return (
    <div>
      <PageHeader
        title="Расходы за смену"
        description={`${user?.fullName ?? user?.username} · ${user?.branchName ?? ""}`}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Добавить расход
          </Button>
        }
      />

      <Card className="mb-6 max-w-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-[12.5px]">Мои расходы</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-[26px] font-semibold tabular-nums tracking-tight text-foreground">{total.toLocaleString("ru-RU")}</div>
          <p className="mt-1 text-xs text-muted-foreground">{(expenses ?? []).length} записей</p>
        </CardContent>
      </Card>

      {(expenses ?? []).length > 0 && (
        <div className="mb-4 max-w-xs">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: категория, заметка…"
              className="pl-8"
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (expenses ?? []).length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="У вас пока нет расходов"
          description="Добавьте расход за смену, чтобы он попал в общий учёт."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Ничего не найдено"
          description="По вашему запросу нет расходов. Измените поиск."
        />
      ) : (
        <ExpenseDayList expenses={visible} onEdit={openEdit} onDelete={setDeleteTarget} />
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

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="amount">Сумма, UZS</Label>
              <Controller
                control={form.control}
                name="amount"
                render={({ field }) => <CurrencyInput id="amount" value={field.value} onChange={field.onChange} />}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="note">Детали расхода</Label>
              <Textarea
                id="note"
                placeholder="Опишите подробно: что куплено / оплачено, для чего…"
                {...form.register("note")}
              />
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
