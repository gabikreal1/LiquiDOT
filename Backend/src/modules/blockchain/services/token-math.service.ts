import { Injectable, Logger } from '@nestjs/common';
import { PriceService } from './price.service';
import { MoonbeamService } from './moonbeam.service';
import * as TokenMath from '../../../common/token-math';

// Re-export for convenience — consumers can import from one place
export { TokenMath };

/**
 * TokenMathService
 *
 * NestJS injectable that wraps the pure `token-math` utility functions
 * with live data: DOT/USD price from PriceService, and on-chain ERC20
 * decimal lookups from MoonbeamService (with in-memory cache).
 */
@Injectable()
export class TokenMathService {
  private readonly logger = new Logger(TokenMathService.name);

  /** Cache: lowercased address → decimals */
  private readonly decimalsCache = new Map<string, number>();

  constructor(
    private readonly priceService: PriceService,
    private readonly moonbeamService: MoonbeamService,
  ) {}

  // ──────────────────────────────────────────
  // DOT convenience (async — fetches live price)
  // ──────────────────────────────────────────

  /** Convert DOT planck to USD using live CoinGecko price. */
  async dotPlanckToUsd(planck: bigint | string): Promise<number> {
    const price = await this.priceService.getDotPriceUsd();
    return TokenMath.planckToUsd(planck, price);
  }

  /** Convert USD to DOT planck using live CoinGecko price. */
  async usdToDotPlanck(usdAmount: number): Promise<bigint> {
    const price = await this.priceService.getDotPriceUsd();
    return TokenMath.usdToPlanck(usdAmount, price);
  }

  // ──────────────────────────────────────────
  // DOT convenience (sync — no price lookup)
  // ──────────────────────────────────────────

  /** Convert DOT planck to human-readable DOT. */
  planckToDot(planck: bigint | string): number {
    return TokenMath.planckToDot(planck);
  }

  /** Convert human-readable DOT to planck bigint. */
  dotToPlanck(dot: number): bigint {
    return TokenMath.dotToPlanck(dot);
  }

  // ──────────────────────────────────────────
  // Generic token conversions
  // ──────────────────────────────────────────

  /** Convert smallest-unit to USD for any token. */
  smallestUnitToUsd(
    smallestUnit: bigint | string,
    decimals: number,
    priceUsd: number,
  ): number {
    return TokenMath.smallestUnitToUsd(smallestUnit, decimals, priceUsd);
  }

  /** Convert USD to smallest-unit for any token. */
  usdToSmallestUnit(
    usdAmount: number,
    decimals: number,
    priceUsd: number,
  ): bigint {
    return TokenMath.usdToSmallestUnit(usdAmount, decimals, priceUsd);
  }

  // ──────────────────────────────────────────
  // On-chain decimal resolution
  // ──────────────────────────────────────────

  /**
   * Resolve decimals for a token by address.
   *
   * Resolution order:
   * 1. In-memory cache
   * 2. Known address registry
   * 3. On-chain ERC20 metadata via MoonbeamService
   *
   * Caches the result for all future calls.
   */
  async getTokenDecimals(tokenAddress: string): Promise<number> {
    const key = tokenAddress.toLowerCase();

    // 1. In-memory cache
    const cached = this.decimalsCache.get(key);
    if (cached !== undefined) return cached;

    // 2. Known address registry
    const known = TokenMath.getKnownDecimalsByAddress(tokenAddress);
    if (known !== undefined) {
      this.decimalsCache.set(key, known);
      return known;
    }

    // 3. On-chain lookup
    if (!this.moonbeamService.isInitialized()) {
      throw new Error(
        `Cannot resolve decimals for ${tokenAddress}: MoonbeamService not initialized and address not in known registry.`,
      );
    }

    try {
      const metadata = await this.moonbeamService.getErc20Metadata(tokenAddress);
      if (metadata.decimals === undefined || metadata.decimals === null) {
        throw new Error(`ERC20 at ${tokenAddress} did not return decimals`);
      }
      this.decimalsCache.set(key, metadata.decimals);
      this.logger.debug(
        `Resolved decimals for ${tokenAddress}: ${metadata.decimals} (${metadata.symbol ?? 'unknown'})`,
      );
      return metadata.decimals;
    } catch (error) {
      throw new Error(
        `Failed to resolve decimals for ${tokenAddress}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
