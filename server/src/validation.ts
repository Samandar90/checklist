import { z } from "zod";

// bcrypt хэширует только первые 72 байта пароля — остальное молча отбрасывается.
// Кириллица занимает 2 байта на символ, так что пароль из 50 русских букв на деле
// защищён лишь первыми 36. Отклоняем такие пароли явно, а не ослабляем молча.
const BCRYPT_MAX_BYTES = 72;
const password = (min: number, message: string) =>
  z
    .string()
    .min(min, message)
    .refine(
      (v) => Buffer.byteLength(v, "utf8") <= BCRYPT_MAX_BYTES,
      "Пароль слишком длинный (не больше 72 латинских или 36 русских символов)"
    );

// Ограничения длины свободного текста: без них одним запросом можно записать в
// SQLite (и в журнал аудита, и в ночные бэкапы) мегабайты в одно поле.
const NAME_MAX = 200;
const NOTE_MAX = 2000;
const CURRENCY_MAX = 10;
const TOO_LONG = "Слишком длинное значение";

export const branchSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").max(NAME_MAX, TOO_LONG),
});

export const adminCreateSchema = z.object({
  fullName: z.string().trim().min(1, "ФИО обязательно").max(NAME_MAX, TOO_LONG),
  phone: z.string().trim().min(1, "Телефон обязателен").max(NAME_MAX, TOO_LONG),
  branchId: z.string().trim().min(1, "Филиал обязателен"),
  // Every branch this admin should work in. Optional — if omitted, defaults to just branchId.
  branchIds: z.array(z.string().trim().min(1)).optional(),
  username: z.string().trim().min(3, "Логин должен быть не короче 3 символов").max(NAME_MAX, TOO_LONG),
  password: password(6, "Пароль должен быть не короче 6 символов"),
});

export const adminUpdateSchema = z.object({
  fullName: z.string().trim().min(1, "ФИО обязательно").max(NAME_MAX, TOO_LONG),
  phone: z.string().trim().min(1, "Телефон обязателен").max(NAME_MAX, TOO_LONG),
  branchId: z.string().trim().min(1, "Филиал обязателен"),
  branchIds: z.array(z.string().trim().min(1)).optional(),
  username: z.string().trim().min(3, "Логин должен быть не короче 3 символов").max(NAME_MAX, TOO_LONG),
  password: password(6, "Пароль должен быть не короче 6 символов").optional().or(z.literal("")),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Укажите логин"),
  password: z.string().min(1, "Укажите пароль"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Укажите текущий пароль"),
  newPassword: password(6, "Новый пароль должен быть не короче 6 символов"),
});

export const roomSchema = z.object({
  roomNumber: z.string().trim().min(1, "Номер комнаты обязателен").max(NAME_MAX, TOO_LONG),
  type: z.string().trim().max(NAME_MAX, TOO_LONG).optional().nullable(),
  branchId: z.string().trim().min(1, "Филиал обязателен"),
});

export const sourceSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").max(NAME_MAX, TOO_LONG),
});

export const paymentMethods = ["Наличные", "Карта", "Терминал"] as const;
export const paymentStatuses = ["Оплачено", "Частично", "Долг"] as const;
export const bookingStatuses = ["RESERVED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"] as const;

// JSON.parse("1e400") даёт Infinity, а z.number() его пропускает — одна такая
// сумма превращала выручку, долги и расчёт кассы в Infinity/NaN. Поэтому
// у всех денежных полей .finite().
export const reportSchema = z
  .object({
    date: z
      .string()
      .trim()
      .min(1, "Дата заезда обязательна")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Некорректная дата заезда"),
    checkOut: z
      .string()
      .trim()
      .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Некорректная дата выезда")
      .optional()
      .nullable(),
    guestName: z.string().trim().max(NAME_MAX, TOO_LONG).optional().nullable(),
    branchId: z.string().trim().min(1, "Филиал обязателен"),
    adminId: z.string().trim().min(1, "Администратор обязателен"),
    roomId: z.string().trim().min(1, "Номер обязателен"),
    sourceId: z.string().trim().min(1, "Источник бронирования обязателен"),
    price: z.number({ invalid_type_error: "Цена должна быть числом" }).finite("Некорректная цена").positive("Цена должна быть положительной"),
    currency: z.string().trim().min(1, "Валюта обязательна").max(CURRENCY_MAX, TOO_LONG),
    paymentMethod: z.enum(paymentMethods, {
      errorMap: () => ({ message: "Выберите способ оплаты" }),
    }),
    paymentStatus: z.enum(paymentStatuses, {
      errorMap: () => ({ message: "Выберите статус оплаты" }),
    }).default("Оплачено"),
    status: z.enum(bookingStatuses).default("RESERVED"),
    paidAmount: z.number({ invalid_type_error: "Сумма должна быть числом" }).finite("Некорректная сумма").min(0).optional().nullable(),
    notes: z.string().trim().max(NOTE_MAX, TOO_LONG).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.checkOut) {
      const inDate = new Date(data.date);
      const outDate = new Date(data.checkOut);
      if (!Number.isNaN(outDate.getTime()) && outDate <= inDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["checkOut"],
          message: "Дата выезда должна быть позже заезда",
        });
      }
    }
    if (data.paymentStatus === "Частично") {
      if (data.paidAmount == null || data.paidAmount <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paidAmount"], message: "Укажите оплаченную сумму" });
      } else if (data.paidAmount >= data.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paidAmount"],
          message: "Частичная оплата должна быть меньше цены",
        });
      }
    }
  });

export const expenseCategories = [
  "Зарплата",
  "Аренда",
  "Коммунальные",
  "Снабжение",
  "Ремонт",
  "Маркетинг",
  "Прочее",
] as const;

export const expenseSchema = z.object({
  // Проверяем разбор даты так же, как в reportSchema: без этого строка вроде
  // "31.02.2026" доходила до `new Date(...)` в маршруте, Prisma получала
  // Invalid Date и падала с 500 вместо понятной ошибки валидации.
  date: z
    .string()
    .trim()
    .min(1, "Дата обязательна")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Некорректная дата"),
  branchId: z.string().trim().optional(),
  category: z.enum(expenseCategories, {
    errorMap: () => ({ message: "Выберите категорию" }),
  }),
  amount: z.number({ invalid_type_error: "Сумма должна быть числом" }).finite("Некорректная сумма").positive("Сумма должна быть положительной"),
  currency: z.string().trim().min(1, "Валюта обязательна").max(CURRENCY_MAX, TOO_LONG),
  note: z.string().trim().max(NOTE_MAX, TOO_LONG).optional().nullable(),
});

export const cashShiftOpenSchema = z.object({
  openingAmount: z.number({ invalid_type_error: "Укажите сумму" }).finite("Некорректная сумма").min(0, "Сумма не может быть отрицательной"),
  currency: z.string().trim().min(1, "Валюта обязательна").max(CURRENCY_MAX, TOO_LONG),
  branchId: z.string().trim().optional().nullable(), // филиал смены (для мульти-филиальных админов)
  notes: z.string().trim().max(NOTE_MAX, TOO_LONG).optional().nullable(),
});

export const cashShiftCloseSchema = z.object({
  closingAmount: z.number({ invalid_type_error: "Укажите сумму" }).finite("Некорректная сумма").min(0, "Сумма не может быть отрицательной"),
  notes: z.string().trim().max(NOTE_MAX, TOO_LONG).optional().nullable(),
});

export const roomBlockKinds = ["HOLD", "BLOCK", "OUT_OF_ORDER"] as const;

const blockDate = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} обязательна`)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), `Некорректная ${label.toLowerCase()}`);

/**
 * Блокировка номера: временное хранение / закрытые даты / номер не работает.
 * Ночи считаются как у брони — [startDate, endDate), поэтому окончание строго
 * позже начала. Хранение обязано знать, до какого момента держать номер.
 */
export const roomBlockSchema = z
  .object({
    branchId: z.string().trim().min(1, "Филиал обязателен"),
    roomId: z.string().trim().min(1, "Номер обязателен"),
    kind: z.enum(roomBlockKinds, { errorMap: () => ({ message: "Неизвестный тип блокировки" }) }),
    startDate: blockDate("Дата начала"),
    endDate: blockDate("Дата окончания"),
    guestName: z.string().trim().max(NAME_MAX, TOO_LONG).optional().nullable(),
    note: z.string().trim().max(NOTE_MAX, TOO_LONG).optional().nullable(),
    holdUntil: z
      .string()
      .trim()
      .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Некорректный срок хранения")
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Дата окончания должна быть позже начала",
      });
    }
    if (data.kind === "HOLD" && !data.holdUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["holdUntil"],
        message: "Укажите, до какого времени держать номер",
      });
    }
  });
