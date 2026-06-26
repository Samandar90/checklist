import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Room } from "@/types";

export interface RoomInput {
  roomNumber: string;
  branchId: string;
}

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await api.get<Room[]>("/rooms")).data,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RoomInput) => (await api.post<Room>("/rooms", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RoomInput }) =>
      (await api.put<Room>(`/rooms/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/rooms/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
}
