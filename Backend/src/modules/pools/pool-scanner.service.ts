import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pool } from './entities/pool.entity';
import { Dex } from './entities/dex.entity';
import { ConfigService } from '@nestjs/config';
import { request, gql } from 'graphql-request';

@Injectable()
export class PoolScannerService implements OnModuleInit {
  private readonly logger = new Logger(PoolScannerService.name);
  private subgraphUrl: string;

  constructor(
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(Dex)
    private dexRepository: Repository<Dex>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.subgraphUrl = this.configService.get<string>('ALGEBRA_SUBGRAPH_URL');

    if (!this.subgraphUrl) {
      this.logger.warn('ALGEBRA_SUBGRAPH_URL not set. Pool Scanner disabled.');
      return;
    }

    // Initial sync
    this.syncPools();
    
    // Sync every 5 minutes
    setInterval(() => this.syncPools(), 1000 * 60 * 5);
  }

  async syncPools() {
    this.logger.log('🔄 Syncing pools from Subgraph...');

    // Ensure Dex exists
    let dex = await this.dexRepository.findOne({ where: { name: 'Algebra Dex' } });
    if (!dex) {
      dex = this.dexRepository.create({
        name: 'Algebra Dex',
        factoryAddress: this.configService.get<string>('ALGEBRA_FACTORY_ADDRESS') || '0x0000000000000000000000000000000000000000',
        routerAddress: this.configService.get<string>('ALGEBRA_ROUTER_ADDRESS') || '0x0000000000000000000000000000000000000000',
        nonfungiblePositionManagerAddress: this.configService.get<string>('ALGEBRA_POSITION_MANAGER_ADDRESS') || '0x0000000000000000000000000000000000000000',
        chainId: 2004, // Moonbeam
        isActive: true,
      });
      dex = await this.dexRepository.save(dex);
    }

    const query = gql`
      {
        pools(
          orderBy: totalValueLockedUSD, 
          orderDirection: desc, 
          first: 50
        ) {
          id
          fee
          liquidity
          sqrtPrice
          tick
          token0 {
            symbol
            id
            decimals
          }
          token1 {
            symbol
            id
            decimals
          }
          totalValueLockedUSD
          volumeUSD
          feesUSD
          poolHourData(orderBy: periodStartUnix, orderDirection: desc, first: 24) {
            feesUSD
            periodStartUnix
          }
        }
      }
    `;

    try {
      const data: any = await request(this.subgraphUrl, query);
      
      for (const graphPool of data.pools) {
        // 1. Calculate 24h Fees (Sum of last 24 hourly snapshots)
        const fees24h = graphPool.poolHourData.reduce((acc, hour) => acc + Number(hour.feesUSD), 0);
        const tvl = Number(graphPool.totalValueLockedUSD);
        
        // 2. Calculate APR: (Fees24h * 365) / TVL
        const apr = tvl > 0 ? ((fees24h * 365) / tvl) * 100 : 0;

        // 3. Find or Create Pool in DB
        let pool = await this.poolRepository.findOne({ where: { poolAddress: graphPool.id } });
        
        if (!pool) {
          pool = this.poolRepository.create({
            poolAddress: graphPool.id,
            token0Address: graphPool.token0.id,
            token1Address: graphPool.token1.id,
            token0Symbol: graphPool.token0.symbol,
            token1Symbol: graphPool.token1.symbol,
            dexId: dex.id,
            dex: dex,
            chainId: 2004,
            isActive: true,
            // Initialize required fields
            fee: Number(graphPool.fee) || 0,
            liquidity: graphPool.liquidity || '0',
            sqrtPriceX96: graphPool.sqrtPrice || '0',
            tick: Number(graphPool.tick) || 0,
            volume24h: '0',
            tvl: '0',
            apr: '0',
            lastSyncedAt: new Date()
          });
        }

        // 4. Update Stats
        pool.tvl = tvl.toString();
        pool.volume24h = graphPool.volumeUSD.toString(); 
        pool.apr = apr.toString();
        pool.fee = Number(graphPool.fee) || pool.fee;
        pool.liquidity = graphPool.liquidity || pool.liquidity;
        pool.sqrtPriceX96 = graphPool.sqrtPrice || pool.sqrtPriceX96;
        pool.tick = Number(graphPool.tick) || pool.tick;
        pool.lastSyncedAt = new Date();

        await this.poolRepository.save(pool);
      }
      
      this.logger.log(`✅ Synced ${data.pools.length} pools from Subgraph.`);

    } catch (error) {
      this.logger.error(`❌ Subgraph sync failed: ${error.message}`);
    }
  }
}
