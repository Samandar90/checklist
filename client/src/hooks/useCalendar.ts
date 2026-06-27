import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CalendarResponse } from "@/types";

export function useCalendar(branchId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["calendar", branchId, from, to],
    enabled: Boolean(branchId),
    queryFn: async () =>
      (await api.get<CalendarResponse>("/reports/calendar", { params: { branchId, from, to } })).data,
  });
}
