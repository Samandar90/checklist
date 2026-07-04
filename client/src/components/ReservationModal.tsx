import { AnimatePresence, motion } from "framer-motion";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import ReservationActions from "@/components/ReservationActions";
import { MonthlyReport } from "@/types";
import { formatDate, formatMoney, nightsBetween, reportDebt, paymentStatusClass } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClass ?? "text-foreground"}>{value}</span>
    </div>
  );
}

/**
 * The Reservation Details modal — the single place every action on a
 * reservation is taken from. Opened by clicking (or Enter/right-click on)
 * any block on the chessboard.
 */
export default function ReservationModal({
  report,
  open,
  onOpenChange,
  onEdit,
  onDeleteRequest,
}: {
  report: MonthlyReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (report: MonthlyReport) => void;
  onDeleteRequest: (report: MonthlyReport) => void;
}) {
  if (!report) return null;
  const debt = reportDebt(report);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <div className="max-h-[80vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="min-w-0">
              <DialogTitle className="truncate">{report.guestName || "Бронирование"}</DialogTitle>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={report.status}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <BookingStatusBadge status={report.status} />
                  </motion.div>
                </AnimatePresence>
                <Badge className={paymentStatusClass(report.paymentStatus)}>{report.paymentStatus}</Badge>
                <Badge className="bg-secondary text-secondary-foreground">{report.source.name}</Badge>
                <span className="text-[11px] text-muted-foreground">#{report.id.slice(-6).toUpperCase()}</span>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <Section title="Гость">
              <p className="text-sm text-foreground">{report.guestName || "Не указано"}</p>
            </Section>

            <Section title="Проживание">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Row label="Заезд" value={formatDate(report.date)} />
                <Row label="Выезд" value={report.checkOut ? formatDate(report.checkOut) : "—"} />
                <Row
                  label="Номер"
                  value={`${report.room.roomNumber}${report.room.type ? ` · ${report.room.type}` : ""}`}
                />
                <Row label="Ночей" value={String(nightsBetween(report.date, report.checkOut))} />
                <Row label="Филиал" value={report.branch.name} />
                <Row label="Администратор" value={report.admin.fullName} />
              </div>
            </Section>

            <Section title="Оплата">
              <div className="space-y-1.5">
                <Row label="Сумма" value={formatMoney(report.price, report.currency)} valueClass="font-medium text-foreground" />
                <Row label="Способ" value={report.paymentMethod} />
                {debt > 0 && (
                  <Row label="Долг" value={formatMoney(debt, report.currency)} valueClass="font-semibold text-destructive" />
                )}
              </div>
            </Section>

            {report.notes && (
              <Section title="Заметки">
                <p className="text-sm text-muted-foreground">{report.notes}</p>
              </Section>
            )}
          </div>
        </div>

        <DialogFooter className="mt-0 border-t border-border bg-card px-6 py-4">
          <ReservationActions
            report={report}
            onEdit={() => onEdit(report)}
            onDeleteRequest={() => onDeleteRequest(report)}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
