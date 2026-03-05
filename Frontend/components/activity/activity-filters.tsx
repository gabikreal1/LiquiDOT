"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActivityTypeFilter, ActivityStatusFilter } from "@/lib/api/activity";

const TYPES: { value: ActivityTypeFilter; label: string }[] = [
  { value: "ALL", label: "All Types" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
  { value: "LIQUIDATION", label: "Liquidation" },
  { value: "AUTO_REBALANCE", label: "Rebalance" },
  { value: "ERROR", label: "Error" },
];

const STATUSES: { value: ActivityStatusFilter; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "FAILED", label: "Failed" },
];

interface ActivityFiltersProps {
  type: ActivityTypeFilter;
  status: ActivityStatusFilter;
  onTypeChange: (v: ActivityTypeFilter) => void;
  onStatusChange: (v: ActivityStatusFilter) => void;
}

export function ActivityFilters({
  type,
  status,
  onTypeChange,
  onStatusChange,
}: ActivityFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={type} onValueChange={(v) => onTypeChange(v as ActivityTypeFilter)}>
        <SelectTrigger className="w-full border-ld-gray/30 bg-white text-ld-ink sm:w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => onStatusChange(v as ActivityStatusFilter)}>
        <SelectTrigger className="w-full border-ld-gray/30 bg-white text-ld-ink sm:w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
