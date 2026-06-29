import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAudit } from "@/hooks/useAudit";
import { cn } from "@/lib/utils";
import ActivityTimeline from "@/components/ActivityTimeline";

const SEEN_KEY = "hotel_reports_notifications_seen_at";

export default function NotificationCenter() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useAudit({ page: 1 }, isSuperAdmin);
  const items = isSuperAdmin ? (data?.items.slice(0, 8) ?? []) : [];

  const [lastSeen, setLastSeen] = useState<string>(() => localStorage.getItem(SEEN_KEY) ?? "");
  const unreadCount = items.filter((i) => !lastSeen || new Date(i.createdAt) > new Date(lastSeen)).length;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  function handleOpen() {
    setOpen((o) => !o);
    if (items[0]) {
      localStorage.setItem(SEEN_KEY, items[0].createdAt);
      setLastSeen(items[0].createdAt);
    }
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        aria-label="Уведомления"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-[16px] w-[16px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-rose-500" />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+6px)] w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-pop-in"
          )}
        >
          <div className="border-b border-border px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-foreground">Уведомления</p>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            <ActivityTimeline items={items} emptyText="Нет новых событий" />
          </div>
        </div>
      )}
    </div>
  );
}
