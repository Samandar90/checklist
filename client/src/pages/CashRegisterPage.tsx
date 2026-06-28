import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Wallet, Lock, LockOpen, TrendingUp, TrendingDown, Scale } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

import { useAuth } from "@/contexts/AuthContext";
import {
  useActiveCashShift,
  useCashShifts,
  useOpenCashShift,
  useCloseCashShift,
} from "@/hooks/useCashShifts";
import { getErrorMessage } from "@/lib/api";
import { formatMoney, cn } from "@/lib/utils";

const currencies = ["UZS", "USD", "EUR"];

const openSchema = z.object({
  openingAmount: z.number({ invalid_type_error: "Укажите сумму" }).min(0, "Не может быть отрицательной"),
  currency: z.string().trim().min(1, "Выберите валюту"),
  notes: z.string().trim().optional(),
});
type OpenValues = z.infer<typeof openSchema>;

const closeSchema = z.object({
  closingAmount: z.number({ invalid_type_error: "Укажите сумму" }).min(0, "Не может быть отрицательной"),
  notes: z.string().trim().optional(),
});
type CloseValues = z.infer<typeof closeSchema>;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function CashRegisterPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data: active, isLoading: activeLoading } = useActiveCashShift();
  const { data: history, isLoading: historyLoading } = useCashShifts(isAdmin ? {} : {});
  const openShift = useOpenCashShift();
  const closeShift = useCloseCashShift();

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const openForm = useForm<OpenValues>({
    resolver: zodResolver(openSchema),
    defaultValues: { openingAmount: 0, currency: "UZS", notes: "" },
  });
  const closeForm = useForm<CloseValues>({
    resolver: zodResolver(closeSchema),
    defaultValues: { closingAmount: 0, notes: "" },
  });

  async function onOpen(values: OpenValues) {
    try {
      await openShift.mutateAsync(values);
      toast.success("Смена открыта");
      setOpenDialogOpen(false);
      openForm.reset({ openingAmount: 0, currency: "UZS", notes: "" });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function onClose(values: CloseValues) {
    if (!active) return;
    try {
      await closeShift.mutateAsync({ id: active.id, data: values });
      toast.success("Смена закрыта");
      setCloseDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const closedShifts = (history ?? []).filter((s) => s.status === "CLOSED");

  return (
    <div>
      <PageHeader
        title="Касса"
        description={isAdmin ? "Открытие и закрытие смены, контроль наличных." : "История смен по всем филиалам."}
      />

      {isAdmin && (
        <Card className="mb-6 max-w-md">
          {activeLoading ? (
            <CardContent className="p-5">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          ) : active ? (
            <>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <LockOpen className="h-4 w-4 text-emerald-500" /> Смена открыта
                </CardTitle>
                <Badge className="bg-emerald-50 text-emerald-700">{formatDateTime(active.openedAt)}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Остаток на начало" value={formatMoney(active.openingAmount, active.currency)} />
                <Row
                  label="Приход (нал.)"
                  value={`+${formatMoney(active.cashIn ?? 0, active.currency)}`}
                  valueClass="text-emerald-600"
                />
                <Row
                  label="Расход (нал.)"
                  value={`-${formatMoney(active.cashOut ?? 0, active.currency)}`}
                  valueClass="text-rose-600"
                />
                <div className="border-t border-border pt-2.5">
                  <Row
                    label="Должно быть в кассе"
                    value={formatMoney(active.expected ?? active.openingAmount, active.currency)}
                    valueClass="text-lg font-semibold tracking-tight text-foreground"
                  />
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    closeForm.reset({ closingAmount: Math.round(active.expected ?? active.openingAmount), notes: "" });
                    setCloseDialogOpen(true);
                  }}
                >
                  <Lock className="h-4 w-4" /> Закрыть смену
                </Button>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Wallet className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">Смена не открыта. Укажите остаток наличных на начало.</p>
              <Button onClick={() => setOpenDialogOpen(true)}>
                <LockOpen className="h-4 w-4" /> Открыть смену
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold text-foreground">История смен</h2>
      {historyLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : closedShifts.length === 0 ? (
        <EmptyState icon={Wallet} title="Пока нет закрытых смен" description="Закрытые смены появятся здесь." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {!isAdmin && <TableHead>Филиал / Админ</TableHead>}
              <TableHead>Открыта</TableHead>
              <TableHead>Закрыта</TableHead>
              <TableHead>Начало</TableHead>
              <TableHead>Расчёт</TableHead>
              <TableHead>Факт</TableHead>
              <TableHead>Разница</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closedShifts.map((s) => {
              const diff = (s.closingAmount ?? 0) - (s.expectedAmount ?? 0);
              return (
                <TableRow key={s.id}>
                  {!isAdmin && (
                    <TableCell className="text-muted-foreground">
                      {s.branch.name} · {s.admin.fullName}
                    </TableCell>
                  )}
                  <TableCell>{formatDateTime(s.openedAt)}</TableCell>
                  <TableCell>{s.closedAt ? formatDateTime(s.closedAt) : "—"}</TableCell>
                  <TableCell>{formatMoney(s.openingAmount, s.currency)}</TableCell>
                  <TableCell>{formatMoney(s.expectedAmount ?? 0, s.currency)}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    {formatMoney(s.closingAmount ?? 0, s.currency)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-semibold",
                        diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-emerald-600" : "text-rose-600"
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatMoney(diff, s.currency)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Открытие смены */}
      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Открыть смену</DialogTitle>
          </DialogHeader>
          <form onSubmit={openForm.handleSubmit(onOpen)} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="open-amount">Остаток на начало</Label>
              <Controller
                control={openForm.control}
                name="openingAmount"
                render={({ field }) => (
                  <CurrencyInput id="open-amount" value={field.value} onChange={field.onChange} />
                )}
              />
              {openForm.formState.errors.openingAmount && (
                <p className="text-xs text-destructive">{openForm.formState.errors.openingAmount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Валюта</Label>
              <Controller
                control={openForm.control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
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
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="open-notes">Заметка</Label>
              <Textarea id="open-notes" placeholder="Необязательно" {...openForm.register("notes")} />
            </div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpenDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={openForm.formState.isSubmitting}>
                Открыть
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Закрытие смены */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Закрыть смену</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="mb-2 space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Приход</span>
                <span>{formatMoney(active.cashIn ?? 0, active.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Расход</span>
                <span>{formatMoney(active.cashOut ?? 0, active.currency)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span className="flex items-center gap-1"><Scale className="h-3 w-3" /> Расчётный остаток</span>
                <span>{formatMoney(active.expected ?? active.openingAmount, active.currency)}</span>
              </div>
            </div>
          )}
          <form onSubmit={closeForm.handleSubmit(onClose)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="close-amount">Фактически посчитано в кассе</Label>
              <Controller
                control={closeForm.control}
                name="closingAmount"
                render={({ field }) => (
                  <CurrencyInput id="close-amount" value={field.value} onChange={field.onChange} />
                )}
              />
              {closeForm.formState.errors.closingAmount && (
                <p className="text-xs text-destructive">{closeForm.formState.errors.closingAmount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="close-notes">Заметка</Label>
              <Textarea id="close-notes" placeholder="Необязательно" {...closeForm.register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCloseDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={closeForm.formState.isSubmitting}>
                Закрыть смену
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums text-foreground", valueClass)}>{value}</span>
    </div>
  );
}
