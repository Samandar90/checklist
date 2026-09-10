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

/*
 * iOS segmented control: a cool-wash track with a white sliding thumb. The
 * thumb is the one small control allowed a shadow — it is what makes it read
 * as a physical slider rather than a highlighted cell.
 */
export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div
      className={cn("grid gap-0.5 rounded-full bg-secondary p-[3px]", className)}
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
              "rounded-full px-2 py-1.5 text-[13px] font-medium transition-all",
              active
                ? o.activeCls ?? "bg-card text-foreground shadow-[0_3px_8px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)]"
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
