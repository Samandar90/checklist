import { ReactNode } from "react";

/* Whispered headline: 28px, weight 600, tight tracking, grey subtitle. */
export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">{title}</h1>
        {description && <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
