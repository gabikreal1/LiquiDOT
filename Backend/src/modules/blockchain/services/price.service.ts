import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * PriceService
 *
 * Fetches the live DOT/USD price from CoinGecko's free API.
 * Caches for 5 minutes in-memory. Falls back to the last known price
 * when fetches fail; throws if no price has ever been fetched.
 */
@Injectable()
export class PriceService implements OnModuleInit {
  private readonly logger = new Logger(PriceService.name);

  private cachedPrice: number | null = null;
  private lastFetchedAt: number = 0;
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  private readonly url =
    'https://api.coingecko.com/api/v3/simple/price?ids=polkadot&vs_currencies=usd';

  async onModuleInit() {
    // Eagerly fetch price on startup so downstream services can use it immediately
    try {
      await this.getDotPriceUsd();
    } catch (err) {
      this.logger.warn(`Initial DOT price fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Returns the current DOT/USD price.
   * Uses in-memory cache (5 min TTL), with fallback to last known price.
   */
  async getDotPriceUsd(): Promise<number> {
    const now = Date.now();
    if (this.cachedPrice !== null && now - this.lastFetchedAt < this.cacheTtlMs) {
      return this.cachedPrice;
    }

    try {
      const response = await fetch(this.url);
      if (!response.ok) {
        throw new Error(`CoinGecko returned ${response.status}`);
      }

      const data = (await response.json()) as { polkadot?: { usd?: number } };
      const price = data?.polkadot?.usd;

      if (typeof price !== 'number' || price <= 0) {
        throw new Error(`Invalid price from CoinGecko: ${JSON.stringify(data)}`);
      }

      this.cachedPrice = price;
      this.lastFetchedAt = now;
      this.logger.debug(`DOT price updated: $${price}`);
      return price;
    } catch (error) {
      if (this.cachedPrice !== null) {
        this.logger.warn(
          `DOT price fetch failed, using cached price $${this.cachedPrice}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return this.cachedPrice;
      }

      throw new Error(
        `Cannot determine DOT price (no cached value): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
