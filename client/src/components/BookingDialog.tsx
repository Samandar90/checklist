import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";

import { useAdmins } from "@/hooks/useAdmins";
import { useSources } from "@/hooks/useSources";
import { useCreateReport, useUpdateReport } from "@/hooks/useReports";
import { useAuth } from "@/contexts/AuthContext";
import { MonthlyReport, Room, paymentMethods, paymentStatuses } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { addDaysIso, nightsBetween } from "@/lib/utils";

const currencies = ["UZS", "USD", "EUR"];

const paymentMethodOptions = paymentMethods.map((m) => ({ value: m, label: m }));
const paymentStatusOptions = [
  { value: "Оплачено" as const, label: "Оплачено", activeCls: "bg-emerald-500 text-white shadow-sm" },
  { value: "Частично" as const, label: "Частично", activeCls: "bg-amber-500 text-white shadow-sm" },
  { value: "Долг" as const, label: "Долг", activeCls: "bg-red-500 text-white shadow-sm" },
];

const schema = z
  .object({
    date: z.string().trim().min(1, "Укажите дату заезда"),
    checkOut: z.string().trim().min(1, "Укажите дату выезда"),
    guestName: z.string().trim().optional(),
    roomId: z.string().trim().min(1, "Выберите номер"),
    adminId: z.string().trim().min(1, "Выберите администратора"),
    sourceId: z.string().trim().min(1, "Выберите источник"),
    pricePerNight: z.number({ invalid_type_error: "Укажите цену за ночь" }).positive("Цена должна быть положительной"),
    currency: z.string().trim().min(1, "Выберите валюту"),
    paymentMethod: z.enum(paymentMethods, { errorMap: () => ({ message: "Выберите способ оплаты" }) }),
    paymentStatus: z.enum(paymentStatuses, { errorMap: () => ({ message: "Выберите статус" }) }),
    paidAmount: z.number({ invalid_type_error: "Укажите сумму" }).min(0).optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.checkOut && data.date && new Date(data.checkOut) <= new Date(data.date)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checkOut"], message: "Выезд должен быть позже заезда" });
    }
    const nights = Math.max(1, nightsBetween(data.date, data.checkOut));
    const total = data.pricePerNight * nights;
    if (data.paymentStatus === "Частично") {
      if (!data.paidAmount || data.paidAmount <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paidAmount"], message: "Укажите оплаченную сумму" });
      } else if (data.paidAmount >= total) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paidAmount"], message: "Должна быть меньше общей суммы" });
      }
    }
  });
type FormValues = z.infer<typeof schema>;

export interface BookingDraft {
  roomId: string;
  date: string;
  checkOut: string;
}

export default function BookingDialog({
  open,
  onOpenChange,
  branchId,
  rooms,
  editing,
  draft,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  branchId: string;
  rooms: Room[];
  editing: MonthlyReport | null;
  draft: BookingDraft | null;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: admins } = useAdmins({ enabled: !isAdmin });
  const { data: sources } = useSources();
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();

  const branchAdmins = (admins ?? []).filter((a) => a.branchId === branchId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: "",
      checkOut: "",
      guestName: "",
      roomId: "",
      adminId: "",
      sourceId: "",
      pricePerNight: 0,
      currency: "UZS",
      paymentMethod: "Наличные",
      paymentStatus: "Оплачено",
      paidAmount: undefined,
      notes: "",
    },
  });

  // Re-seed the form whenever the dialog opens for a new target.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const editNights = Math.max(1, nightsBetween(editing.date, editing.checkOut));
      form.reset({
        date: editing.date.slice(0, 10),
        checkOut: editing.checkOut ? editing.checkOut.slice(0, 10) : addDaysIso(editing.date.slice(0, 10), 1),
        guestName: editing.guestName ?? "",
        roomId: editing.roomId,
        adminId: isAdmin ? user?.adminId ?? "" : editing.adminId,
        sourceId: editing.sourceId,
        pricePerNight: Math.round((editing.price / editNights) * 100) / 100,
        currency: editing.currency,
        paymentMethod: editing.paymentMethod,
        paymentStatus: editing.paymentStatus,
        paidAmount: editing.paidAmount ?? undefined,
        notes: editing.notes ?? "",
      });
    } else if (draft) {
      form.reset({
        date: draft.date,
        checkOut: draft.checkOut,
        guestName: "",
        roomId: draft.roomId,
        adminId: isAdmin ? user?.adminId ?? "" : branchAdmins[0]?.id ?? "",
        sourceId: sources?.[0]?.id ?? "",
        pricePerNight: 0,
        currency: "UZS",
        paymentMethod: "Наличные",
        paymentStatus: "Оплачено",
        paidAmount: undefined,
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, draft, admins, sources]);

  const selectedStatus = form.watch("paymentStatus");
  const nights = Math.max(1, nightsBetween(form.watch("date"), form.watch("checkOut")));
  const totalPrice = (form.watch("pricePerNight") || 0) * nights;

  async function onSubmit(values: FormValues) {
    try {
      const { pricePerNight, ...rest } = values;
      const total = pricePerNight * Math.max(1, nightsBetween(values.date, values.checkOut));
      const payload = { ...rest, price: total, branchId };
      if (editing) {
        await updateReport.mutateAsync({ id: editing.id, data: payload });
        toast.success("Бронь обновлена");
      } else {
        await createReport.mutateAsync(payload);
        toast.success("Бронь создана");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const noAdmins = !isAdmin && branchAdmins.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Редактировать бронь" : "Новое бронирование"}</DialogTitle>
        </DialogHeader>

        {noAdmins ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            В этом филиале нет администраторов. Сначала добавьте администратора в разделе «Администраторы».
          </p>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bd-date">Заезд</Label>
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <Input
                    id="bd-date"
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
              <Label htmlFor="bd-checkout">Выезд</Label>
              <Input id="bd-checkout" type="date" min={form.watch("date")} {...form.register("checkOut")} />
              {form.formState.errors.checkOut && (
                <p className="text-xs text-destructive">{form.formState.errors.checkOut.message}</p>
              )}
            </div>

            <div className="col-span-2 -mt-2">
              <p className="text-xs text-muted-foreground">
                Ночей: <span className="font-medium text-foreground">{nights}</span>
              </p>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="bd-guest">Имя гостя</Label>
              <Input id="bd-guest" placeholder="например, Иван Иванов" {...form.register("guestName")} />
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
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.roomNumber}
                          {r.type ? ` · ${r.type}` : ""}
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
              <Label>Источник</Label>
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

            {!isAdmin && (
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
                        {branchAdmins.map((a) => (
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
            )}

            <div className="space-y-1.5">
              <Label htmlFor="bd-price">Цена за ночь</Label>
              <Controller
                control={form.control}
                name="pricePerNight"
                render={({ field }) => <CurrencyInput id="bd-price" value={field.value} onChange={field.onChange} />}
              />
              {form.formState.errors.pricePerNight && (
                <p className="text-xs text-destructive">{form.formState.errors.pricePerNight.message}</p>
              )}
            </div>

            <div className="col-span-2 -mt-2 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Итого за {nights} {nights === 1 ? "ночь" : "ночи"}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {totalPrice.toLocaleString("ru-RU")} {form.watch("currency")}
              </span>
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

            {selectedStatus === "Частично" && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="bd-paid">Оплачено сейчас</Label>
                <Controller
                  control={form.control}
                  name="paidAmount"
                  render={({ field }) => (
                    <CurrencyInput id="bd-paid" value={field.value ?? 0} onChange={field.onChange} />
                  )}
                />
                {form.formState.errors.paidAmount && (
                  <p className="text-xs text-destructive">{form.formState.errors.paidAmount.message}</p>
                )}
              </div>
            )}

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="bd-notes">Заметки</Label>
              <Textarea id="bd-notes" placeholder="Необязательные заметки" {...form.register("notes")} />
            </div>

            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? "Сохранить" : "Создать бронь"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
