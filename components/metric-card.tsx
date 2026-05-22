import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-normal text-ink">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-leaf">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-sm text-zinc-500">{detail}</p>
    </div>
  );
}
