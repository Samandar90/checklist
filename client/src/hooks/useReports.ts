import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BookingStatus, MonthlyReport, PaymentMethod, PaymentStatus, ReportFilters, ReportSummary } from "@/types";

export interface ReportInput {
  date: string;
  checkOut?: string | null;
  guestName?: string | null;
  branchId?: string;
  adminId?: string;
  roomId: string;
  sourceId: string;
  price: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status?: BookingStatus;
  paidAmount?: number | null;
  notes?: string | null;
}

export type BulkBookingAction = "CHECK_IN" | "CHECK_OUT" | "CANCEL" | "NO_SHOW" | "DELETE" | "MOVE_ROOM";

function cleanFilters(filters: ReportFilters) {
  const params: Record<string, string> = {};
  if (filters.month) params.month = filters.month;
  if (filters.year) params.year = filters.year;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.adminId) params.adminId = filters.adminId;
  if (filters.sourceId) params.sourceId = filters.sourceId;
  return params;
}

export function useReports(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", filters],
    queryFn: async () =>
      (await api.get<MonthlyReport[]>("/reports", { params: cleanFilters(filters) })).data,
  });
}

export function useReportSummary(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports-summary", filters],
    queryFn: async () =>
      (await api.get<ReportSummary>("/reports/summary", { params: cleanFilters(filters) })).data,
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ReportInput) => (await api.post<MonthlyReport>("/reports", data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["reports-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReportInput }) =>
      (await api.put<MonthlyReport>(`/reports/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["reports-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/reports/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["reports-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

function invalidateReportQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["reports"] });
  qc.invalidateQueries({ queryKey: ["reports-summary"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["calendar"] });
  qc.invalidateQueries({ queryKey: ["audit"] });
}

export function useUpdateReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) =>
      (await api.patch<MonthlyReport>(`/reports/${id}/status`, { status })).data,
    onSuccess: () => invalidateReportQueries(qc),
  });
}

export function useBulkReportAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ids: string[]; action: BulkBookingAction; roomId?: string }) =>
      (await api.post<{ count: number }>("/reports/bulk", payload)).data,
    onSuccess: () => invalidateReportQueries(qc),
  });
}
