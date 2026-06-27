import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useBranches } from "@/hooks/useBranches";
import { useDebtors, useSettleDebt } from "@/hooks/useDebtors";
import { DebtorReport } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { formatDate, formatMoney, paymentStatusClass } from "@/lib/utils";

export default function DebtorsPage() {
  const { data: branches } = useBranches();
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const { data, isLoading } = useDebtors(branchId);
  const settle = useSettleDebt();

  const [settleTarget, setSettleTarget] = useState<DebtorReport | null>(null);

  async function handleSettle() {
    if (!settleTarget) return;
    try {
      await settle.mutateAsync(settleTarget.id);
      toast.success("Долг погашен");
      setSettleTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title="Должники" description="Незакрытые оплаты по бронированиям." />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-56 space-y-1.5">
            <Label>Филиал</Label>
            <Select value={branchId ?? "all"} onValueChange={(v) => setBranchId(v === "all" ? undefined : v)}>
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
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Общая задолженность</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-semibold text-destructive">
                  {(data?.totalDebt ?? 0).toLocaleString("ru-RU")}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{data?.items.length ?? 0} незакрытых записей</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Задолженность по филиалам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(data?.byBranch ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет данных</p>
            ) : (
              data?.byBranch.map((b) => (
                <div key={b.name} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {b.name} <span className="text-xs">· {b.count}</span>
                  </span>
                  <span className="font-medium text-foreground">{b.total.toLocaleString("ru-RU")}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Должников нет"
          description="Все брони оплачены полностью."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Заезд</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead>Администратор</TableHead>
              <TableHead>Номер</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Оплачено</TableHead>
              <TableHead>Долг</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>{r.branch.name}</TableCell>
                <TableCell>{r.admin.fullName}</TableCell>
                <TableCell>{r.room.roomNumber}</TableCell>
                <TableCell className="text-foreground">{formatMoney(r.price, r.currency)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatMoney(r.paidAmount ?? 0, r.currency)}
                </TableCell>
                <TableCell className="font-semibold text-destructive">{formatMoney(r.debt, r.currency)}</TableCell>
                <TableCell>
                  <Badge className={paymentStatusClass(r.paymentStatus)}>{r.paymentStatus}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setSettleTarget(r)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Погасить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDeleteDialog
        open={!!settleTarget}
        onOpenChange={(open) => !open && setSettleTarget(null)}
        onConfirm={handleSettle}
        loading={settle.isPending}
        title="Погасить долг?"
        description={
          settleTarget
            ? `Бронь «${settleTarget.room.roomNumber}» будет отмечена как полностью оплаченная (${formatMoney(
                settleTarget.debt,
                settleTarget.currency
              )}).`
            : ""
        }
        confirmLabel="Погасить"
        loadingLabel="Сохранение..."
      />
    </div>
  );
}
