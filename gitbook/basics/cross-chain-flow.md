---
icon: arrows-cross
---

# Cross-Chain Flow

How LiquiDOT uses Polkadot's XCM (Cross-Consensus Messaging) for seamless cross-chain liquidity management.

## XCM Overview

XCM is Polkadot's universal messaging format enabling parachains, smart contracts, and pallets to communicate across consensus systems. LiquiDOT uses XCM to transfer assets and instructions between Asset Hub and Moonbeam.

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

### 2. XCM Message Transit

```mermaid
%%{init: {'theme':'dark', 'themeVariables': { 'primaryColor':'#4fc3f7','primaryTextColor':'#fff','primaryBorderColor':'#0288d1','actorBkg':'#1e1e1e','actorBorder':'#4fc3f7','actorTextColor':'#fff','signalColor':'#64b5f6','signalTextColor':'#fff','labelBoxBkgColor':'#2d2d2d','labelBoxBorderColor':'#4fc3f7','labelTextColor':'#fff','loopTextColor':'#fff','noteBkgColor':'#ba68c8','noteBorderColor':'#7b1fa2','noteTextColor':'#fff','sequenceNumberColor':'#fff','fontSize':'16px'}}}%%
sequenceDiagram
    autonumber
    participant AH as 💎 Asset Hub Vault
    participant RC as 🔗 Relay Chain
    participant MB as 🌙 Moonbeam
    participant XP as 🔄 XCM Proxy
    participant DEX as 💧 Algebra Pool
    
    Note over AH,XP: Investment Flow
    AH->>+RC: XCM Message with Assets
    Note right of RC: Routing cross-chain<br/>message
    RC->>+MB: Route to Moonbeam
    MB->>+XP: Deliver Assets + Instructions
    Note right of XP: Decode investment<br/>parameters
    XP->>XP: Validate Parameters
    XP->>+DEX: Swap & Mint LP
    DEX-->>-XP: LP Position Created
    Note over XP,DEX: Position recorded
    XP-->>-MB: Success
    MB-->>-RC: Confirmation
    RC-->>-AH: Investment Complete
```

### 3. Asset Reception & Execution

**XCM Proxy receives:**
- 99.99 DOT (after XCM fees ~0.01 DOT)
- Investment parameters
- User address

**Execution steps:**
1. Decode investment parameters
2. Swap to LP pair ratio if needed
3. Calculate tick range from percentages
4. Mint LP position on Algebra
5. Record position data

### 4. Position Monitoring

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

### 5. Liquidation & Return

**XCM Proxy execution:**
1. Validate trigger condition
2. Burn LP position
3. Collect fees
4. Swap to base asset
5. Send XCM message back to Asset Hub

**Asset Hub Vault:**
1. Receive proceeds
2. Calculate profit/loss
3. Credit user balance
4. Update position status

## XCM Fee Handling

| Direction | Initial | Fee | Received |
|-----------|---------|-----|----------|
| **Outbound** (Asset Hub → Moonbeam) | 100 DOT | ~0.01 DOT | 99.99 DOT |
| **Inbound** (Moonbeam → Asset Hub) | 105 DOT | ~0.01 DOT | 104.99 DOT |

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
