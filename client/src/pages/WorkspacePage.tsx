import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, BedDouble, Users2, Wallet, AlertTriangle, ArrowRight, CalendarRange, ClipboardList } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useBranches } from "@/hooks/useBranches";
import { useDashboard } from "@/hooks/useDashboard";
import { useDebtors } from "@/hooks/useDebtors";
import { useActiveBranch } from "@/contexts/BranchContext";

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { data: branches, isLoading } = useBranches();
  const { data: dashboard } = useDashboard({});
  const { data: debtors } = useDebtors();
  const { setActiveBranchId } = useActiveBranch();

  const revenueByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of dashboard?.byBranch ?? []) map.set(b.name, b.total);
    return map;
  }, [dashboard]);

  const debtByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of debtors?.byBranch ?? []) map.set(b.name, b.total);
    return map;
  }, [debtors]);

  const totalRooms = (branches ?? []).reduce((s, b) => s + (b._count?.rooms ?? 0), 0);
  const totalRevenue = dashboard?.revenue ?? 0;

  function openBranch(branchId: string) {
    setActiveBranchId(branchId);
    navigate("/");
  }

  return (
    <div>
      <PageHeader
        title="Воркспейс"
        description="Все отели и филиалы сети в одном месте — статистика, KPI и быстрый переход."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl tint-indigo">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Отелей / филиалов</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{branches?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl tint-sky">
              <BedDouble className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Всего номеров</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{totalRooms}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl tint-emerald">
              <Wallet className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Выручка по сети</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{totalRevenue.toLocaleString("ru-RU")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : !branches || branches.length === 0 ? (
        <EmptyState icon={Building2} title="Филиалов пока нет" description="Добавьте первый филиал в разделе «Филиалы»." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch, i) => {
            const revenue = revenueByName.get(branch.name) ?? 0;
            const debt = debtByName.get(branch.name) ?? 0;
            return (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] as const }}
              >
                <Card className="flex h-full flex-col">
                  <CardContent className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl tint-violet">
                          <Building2 className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="font-semibold tracking-tight text-foreground">{branch.name}</p>
                          <p className="text-xs text-muted-foreground">Филиал сети</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="tabular-nums text-foreground">{branch._count?.rooms ?? 0} номеров</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="tabular-nums text-foreground">{branch._count?.admins ?? 0} админ.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="tabular-nums text-foreground">{revenue.toLocaleString("ru-RU")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={debt > 0 ? "h-3.5 w-3.5 text-destructive" : "h-3.5 w-3.5 text-muted-foreground"} />
                        <span className={debt > 0 ? "tabular-nums text-destructive" : "tabular-nums text-foreground"}>
                          {debt > 0 ? debt.toLocaleString("ru-RU") : "Без долгов"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-1.5 border-t border-border pt-3">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/calendar">
                          <CalendarRange className="h-3.5 w-3.5" /> Шахматка
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/reports">
                          <ClipboardList className="h-3.5 w-3.5" /> Отчёты
                        </Link>
                      </Button>
                      <Button size="sm" className="ml-auto" onClick={() => openBranch(branch.id)}>
                        Открыть <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
