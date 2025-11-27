# 🚀 Next Steps - Complete NestJS Implementation

You now have the **foundational structure** for your NestJS backend that's fully compatible with your AssetHub and Moonbeam smart contracts!

## ✅ What's Been Created

### Core Files
- ✅ `package.json` - All NestJS dependencies
- ✅ `src/main.ts` - Application bootstrap
- ✅ `src/app.module.ts` - Root module
- ✅ `src/health.controller.ts` - Health check endpoint
- ✅ `src/config/typeorm.config.ts` - Database configuration

### Entity Layer (Database Models)
- ✅ `src/modules/users/entities/user.entity.ts`
- ✅ `src/modules/positions/entities/position.entity.ts`
- ✅ `src/modules/pools/entities/pool.entity.ts`
- ✅ `src/modules/pools/entities/dex.entity.ts`
- ✅ `src/modules/preferences/entities/user-preference.entity.ts`

### Blockchain Services (Contract Integration)
- ✅ `src/modules/blockchain/services/asset-hub.service.ts` - AssetHub Vault contract wrapper
- ✅ `src/modules/blockchain/services/moonbeam.service.ts` - Moonbeam XCM Proxy wrapper
- ✅ Placeholder ABIs (need real ones from compilation)

### Documentation
- ✅ `PRD.md` - Product Requirements with Mermaid diagrams
- ✅ `IMPLEMENTATION_GUIDE.md` - Complete implementation guide
- ✅ `DEPLOYMENT_GUIDE.md` - AWS deployment guide
- ✅ `SIMPLE_DEPLOYMENT.md` - Simplified deployment

### Deployment
- ✅ `Dockerfile` - Production container
- ✅ `docker-compose.yml` - Local development
- ✅ `.env.example` - Environment variables
- ✅ `deploy.sh`, `setup.sh`, `quick-start.sh` - Deployment scripts

---

## 🎯 Step 1: Install Dependencies

```bash
cd Backend
npm install
```

This will install:
- NestJS framework (`@nestjs/core`, `@nestjs/common`)
- TypeORM + PostgreSQL driver
- Ethers.js v6 for EVM contracts
- Polkadot.js API for XCM
- All other dependencies

---

## 🎯 Step 2: Extract Contract ABIs

Your blockchain services need the real contract ABIs to work. Run:

```bash
# Make script executable
chmod +x extract-abis.sh

# Extract ABIs (requires jq - install with: brew install jq)
./extract-abis.sh
```

This will:
1. Compile your Solidity contracts in `../SmartContracts`
2. Extract the ABIs from compilation artifacts
3. Generate TypeScript files with proper formatting

**Manual Alternative** (if script fails):

```bash
cd ../SmartContracts
npx hardhat compile

# Copy the "abi" array from these files:
# - artifacts/contracts/V1(Current)/AssetHubVault.sol/AssetHubVault.json
# - artifacts/contracts/V1(Current)/XCMProxy.sol/XCMProxy.json

# Paste into:
# - Backend/src/modules/blockchain/abis/AssetHubVault.abi.ts
# - Backend/src/modules/blockchain/abis/XCMProxy.abi.ts
```

---

## 🎯 Step 3: Generate Remaining Modules

Use NestJS CLI to scaffold the remaining modules:

```bash
# Generate modules
npx @nestjs/cli g module modules/blockchain
npx @nestjs/cli g module modules/users
npx @nestjs/cli g module modules/positions
npx @nestjs/cli g module modules/pools
npx @nestjs/cli g module modules/preferences
npx @nestjs/cli g module modules/investment-decision
npx @nestjs/cli g module modules/stop-loss-worker

# Generate services
npx @nestjs/cli g service modules/users/users
npx @nestjs/cli g service modules/positions/positions
npx @nestjs/cli g service modules/pools/pools
npx @nestjs/cli g service modules/pools/pool-aggregator
npx @nestjs/cli g service modules/investment-decision/investment-decision
npx @nestjs/cli g service modules/investment-decision/investment-decision-worker
npx @nestjs/cli g service modules/stop-loss-worker/stop-loss-worker
npx @nestjs/cli g service modules/preferences/preferences

# Generate controllers
npx @nestjs/cli g controller modules/users/users --flat
npx @nestjs/cli g controller modules/positions/positions --flat
npx @nestjs/cli g controller modules/pools/pools --flat
npx @nestjs/cli g controller modules/investment-decision/investment-decision --flat
```

---

## 🎯 Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# PostgreSQL
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=liquidot
DATABASE_PASSWORD=your_password_here
DATABASE_NAME=liquidot_db

# AssetHub (Parachain 1000)
ASSETHUB_RPC_URL=https://assethub-polkadot-rpc.polkadot.io
ASSETHUB_VAULT_ADDRESS=0x... # Your deployed contract address

# Moonbeam (Parachain 2004)
MOONBEAM_RPC_URL=https://rpc.api.moonbeam.network
MOONBEAM_XCM_PROXY_ADDRESS=0x... # Your deployed contract address

# Relayer Wallet (for submitting transactions)
RELAYER_PRIVATE_KEY=0x... # Your private key (KEEP SECURE!)

# API
PORT=3001
NODE_ENV=development
```

---

## 🎯 Step 5: Start Development

```bash
# Start PostgreSQL
docker-compose up postgres -d

# Run database migrations
npm run typeorm migration:generate -- src/migrations/InitialSchema
npm run typeorm migration:run

# Start backend in watch mode
npm run start:dev
```

Visit:
- **API**: http://localhost:3001/api
- **Health**: http://localhost:3001/api/health

---

## 🎯 Step 6: Implement Business Logic

Now implement the actual logic in each service. Here's the priority order:

### 6.1 Users Service (`src/modules/users/users.service.ts`)

```typescript
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOrCreate(walletAddress: string): Promise<User> {
    let user = await this.usersRepository.findOne({ where: { walletAddress } });
    if (!user) {
      user = this.usersRepository.create({ walletAddress });
      await this.usersRepository.save(user);
    }
    return user;
  }

  async findByAddress(walletAddress: string): Promise<User | null> {
    return this.usersRepository.findOne({ 
      where: { walletAddress },
      relations: ['positions', 'preferences'],
    });
  }
}
```

### 6.2 Positions Service (`src/modules/positions/positions.service.ts`)

```typescript
@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(Position)
    private positionsRepository: Repository<Position>,
  ) {}

  async getUserPositions(userAddress: string): Promise<Position[]> {
    return this.positionsRepository.find({
      where: { user: { walletAddress: userAddress } },
      relations: ['pool', 'pool.dex'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    assetHubPositionId: string,
    status: PositionStatus,
  ): Promise<void> {
    await this.positionsRepository.update(
      { assetHubPositionId },
      { status, updatedAt: new Date() },
    );
  }
}
```

### 6.3 Pools Service (`src/modules/pools/pools.service.ts`)

```typescript
@Injectable()
export class PoolsService {
  constructor(
    @InjectRepository(Pool)
    private poolsRepository: Repository<Pool>,
  ) {}

  async getTopPools(limit = 20): Promise<Pool[]> {
    return this.poolsRepository.find({
      where: { isActive: true },
      relations: ['dex'],
      order: { apr: 'DESC' },
      take: limit,
    });
  }

  async getBestPoolForUser(preferences: any): Promise<Pool | null> {
    const query = this.poolsRepository
      .createQueryBuilder('pool')
      .where('pool.isActive = :isActive', { isActive: true })
      .andWhere('pool.apr >= :minApr', { minApr: preferences.minApr })
      .andWhere('pool.tvl >= :minTvl', { minTvl: preferences.minTvl })
      .orderBy('pool.apr', 'DESC');

    if (preferences.preferredDexes?.length > 0) {
      query.andWhere('dex.name IN (:...dexes)', { dexes: preferences.preferredDexes });
    }

    return query.getOne();
  }
}
```

### 6.4 Stop-Loss Worker (`src/modules/stop-loss-worker/stop-loss-worker.service.ts`)

```typescript
@Injectable()
export class StopLossWorkerService {
  private readonly logger = new Logger(StopLossWorkerService.name);

  constructor(
    @InjectRepository(Position)
    private positionsRepository: Repository<Position>,
    private moonbeamService: MoonbeamService,
    private assetHubService: AssetHubService,
  ) {}

  @Cron('*/60 * * * * *') // Every 60 seconds
  async checkPositions() {
    this.logger.log('Checking positions for stop-loss...');

    const activePositions = await this.positionsRepository.find({
      where: { status: PositionStatus.ACTIVE },
    });

    for (const position of activePositions) {
      try {
        const { outOfRange, currentPrice } = await this.moonbeamService.isPositionOutOfRange(
          parseInt(position.moonbeamPositionId),
        );

        if (outOfRange) {
          this.logger.warn(`Position ${position.id} is out of range! Triggering liquidation...`);
          await this.liquidatePosition(position, currentPrice);
        }
      } catch (error) {
        this.logger.error(`Error checking position ${position.id}: ${error.message}`);
      }
    }
  }

  private async liquidatePosition(position: Position, currentPrice: bigint) {
    // Call Moonbeam contract to liquidate
    await this.moonbeamService.liquidateSwapAndReturn({
      positionId: parseInt(position.moonbeamPositionId),
      baseAsset: position.baseAsset,
      destination: new Uint8Array(), // XCM destination to AssetHub
      minAmountOut0: 0n, // Set proper slippage
      minAmountOut1: 0n,
      limitSqrtPrice: currentPrice,
      assetHubPositionId: position.assetHubPositionId,
    });

    // Update database
    await this.positionsRepository.update(position.id, {
      status: PositionStatus.OUT_OF_RANGE,
      liquidatedAt: new Date(),
    });
  }
}
```

---

## 🎯 Step 7: Test the API

```bash
# Get health status
curl http://localhost:3001/api/health

# Get top pools
curl http://localhost:3001/api/pools

# Get user positions
curl http://localhost:3001/api/positions/0xYourWalletAddress

# Create investment decision
curl -X POST http://localhost:3001/api/investment/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xYourWalletAddress",
    "poolId": "uuid-of-pool",
    "amount": "1000000000000000000",
    "lowerRangePercent": -5,
    "upperRangePercent": 10
  }'
```

---

## 🎯 Step 8: Deploy

### Local Docker

```bash
docker-compose up --build
```

### AWS (Production)

```bash
# Follow DEPLOYMENT_GUIDE.md
./setup.sh
```

---

## 📚 Key Files to Implement Next

1. **`investment-decision-worker.service.ts`** - Hourly cron job to check if users should invest
2. **`pool-aggregator.service.ts`** - Fetch pool data from DEXes every 10 minutes
3. **`xcm.service.ts`** - Build XCM messages for cross-chain communication
4. **`event-listener.service.ts`** - Listen to contract events and update database
5. **Controllers** - Implement REST endpoints from PRD.md

---

## 🐛 Troubleshooting

### TypeScript Errors
The lint errors you see are expected until you run `npm install`. They'll disappear after installation.

### Database Connection
Make sure PostgreSQL is running:
```bash
docker-compose up postgres -d
docker-compose logs postgres
```

### Contract Calls Failing
1. Check `.env` has correct RPC URLs and contract addresses
2. Verify relayer wallet has funds for gas
3. Enable test mode in contracts for local development

### Event Listeners Not Working
Make sure to call `setupEventListeners()` in `app.module.ts`:

```typescript
@Module({
  // ...
})
export class AppModule implements OnModuleInit {
  constructor(
    private assetHubService: AssetHubService,
    private moonbeamService: MoonbeamService,
  ) {}

  onModuleInit() {
    // Setup event listeners
    this.assetHubService.setupEventListeners({
      onInvestmentInitiated: (event) => console.log('Investment initiated:', event),
      // ...
    });
  }
}
```

---

## 📖 Additional Resources

- **PRD.md** - Complete product requirements with diagrams
- **IMPLEMENTATION_GUIDE.md** - Detailed implementation instructions
- **DEPLOYMENT_GUIDE.md** - AWS deployment walkthrough
- **Smart Contracts** - `../SmartContracts/contracts/V1(Current)/`

---

**🎉 You're ready to build! Start with Step 1 and work through each step. The architecture is designed to match your contracts exactly.**

For questions, refer to the PRD.md for contract function signatures and expected behavior.
