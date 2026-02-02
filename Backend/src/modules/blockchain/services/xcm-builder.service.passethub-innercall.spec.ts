import { ConfigService } from '@nestjs/config';
import { XcmBuilderService } from './xcm-builder.service';
import { PapiClientService } from '../papi/papi-client.service';

/**
 * These tests are intentionally "offline": they validate gating + input validation
 * without requiring a live PASSET_HUB_WS.
 */
describe('XcmBuilderService PassetHub innerCall builder', () => {
  const makeService = (cfg: Record<string, any>) => {
    const configService = {
      get: (key: string, defaultValue?: any) =>
        Object.prototype.hasOwnProperty.call(cfg, key) ? cfg[key] : defaultValue,
    } as unknown as ConfigService;

    // Mock PapiClientService - these tests only validate input/config validation
    // before P-API calls are made
    const papiClientService = {
      getReviveCallTransaction: jest.fn(),
      buildReviveMapAccount: jest.fn(),
      buildUtilityBatch: jest.fn(),
    } as unknown as PapiClientService;

    return new XcmBuilderService(configService, papiClientService);
  };

  it('rejects when feature flag disabled', async () => {
    const svc = makeService({
      ENABLE_PASSETHUB_TRANSACT_SETTLEMENT: false,
      PASSET_HUB_WS: 'wss://example.invalid',
    });

    await expect(
      svc.buildPassetHubSettleLiquidationInnerCall({
        assetHubVaultAddress: '0x0000000000000000000000000000000000000000',
        positionId:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        receivedAmount: 1n,
      }),
    ).rejects.toThrow(/disabled/i);
  });

  it('rejects invalid AssetHubVault address format', async () => {
    const svc = makeService({
      ENABLE_PASSETHUB_TRANSACT_SETTLEMENT: true,
      PASSET_HUB_WS: 'wss://example.invalid',
    });

    await expect(
      svc.buildPassetHubSettleLiquidationInnerCall({
        assetHubVaultAddress: 'not-an-address',
        positionId:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        receivedAmount: 1n,
      }),
    ).rejects.toThrow(/EVM address/i);
  });
});
