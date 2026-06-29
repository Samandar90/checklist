import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Wand2, Users, ArrowRight, TrendingUp } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RoomComparisonCard from "@/components/RoomComparisonCard";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useBranches } from "@/hooks/useBranches";
import { useRooms } from "@/hooks/useRooms";
import { useCalendar } from "@/hooks/useCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { addDaysIso, nightsBetween } from "@/lib/utils";
import { buildRoomProfiles, rankRooms, RankedRoom } from "@/lib/roomAssignment";

const OCCUPANCY_WINDOW_NIGHTS = 30;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function SmartAssignPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: branches } = useBranches({ enabled: !isAdmin });
  const { data: rooms } = useRooms();

  const [branchId, setBranchId] = useState<string>(isAdmin ? user?.branchId ?? "" : "");
  const [checkIn, setCheckIn] = useState(todayIso());
  const [checkOut, setCheckOut] = useState(addDaysIso(todayIso(), 2));
  const [guests, setGuests] = useState(2);
  const [preferredType, setPreferredType] = useState<string>("any");
  const [selected, setSelected] = useState<RankedRoom | null>(null);

  const branchRooms = useMemo(() => (rooms ?? []).filter((r) => r.branchId === branchId), [rooms, branchId]);
  const roomTypes = useMemo(
    () => Array.from(new Set(branchRooms.map((r) => r.type?.trim()).filter(Boolean))) as string[],
    [branchRooms]
  );

  const nights = Math.max(1, nightsBetween(checkIn, checkOut));
  const windowFrom = addDaysIso(checkIn, -OCCUPANCY_WINDOW_NIGHTS);

  const { data: rangeData, isLoading: rangeLoading } = useCalendar(branchId || undefined, checkIn, checkOut);
  const { data: windowData, isLoading: windowLoading } = useCalendar(branchId || undefined, windowFrom, checkIn);

  const result = useMemo(() => {
    if (!branchRooms.length || !rangeData || !windowData) return null;
    const profiles = buildRoomProfiles(branchRooms, windowData.bookings, rangeData.bookings, OCCUPANCY_WINDOW_NIGHTS);
    return rankRooms(profiles, {
      preferredType: preferredType === "any" ? undefined : preferredType,
      guests,
      nights,
    });
  }, [branchRooms, rangeData, windowData, preferredType, guests, nights]);

  function handleSelect(room: RankedRoom) {
    setSelected(room);
    toast.success(`Номер ${room.room.roomNumber} выбран`);
  }

  const isLoading = rangeLoading || windowLoading;

  return (
    <div>
      <PageHeader
        title="Умное распределение номеров"
        description="Подбор лучшего номера на основе доступности, типа, предпочтений гостя, длительности и текущей загрузки."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          {!isAdmin && (
            <div className="w-52 space-y-1.5">
              <Label>Филиал</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите филиал" />
                </SelectTrigger>
                <SelectContent>
                  {(branches ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="w-40 space-y-1.5">
            <Label>Заезд</Label>
            <Input
              type="date"
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (new Date(checkOut) <= new Date(e.target.value)) setCheckOut(addDaysIso(e.target.value, 1));
              }}
            />
          </div>
          <div className="w-40 space-y-1.5">
            <Label>Выезд</Label>
            <Input type="date" min={checkIn} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>

          <div className="w-44 space-y-1.5">
            <Label>Тип номера</Label>
            <Select value={preferredType} onValueChange={setPreferredType}>
              <SelectTrigger>
                <SelectValue placeholder="Любой" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Любой тип</SelectItem>
                {roomTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32 space-y-1.5">
            <Label>Гостей</Label>
            <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1">
              <button onClick={() => setGuests((g) => Math.max(1, g - 1))} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground">
                −
              </button>
              <span className="flex flex-1 items-center justify-center gap-1 text-[13px] font-semibold text-foreground">
                <Users className="h-3.5 w-3.5" /> {guests}
              </span>
              <button onClick={() => setGuests((g) => Math.min(6, g + 1))} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground">
                +
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {nights} {nights === 1 ? "ночь" : "ночи/ночей"}
          </p>
        </CardContent>
      </Card>

      {selected && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3"
        >
          <span className="text-sm text-foreground">
            Выбран номер <strong>№ {selected.room.roomNumber}</strong>. Создайте бронирование в шахматке.
          </span>
          <Button asChild size="sm">
            <Link to="/calendar">
              Перейти в шахматку <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>
      )}

      {!branchId ? (
        <EmptyState icon={Wand2} title="Выберите филиал" description="Укажите филиал, даты и предпочтения, чтобы получить подбор номеров." />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : !result || !result.best ? (
        <EmptyState icon={Wand2} title="Нет свободных номеров" description="На выбранные даты в этом филиале нет доступных номеров." />
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Лучшее совпадение</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <RoomComparisonCard room={result.best} badge={{ label: "Лучшее совпадение", tint: "text-primary" }} onSelect={handleSelect} />
            </div>
          </section>

          {result.alternatives.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Альтернативные номера</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.alternatives.map((r, i) => (
                  <RoomComparisonCard key={r.room.id} room={r} baseline={result.best} onSelect={handleSelect} delay={(i + 1) * 0.05} />
                ))}
              </div>
            </section>
          )}

          {result.upgrades.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <TrendingUp className="h-4 w-4 text-amber-600" /> Предложения для повышения категории
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.upgrades.map((r, i) => (
                  <RoomComparisonCard
                    key={r.room.id}
                    room={r}
                    baseline={result.best}
                    badge={{ label: "Повышение категории", tint: "text-amber-600" }}
                    onSelect={handleSelect}
                    delay={(i + 1) * 0.05}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
