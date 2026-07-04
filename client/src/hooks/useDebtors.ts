import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DebtorsResponse, MonthlyReport } from "@/types";

export function useDebtors(branchId?: string) {
  return useQuery({
    queryKey: ["debtors", branchId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      return (await api.get<DebtorsResponse>("/reports/debtors", { params })).data;
    },
  });
}

export function useSettleDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<MonthlyReport>(`/reports/${id}/settle`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debtors"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
