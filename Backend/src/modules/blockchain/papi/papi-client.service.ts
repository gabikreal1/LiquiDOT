import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// NOTE: We intentionally keep the PAPI usage isolated in this file so that:
// - Substrate connectivity is clearly "PAPI-based" (per grant commitments)
// - EVM/ethers code remains unchanged
// - We can feature-flag real network calls in tests/environments
import type { PolkadotClient } from 'polkadot-api';

import { PAPI_LOGGER_CONTEXT } from './papi.constants';
import type { PapiBasicChainInfo, PapiHealth } from './papi.types';

@Injectable()
export class PapiClientService implements OnModuleDestroy {
  private readonly logger = new Logger(PAPI_LOGGER_CONTEXT);
  private client?: PolkadotClient;
  private connectedAt?: Date;

  constructor(private readonly config: ConfigService) {}

  /**
   * Lazy-connect and reuse a single instance.
   *
   * Env:
   * - ASSET_HUB_PAPI_ENDPOINT: e.g. wss://asset-hub-polkadot-rpc.polkadot.io
   */
  async getClient(): Promise<PolkadotClient> {
    if (this.client) return this.client;

    const endpoint = this.config.get<string>('ASSET_HUB_PAPI_ENDPOINT');
    if (!endpoint) {
      throw new Error(
        'Missing ASSET_HUB_PAPI_ENDPOINT env var (required for PAPI connectivity)',
      );
    }

  // polkadot-api is ESM-only in many setups; Jest (ts-jest/commonjs) will fail to parse
  // deep ESM deps if we import it at module load time.
  //
  // To keep backend tests green while still providing a real PAPI integration,
  // we load the library lazily at runtime.
  const { createClient } = await import('polkadot-api');
  const { getWsProvider } = await import('polkadot-api/ws-provider');

  // createClient expects a JsonRpcProvider; for WS endpoints use the built-in ws-provider.
  const provider = getWsProvider(endpoint);
  this.client = createClient(provider) as unknown as PolkadotClient;
    this.connectedAt = new Date();

    this.logger.log(`PAPI client created (endpoint: ${endpoint})`);

    return this.client;
  }

  async health(): Promise<PapiHealth> {
    const endpoint = this.config.get<string>('ASSET_HUB_PAPI_ENDPOINT');

    if (!endpoint) {
      return {
        connected: false,
        error: 'ASSET_HUB_PAPI_ENDPOINT not configured',
      };
    }

    try {
      await this.getClient();
      return {
        connected: true,
        endpoint,
        chainId: 'AssetHubPolkadot',
      };
    } catch (e) {
      return {
        connected: false,
        endpoint,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  getBasicChainInfo(): PapiBasicChainInfo {
    const endpoint = this.config.get<string>('ASSET_HUB_PAPI_ENDPOINT', '');

    return {
      chain: 'AssetHubPolkadot',
      endpoint,
      connectedAt: this.connectedAt?.toISOString() ?? '',
    };
  }

  async onModuleDestroy(): Promise<void> {
    try {
      // polkadot-api clients expose a destroy/disconnect depending on version.
      // We keep this defensive to avoid runtime errors if API changes.
      const c: any = this.client;
      if (c?.disconnect) await c.disconnect();
      if (c?.destroy) await c.destroy();
    } catch (e) {
      this.logger.warn(
        `Failed to close PAPI client cleanly: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
