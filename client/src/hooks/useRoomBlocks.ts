import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RoomBlock, RoomBlockKind } from "@/types";

export interface RoomBlockInput {
  branchId?: string;
  roomId: string;
  kind: RoomBlockKind;
  /** First closed night, ISO day. */
  startDate: string;
  /** Exclusive — the morning the room is on sale again, ISO day. */
  endDate: string;
  guestName?: string | null;
  note?: string | null;
  /** HOLD only: ISO timestamp after which the hold releases itself. */
  holdUntil?: string | null;
}

// Blocks live on the chessboard and in the audit log; they carry no money, so
// reports and the cash register are untouched.
function invalidate(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["calendar"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["audit"] });
}

export function useCreateRoomBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RoomBlockInput) => (await api.post<RoomBlock>("/room-blocks", data)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateRoomBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RoomBlockInput }) =>
      (await api.put<RoomBlock>(`/room-blocks/${id}`, data)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteRoomBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/room-blocks/${id}`)).data,
    onSuccess: () => invalidate(qc),
  });
}
