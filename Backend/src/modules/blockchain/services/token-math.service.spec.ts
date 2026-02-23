import { Test, TestingModule } from '@nestjs/testing';
import { TokenMathService, TokenMath } from './token-math.service';
import { PriceService } from './price.service';
import { MoonbeamService } from './moonbeam.service';

describe('TokenMathService', () => {
  let service: TokenMathService;
  let priceService: jest.Mocked<PriceService>;
  let moonbeamService: jest.Mocked<Pick<MoonbeamService, 'isInitialized' | 'getErc20Metadata'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenMathService,
        {
          provide: PriceService,
          useValue: {
            getDotPriceUsd: jest.fn().mockResolvedValue(7.5),
          },
        },
        {
          provide: MoonbeamService,
          useValue: {
            isInitialized: jest.fn().mockReturnValue(true),
            getErc20Metadata: jest.fn().mockResolvedValue({
              address: '0xabc',
              symbol: 'TKN',
              name: 'TestToken',
              decimals: 12,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(TokenMathService);
    priceService = module.get(PriceService);
    moonbeamService = module.get(MoonbeamService);
  });

  // ──────────────────────────────────────────
  // dotPlanckToUsd
  // ──────────────────────────────────────────

  describe('dotPlanckToUsd', () => {
    it('should convert planck to USD using live DOT price', async () => {
      const result = await service.dotPlanckToUsd(10_000_000_000n);
      expect(result).toBeCloseTo(7.5, 2);
      expect(priceService.getDotPriceUsd).toHaveBeenCalled();
    });

    it('should handle 0 planck', async () => {
      const result = await service.dotPlanckToUsd(0n);
      expect(result).toBe(0);
    });

    it('should propagate PriceService errors', async () => {
      priceService.getDotPriceUsd.mockRejectedValueOnce(
        new Error('Cannot determine DOT price'),
      );
      await expect(service.dotPlanckToUsd(10_000_000_000n)).rejects.toThrow(
        'Cannot determine DOT price',
      );
    });
  });

  // ──────────────────────────────────────────
  // usdToDotPlanck
  // ──────────────────────────────────────────

  describe('usdToDotPlanck', () => {
    it('should convert USD to planck using live DOT price', async () => {
      const result = await service.usdToDotPlanck(7.5);
      expect(result).toBe(10_000_000_000n);
    });

    it('should handle $0', async () => {
      const result = await service.usdToDotPlanck(0);
      expect(result).toBe(0n);
    });
  });

  // ──────────────────────────────────────────
  // getTokenDecimals
  // ──────────────────────────────────────────

  describe('getTokenDecimals', () => {
    it('should return from known registry for known addresses', async () => {
      const result = await service.getTokenDecimals(
        '0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080',
      );
      expect(result).toBe(10);
      expect(moonbeamService.getErc20Metadata).not.toHaveBeenCalled();
    });

    it('should fetch from MoonbeamService for unknown addresses', async () => {
      const result = await service.getTokenDecimals('0x1234567890abcdef');
      expect(result).toBe(12);
      expect(moonbeamService.getErc20Metadata).toHaveBeenCalledWith(
        '0x1234567890abcdef',
      );
    });

    it('should cache the on-chain result on second call', async () => {
      await service.getTokenDecimals('0x1234567890abcdef');
      await service.getTokenDecimals('0x1234567890abcdef');
      expect(moonbeamService.getErc20Metadata).toHaveBeenCalledTimes(1);
    });

    it('should throw if MoonbeamService fails and address not known', async () => {
      moonbeamService.getErc20Metadata.mockRejectedValueOnce(
        new Error('RPC error'),
      );
      await expect(
        service.getTokenDecimals('0xunknown'),
      ).rejects.toThrow('Failed to resolve decimals');
    });

    it('should throw if MoonbeamService not initialized for unknown address', async () => {
      moonbeamService.isInitialized.mockReturnValueOnce(false);
      await expect(
        service.getTokenDecimals('0xunknown'),
      ).rejects.toThrow('not initialized');
    });
  });

  // ──────────────────────────────────────────
  // Sync delegates
  // ──────────────────────────────────────────

  describe('planckToDot (sync)', () => {
    it('should delegate to TokenMath.planckToDot', () => {
      expect(service.planckToDot(25_000_000_000n)).toBe(
        TokenMath.planckToDot(25_000_000_000n),
      );
    });
  });

  describe('dotToPlanck (sync)', () => {
    it('should delegate to TokenMath.dotToPlanck', () => {
      expect(service.dotToPlanck(2.5)).toBe(TokenMath.dotToPlanck(2.5));
    });
  });
});
