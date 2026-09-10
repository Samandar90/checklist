import { Hotel } from "lucide-react";

/**
 * Branded loader: the logo mark gently breathes inside a thin accent ring
 * that sweeps around it — calm and premium, not a generic spinner.
 */
export default function PageLoader() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="loader-ring absolute inset-0" />
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-foreground text-background"
          style={{ animation: "loader-breathe 1.6s ease-in-out infinite" }}
        >
          <Hotel className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="text-[13px] font-medium text-muted-foreground">Загрузка…</p>
    </div>
  );
}
