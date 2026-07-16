import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatDate, pluralRu } from "@/lib/utils";

export interface GuestSuggestion {
  name: string;
  stays: number;
  lastVisit: string;
}

function guestInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Guest name field with autocomplete from the branch's booking history —
 * type to filter returning guests (name + visits + last stay), click to fill.
 * There's no separate guests table; suggestions are derived from past bookings.
 *
 * Kept in its own module (not co-located in BookingWizard) so React Fast Refresh
 * updates it cleanly without a transient "not defined" during hot reloads.
 */
export default function GuestAutocomplete({
  value,
  onChange,
  guests,
}: {
  value: string;
  onChange: (v: string) => void;
  guests: GuestSuggestion[];
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = q ? guests.filter((g) => g.name.toLowerCase().includes(q) && g.name.toLowerCase() !== q) : guests;
    return list.slice(0, 6);
  }, [q, guests]);

  return (
    <div className="relative">
      <Input
        id="bw-guest"
        placeholder="например, Иван Иванов"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && matches.length > 0 && (
        <div className="glass-strong absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-2xl p-1 animate-pop-in">
          {matches.map((g) => (
            <button
              key={g.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(g.name);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-primary/10"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                {guestInitials(g.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{g.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {g.stays} {pluralRu(g.stays, "визит", "визита", "визитов")} · последний {formatDate(g.lastVisit)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
