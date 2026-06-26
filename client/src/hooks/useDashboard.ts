import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardStats } from "@/types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardStats>("/dashboard")).data,
  });
}
