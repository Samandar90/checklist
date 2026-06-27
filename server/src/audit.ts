import { Request } from "express";
import { prisma } from "./prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface FieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

const FIELD_LABELS: Record<string, string> = {
  date: "Заезд",
  checkOut: "Выезд",
  price: "Цена",
  currency: "Валюта",
  paymentMethod: "Способ оплаты",
  paymentStatus: "Статус оплаты",
  paidAmount: "Оплачено",
  notes: "Заметки",
  roomNumber: "Номер",
  sourceName: "Источник",
  adminName: "Администратор",
  branchName: "Филиал",
  category: "Категория",
  amount: "Сумма",
  note: "Заметка",
  name: "Название",
  fullName: "ФИО",
  phone: "Телефон",
  username: "Логин",
};

const ENTITY_LABELS: Record<string, string> = {
  report: "отчёт",
  expense: "расход",
  branch: "филиал",
  admin: "администратора",
  room: "номер",
  source: "источник",
};

const MONEY_FIELDS = new Set(["price", "paidAmount", "amount"]);
const DATE_FIELDS = new Set(["date", "checkOut"]);

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY_FIELDS.has(field)) return Number(value).toLocaleString("ru-RU");
  if (DATE_FIELDS.has(field)) return new Date(value as string).toISOString().slice(0, 10);
  return String(value);
}

function normalize(field: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (DATE_FIELDS.has(field)) return new Date(value as string).toISOString().slice(0, 10);
  return String(value);
}

/** Build the list of changed fields between two snapshots. */
export function buildChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    if (normalize(field, before[field]) !== normalize(field, after[field])) {
      changes.push({
        field,
        label: FIELD_LABELS[field] ?? field,
        from: formatValue(field, before[field]),
        to: formatValue(field, after[field]),
      });
    }
  }
  return changes;
}

function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

/** Human-readable one-line summary for the audit feed. */
export function summarize(action: AuditAction, entity: string, changes: FieldChange[], extra?: string): string {
  const label = entityLabel(entity);
  if (action === "CREATE") return `Добавил ${label}${extra ? ` — ${extra}` : ""}`;
  if (action === "DELETE") return `Удалил ${label}${extra ? ` — ${extra}` : ""}`;
  if (!changes.length) return `Изменил ${label}`;
  return `Изменил ${label}: ` + changes.map((c) => `${c.label} ${c.from} → ${c.to}`).join("; ");
}

async function resolveActor(req: Request): Promise<{ id: string | null; name: string; role: string }> {
  const sub = req.user?.sub ?? null;
  const role = req.user?.role ?? "UNKNOWN";
  if (!sub) return { id: null, name: "—", role };
  try {
    const user = await prisma.user.findUnique({ where: { id: sub }, include: { admin: true } });
    return { id: sub, name: user?.admin?.fullName ?? user?.username ?? "—", role };
  } catch {
    return { id: sub, name: "—", role };
  }
}

interface RecordArgs {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary: string;
  changes?: FieldChange[];
}

/** Best-effort audit write — never throws into the request flow. */
export async function recordAudit(req: Request, args: RecordArgs): Promise<void> {
  try {
    const actor = await resolveActor(req);
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: args.action,
        entity: args.entity,
        entityId: args.entityId ?? null,
        summary: args.summary,
        changes: args.changes && args.changes.length ? JSON.stringify(args.changes) : null,
      },
    });
  } catch (err) {
    console.error("Не удалось записать журнал аудита:", err);
  }
}
