import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/bookingStatus";
import { BookingStatus } from "@/types";

export default function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge className={cn(meta.tint, "gap-1.5 font-semibold", className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}
