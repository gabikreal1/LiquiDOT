# Blockchain Module

> NestJS module for interacting with Liquidot's smart contracts on Asset Hub and Moonbeam.

## Overview

The Blockchain module provides type-safe services for all on-chain operations:

## P-API (Polkadot-API) Integration

Substrate RPC access is handled via **P-API** (`polkadot-api`) - the modern, light-client-first Polkadot API library. This aligns with grant commitments and replaces the legacy Polkadot.js (`@polkadot/api`).

### Services

- `PapiClientService` (in `src/modules/blockchain/papi/`) - Multi-chain client management
- `PapiModule` - NestJS module for P-API integration

### Features

- **Multi-chain support**: Asset Hub and PassetHub (Revive pallet) connectivity
- **UnsafeApi**: Dynamic pallet access without pre-generated descriptors
- **SCALE encoding**: Build and encode extrinsics for XCM Transact calls

### Configuration

Set the following env vars to enable P-API connectivity:

| Variable | Description | Example |
|----------|-------------|---------|
| `ASSET_HUB_PAPI_ENDPOINT` | Asset Hub WebSocket endpoint | `wss://polkadot-asset-hub-rpc.polkadot.io` |
| `PASSET_HUB_WS` | PassetHub WebSocket endpoint (for Revive pallet) | `wss://...` |

### Usage

```typescript
// XcmBuilderService uses P-API internally for PassetHub calls
const innerCall = await xcmBuilderService.buildPassetHubSettleLiquidationInnerCall({
  assetHubVaultAddress: '0x...',
  positionId: '0x...',
  receivedAmount: 1000000n,
});
```

### Notes

- Contract interactions (EVM/PolkaVM) continue to use `ethers` + JSON-RPC.
- Substrate interactions go through `polkadot-api` (P-API) with UnsafeApi for dynamic access.
- No Polkadot.js (`@polkadot/api`) dependencies - fully migrated to P-API.

- **AssetHubService**: Manages the `AssetHubVault` contract (custody, investments, settlements)
- **MoonbeamService**: Manages the `XCMProxy` contract (LP positions, liquidations, swaps)
- **XcmBuilderService**: Constructs XCM messages using ParaSpell SDK
- **BlockchainEventListenerService**: Unified event handling for both chains

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BlockchainModule                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐     ┌─────────────────┐                    │
│  │  AssetHubService │     │ MoonbeamService │                    │
│  │  ───────────────│     │ ───────────────│                    │
│  │  • dispatchInvest│     │ • executePending│                    │
│  │  • confirmExec   │     │ • liquidateSwap │                    │
│  │  • settleLiquid  │     │ • isOutOfRange  │                    │
│  │  • deposit/with  │     │ • collectFees   │                    │
│  └────────┬─────────┘     └────────┬────────┘                    │
│           │                        │                             │
│           │    ┌───────────────────┼───────────────┐             │
│           │    │                   │               │             │
│           ▼    ▼                   ▼               ▼             │
│  ┌─────────────────┐     ┌─────────────────────────────┐        │
│  │ XcmBuilderService│     │ BlockchainEventListenerService│        │
│  │  ───────────────│     │ ───────────────────────────│        │
│  │  • buildXcm      │     │ • setupEventListeners      │        │
│  │  • dryRunXcm     │     │ • registerCallbacks        │        │
│  │  • buildDestination│   │ • getStats                 │        │
│  └─────────────────┘     └─────────────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│   Asset Hub     │   XCM   │    Moonbeam     │
│  (AssetHubVault)│ ◄─────► │   (XCMProxy)    │
└─────────────────┘         └─────────────────┘
```

## Installation

The module is already part of the backend. Import it in your module:

```typescript
import { BlockchainModule } from '@/modules/blockchain';

@Module({
  imports: [BlockchainModule],
})
export class YourModule {}
```

## Configuration

Set these environment variables:

```env
# Asset Hub Configuration
ASSETHUB_RPC_URL=wss://westend-asset-hub-rpc.polkadot.io
ASSETHUB_VAULT_ADDRESS=0x...

# Moonbeam Configuration
MOONBEAM_RPC_URL=https://rpc.api.moonbeam.network
MOONBEAM_XCM_PROXY_ADDRESS=0x...
XCM_PROXY_ADDRESS=0x...  # Same as above, used by XcmBuilder

# Relayer Wallet
RELAYER_PRIVATE_KEY=0x...

# XCM Configuration
XCM_TEST_MODE=false
MOONBEAM_PARA_ID=2004
ASSET_HUB_PARA_ID=1000

# Event Listener
BLOCKCHAIN_EVENTS_AUTO_START=true
```

## Services

### AssetHubService

Manages the `AssetHubVault` contract on Asset Hub.

#### Key Methods

```typescript
// Investments
async dispatchInvestmentWithXcm(params: DispatchInvestmentRequest): Promise<string>
async confirmExecution(positionId: string, remoteId: string, liquidity: bigint): Promise<void>
async settleLiquidation(positionId: string, amount: bigint): Promise<void>

// User Operations
async deposit(amount: bigint): Promise<string>
async withdraw(amount: bigint): Promise<string>
async getUserBalance(user: string): Promise<bigint>

// Position Queries
async getPosition(positionId: string): Promise<ContractPosition | null>
async getAllUserPositions(user: string): Promise<ContractPosition[]>
async getUserPositionsByStatus(user: string, status: PositionStatus): Promise<ContractPosition[]>
async getUserPositionStats(user: string): Promise<UserPositionStats>

// Chain Configuration (Admin)
async addChain(chainId: number, destination: Uint8Array, name: string, executor: string): Promise<string>
async removeChain(chainId: number): Promise<string>
async getChainConfig(chainId: number): Promise<ChainConfig>

// Contract State
async isPaused(): Promise<boolean>
async isTestMode(): Promise<boolean>
async getAdmin(): Promise<string>
```

#### Example Usage

```typescript
@Injectable()
export class InvestmentService {
  constructor(private assetHubService: AssetHubService) {}

  async createInvestment(user: string, amount: bigint, pool: string) {
    const positionId = await this.assetHubService.dispatchInvestmentWithXcm({
      user,
      chainId: 2004, // Moonbeam
      poolId: pool,
      baseAsset: '0x...DOT',
      amount,
      lowerRangePercent: -5,
      upperRangePercent: 10,
    });
    
    return positionId;
  }
}
```

### MoonbeamService

Manages the `XCMProxy` contract on Moonbeam.

#### Key Methods

```typescript
// Position Execution
async executePendingInvestment(assetHubPositionId: string): Promise<number>
async getPosition(positionId: number): Promise<MoonbeamPosition | null>
async getPendingPosition(assetHubPositionId: string): Promise<PendingPosition | null>
async getActivePositions(): Promise<MoonbeamPosition[]>

// Stop-Loss Monitoring
async isPositionOutOfRange(positionId: number): Promise<RangeCheckResult>

// Liquidation
async liquidateSwapAndReturn(params: LiquidateParams): Promise<void>
async executeFullLiquidation(positionId: number): Promise<CollectedFees>
async collectFees(positionId: number): Promise<CollectedFees>

// Swaps
async quoteSwap(tokenIn: string, tokenOut: string, amount: bigint): Promise<SwapQuote>
async executeSwap(tokenIn: string, tokenOut: string, recipient: string, 
                  amountIn: bigint, minOut: bigint): Promise<SwapResult>

// Configuration
async getXcmConfig(): Promise<XcmConfig>
async getIntegrationAddresses(): Promise<{nfpm, quoter, swapRouter, ...}>
async calculateTickRange(pool: string, lower: number, upper: number): Promise<TickRange>
```

#### Example Usage

```typescript
@Injectable()
export class StopLossWorker {
  constructor(private moonbeamService: MoonbeamService) {}

  async checkPositions() {
    const positions = await this.moonbeamService.getActivePositions();
    
    for (const position of positions) {
      const { outOfRange, currentPrice } = await this.moonbeamService.isPositionOutOfRange(
        position.tokenId
      );
      
      if (outOfRange) {
        await this.triggerLiquidation(position);
      }
    }
  }
}
```

### XcmBuilderService

Builds XCM messages for cross-chain operations using ParaSpell SDK.

#### Key Methods

```typescript
// Build XCM for investments
async buildInvestmentXcm(params: XcmInvestmentParams): Promise<{
  destination: Uint8Array;
  xcmMessage: Uint8Array;
}>

// Build XCM return destination for liquidations
async buildReturnDestination(params: XcmReturnParams): Promise<Uint8Array>

// Validate XCM before sending
async dryRunXcm(params: XcmInvestmentParams): Promise<XcmDryRunResult>

// Build MultiLocation bytes
buildMultiLocation(paraId: number, accountId: string): Uint8Array
```

#### Example Usage

```typescript
// XCM is built automatically by AssetHubService.dispatchInvestmentWithXcm()
// Direct usage is rarely needed, but available:

const { destination, xcmMessage } = await xcmBuilderService.buildInvestmentXcm({
  amount: ethers.parseEther('100'),
  moonbeamProxyAddress: '0x...',
  assetHubVaultAddress: '0x...',
  user: '0x...',
  poolId: '0x...',
  chainId: 2004,
  lowerRangePercent: -5,
  upperRangePercent: 10,
});
```

### BlockchainEventListenerService

Unified event listener for both chains.

#### Key Methods

```typescript
// Control
async startListening(): Promise<void>
async stopListening(): Promise<void>

// Configuration
registerCallbacks(callbacks: BlockchainEventCallbacks): void

// Monitoring
getStats(): EventStats
resetStats(): void
```

#### Example Usage

```typescript
@Injectable()
export class PositionSyncService implements OnModuleInit {
  constructor(private eventListener: BlockchainEventListenerService) {}

  onModuleInit() {
    this.eventListener.registerCallbacks({
      assetHub: {
        onInvestmentInitiated: (event) => {
          this.handleNewInvestment(event);
        },
        onExecutionConfirmed: (event) => {
          this.syncPositionToDatabase(event);
        },
      },
      moonbeam: {
        onPositionExecuted: (event) => {
          this.updatePositionStatus(event);
        },
        onLiquidationCompleted: (event) => {
          this.markPositionLiquidated(event);
        },
      },
    });
  }
}
```

## Types

### Position Types

```typescript
enum PositionStatus {
  PENDING = 0,    // Investment dispatched, waiting for XCM
  ACTIVE = 1,     // LP position created on Moonbeam
  LIQUIDATED = 2, // Position closed and assets returned
}

interface ContractPosition {
  user: string;
  poolId: string;
  baseAsset: string;
  chainId: number;
  lowerRangePercent: number;
  upperRangePercent: number;
  timestamp: bigint;
  status: PositionStatus;
  amount: bigint;
  remotePositionId: string;
}

interface MoonbeamPosition {
  assetHubPositionId: string;
  pool: string;
  token0: string;
  token1: string;
  bottomTick: number;
  topTick: number;
  liquidity: bigint;
  tokenId: number;
  owner: string;
  lowerRangePercent: number;
  upperRangePercent: number;
  entryPrice: bigint;
  timestamp: bigint;
  active: boolean;
}
```

### XCM Types

```typescript
interface XcmInvestmentParams {
  amount: bigint;
  moonbeamProxyAddress: string;
  assetHubVaultAddress: string;
  user: string;
  poolId: string;
  chainId: number;
  lowerRangePercent: number;
  upperRangePercent: number;
}

interface XcmDryRunResult {
  success: boolean;
  estimatedFees: string;
  error?: string;
}
```

### Error Handling

```typescript
import { BlockchainError, BlockchainErrorCode } from '@/modules/blockchain';

try {
  await assetHubService.dispatchInvestmentWithXcm(params);
} catch (error) {
  if (error instanceof BlockchainError) {
    switch (error.code) {
      case BlockchainErrorCode.XCM_DRY_RUN_FAILED:
        // Handle XCM validation failure
        break;
      case BlockchainErrorCode.CONTRACT_PAUSED:
        // Contract is paused
        break;
    }
  }
}
```

## File Structure

```
src/modules/blockchain/
├── index.ts                    # Module barrel export
├── blockchain.module.ts        # NestJS module definition
├── abis/
│   ├── AssetHubVault.abi.ts   # AssetHubVault contract ABI
│   └── XCMProxy.abi.ts        # XCMProxy contract ABI
├── papi/                       # P-API (polkadot-api) integration
│   ├── papi.module.ts         # NestJS module for P-API
│   ├── papi-client.service.ts # Multi-chain P-API client
│   ├── papi.types.ts          # P-API type definitions
│   └── papi.constants.ts      # P-API constants
├── services/
│   ├── index.ts               # Services barrel export
│   ├── asset-hub.service.ts   # AssetHub contract service
│   ├── moonbeam.service.ts    # Moonbeam contract service
│   ├── xcm-builder.service.ts # XCM message builder (uses P-API)
│   └── event-listener.service.ts # Unified event listener
├── types/
│   └── index.ts               # Shared types and enums
└── README.md                  # This file
```

## Testing

```typescript
describe('AssetHubService', () => {
  let service: AssetHubService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [AssetHubService, XcmBuilderService],
    }).compile();

    service = module.get(AssetHubService);
  });

  it('should dispatch investment', async () => {
    const positionId = await service.dispatchInvestmentWithXcm({
      user: '0x...',
      chainId: 2004,
      poolId: '0x...',
      baseAsset: '0x...',
      amount: 1000000000000000000n,
      lowerRangePercent: -5,
      upperRangePercent: 10,
    });

    expect(positionId).toBeDefined();
  });
});
```

## Contract References

| Contract | Chain | Purpose |
|----------|-------|---------|
| AssetHubVault | Asset Hub | Custody, investment dispatch, settlement |
| XCMProxy | Moonbeam | LP position management, DEX integration |

See `SmartContracts/contracts/V1(Current)/` for Solidity source code.

## Related Documentation

- [PRD.md](/PRD.md) - Product Requirements Document
- [WhitePaper.md](/WhitePaper.md) - Technical Architecture
- [ParaSpell SDK](https://paraspell.github.io/docs/) - XCM message building
