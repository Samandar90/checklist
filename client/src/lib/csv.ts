import { MonthlyReport, AuditLog } from "@/types";
import { formatDate, formatDateTime, reportDebt, nightsBetween } from "@/lib/utils";

export function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportReportsToCsv(reports: MonthlyReport[], filename = "ежемесячные-отчёты.csv") {
  const headers = [
    "Заезд",
    "Выезд",
    "Ночей",
    "Гость",
    "Филиал",
    "Администратор",
    "Номер",
    "Источник",
    "Цена",
    "Валюта",
    "Оплата",
    "Статус",
    "Долг",
    "Заметки",
  ];
  const rows = reports.map((r) => [
    formatDate(r.date),
    r.checkOut ? formatDate(r.checkOut) : "",
    String(nightsBetween(r.date, r.checkOut)),
    r.guestName ?? "",
    r.branch.name,
    r.admin.fullName,
    r.room.roomNumber,
    r.source.name,
    String(r.price),
    r.currency,
    r.paymentMethod,
    r.paymentStatus,
    String(reportDebt(r)),
    r.notes ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const ENTITY_LABELS: Record<string, string> = {
  report: "Отчёт",
  expense: "Расход",
  branch: "Филиал",
  admin: "Администратор",
  room: "Номер",
  source: "Источник",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Добавление",
  UPDATE: "Изменение",
  DELETE: "Удаление",
};

export function exportAuditToCsv(logs: AuditLog[], filename = "журнал-изменений.csv") {
  const headers = ["Дата", "Пользователь", "Роль", "Действие", "Раздел", "Описание"];
  const rows = logs.map((l) => [
    formatDateTime(l.createdAt),
    l.actorName,
    l.actorRole === "SUPER_ADMIN" ? "Главный" : "Администратор",
    ACTION_LABELS[l.action] ?? l.action,
    ENTITY_LABELS[l.entity] ?? l.entity,
    l.summary,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
