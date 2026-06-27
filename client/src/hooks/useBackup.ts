import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BackupSnapshot } from "@/types";

export function useBackups() {
  return useQuery({
    queryKey: ["backups"],
    queryFn: async () => (await api.get<BackupSnapshot[]>("/backup")).data,
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<BackupSnapshot>("/backup")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });
}

/** Download a fresh database snapshot through the browser. */
export async function downloadBackup() {
  const res = await api.get("/backup/download", { responseType: "blob" });
  const disposition = res.headers["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const name = match?.[1] ?? `backup-${new Date().toISOString().slice(0, 10)}.db`;

  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
