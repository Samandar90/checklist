import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, ChevronDown, Check, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranches } from "@/hooks/useBranches";
import { useActiveBranch } from "@/contexts/BranchContext";

export default function BranchSwitcher() {
  const { data: branches } = useBranches();
  const { activeBranchId, setActiveBranchId } = useActiveBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const activeName = activeBranchId ? branches?.find((b) => b.id === activeBranchId)?.name : "Все отели";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <Building2 className="h-[13px] w-[13px] text-muted-foreground" />
        <span className="max-w-[140px] truncate">{activeName ?? "Все отели"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 text-sm shadow-xl"
          >
            <button
              onClick={() => {
                setActiveBranchId(undefined);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left text-foreground transition-colors hover:bg-secondary"
            >
              <span>Все отели</span>
              {!activeBranchId && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
            <div className="my-1 border-t border-border" />
            {(branches ?? []).map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setActiveBranchId(b.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left text-foreground transition-colors hover:bg-secondary"
              >
                <span className="truncate">{b.name}</span>
                {activeBranchId === b.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => {
                setOpen(false);
                navigate("/workspace");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LayoutGrid className="h-[14px] w-[14px]" /> Открыть воркспейс
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
