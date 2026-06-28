import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  User2,
  Wallet,
  ClipboardList,
  Moon,
  AlertTriangle,
  BedDouble,
  StickyNote,
  History,
} from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerSection, DrawerCloseButton } from "@/components/ui/drawer";
import { useReports } from "@/hooks/useReports";
import { MonthlyReport } from "@/types";
import { cn, formatDate, formatDateTime, formatMoney, nightsBetween, reportDebt, paymentStatusClass } from "@/lib/utils";

interface GuestProfile {
  key: string;
  name: string;
  bookings: MonthlyReport[];
  totalRevenue: number;
  totalDebt: number;
  stays: number;
  avgNights: number;
  lastVisit: string;
  branches: Set<string>;
}

function buildGuests(reports: MonthlyReport[]): GuestProfile[] {
  const map = new Map<string, GuestProfile>();
  for (const r of reports) {
    const name = r.guestName?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { key, name, bookings: [], totalRevenue: 0, totalDebt: 0, stays: 0, avgNights: 0, lastVisit: r.date, branches: new Set() });
    }
    const g = map.get(key)!;
    g.bookings.push(r);
    g.totalRevenue += r.price;
    g.totalDebt += reportDebt(r);
    g.stays += 1;
    g.branches.add(r.branch.name);
    if (r.date > g.lastVisit) g.lastVisit = r.date;
  }
  for (const g of map.values()) {
    g.bookings.sort((a, b) => b.date.localeCompare(a.date));
    const totalNights = g.bookings.reduce((s, b) => s + nightsBetween(b.date, b.checkOut), 0);
    g.avgNights = Math.round((totalNights / g.stays) * 10) / 10;
  }
  return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

const tabs = [
  { key: "overview", label: "Обзор", icon: User2 },
  { key: "reservations", label: "Брони", icon: BedDouble },
  { key: "payments", label: "Оплаты", icon: Wallet },
  { key: "notes", label: "Заметки", icon: StickyNote },
  { key: "activity", label: "История", icon: History },
] as const;
type TabKey = (typeof tabs)[number]["key"];

export default function GuestsPage() {
  const { data: reports, isLoading } = useReports({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GuestProfile | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  const guests = useMemo(() => buildGuests(reports ?? []), [reports]);
  const q = search.trim().toLowerCase();
  const filtered = q ? guests.filter((g) => g.name.toLowerCase().includes(q)) : guests;

  return (
    <div>
      <PageHeader title="Гости" description="Профили гостей: история проживаний, платежей и заметок." />

      <div className="mb-5 w-72 space-y-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск гостя…" className="pl-8" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={User2} title="Гости не найдены" description="Брони с указанным именем гостя пока нет." />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((g) => (
            <motion.div key={g.key} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}>
              <Card className="cursor-pointer" onClick={() => { setSelected(g); setTab("overview"); }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold text-foreground">
                      {g.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{Array.from(g.branches).join(", ")}</p>
                    </div>
                    {g.totalDebt > 0 && (
                      <Badge className="tint-rose ml-auto shrink-0">Долг</Badge>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-semibold tabular-nums text-foreground">{g.stays}</div>
                      <p className="text-[10px] text-muted-foreground">визитов</p>
                    </div>
                    <div>
                      <div className="text-sm font-semibold tabular-nums text-foreground">{(g.totalRevenue / 1000).toFixed(0)}к</div>
                      <p className="text-[10px] text-muted-foreground">выручка</p>
                    </div>
                    <div>
                      <div className="text-sm font-semibold tabular-nums text-foreground">{formatDate(g.lastVisit)}</div>
                      <p className="text-[10px] text-muted-foreground">визит</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent>
          {selected && (
            <>
              <DrawerHeader>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-foreground">
                    {selected.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <DrawerTitle>{selected.name}</DrawerTitle>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {Array.from(selected.branches).join(", ")} · Последний визит {formatDate(selected.lastVisit)}
                    </p>
                  </div>
                </div>
                <DrawerCloseButton />
              </DrawerHeader>

              {/* KPI */}
              <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
                <Kpi icon={Wallet} tint="tint-indigo" label="Выручка" value={formatMoney(selected.totalRevenue, selected.bookings[0]?.currency ?? "UZS")} />
                <Kpi icon={ClipboardList} tint="tint-violet" label="Бронирований" value={String(selected.stays)} />
                <Kpi icon={Moon} tint="tint-sky" label="Средний срок" value={`${selected.avgNights} ноч.`} />
                <Kpi icon={AlertTriangle} tint="tint-rose" label="Долг" value={selected.totalDebt > 0 ? formatMoney(selected.totalDebt, selected.bookings[0]?.currency ?? "UZS") : "—"} />
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-border px-4 pt-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[12.5px] font-medium transition-colors",
                      tab === t.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              <DrawerBody>
                {tab === "overview" && (
                  <DrawerSection title="Последние брони">
                    <div className="space-y-2.5">
                      {selected.bookings.slice(0, 5).map((b) => (
                        <ReservationRow key={b.id} b={b} />
                      ))}
                    </div>
                  </DrawerSection>
                )}

                {tab === "reservations" && (
                  <DrawerSection title={`Все бронирования (${selected.stays})`}>
                    <div className="space-y-2.5">
                      {selected.bookings.map((b) => (
                        <ReservationRow key={b.id} b={b} />
                      ))}
                    </div>
                  </DrawerSection>
                )}

                {tab === "payments" && (
                  <DrawerSection title="История оплат">
                    <div className="space-y-2.5">
                      {selected.bookings.map((b) => {
                        const debt = reportDebt(b);
                        return (
                          <div key={b.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                            <div>
                              <p className="text-foreground">{formatMoney(b.price, b.currency)} · {b.paymentMethod}</p>
                              <p className="text-[11px] text-muted-foreground">{formatDate(b.date)} · номер {b.room.roomNumber}</p>
                            </div>
                            <div className="text-right">
                              <Badge className={paymentStatusClass(b.paymentStatus)}>{b.paymentStatus}</Badge>
                              {debt > 0 && <p className="mt-0.5 text-[11px] text-destructive">Долг: {formatMoney(debt, b.currency)}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </DrawerSection>
                )}

                {tab === "notes" && (
                  <DrawerSection title="Заметки по бронированиям">
                    {selected.bookings.filter((b) => b.notes?.trim()).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Заметок нет.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {selected.bookings.filter((b) => b.notes?.trim()).map((b) => (
                          <div key={b.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                            <p className="text-foreground">{b.notes}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(b.date)} · номер {b.room.roomNumber}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </DrawerSection>
                )}

                {tab === "activity" && (
                  <DrawerSection title="История изменений">
                    <div className="space-y-2.5">
                      {selected.bookings.map((b) => (
                        <div key={b.id} className="text-sm">
                          <p className="text-foreground">Бронь · номер {b.room.roomNumber} · {formatMoney(b.price, b.currency)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Создано {formatDateTime(b.createdAt)}
                            {b.updatedAt ? ` · изменено ${formatDateTime(b.updatedAt)}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </DrawerSection>
                )}
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Kpi({ icon: Icon, tint, label, value }: { icon: typeof Wallet; tint: string; label: string; value: string }) {
  return (
    <div className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", tint)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-[15px] font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function ReservationRow({ b }: { b: MonthlyReport }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
      <div>
        <p className="text-foreground">
          Номер {b.room.roomNumber}
          {b.room.type ? ` · ${b.room.type}` : ""}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatDate(b.date)} → {b.checkOut ? formatDate(b.checkOut) : "+1"} · {nightsBetween(b.date, b.checkOut)} ноч.
        </p>
      </div>
      <div className="text-right">
        <p className="font-medium tabular-nums text-foreground">{formatMoney(b.price, b.currency)}</p>
        <Badge className={cn(paymentStatusClass(b.paymentStatus), "mt-0.5")}>{b.paymentStatus}</Badge>
      </div>
    </div>
  );
}

