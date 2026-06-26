import { Building2, Users, BedDouble, ClipboardList, Wallet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/useDashboard";

const cards = [
  {
    key: "totalBranches",
    label: "Всего филиалов",
    icon: Building2,
    iconBg: "bg-indigo-50 text-indigo-600",
  },
  {
    key: "totalAdmins",
    label: "Всего администраторов",
    icon: Users,
    iconBg: "bg-amber-50 text-amber-600",
  },
  {
    key: "totalRooms",
    label: "Всего номеров",
    icon: BedDouble,
    iconBg: "bg-sky-50 text-sky-600",
  },
  {
    key: "totalReports",
    label: "Всего отчётов",
    icon: ClipboardList,
    iconBg: "bg-violet-50 text-violet-600",
  },
] as const;

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  return (
    <div>
      <PageHeader title="Дашборд" description="Обзор системы отчётности сети отелей." />

      {isError && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Не удалось загрузить данные дашборда. Убедитесь, что сервер запущен.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.key}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{c.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.iconBg}`}>
                <c.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-semibold text-foreground">{data?.[c.key] ?? 0}</div>
              )}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Общая выручка</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-semibold text-foreground">
                {(data?.totalRevenue ?? 0).toLocaleString("ru-RU")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
