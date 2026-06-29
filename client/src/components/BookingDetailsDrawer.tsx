import { LogIn, LogOut, Ban, UserX, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerSection,
  DrawerCloseButton,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import ActivityTimeline from "@/components/ActivityTimeline";
import { useUpdateReportStatus } from "@/hooks/useReports";
import { useAudit } from "@/hooks/useAudit";
import { useAuth } from "@/contexts/AuthContext";
import { MonthlyReport, BookingStatus } from "@/types";
import { formatDate, formatDateTime, formatMoney, nightsBetween, reportDebt, paymentStatusClass } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";

const STATUS_ACTIONS: { status: BookingStatus; label: string; icon: typeof LogIn }[] = [
  { status: "CHECKED_IN", label: "Заселить", icon: LogIn },
  { status: "CHECKED_OUT", label: "Выселить", icon: LogOut },
  { status: "NO_SHOW", label: "Не заехал", icon: UserX },
  { status: "CANCELLED", label: "Отменить", icon: Ban },
];

export default function BookingDetailsDrawer({
  report,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  report: MonthlyReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (report: MonthlyReport) => void;
  onDelete?: (report: MonthlyReport) => void;
}) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const updateStatus = useUpdateReportStatus();
  const { data: history } = useAudit({ entity: "report", entityId: report?.id }, !!report && open && isSuperAdmin);

  if (!report) return null;
  const debt = reportDebt(report);

  async function handleStatusChange(status: BookingStatus) {
    try {
      await updateStatus.mutateAsync({ id: report!.id, status });
      toast.success("Статус брони обновлён");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <div className="min-w-0">
            <DrawerTitle>{report.guestName || "Бронирование"}</DrawerTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <BookingStatusBadge status={report.status} />
              <Badge className={paymentStatusClass(report.paymentStatus)}>{report.paymentStatus}</Badge>
              <Badge className="bg-secondary text-secondary-foreground">{report.source.name}</Badge>
              <span className="text-[11px] text-muted-foreground">#{report.id.slice(-6).toUpperCase()}</span>
            </div>
          </div>
          <DrawerCloseButton />
        </DrawerHeader>

        <div className="flex flex-wrap gap-1.5 border-b border-border px-6 py-3">
          {STATUS_ACTIONS.filter((a) => a.status !== report.status).map((a) => (
            <Button key={a.status} type="button" variant="outline" size="sm" disabled={updateStatus.isPending} onClick={() => handleStatusChange(a.status)}>
              <a.icon className="h-3.5 w-3.5" /> {a.label}
            </Button>
          ))}
        </div>

        <DrawerBody>
          <DrawerSection title="Гость">
            <p className="text-sm text-foreground">{report.guestName || "Не указано"}</p>
          </DrawerSection>

          <DrawerSection title="Проживание">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Заезд</p>
                <p className="text-foreground">{formatDate(report.date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Выезд</p>
                <p className="text-foreground">{report.checkOut ? formatDate(report.checkOut) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Номер</p>
                <p className="text-foreground">{report.room.roomNumber}{report.room.type ? ` · ${report.room.type}` : ""}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ночей</p>
                <p className="text-foreground">{nightsBetween(report.date, report.checkOut)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Филиал</p>
                <p className="text-foreground">{report.branch.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Администратор</p>
                <p className="text-foreground">{report.admin.fullName}</p>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title="Оплата">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Сумма</span><span className="font-medium text-foreground">{formatMoney(report.price, report.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Способ</span><span className="text-foreground">{report.paymentMethod}</span></div>
              {debt > 0 && (
                <div className="flex justify-between"><span className="text-destructive">Долг</span><span className="font-medium text-destructive">{formatMoney(debt, report.currency)}</span></div>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Источник">
            <p className="text-sm text-foreground">{report.source.name}</p>
          </DrawerSection>

          {report.notes && (
            <DrawerSection title="Заметки">
              <p className="text-sm text-muted-foreground">{report.notes}</p>
            </DrawerSection>
          )}

          <DrawerSection title="История">
            <p className="mb-2 text-xs text-muted-foreground">
              Создано: <span className="text-foreground">{formatDateTime(report.createdAt)}</span>
              {report.updatedAt && (
                <> · Изменено: <span className="text-foreground">{formatDateTime(report.updatedAt)}</span></>
              )}
            </p>
            {isSuperAdmin ? (
              <ActivityTimeline items={history?.items ?? []} emptyText="Нет записей об изменениях" />
            ) : (
              <p className="text-xs text-muted-foreground">Полная история доступна главному аккаунту.</p>
            )}
          </DrawerSection>
        </DrawerBody>

        <DrawerFooter>
          {onDelete && (
            <Button type="button" variant="ghost" onClick={() => onDelete(report)} className="mr-auto text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Удалить
            </Button>
          )}
          {onEdit && (
            <Button type="button" onClick={() => onEdit(report)}>
              <Pencil className="h-4 w-4" /> Редактировать
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
