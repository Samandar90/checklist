import { useState } from "react";
import { toast } from "sonner";
import { Download, DatabaseBackup, ShieldCheck, HardDriveDownload } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useBackups, useCreateBackup, downloadBackup } from "@/hooks/useBackup";
import { getErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function BackupPage() {
  const { data: snapshots, isLoading } = useBackups();
  const createBackup = useCreateBackup();
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadBackup();
      toast.success("Резервная копия скачана");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  async function handleCreate() {
    try {
      await createBackup.mutateAsync();
      toast.success("Резервная копия создана");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Резервные копии"
        description="Защита данных: автоматические ежедневные копии и выгрузка вручную."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCreate} disabled={createBackup.isPending}>
              <DatabaseBackup className="h-4 w-4" /> Создать копию
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4" /> Скачать копию
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl tint-emerald">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Автоматические копии</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                База копируется при запуске сервера и затем каждые 24 часа. Хранятся последние 14 копий.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl tint-sky">
              <HardDriveDownload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Копия вне сервера</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Нажмите «Скачать копию», чтобы сохранить файл базы на свой компьютер — на случай сбоя диска.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Сохранённые копии на сервере</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !snapshots || snapshots.length === 0 ? (
            <EmptyState
              icon={DatabaseBackup}
              title="Копий пока нет"
              description="Первая копия создаётся при запуске сервера."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Файл</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Размер</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-mono text-xs text-foreground">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatSize(s.size)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
