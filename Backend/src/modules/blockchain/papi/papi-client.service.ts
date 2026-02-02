import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// NOTE: We intentionally keep the PAPI usage isolated in this file so that:
// - Substrate connectivity is clearly "PAPI-based" (per grant commitments)
// - EVM/ethers code remains unchanged
// - We can feature-flag real network calls in tests/environments
import type { PolkadotClient } from 'polkadot-api';

import { PAPI_LOGGER_CONTEXT, PAPI_ENV, PAPI_DEFAULT_GAS_LIMIT } from './papi.constants';
import type { PapiBasicChainInfo, PapiHealth, ChainId, PapiEncodedCall, ReviveCallParams } from './papi.types';

/**
 * UnsafeApi type - provides dynamic access to pallets without descriptors
 * This is used for chains where we don't have pre-generated descriptors
 */
type UnsafeApi = {
  tx: Record<string, Record<string, (...args: unknown[]) => unknown>>;
  query: Record<string, Record<string, unknown>>;
};

/**
 * Transaction type from polkadot-api
 */
interface PapiTransaction {
  getEncodedData(): Promise<{ asHex(): string; asBytes(): Uint8Array }>;
  decodedCall: unknown;
}

@Injectable()
export class PapiClientService implements OnModuleDestroy {
  private readonly logger = new Logger(PAPI_LOGGER_CONTEXT);

  /** Cached clients per chain */
  private clients: Map<ChainId, PolkadotClient> = new Map();
  private connectedAt: Map<ChainId, Date> = new Map();

  constructor(private readonly config: ConfigService) {}

  /**
   * Get or create a client for Asset Hub Polkadot
   */
  async getAssetHubClient(): Promise<PolkadotClient> {
    return this.getClient('AssetHubPolkadot', PAPI_ENV.ASSET_HUB_ENDPOINT);
  }

  /**
   * Get or create a client for PassetHub (Asset Hub with Revive pallet)
   */
  async getPassetHubClient(): Promise<PolkadotClient> {
    return this.getClient('PassetHub', PAPI_ENV.PASSET_HUB_ENDPOINT);
  }

  /**
   * Get UnsafeApi for PassetHub - allows dynamic pallet access without descriptors
   *
   * This is necessary because:
   * 1. PassetHub is an evolving chain with changing runtime
   * 2. The revive pallet signature may vary across versions
   * 3. We need runtime introspection similar to Polkadot.js
   */
  async getPassetHubUnsafeApi(): Promise<UnsafeApi> {
    const client = await this.getPassetHubClient();
    // getUnsafeApi() returns an untyped API that allows dynamic pallet access
    return (client as any).getUnsafeApi() as UnsafeApi;
  }

  /**
   * Build a revive.call extrinsic and return SCALE-encoded bytes
   *
   * This replaces the Polkadot.js approach:
   * - OLD: api.tx.revive.call(...).method.toHex()
   * - NEW: unsafeApi.tx.Revive.call({...}).getEncodedData().asHex()
   *
   * @param params Parameters for the revive.call
   * @returns Encoded call data
   */
  async buildReviveCall(params: ReviveCallParams): Promise<PapiEncodedCall> {
    const unsafeApi = await this.getPassetHubUnsafeApi();

    // Check if Revive pallet exists
    if (!unsafeApi.tx.Revive?.call) {
      throw new Error('PassetHub metadata does not expose Revive.call; cannot build innerCall');
    }

    // Try different argument signatures (runtime-dependent)
    const candidates: Array<{ label: string; args: Record<string, unknown> }> = [
      {
        label: 'A(dest,value,gas_limit,storage_deposit_limit,data)',
        args: {
          dest: params.dest,
          value: params.value,
          gas_limit: params.gasLimit,
          storage_deposit_limit: params.storageDepositLimit,
          data: params.inputData,
        },
      },
      {
        label: 'B(dest,value,gas_limit,storage_deposit_limit,input_data)',
        args: {
          dest: params.dest,
          value: params.value,
          gas_limit: params.gasLimit,
          storage_deposit_limit: params.storageDepositLimit,
          input_data: params.inputData,
        },
      },
      {
        label: 'C(dest,value,gas_limit,data) - no storage limit',
        args: {
          dest: params.dest,
          value: params.value,
          gas_limit: params.gasLimit,
          data: params.inputData,
        },
      },
    ];

    let tx: PapiTransaction | null = null;
    let usedCandidate: string | null = null;

    for (const candidate of candidates) {
      try {
        tx = unsafeApi.tx.Revive.call(candidate.args) as PapiTransaction;
        usedCandidate = candidate.label;
        break;
      } catch (e) {
        this.logger.debug(`Revive.call candidate failed (${candidate.label}): ${e}`);
      }
    }

    if (!tx) {
      throw new Error(
        'Failed to construct Revive.call extrinsic with all candidates. ' +
        'The PassetHub runtime may have changed its revive.call signature.',
      );
    }

    this.logger.log(`Built Revive.call using candidate: ${usedCandidate}`);

    const encoded = await tx.getEncodedData();
    return {
      hex: encoded.asHex() as `0x${string}`,
      bytes: encoded.asBytes(),
    };
  }

  /**
   * Build a utility.forceBatch (or batchAll/batch) call wrapping other calls
   *
   * @param calls Array of pre-built transactions to batch
   * @returns Encoded batch call data
   */
  async buildUtilityBatch(calls: PapiTransaction[]): Promise<PapiEncodedCall> {
    const unsafeApi = await this.getPassetHubUnsafeApi();

    // Try forceBatch first (allows partial success), then batchAll, then batch
    const batchFns = [
      { name: 'force_batch', fn: unsafeApi.tx.Utility?.force_batch },
      { name: 'batch_all', fn: unsafeApi.tx.Utility?.batch_all },
      { name: 'batch', fn: unsafeApi.tx.Utility?.batch },
    ];

    const batchFn = batchFns.find(b => typeof b.fn === 'function');
    if (!batchFn) {
      throw new Error('No utility batch function available on PassetHub');
    }

    // Extract the decoded calls from transactions
    const decodedCalls = calls.map(c => c.decodedCall);

    const batchTx = batchFn.fn!({ calls: decodedCalls }) as PapiTransaction;
    const encoded = await batchTx.getEncodedData();

    this.logger.log(`Built utility.${batchFn.name} with ${calls.length} calls`);

    return {
      hex: encoded.asHex() as `0x${string}`,
      bytes: encoded.asBytes(),
    };
  }

  /**
   * Build a revive.mapAccount call (if available)
   *
   * @returns Transaction or null if not available
   */
  async buildReviveMapAccount(): Promise<PapiTransaction | null> {
    const unsafeApi = await this.getPassetHubUnsafeApi();

    if (typeof unsafeApi.tx.Revive?.map_account !== 'function') {
      this.logger.warn('Revive.map_account is not available on this runtime');
      return null;
    }

    try {
      return unsafeApi.tx.Revive.map_account({}) as PapiTransaction;
    } catch (e) {
      this.logger.warn(`Failed to build Revive.map_account: ${e}`);
      return null;
    }
  }

  /**
   * Get raw transaction object for revive.call (for use in batching)
   */
  async getReviveCallTransaction(params: ReviveCallParams): Promise<PapiTransaction> {
    const unsafeApi = await this.getPassetHubUnsafeApi();

    if (!unsafeApi.tx.Revive?.call) {
      throw new Error('PassetHub metadata does not expose Revive.call');
    }

    // Use the same candidate logic as buildReviveCall
    const candidates: Array<{ label: string; args: Record<string, unknown> }> = [
      {
        label: 'A',
        args: {
          dest: params.dest,
          value: params.value,
          gas_limit: params.gasLimit,
          storage_deposit_limit: params.storageDepositLimit,
          data: params.inputData,
        },
      },
      {
        label: 'B',
        args: {
          dest: params.dest,
          value: params.value,
          gas_limit: params.gasLimit,
          storage_deposit_limit: params.storageDepositLimit,
          input_data: params.inputData,
        },
      },
      {
        label: 'C',
        args: {
          dest: params.dest,
          value: params.value,
          gas_limit: params.gasLimit,
          data: params.inputData,
        },
      },
    ];

    for (const candidate of candidates) {
      try {
        return unsafeApi.tx.Revive.call(candidate.args) as PapiTransaction;
      } catch {
        // Try next candidate
      }
    }

    throw new Error('Failed to construct Revive.call transaction');
  }

  /**
   * Lazy-connect and reuse a single instance per chain.
   */
  private async getClient(chainId: ChainId, endpointEnvVar: string): Promise<PolkadotClient> {
    const existing = this.clients.get(chainId);
    if (existing) return existing;

    const endpoint = this.config.get<string>(endpointEnvVar);
    if (!endpoint) {
      throw new Error(
        `Missing ${endpointEnvVar} env var (required for PAPI connectivity to ${chainId})`,
      );
    }

    // polkadot-api is ESM-only in many setups; Jest (ts-jest/commonjs) will fail to parse
    // deep ESM deps if we import it at module load time.
    // To keep backend tests green while still providing a real PAPI integration,
    // we load the library lazily at runtime.
    const { createClient } = await import('polkadot-api');
    const { getWsProvider } = await import('polkadot-api/ws-provider/node');

    // createClient expects a JsonRpcProvider; for WS endpoints use the built-in ws-provider.
    const provider = getWsProvider(endpoint);
    const client = createClient(provider) as unknown as PolkadotClient;

    this.clients.set(chainId, client);
    this.connectedAt.set(chainId, new Date());

    this.logger.log(`PAPI client created for ${chainId} (endpoint: ${endpoint})`);

    return client;
  }

  async health(chainId: ChainId = 'AssetHubPolkadot'): Promise<PapiHealth> {
    const endpointEnvVar = chainId === 'PassetHub'
      ? PAPI_ENV.PASSET_HUB_ENDPOINT
      : PAPI_ENV.ASSET_HUB_ENDPOINT;
    const endpoint = this.config.get<string>(endpointEnvVar);

    if (!endpoint) {
      return {
        connected: false,
        error: `${endpointEnvVar} not configured`,
      };
    }

    try {
      await this.getClient(chainId, endpointEnvVar);
      return {
        connected: true,
        endpoint,
        chainId,
      };
    } catch (e) {
      return {
        connected: false,
        endpoint,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  getBasicChainInfo(chainId: ChainId = 'AssetHubPolkadot'): PapiBasicChainInfo {
    const endpointEnvVar = chainId === 'PassetHub'
      ? PAPI_ENV.PASSET_HUB_ENDPOINT
      : PAPI_ENV.ASSET_HUB_ENDPOINT;
    const endpoint = this.config.get<string>(endpointEnvVar, '');

    return {
      chain: chainId,
      endpoint,
      connectedAt: this.connectedAt.get(chainId)?.toISOString() ?? '',
    };
  }

  async onModuleDestroy(): Promise<void> {
    for (const [chainId, client] of this.clients) {
      try {
        // polkadot-api clients expose a destroy/disconnect depending on version.
        // We keep this defensive to avoid runtime errors if API changes.
        const c: any = client;
        if (c?.disconnect) await c.disconnect();
        if (c?.destroy) await c.destroy();
        this.logger.log(`Disconnected PAPI client for ${chainId}`);
      } catch (e) {
        this.logger.warn(
          `Failed to close PAPI client for ${chainId} cleanly: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    this.clients.clear();
    this.connectedAt.clear();
  }
}
