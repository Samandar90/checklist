import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Tailwind classes applied when this option is active (e.g. colored status). */
  activeCls?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div
      className={cn("grid gap-1 rounded-2xl bg-secondary/70 p-1 ring-1 ring-inset ring-border/60", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl px-2 py-1.5 text-sm font-medium transition-all",
              active
                ? o.activeCls ?? "bg-card text-foreground shadow-[0_1px_3px_rgba(16,24,40,0.14)] ring-1 ring-black/[0.04]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
