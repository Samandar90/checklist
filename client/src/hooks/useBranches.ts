import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Branch } from "@/types";

export function useBranches(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/branches")).data,
    enabled: options.enabled ?? true,
  });
}

/** Branches the current (non-super-admin) user is assigned to work in. */
export function useMyBranches(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["branches", "mine"],
    queryFn: async () => (await api.get<Branch[]>("/branches/mine")).data,
    enabled: options.enabled ?? true,
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
