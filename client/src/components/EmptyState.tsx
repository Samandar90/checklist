import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

/* A quiet white tile on the canvas — no dashed box, no stroke. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 rounded-2xl bg-card px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">{title}</p>
      {description && <p className="max-w-sm text-[14px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
