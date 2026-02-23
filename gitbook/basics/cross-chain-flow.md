---
icon: arrows-cross
---

# Cross-Chain Flow

How LiquiDOT uses Polkadot's XCM (Cross-Consensus Messaging) for seamless cross-chain liquidity management.

## XCM Overview

XCM is Polkadot's universal messaging format enabling parachains, smart contracts, and pallets to communicate across consensus systems. LiquiDOT uses XCM to transfer assets and instructions between Asset Hub and Moonbeam.

### XCM Precompile Addresses

| Precompile | Network | Address | Purpose |
|------------|---------|---------|---------|
| **IXcm** | Asset Hub | `0x00000000000000000000000000000000000a0000` | Send/execute XCM messages |
| **IPalletXcm** | Moonbeam | `0x000000000000000000000000000000000000081A` | Cross-chain token transfers |

### IXcm Interface (Asset Hub)

```solidity
interface IXcm {
    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }
    function execute(bytes calldata message, Weight calldata maxWeight) external;
    function send(bytes calldata dest, bytes calldata message) external;
    function weighMessage(bytes calldata message) external view returns (Weight memory);
}
```

### IPalletXcm Interface (Moonbeam)

```solidity
interface IPalletXcm {
    struct Location {
        uint8 parents;
        bytes[] interior;
    }

    struct AssetAddressInfo {
        address asset;
        uint256 amount;
    }

    function transferAssetsUsingTypeAndThenAddress(
        Location calldata dest,
        AssetAddressInfo[] calldata assets,
        uint8 assetsTransferType,
        uint8 remoteFeesIdIndex,
        uint8 feesTransferType,
        bytes calldata customXcmOnDest
    ) external;
}
```

The XCMProxy contract uses `transferAssetsUsingTypeAndThenAddress` with `DestinationReserve` transfer type (value `2`) to send DOT back to Asset Hub. The contract handles EE-padding of Moonbeam H160 addresses to Asset Hub AccountId32 format internally.

## Investment Flow

### 1. User Initiates Investment

```javascript
await assetHubVault.investInPool(
  chainId: 1284,
  poolId: "0xPoolABC...",
  baseAsset: "DOT",
  amounts: [parseUnits("100", 10)],
  lowerRangePercent: -5,
  upperRangePercent: 10
);
```

**Vault Actions:**
1. Verify balance
2. Lock DOT
3. Construct XCM message
4. Dispatch to Moonbeam

### 2. XCM Message Transit & Execution Flow

```mermaid
%%{init: {'theme':'dark', 'themeVariables': { 'primaryColor':'#4fc3f7','primaryTextColor':'#fff','primaryBorderColor':'#0288d1','actorBkg':'#1e1e1e','actorBorder':'#4fc3f7','actorTextColor':'#fff','signalColor':'#64b5f6','signalTextColor':'#fff','labelBoxBkgColor':'#2d2d2d','labelBoxBorderColor':'#4fc3f7','labelTextColor':'#fff','loopTextColor':'#fff','noteBkgColor':'#ba68c8','noteBorderColor':'#7b1fa2','noteTextColor':'#fff','sequenceNumberColor':'#fff','fontSize':'16px'}}}%%
sequenceDiagram
    autonumber
    participant AH as 💎 Asset Hub Vault
    participant RC as 🔗 Relay Chain
    participant MB as 🌙 Moonbeam
    participant XP as 🔄 XCM Proxy
    participant OP as 🤖 Operator
    participant DEX as 💧 Algebra NFPM
    
    Note over AH,DEX: Investment Flow
    AH->>+RC: XCM Message with Assets
    Note right of RC: Cross-chain routing
    RC->>+MB: Route to Moonbeam
    MB->>+XP: Deliver Assets + Instructions
    XP->>XP: receiveAssets()
    Note right of XP: Create PendingPosition
    XP-->>-MB: Assets received
    MB-->>-RC: XCM Complete
    RC-->>-AH: Message delivered
    
    Note over OP,DEX: Operator Execution
    OP->>+XP: executePendingInvestment()
    XP->>XP: Decode parameters
    XP->>XP: Swap tokens if needed
    XP->>+DEX: Mint NFPM position
    DEX-->>+XP: tokenId, liquidity
    XP->>XP: Create position record
    XP-->>-OP: Execution complete
    
    Note over OP,AH: Confirmation
    OP->>+AH: confirmExecution()
    AH->>AH: Update status to Active
    Note right of AH: Link remote position
    AH-->>-OP: Position confirmed
```

### 3. Asset Reception

**XCM Proxy `receiveAssets()` creates pending position:**
- Receives 99.99 DOT (after XCM fees ~0.01 DOT)
- Stores investment parameters
- Emits `PendingPositionCreated` event
- Position awaits operator execution

### 4. Investment Execution

**Operator calls `executePendingInvestment()`:**
1. Decode pending position parameters
2. Swap tokens to LP pair ratio if needed
3. Calculate tick range from percentages
4. Approve tokens and mint NFPM position
5. Create local position record
6. Delete pending position

### 5. Execution Confirmation

**Operator confirms on Asset Hub:**
```javascript
// Call confirmExecution on AssetHubVault
await assetHubVault.confirmExecution(
  positionId,        // Asset Hub position ID
  remotePositionId,  // Local XCMProxy position ID
  liquidity          // Liquidity created
);
```

**Updates position status:**
- `PendingExecution` → `Active`
- Links Asset Hub position to remote position
- Emits `PositionExecutionConfirmed` event

### 6. Position Monitoring

**Stop-Loss Worker (every 12 seconds):**

```javascript
async function monitorPositions() {
  const positions = await xcmProxy.getActivePositions();
  
  for (const position of positions) {
    const currentPrice = await getPoolPrice(position.pool);
    const lowerBound = position.entryPrice * (1 + position.lowerRangePercent / 100);
    const upperBound = position.entryPrice * (1 + position.upperRangePercent / 100);
    
    if (currentPrice < lowerBound) {
      await triggerLiquidation(position.id, 'STOP_LOSS');
    } else if (currentPrice > upperBound) {
      await triggerLiquidation(position.id, 'TAKE_PROFIT');
    }
  }
}
```

### 7. Liquidation & Return

**Operator calls `liquidateSwapAndReturn(positionId, baseAsset, beneficiary, ...)`:**
1. Burn NFPM position and collect fees
2. Swap all tokens to base asset (DOT)
3. Call `IPalletXcm.transferAssetsUsingTypeAndThenAddress()` with DestinationReserve type to send assets back to Asset Hub (contract handles H160→AccountId32 conversion internally)
4. Emit `LiquidationCompleted` event

### 8. Liquidation Settlement

**Operator settles on Asset Hub:**
```javascript
// After XCM transfer completes
await assetHubVault.settleLiquidation(
  positionId,
  receivedAmount
);
```

**Updates:**
1. Verify contract received assets
2. Update position status to `Liquidated`
3. Credit user balance
4. Emit `LiquidationSettled` event

## XCM Fee Handling

Total XCM overhead is approximately ~0.05 DOT per cross-chain operation:

| Direction | Initial | Fee | Received |
|-----------|---------|-----|----------|
| **Outbound** (Asset Hub → Moonbeam) | 100 DOT | ~0.03 DOT (AH) + ~0.02 DOT (MB) | ~99.95 DOT |
| **Inbound** (Moonbeam → Asset Hub) | 105 DOT | ~0.05 DOT | ~104.95 DOT |

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| BuyExecution failed | Insufficient fees | Increase fee reserve |
| Transact failed | Position exists | Retry with new ID |
| Asset trapped | Reception failed | Call `claimAssets()` |

**Recovery mechanism:**
```solidity
function rescueTrappedAssets(address token, address recipient, uint256 amount) external onlyAdmin {
    IXcmTransactor(XCM_PRECOMPILE).claimAssets(token, amount, recipient);
}
```

## Message Tracking

```javascript
// Get message hash
const messageHash = await assetHubVault.lastXcmMessageHash();

// Query status
const status = await polkadotApi.query.xcmPallet.queries(messageHash);
// Values: Pending, Success, Failed

// Listen for events
assetHubVault.on('XcmMessageSent', (hash, dest) => {
  console.log(`XCM sent: ${hash} → ${dest}`);
});
```

**Next:** [Architecture](architecture.md) • [Smart Contracts](smart-contracts.md) • [Testing Guide](testing-guide.md)
