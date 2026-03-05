const EXPLORER_MAP: Record<number, { name: string; txUrl: string }> = {
  // Polkadot Hub (Asset Hub EVM mainnet)
  420420419: {
    name: "Blockscout (Polkadot Hub)",
    txUrl: "https://blockscout.polkadot.io/tx/",
  },
  // Paseo PassetHub (Asset Hub EVM testnet)
  420420422: {
    name: "Blockscout (Paseo)",
    txUrl: "https://blockscout-testnet.polkadot.io/tx/",
  },
  // Moonbeam (backend-operated, but useful for tx links)
  1284: {
    name: "Moonscan",
    txUrl: "https://moonscan.io/tx/",
  },
  1287: {
    name: "Moonscan Testnet",
    txUrl: "https://moonbase.moonscan.io/tx/",
  },
};

export type ChainId = number | "asset-hub" | "moonbeam";

export function getExplorerUrl(chainId: ChainId, hash: string): string {
  if (chainId === "asset-hub") {
    return `${EXPLORER_MAP[420420422].txUrl}${hash}`;
  }
  if (chainId === "moonbeam") {
    return `${EXPLORER_MAP[1284].txUrl}${hash}`;
  }

  const explorer = EXPLORER_MAP[chainId];
  if (!explorer) return `#`;
  return `${explorer.txUrl}${hash}`;
}

export function getExplorerName(chainId: ChainId): string {
  if (chainId === "asset-hub") return EXPLORER_MAP[420420422].name;
  if (chainId === "moonbeam") return EXPLORER_MAP[1284].name;
  return EXPLORER_MAP[chainId]?.name ?? "Explorer";
}
