import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AuditFilters, AuditResponse } from "@/types";

export function useAudit(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ["audit", filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.entity) params.entity = filters.entity;
      if (filters.action) params.action = filters.action;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.page) params.page = String(filters.page);
      return (await api.get<AuditResponse>("/audit", { params })).data;
    },
    placeholderData: keepPreviousData,
  });
}
