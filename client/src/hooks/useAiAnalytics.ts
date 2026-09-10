import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AiAskResponse, AiNarrative, AiOverview, DashboardFilters } from "@/types";

function toParams(filters: DashboardFilters) {
  const params: Record<string, string> = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.branchId) params.branchId = filters.branchId;
  return params;
}

export function useAiOverview(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ["ai-overview", filters],
    queryFn: async () => (await api.get<AiOverview>("/ai-analytics/overview", { params: toParams(filters) })).data,
    staleTime: 60_000,
  });
}

/** The Claude-written summary. Cached server-side for 10 min; never retried on failure (it costs money). */
export function useAiNarrative(filters: DashboardFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["ai-narrative", filters],
    queryFn: async () => (await api.get<AiNarrative>("/ai-analytics/narrative", { params: toParams(filters) })).data,
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useAskAi() {
  return useMutation({
    mutationFn: async (body: DashboardFilters & { question: string }) =>
      (await api.post<AiAskResponse>("/ai-analytics/ask", body)).data,
  });
}
