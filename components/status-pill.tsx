import { AlertCircle, CheckCircle2, CircleSlash, TrendingDown } from "lucide-react";
import type { ProductStatus } from "@/lib/db-types";
import { cn } from "@/lib/utils";

const config = {
  healthy: {
    label: "Healthy",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2
  },
  low: {
    label: "Low",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: TrendingDown
  },
  critical: {
    label: "Critical",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: AlertCircle
  },
  out: {
    label: "Out",
    className: "border-zinc-300 bg-zinc-100 text-zinc-700",
    icon: CircleSlash
  }
};

export function StatusPill({ status }: { status: ProductStatus }) {
  const item = config[status];
  const Icon = item.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold", item.className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {item.label}
    </span>
  );
}
