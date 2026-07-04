import { LogIn, LogOut, Pencil, Trash2, Ban, UserX, RotateCcw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useUpdateReportStatus } from "@/hooks/useReports";
import { useSettleDebt } from "@/hooks/useDebtors";
import { getErrorMessage } from "@/lib/api";
import { reportDebt } from "@/lib/utils";
import { MonthlyReport } from "@/types";

/**
 * The single place reservation status changes happen from.
 *
 * Action set is curated per status (not "every other status as a button"):
 * RESERVED    → Check-in is the primary action; Cancel / No-show are secondary
 *               (kept so the ability to mark a booking cancelled/no-show isn't
 *               lost now that it no longer lives in a right-click menu).
 * CHECKED_IN  → Check-out is the only status action; a guest who's in-house
 *               can no longer be "cancelled" or "marked no-show".
 * CHECKED_OUT / CANCELLED / NO_SHOW → view-only, with a Restore action that
 *               reopens the reservation as RESERVED (a manual mistake recovery
 *               path, non-destructive).
 * Debt settlement is independent of reservation status and shown whenever a
 * balance is owed.
 */
export default function ReservationActions({
  report,
  onEdit,
  onDeleteRequest,
}: {
  report: MonthlyReport;
  onEdit: () => void;
  onDeleteRequest: () => void;
}) {
  const updateStatus = useUpdateReportStatus();
  const settle = useSettleDebt();
  const debt = reportDebt(report);

  async function changeStatus(status: MonthlyReport["status"]) {
    try {
      await updateStatus.mutateAsync({ id: report.id, status });
      toast.success("Статус брони обновлён");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleSettle() {
    try {
      await settle.mutateAsync(report.id);
      toast.success("Долг погашен");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const busy = updateStatus.isPending || settle.isPending;

  return (
    <div className="flex w-full flex-col gap-2">
      {debt > 0 && (
        <Button onClick={handleSettle} disabled={busy} className="w-full sm:w-auto">
          <CheckCircle2 className="h-4 w-4" /> Погасить долг
        </Button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {report.status === "RESERVED" && (
          <>
            <Button onClick={() => changeStatus("CHECKED_IN")} disabled={busy}>
              <LogIn className="h-4 w-4" /> Заселить
            </Button>
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Редактировать
            </Button>
            <Button variant="ghost" onClick={onDeleteRequest} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Удалить
            </Button>
          </>
        )}

        {report.status === "CHECKED_IN" && (
          <>
            <Button onClick={() => changeStatus("CHECKED_OUT")} disabled={busy}>
              <LogOut className="h-4 w-4" /> Выселить
            </Button>
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Редактировать
            </Button>
          </>
        )}

        {(report.status === "CHECKED_OUT" || report.status === "CANCELLED" || report.status === "NO_SHOW") && (
          <Button variant="outline" onClick={() => changeStatus("RESERVED")} disabled={busy}>
            <RotateCcw className="h-4 w-4" /> Восстановить
          </Button>
        )}
      </div>

      {report.status === "RESERVED" && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <span className="text-[11px] text-muted-foreground">Ещё:</span>
          <Button variant="outline" size="sm" onClick={() => changeStatus("CANCELLED")} disabled={busy}>
            <Ban className="h-3.5 w-3.5" /> Отменить
          </Button>
          <Button variant="outline" size="sm" onClick={() => changeStatus("NO_SHOW")} disabled={busy}>
            <UserX className="h-3.5 w-3.5" /> Не заехал
          </Button>
        </div>
      )}
    </div>
  );
}
