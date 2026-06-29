import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AuditFilters, AuditResponse } from "@/types";

export function useAudit(filters: AuditFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["audit", filters],
    enabled,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.entity) params.entity = filters.entity;
      if (filters.entityId) params.entityId = filters.entityId;
      if (filters.action) params.action = filters.action;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.page) params.page = String(filters.page);
      return (await api.get<AuditResponse>("/audit", { params })).data;
    },
    placeholderData: keepPreviousData,
  });
}
