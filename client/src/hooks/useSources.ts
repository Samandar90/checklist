import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BookingSource } from "@/types";

export function useSources() {
  return useQuery({
    queryKey: ["sources"],
    queryFn: async () => (await api.get<BookingSource[]>("/sources")).data,
  });
}

export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => (await api.post<BookingSource>("/sources", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });
}

export function useUpdateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string } }) =>
      (await api.put<BookingSource>(`/sources/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/sources/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });
}
