"use client";

import { ExplorerLink } from "@/components/shared/explorer-link";
import { truncateHash } from "@/lib/utils/format";
import type { PositionDetail } from "@/lib/types/position";

interface Props {
  position: PositionDetail;
}

export function TransactionsCard({ position }: Props) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]">
      <h2 className="mb-5 font-display text-[17px] font-semibold text-ld-ink">
        Transactions
      </h2>

      <div className="space-y-4">
        {/* Asset Hub Tx */}
        <TxItem
          label="Asset Hub Tx"
          iconColor="#E6007A"
          iconBg="rgba(230,0,122,0.08)"
          hash={position.assetHubTxHash}
          chainId="asset-hub"
        />

        {/* Moonbeam Tx */}
        <TxItem
          label="Moonbeam Tx"
          iconColor="#627EEA"
          iconBg="rgba(98,126,234,0.08)"
          hash={position.moonbeamTxHash}
          chainId="moonbeam"
        />
      </div>

      {/* Position IDs */}
      <div className="mt-5 space-y-0 border-t border-black/6 pt-4">
        <DataRow
          label="AH Position ID"
          value={
            position.assetHubPositionId
              ? truncateHash(position.assetHubPositionId, 6)
              : "—"
          }
        />
        <DataRow
          label="Moonbeam NFT ID"
          value={
            position.moonbeamPositionId != null
              ? String(position.moonbeamPositionId)
              : "—"
          }
        />
      </div>
    </div>
  );
}

function TxItem({
  label,
  iconColor,
  iconBg,
  hash,
  chainId,
}: {
  label: string;
  iconColor: string;
  iconBg: string;
  hash: string | null;
  chainId: "asset-hub" | "moonbeam";
}) {
  return (
    <div className="flex items-start gap-3 border-b border-black/4 pb-4 last:border-0 last:pb-0">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: iconBg }}
      >
        <span
          className="inline-block h-4 w-4 rounded-full"
          style={{ backgroundColor: iconColor }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-display text-[13px] font-semibold text-ld-ink">
          {label}
        </div>
        {hash ? (
          <>
            <p className="mb-1 break-all font-mono text-xs text-ld-slate">
              {hash}
            </p>
            <ExplorerLink
              chainId={chainId}
              hash={hash}
              className="text-xs"
            />
          </>
        ) : (
          <span className="text-xs text-ld-slate/40">—</span>
        )}
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-black/4 py-2.5 last:border-0">
      <span className="font-body text-[13px] text-ld-slate">{label}</span>
      <span className="font-mono text-sm font-medium text-ld-ink">{value}</span>
    </div>
  );
}
