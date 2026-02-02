export const PAPI_LOGGER_CONTEXT = 'PapiClient';

export const PAPI_DEFAULT_CHAIN_NAME = 'AssetHubPolkadot';

/** Default gas limit for revive.call (1 billion) */
export const PAPI_DEFAULT_GAS_LIMIT = 1_000_000_000n;

/** Environment variable names */
export const PAPI_ENV = {
  ASSET_HUB_ENDPOINT: 'ASSET_HUB_PAPI_ENDPOINT',
  PASSET_HUB_ENDPOINT: 'PASSET_HUB_WS',
} as const;
