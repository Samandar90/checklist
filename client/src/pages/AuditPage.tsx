import { useState } from "react";
import { Plus, Pencil, Trash2, History, X, ArrowRight } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAudit } from "@/hooks/useAudit";
import { AuditFilters, AuditFieldChange, AuditLog } from "@/types";
import { cn, formatDateTime } from "@/lib/utils";

const entityLabels: Record<string, string> = {
  report: "Отчёт",
  expense: "Расход",
  branch: "Филиал",
  admin: "Администратор",
  room: "Номер",
  source: "Источник",
};

const actionMeta: Record<string, { label: string; icon: typeof Plus; cls: string }> = {
  CREATE: { label: "Добавление", icon: Plus, cls: "bg-emerald-50 text-emerald-600" },
  UPDATE: { label: "Изменение", icon: Pencil, cls: "bg-amber-50 text-amber-600" },
  DELETE: { label: "Удаление", icon: Trash2, cls: "bg-red-50 text-red-600" },
};

function parseChanges(raw: string | null): AuditFieldChange[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AuditFieldChange[];
  } catch {
    return [];
  }
}

function AuditRow({ log }: { log: AuditLog }) {
  const meta = actionMeta[log.action] ?? actionMeta.UPDATE;
  const Icon = meta.icon;
  const changes = parseChanges(log.changes);

  return (
    <div className="flex gap-3 py-3.5">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.cls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{log.actorName}</span>
          <Badge className="bg-secondary text-[11px] text-muted-foreground">
            {log.actorRole === "SUPER_ADMIN" ? "Главный" : "Админ"}
          </Badge>
          <Badge className="bg-secondary text-[11px] text-muted-foreground">
            {entityLabels[log.entity] ?? log.entity}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{log.summary}</p>

        {changes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {changes.map((c) => (
              <span
                key={c.field}
                className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs"
              >
                <span className="text-muted-foreground">{c.label}:</span>
                <span className="text-foreground line-through decoration-muted-foreground/50">{c.from}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium text-foreground">{c.to}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(log.createdAt)}
      </span>
    </div>
  );
}

export default function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ page: 1 });
  const { data, isLoading } = useAudit(filters);

  const set = (patch: Partial<AuditFilters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const hasActiveFilters = Boolean(filters.entity || filters.action || filters.from || filters.to);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader
        title="Журнал изменений"
        description="Все действия пользователей: кто, когда и что изменил."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-44 space-y-1.5">
            <Label>Раздел</Label>
            <Select
              value={filters.entity ?? "all"}
              onValueChange={(v) => set({ entity: v === "all" ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все разделы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все разделы</SelectItem>
                {Object.entries(entityLabels).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-44 space-y-1.5">
            <Label>Действие</Label>
            <Select
              value={filters.action ?? "all"}
              onValueChange={(v) => set({ action: v === "all" ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все действия" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все действия</SelectItem>
                {Object.entries(actionMeta).map(([k, m]) => (
                  <SelectItem key={k} value={k}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>С</Label>
            <Input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => set({ from: e.target.value || undefined })}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label>По</Label>
            <Input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => set({ to: e.target.value || undefined })}
              className="w-40"
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => setFilters({ page: 1 })}>
              <X className="h-3.5 w-3.5" /> Сбросить
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Записей нет"
          description="Изменения появятся здесь, как только пользователи начнут работать."
        />
      ) : (
        <>
          <Card>
            <CardContent className="divide-y divide-border p-4">
              {data.items.map((log) => (
                <AuditRow key={log.id} log={log} />
              ))}
            </CardContent>
          </Card>
          <Pagination
            page={data.page}
            totalPages={totalPages}
            totalItems={data.total}
            pageSize={data.pageSize}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          />
        </>
      )}
    </div>
  );
}
