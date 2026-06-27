import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Expense, ExpenseCategory, ExpenseFilters } from "@/types";

export interface ExpenseInput {
  date: string;
  branchId: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  note?: string | null;
}

function cleanFilters(filters: ExpenseFilters) {
  const params: Record<string, string> = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.branchId) params.branchId = filters.branchId;
  return params;
}

export function useExpenses(filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: ["expenses", filters],
    queryFn: async () => (await api.get<Expense[]>("/expenses", { params: cleanFilters(filters) })).data,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["expenses"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ExpenseInput) => (await api.post<Expense>("/expenses", data)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExpenseInput }) =>
      (await api.put<Expense>(`/expenses/${id}`, data)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/expenses/${id}`)).data,
    onSuccess: () => invalidate(qc),
  });
}
