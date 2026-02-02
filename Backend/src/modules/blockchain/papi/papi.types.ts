export type ChainId = 'AssetHubPolkadot' | 'PassetHub' | 'Moonbeam' | string;

export interface PapiHealth {
  connected: boolean;
  endpoint?: string;
  chainId?: ChainId;
  error?: string;
}

export interface PapiBasicChainInfo {
  chain: string;
  endpoint: string;
  connectedAt: string; // ISO
}

/**
 * Result from building a SCALE-encoded call
 */
export interface PapiEncodedCall {
  /** Hex-encoded SCALE bytes */
  hex: `0x${string}`;
  /** Raw bytes */
  bytes: Uint8Array;
}

/**
 * Parameters for building a revive.call extrinsic
 */
export interface ReviveCallParams {
  /** Target contract address (H160) */
  dest: string;
  /** Value to transfer (0 for read-only calls) */
  value: bigint;
  /** Gas limit */
  gasLimit: bigint;
  /** Storage deposit limit (null for unlimited) */
  storageDepositLimit: bigint | null;
  /** EVM calldata (hex-encoded) */
  inputData: `0x${string}`;
}
