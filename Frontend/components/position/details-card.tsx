"use client";

import type { PositionDetail } from "@/lib/types/position";
import { format } from "date-fns";

interface Props {
  position: PositionDetail;
}

export function DetailsCard({ position }: Props) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]">
      <h2 className="mb-5 font-display text-[17px] font-semibold text-ld-ink">
        Position Details
      </h2>

      <div className="space-y-0">
        <DataRow
          label="Amount Invested"
          value={`${position.amountDot.toFixed(2)} DOT`}
        />
        <DataRow label="Pool" value={position.poolName} />
        <DataRow
          label="Created"
          value={format(new Date(position.createdAt), "MMM d, yyyy · h:mm a")}
        />
        <DataRow
          label="Executed"
          value={
            position.executedAt
              ? format(new Date(position.executedAt), "MMM d, yyyy · h:mm a")
              : "—"
          }
        />
      </div>

      <div className="my-4 h-px bg-black/6" />

      <div className="space-y-0">
        <DataRow
          label="Stop-Loss %"
          value={`${position.lowerRangePercent}%`}
          valueColor="text-[#E53935]"
        />
        <DataRow
          label="Take-Profit %"
          value={`+${position.upperRangePercent}%`}
          valueColor="text-[#00C853]"
        />
        <DataRow
          label="Entry Price"
          value={`$${position.entryPriceUsd.toFixed(2)}`}
        />
        <DataRow label="Lower Tick" value={String(position.lowerTick)} />
        <DataRow label="Upper Tick" value={`+${position.upperTick}`} />
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
  valueColor = "text-ld-ink",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between border-b border-black/4 py-2.5 last:border-0">
      <span className="font-body text-[13px] text-ld-slate">{label}</span>
      <span className={`font-mono text-sm font-medium ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}
