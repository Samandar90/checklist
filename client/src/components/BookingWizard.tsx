import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, User2, CalendarRange, BedDouble, Wallet, ClipboardCheck, ChevronLeft, ChevronRight } from "lucide-react";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerFooter, DrawerCloseButton } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";

import { useAdmins } from "@/hooks/useAdmins";
import { useSources } from "@/hooks/useSources";
import { useCreateReport } from "@/hooks/useReports";
import { useAuth } from "@/contexts/AuthContext";
import { Room, paymentMethods, paymentStatuses } from "@/types";
import { getErrorMessage } from "@/lib/api";
import { cn, addDaysIso, nightsBetween, pluralRu, formatMoney, formatDate, PAYMENT_STATUS_OPTIONS } from "@/lib/utils";

const DRAFT_KEY = "booking-wizard-draft";

const paymentMethodOptions = paymentMethods.map((m) => ({ value: m, label: m }));
const paymentStatusOptions = PAYMENT_STATUS_OPTIONS;

const schema = z
  .object({
    guestName: z.string().trim().optional(),
    date: z.string().trim().min(1, "Укажите дату заезда"),
    checkOut: z.string().trim().min(1, "Укажите дату выезда"),
    roomId: z.string().trim().min(1, "Выберите номер"),
    sourceId: z.string().trim().min(1, "Выберите источник"),
    adminId: z.string().trim().min(1, "Выберите администратора"),
    pricePerNight: z.number({ invalid_type_error: "Укажите цену за ночь" }).positive("Цена должна быть положительной"),
    currency: z.string().trim().min(1),
    paymentMethod: z.enum(paymentMethods),
    paymentStatus: z.enum(paymentStatuses),
    paidAmount: z.number().min(0).optional(),
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

export interface WizardDraft {
  roomId: string;
  date: string;
  checkOut: string;
}

const STEPS = [
  { key: "guest", label: "Гость", icon: User2 },
  { key: "stay", label: "Проживание", icon: CalendarRange },
  { key: "room", label: "Номер", icon: BedDouble },
  { key: "payment", label: "Оплата", icon: Wallet },
  { key: "confirm", label: "Подтверждение", icon: ClipboardCheck },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const FIELDS_BY_STEP: Record<StepKey, (keyof FormValues)[]> = {
  guest: [],
  stay: ["date", "checkOut"],
  room: ["roomId", "sourceId", "adminId", "pricePerNight", "currency"],
  payment: ["paymentMethod", "paymentStatus", "paidAmount"],
  confirm: [],
};

export default function BookingWizard({
  open,
  onOpenChange,
  branchId,
  rooms,
  draft,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  branchId: string;
  rooms: Room[];
  draft: WizardDraft | null;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: admins } = useAdmins({ enabled: !isAdmin });
  const { data: sources } = useSources();
  const createReport = useCreateReport();
  const [confirmClose, setConfirmClose] = useState(false);
  // Админ подходит, если работает в этом филиале (мульти-филиальные — по branchIds).
  const branchAdmins = (admins ?? []).filter((a) => (a.branchIds?.length ? a.branchIds.includes(branchId) : a.branchId === branchId));

  const [stepIdx, setStepIdx] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      guestName: "",
      date: "",
      checkOut: "",
      roomId: "",
      sourceId: "",
      adminId: "",
      pricePerNight: 0,
      currency: "UZS",
      paymentMethod: "Наличные",
      paymentStatus: "Оплачено",
      paidAmount: undefined,
      notes: "",
    },
  });

  // Seed the form ONCE per open+draft. Deliberately independent of the async
  // admins/sources queries: if we re-ran when those lists arrived, the reset
  // would throw the user back to step 1 and wipe what they'd already typed.
  const seededKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !draft) {
      if (!open) seededKeyRef.current = null; // allow a fresh seed on next open
      return;
    }
    const key = `${draft.roomId}|${draft.date}|${draft.checkOut}`;
    if (seededKeyRef.current === key) return; // already seeded this draft
    seededKeyRef.current = key;

    setStepIdx(0);
    let extra: Partial<FormValues> = {};
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) extra = JSON.parse(raw);
    } catch {
      // ignore corrupt draft
    }
    form.reset({
      guestName: extra.guestName ?? "",
      date: draft.date,
      checkOut: draft.checkOut,
      roomId: draft.roomId,
      sourceId: extra.sourceId || sources?.[0]?.id || "",
      adminId: isAdmin ? user?.adminId ?? "" : extra.adminId || branchAdmins[0]?.id || "",
      pricePerNight: extra.pricePerNight ?? 0,
      currency: "UZS",
      paymentMethod: extra.paymentMethod ?? "Наличные",
      paymentStatus: extra.paymentStatus ?? "Оплачено",
      paidAmount: extra.paidAmount,
      notes: extra.notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  // Backfill the default source / admin once those lists finish loading —
  // only into still-empty fields, without a reset, so the current step and any
  // user input are preserved. shouldDirty:false keeps the "unsaved changes"
  // close-guard from firing on an auto-filled default.
  useEffect(() => {
    if (!open) return;
    if (!form.getValues("sourceId") && sources?.[0]?.id) {
      form.setValue("sourceId", sources[0].id, { shouldDirty: false });
    }
    if (!isAdmin && !form.getValues("adminId") && branchAdmins[0]?.id) {
      form.setValue("adminId", branchAdmins[0].id, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sources, admins, branchId]);

  // Autosave the editable extras (not the drag-selected room/dates) on every change.
  useEffect(() => {
    if (!open) return;
    const sub = form.watch((values) => {
      const { guestName, sourceId, adminId, pricePerNight, currency, paymentMethod, paymentStatus, paidAmount, notes } = values;
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ guestName, sourceId, adminId, pricePerNight, currency, paymentMethod, paymentStatus, paidAmount, notes })
      );
    });
    return () => sub.unsubscribe();
  }, [open, form]);

  // Деструктуризация при рендере подписывает Proxy formState на эти поля —
  // иначе значения, прочитанные в обработчике, всегда будут false.
  const { isDirty, isSubmitSuccessful } = form.formState;

  // Форма считается «заполненной», если пользователь что-то ввёл сам (isDirty)
  // или в ней есть восстановленный черновик (имя/цена) — его тоже жалко терять.
  function hasMeaningfulInput() {
    const v = form.getValues();
    return isDirty || Boolean(v.guestName?.trim()) || (v.pricePerNight ?? 0) > 0 || Boolean(v.notes?.trim());
  }

  // Случайный клик мимо окна НЕ закрывает мастер (см. onInteractOutside ниже).
  // Явное закрытие (крестик/Esc) при заполненной форме требует подтверждения.
  function handleOpenChange(next: boolean) {
    if (!next && !isSubmitSuccessful && hasMeaningfulInput()) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(next);
  }

  const selectedStatus = form.watch("paymentStatus");
  const nights = Math.max(1, nightsBetween(form.watch("date"), form.watch("checkOut")));
  const totalPrice = (form.watch("pricePerNight") || 0) * nights;
  const selectedRoom = rooms.find((r) => r.id === form.watch("roomId"));
  const selectedSource = (sources ?? []).find((s) => s.id === form.watch("sourceId"));

  async function goNext() {
    const fields = FIELDS_BY_STEP[STEPS[stepIdx].key];
    if (fields.length) {
      const ok = await form.trigger(fields as (keyof FormValues)[]);
      if (!ok) return;
    }
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  }
  function goBack() {
    setStepIdx((i) => Math.max(0, i - 1));
  }

  async function onSubmit(values: FormValues) {
    try {
      const total = values.pricePerNight * Math.max(1, nightsBetween(values.date, values.checkOut));
      const { pricePerNight, ...rest } = values;
      void pricePerNight;
      await createReport.mutateAsync({ ...rest, price: total, branchId });
      toast.success("Бронь создана");
      localStorage.removeItem(DRAFT_KEY);
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const step = STEPS[stepIdx];
  const noAdmins = !isAdmin && branchAdmins.length === 0;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent
        // Клик мимо окна и фокус наружу не закрывают мастер — данные не теряются.
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DrawerHeader>
          <div>
            <DrawerTitle>Новое бронирование</DrawerTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Шаг {stepIdx + 1} из {STEPS.length} — {step.label}
            </p>
          </div>
          <DrawerCloseButton />
        </DrawerHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 border-b border-border px-6 py-3.5">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center gap-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                    i < stepIdx ? "bg-primary text-primary-foreground" : i === stepIdx ? "bg-primary/10 text-primary ring-2 ring-primary" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {i < stepIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn("hidden text-[10px] sm:block", i === stepIdx ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-px flex-1 transition-colors", i < stepIdx ? "bg-primary" : "bg-border")} />}
            </div>
          ))}
        </div>

        {noAdmins ? (
          <DrawerBody>
            <p className="py-6 text-center text-sm text-muted-foreground">
              В этом филиале нет администраторов. Сначала добавьте администратора в разделе «Администраторы».
            </p>
          </DrawerBody>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
            <DrawerBody>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  {step.key === "guest" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="bw-guest">Имя гостя</Label>
                      <Input id="bw-guest" placeholder="например, Иван Иванов" {...form.register("guestName")} />
                      <p className="text-xs text-muted-foreground">Поиск по базе гостей пока не подключён — введите имя вручную.</p>
                    </div>
                  )}

                  {step.key === "stay" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="bw-date">Заезд</Label>
                        <Controller
                          control={form.control}
                          name="date"
                          render={({ field }) => (
                            <Input
                              id="bw-date"
                              type="date"
                              value={field.value}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                                const co = form.getValues("checkOut");
                                if (!co || new Date(co) <= new Date(e.target.value)) form.setValue("checkOut", addDaysIso(e.target.value, 1));
                              }}
                            />
                          )}
                        />
                        {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bw-checkout">Выезд</Label>
                        <Input id="bw-checkout" type="date" min={form.watch("date")} {...form.register("checkOut")} />
                        {form.formState.errors.checkOut && <p className="text-xs text-destructive">{form.formState.errors.checkOut.message}</p>}
                      </div>
                      <div className="col-span-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {nights} {pluralRu(nights, "ночь", "ночи", "ночей")}
                        </span>
                        {form.watch("date") && form.watch("checkOut") && (
                          <> · {formatDate(form.watch("date"))} → {formatDate(form.watch("checkOut"))}</>
                        )}
                        <p className="mt-0.5">Дата выезда — день освобождения номера, эта ночь не оплачивается.</p>
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label htmlFor="bw-notes-stay">Особые пожелания</Label>
                        <Textarea id="bw-notes-stay" placeholder="Например: вид на море, тихий этаж…" {...form.register("notes")} />
                      </div>
                    </div>
                  )}

                  {step.key === "room" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1.5">
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
                        {form.formState.errors.roomId && <p className="text-xs text-destructive">{form.formState.errors.roomId.message}</p>}
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
                        {form.formState.errors.sourceId && <p className="text-xs text-destructive">{form.formState.errors.sourceId.message}</p>}
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
                          {form.formState.errors.adminId && <p className="text-xs text-destructive">{form.formState.errors.adminId.message}</p>}
                        </div>
                      )}

                      <div className="col-span-2 space-y-1.5">
                        <Label htmlFor="bw-price">Цена за ночь, UZS</Label>
                        <Controller
                          control={form.control}
                          name="pricePerNight"
                          render={({ field }) => <CurrencyInput id="bw-price" value={field.value} onChange={field.onChange} />}
                        />
                        {form.formState.errors.pricePerNight && <p className="text-xs text-destructive">{form.formState.errors.pricePerNight.message}</p>}
                      </div>
                    </div>
                  )}

                  {step.key === "payment" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                        <span className="text-xs text-muted-foreground">
                          Итого за {nights} {pluralRu(nights, "ночь", "ночи", "ночей")}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {totalPrice.toLocaleString("ru-RU")} {form.watch("currency")}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Способ оплаты</Label>
                        <Controller control={form.control} name="paymentMethod" render={({ field }) => <Segmented options={paymentMethodOptions} value={field.value} onChange={field.onChange} />} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Статус оплаты (депозит)</Label>
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
                        <div className="space-y-1.5">
                          <Label htmlFor="bw-paid">Оплачено сейчас (депозит)</Label>
                          <Controller control={form.control} name="paidAmount" render={({ field }) => <CurrencyInput id="bw-paid" value={field.value ?? 0} onChange={field.onChange} />} />
                          {form.formState.errors.paidAmount && <p className="text-xs text-destructive">{form.formState.errors.paidAmount.message}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {step.key === "confirm" && (
                    <div className="space-y-3 text-sm">
                      <SummaryRow label="Гость" value={form.watch("guestName") || "Без имени"} />
                      <SummaryRow
                        label="Период"
                        value={`${formatDate(form.watch("date"))} → ${formatDate(form.watch("checkOut"))} · ${nights} ${pluralRu(nights, "ночь", "ночи", "ночей")}`}
                      />
                      <SummaryRow label="Номер" value={selectedRoom ? `${selectedRoom.roomNumber}${selectedRoom.type ? ` · ${selectedRoom.type}` : ""}` : "—"} />
                      <SummaryRow label="Источник" value={selectedSource?.name ?? "—"} />
                      <SummaryRow label="Сумма" value={formatMoney(totalPrice, form.watch("currency"))} />
                      <SummaryRow label="Оплата" value={`${form.watch("paymentMethod")} · ${form.watch("paymentStatus")}`} />
                      {form.watch("notes") && <SummaryRow label="Заметки" value={form.watch("notes") || ""} />}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </DrawerBody>

            <DrawerFooter className="justify-between">
              <div className="flex min-w-0 flex-col leading-tight">
                {totalPrice > 0 && (
                  <>
                    <span className="text-[11px] text-muted-foreground">
                      {nights} {nights === 1 ? "ночь" : nights < 5 ? "ночи" : "ночей"}
                      {selectedRoom ? ` · № ${selectedRoom.roomNumber}` : ""}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatMoney(totalPrice, form.watch("currency"))}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {stepIdx > 0 && (
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ChevronLeft className="h-4 w-4" /> Назад
                  </Button>
                )}
                {stepIdx < STEPS.length - 1 ? (
                  <Button type="button" onClick={goNext}>
                    Далее <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    <Check className="h-4 w-4" /> Создать бронь
                  </Button>
                )}
              </div>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>

      {/* Подтверждение закрытия, чтобы случайно не потерять заполненную форму */}
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть оформление брони?</AlertDialogTitle>
            <AlertDialogDescription>
              Введённые данные сохранятся как черновик и подставятся при следующем открытии мастера.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Продолжить оформление</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              Закрыть
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
