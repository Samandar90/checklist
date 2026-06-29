import { createContext, useContext, useEffect, useState, ReactNode } from "react";

const STORAGE_KEY = "hotel_reports_active_branch";

interface BranchContextValue {
  activeBranchId: string | undefined;
  setActiveBranchId: (id: string | undefined) => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [activeBranchId, setActiveBranchId] = useState<string | undefined>(
    () => localStorage.getItem(STORAGE_KEY) || undefined
  );

  useEffect(() => {
    if (activeBranchId) localStorage.setItem(STORAGE_KEY, activeBranchId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [activeBranchId]);

  return <BranchContext.Provider value={{ activeBranchId, setActiveBranchId }}>{children}</BranchContext.Provider>;
}

export function useActiveBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useActiveBranch must be used within BranchProvider");
  return ctx;
}
