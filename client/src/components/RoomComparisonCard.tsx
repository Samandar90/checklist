import { motion } from "framer-motion";
import { Users, Layers, Sparkles, Wallet, Gauge, Crown, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RankedRoom } from "@/lib/roomAssignment";

function Diff({ value, baseline, suffix = "" }: { value: number; baseline: number; suffix?: string }) {
  if (baseline === 0 || value === baseline) return null;
  const delta = value - baseline;
  return (
    <span className={cn("ml-1 text-[10.5px] font-semibold", delta > 0 ? "text-emerald-600" : "text-rose-500")}>
      {delta > 0 ? "+" : ""}
      {Math.round(delta).toLocaleString("ru-RU")}
      {suffix}
    </span>
  );
}

export default function RoomComparisonCard({
  room,
  baseline,
  badge,
  onSelect,
  delay = 0,
}: {
  room: RankedRoom;
  baseline?: RankedRoom | null;
  badge?: { label: string; tint: string; icon?: typeof Crown };
  onSelect?: (room: RankedRoom) => void;
  delay?: number;
}) {
  const BadgeIcon = badge?.icon ?? Crown;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.16, 1, 0.3, 1] as const }}
    >
      <Card className="relative h-full overflow-hidden">
        {badge && (
          <div className={cn("flex items-center gap-1.5 px-5 pt-4 text-[11px] font-semibold uppercase tracking-wide", badge.tint)}>
            <BadgeIcon className="h-3.5 w-3.5" /> {badge.label}
          </div>
        )}
        <CardContent className={cn("space-y-4", badge ? "pt-2" : "pt-5")}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold tracking-tight text-foreground">№ {room.room.roomNumber}</p>
              <p className="text-xs text-muted-foreground">{room.room.type || "Без типа"} · этаж {room.floor}</p>
            </div>
            <Badge className="bg-secondary text-secondary-foreground tabular-nums">{room.score} баллов</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="tabular-nums text-foreground">
                {room.avgPrice > 0 ? Math.round(room.avgPrice).toLocaleString("ru-RU") : "—"}
              </span>
              {baseline && <Diff value={room.avgPrice} baseline={baseline.avgPrice} />}
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="tabular-nums text-foreground">{room.capacity} гост.</span>
              {baseline && <Diff value={room.capacity} baseline={baseline.capacity} />}
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">Этаж {room.floor}</span>
            </div>
            <div className="flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="tabular-nums text-foreground">{Math.round(room.occupancyRate * 100)}% загрузка</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {room.amenities.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                <Sparkles className="h-2.5 w-2.5" /> {a}
              </span>
            ))}
          </div>

          {room.reasons.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-3">
              {room.reasons.slice(0, 2).map((r) => (
                <li key={r} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> {r}
                </li>
              ))}
            </ul>
          )}

          {onSelect && (
            <button
              onClick={() => onSelect(room)}
              className="w-full rounded-lg bg-primary py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Выбрать этот номер
            </button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
