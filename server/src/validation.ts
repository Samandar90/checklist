import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно"),
});

export const adminCreateSchema = z.object({
  fullName: z.string().trim().min(1, "ФИО обязательно"),
  phone: z.string().trim().min(1, "Телефон обязателен"),
  branchId: z.string().trim().min(1, "Филиал обязателен"),
  username: z.string().trim().min(3, "Логин должен быть не короче 3 символов"),
  password: z.string().min(6, "Пароль должен быть не короче 6 символов"),
});

export const adminUpdateSchema = z.object({
  fullName: z.string().trim().min(1, "ФИО обязательно"),
  phone: z.string().trim().min(1, "Телефон обязателен"),
  branchId: z.string().trim().min(1, "Филиал обязателен"),
  username: z.string().trim().min(3, "Логин должен быть не короче 3 символов"),
  password: z.string().min(6, "Пароль должен быть не короче 6 символов").optional().or(z.literal("")),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Укажите логин"),
  password: z.string().min(1, "Укажите пароль"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Укажите текущий пароль"),
  newPassword: z.string().min(6, "Новый пароль должен быть не короче 6 символов"),
});

export const roomSchema = z.object({
  roomNumber: z.string().trim().min(1, "Номер комнаты обязателен"),
  type: z.string().trim().optional().nullable(),
  branchId: z.string().trim().min(1, "Филиал обязателен"),
});

export const sourceSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно"),
});

export const paymentMethods = ["Наличные", "Карта", "Терминал"] as const;
export const paymentStatuses = ["Оплачено", "Частично", "Долг"] as const;

export const reportSchema = z
  .object({
    date: z.string().trim().min(1, "Дата заезда обязательна"),
    checkOut: z.string().trim().optional().nullable(),
    guestName: z.string().trim().optional().nullable(),
    branchId: z.string().trim().min(1, "Филиал обязателен"),
    adminId: z.string().trim().min(1, "Администратор обязателен"),
    roomId: z.string().trim().min(1, "Номер обязателен"),
    sourceId: z.string().trim().min(1, "Источник бронирования обязателен"),
    price: z.number({ invalid_type_error: "Цена должна быть числом" }).positive("Цена должна быть положительной"),
    currency: z.string().trim().min(1, "Валюта обязательна"),
    paymentMethod: z.enum(paymentMethods, {
      errorMap: () => ({ message: "Выберите способ оплаты" }),
    }),
    paymentStatus: z.enum(paymentStatuses, {
      errorMap: () => ({ message: "Выберите статус оплаты" }),
    }).default("Оплачено"),
    paidAmount: z.number({ invalid_type_error: "Сумма должна быть числом" }).min(0).optional().nullable(),
    notes: z.string().trim().optional().nullable(),
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
  date: z.string().trim().min(1, "Дата обязательна"),
  branchId: z.string().trim().optional(),
  category: z.enum(expenseCategories, {
    errorMap: () => ({ message: "Выберите категорию" }),
  }),
  amount: z.number({ invalid_type_error: "Сумма должна быть числом" }).positive("Сумма должна быть положительной"),
  currency: z.string().trim().min(1, "Валюта обязательна"),
  note: z.string().trim().optional().nullable(),
});
