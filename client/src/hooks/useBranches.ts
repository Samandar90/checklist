import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Branch } from "@/types";

export function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/branches")).data,
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => (await api.post<Branch>("/branches", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string } }) =>
      (await api.put<Branch>(`/branches/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/branches/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}
