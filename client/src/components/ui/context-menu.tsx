import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  destructive?: boolean;
}

export function ContextMenu({
  items,
  children,
}: {
  items: ContextMenuItem[];
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    function close() {
      setPos(null);
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", (e) => e.key === "Escape" && close());
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [pos]);

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <div onContextMenu={onContextMenu}>{children}</div>
      {pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ left: pos.x, top: pos.y }}
            className="glass-strong fixed z-[100] min-w-[180px] overflow-hidden rounded-2xl p-1 animate-pop-in"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onSelect();
                  setPos(null);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-primary/10",
                  item.destructive ? "text-destructive" : "text-foreground"
                )}
              >
                {item.icon && <item.icon className="h-[14px] w-[14px]" />}
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
