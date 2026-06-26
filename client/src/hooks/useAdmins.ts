import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Admin } from "@/types";

export interface AdminInput {
  fullName: string;
  phone: string;
  branchId: string;
}

export function useAdmins() {
  return useQuery({
    queryKey: ["admins"],
    queryFn: async () => (await api.get<Admin[]>("/admins")).data,
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AdminInput) => (await api.post<Admin>("/admins", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admins"] }),
  });
}

export function useUpdateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AdminInput }) =>
      (await api.put<Admin>(`/admins/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admins"] }),
  });
}

export function useDeleteAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admins/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admins"] }),
  });
}
