import { MonthlyReport } from "@/types";
import { formatDate } from "@/lib/utils";

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportReportsToCsv(reports: MonthlyReport[], filename = "ежемесячные-отчёты.csv") {
  const headers = ["Дата", "Филиал", "Администратор", "Номер", "Источник", "Цена", "Валюта", "Заметки"];
  const rows = reports.map((r) => [
    formatDate(r.date),
    r.branch.name,
    r.admin.fullName,
    r.room.roomNumber,
    r.source.name,
    String(r.price),
    r.currency,
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
