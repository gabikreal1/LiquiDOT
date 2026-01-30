import { ConfigService } from '@nestjs/config';
import { XcmBuilderService } from './xcm-builder.service';

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

    return new XcmBuilderService(configService);
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

  it('rejects when PASSET_HUB_WS missing', async () => {
    const svc = makeService({
      ENABLE_PASSETHUB_TRANSACT_SETTLEMENT: true,
    });

    await expect(
      svc.buildPassetHubSettleLiquidationInnerCall({
        assetHubVaultAddress: '0x0000000000000000000000000000000000000000',
        positionId:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        receivedAmount: 1n,
      }),
    ).rejects.toThrow(/PASSET_HUB_WS/i);
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
