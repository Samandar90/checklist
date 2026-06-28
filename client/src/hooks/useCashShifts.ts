import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CashShift } from "@/types";

export interface CashShiftFilters {
  branchId?: string;
  adminId?: string;
  status?: "OPEN" | "CLOSED";
}

function cleanFilters(filters: CashShiftFilters) {
  const params: Record<string, string> = {};
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.adminId) params.adminId = filters.adminId;
  if (filters.status) params.status = filters.status;
  return params;
}

export function useCashShifts(filters: CashShiftFilters = {}) {
  return useQuery({
    queryKey: ["cash-shifts", filters],
    queryFn: async () => (await api.get<CashShift[]>("/cash-shifts", { params: cleanFilters(filters) })).data,
  });
}

export function useActiveCashShift() {
  return useQuery({
    queryKey: ["cash-shifts", "active"],
    queryFn: async () => (await api.get<CashShift | null>("/cash-shifts/active")).data,
    refetchInterval: 30_000,
  });
}

export function useOpenCashShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { openingAmount: number; currency: string; notes?: string | null }) =>
      (await api.post<CashShift>("/cash-shifts", data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-shifts"] });
    },
  });
}

export function useCloseCashShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { closingAmount: number; notes?: string | null } }) =>
      (await api.put<CashShift>(`/cash-shifts/${id}/close`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-shifts"] });
    },
  });
}
