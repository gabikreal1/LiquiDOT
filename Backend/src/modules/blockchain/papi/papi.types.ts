export type ChainId = 'AssetHubPolkadot' | 'Moonbeam' | string;

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
