import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function HoverCard({
  content,
  children,
  className,
  delay = 250,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }

  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }

  return (
    <div className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {open && (
        <div
          className={cn(
            "absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-64 -translate-x-1/2 rounded-xl border border-border bg-card p-3 text-sm shadow-xl dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85)] animate-pop-in",
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
