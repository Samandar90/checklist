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
  branchId: z.string().trim().min(1, "Филиал обязателен"),
});

export const sourceSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно"),
});

export const reportSchema = z.object({
  date: z.string().trim().min(1, "Дата обязательна"),
  branchId: z.string().trim().min(1, "Филиал обязателен"),
  adminId: z.string().trim().min(1, "Администратор обязателен"),
  roomId: z.string().trim().min(1, "Номер обязателен"),
  sourceId: z.string().trim().min(1, "Источник бронирования обязателен"),
  price: z.number({ invalid_type_error: "Цена должна быть числом" }).positive("Цена должна быть положительной"),
  currency: z.string().trim().min(1, "Валюта обязательна"),
  notes: z.string().trim().optional().nullable(),
});
