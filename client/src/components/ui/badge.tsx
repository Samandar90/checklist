import * as React from "react";
import { cn } from "@/lib/utils";

/* Pill badge — soft fill, no ring. */
function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-secondary px-2.5 py-[3px] text-[12px] font-medium text-secondary-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
