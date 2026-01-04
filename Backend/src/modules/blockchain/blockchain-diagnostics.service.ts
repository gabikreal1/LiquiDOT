import { Injectable } from '@nestjs/common';

import { AssetHubService } from './services/asset-hub.service';
import { MoonbeamService } from './services/moonbeam.service';

export interface BlockchainDiagnosticsResult {
  assetHub: {
    xcmPrecompile?: string;
    error?: string;
  };
  moonbeam: {
    xTokensPrecompile?: string;
    xcmTransactorPrecompile?: string;
    error?: string;
  };
  timestamp: string;
}

@Injectable()
export class BlockchainDiagnosticsService {
  constructor(
    private readonly assetHubService: AssetHubService,
    private readonly moonbeamService: MoonbeamService,
  ) {}

  async diagnostics(): Promise<BlockchainDiagnosticsResult> {
    const timestamp = new Date().toISOString();

    const result: BlockchainDiagnosticsResult = {
      assetHub: {},
      moonbeam: {},
      timestamp,
    };

    try {
      result.assetHub.xcmPrecompile = await this.assetHubService.getXcmPrecompile();
    } catch (e) {
      result.assetHub.error = e?.message ?? String(e);
    }

    try {
      const integration = await this.moonbeamService.getIntegrationAddresses();
      result.moonbeam.xTokensPrecompile = integration.xTokensPrecompile;
      result.moonbeam.xcmTransactorPrecompile = integration.xcmTransactorPrecompile;
    } catch (e) {
      result.moonbeam.error = e?.message ?? String(e);
    }

    return result;
  }
}
