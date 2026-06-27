import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardStats, DashboardFilters } from "@/types";

export function useDashboard(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ["dashboard", filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.branchId) params.branchId = filters.branchId;
      return (await api.get<DashboardStats>("/dashboard", { params })).data;
    },
  });
}
