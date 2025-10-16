# Adding Chain Configuration to AssetHubVault

## Overview
Before you can dispatch investments from AssetHubVault to XCMProxy on Moonbase, you need to add Moonbase as a supported destination chain.

## Quick Start

### Option 1: Use the Script (Recommended)
```bash
npx hardhat run scripts/add-moonbase-chain.js --network passethub
```

### Option 2: Manual via Remix/Revive

Navigate to your deployed AssetHubVault contract and call `addChain` with these parameters:

## Moonbase Alpha Parameters

### Function Signature
```solidity
function addChain(
    uint32 chainId,
    bytes calldata xcmDestination,
    string calldata chainName,
    address executor
) external onlyAdmin
```

### Parameters for Moonbase Alpha

```javascript
chainId: 1000                          // Moonbase Alpha's parachain ID
xcmDestination: "0x010100000003e8"    // SCALE-encoded MultiLocation
chainName: "Moonbase Alpha"            // Human-readable name
executor: "0xf7749B6A5aD0EB4ed059620B89f14FA8e916ee41"  // Your XCMProxy address
```

### Parameter Explanation

| Parameter | Value | Description |
|-----------|-------|-------------|
| `chainId` | `1000` | Moonbase Alpha's parachain ID (used as unique identifier) |
| `xcmDestination` | `0x010100000003e8` | SCALE-encoded XCM MultiLocation |
| `chainName` | `"Moonbase Alpha"` | Human-readable chain name |
| `executor` | XCMProxy address | Optional: Contract that executes on destination chain |

## Understanding xcmDestination Encoding

The `xcmDestination` is a SCALE-encoded XCM MultiLocation:

```
MultiLocation {
    parents: 1,
    interior: X1(Parachain(1000))
}
```

Encoded as hex: `0x010100000003e8`

Breaking down the encoding:
- `0x01` - parents: 1 (go up to relay chain)
- `0x01` - interior: X1 (single junction)
- `0x00` - Parachain selector
- `0x000003e8` - paraId: 1000 (hex: 0x3e8)

## Verification

After adding the chain, verify it was configured correctly:

```javascript
// Check chain configuration
const chainInfo = await vault.supportedChains(1000);
console.log("Supported:", chainInfo.supported);       // Should be true
console.log("Chain Name:", chainInfo.chainName);      // "Moonbase Alpha"
console.log("XCM Destination:", chainInfo.xcmDestination);

// Check executor
const executor = await vault.chainExecutors(1000);
console.log("Executor:", executor);  // Should be your XCMProxy address
```

## Complete Setup Checklist

Before dispatching investments, ensure:

- [x] AssetHubVault deployed on Paseo Asset Hub
- [x] XCMProxy deployed on Moonbase Alpha
- [ ] **Moonbase chain added** (this step)
- [ ] XCM precompile address set
- [ ] Test mode status configured
- [ ] Users have deposited funds
- [ ] Contract has sufficient balance

## XCM MultiLocation Reference

The MultiLocation for Moonbase Alpha from Asset Hub's perspective:

```rust
MultiLocation {
    parents: 1,              // Go up to relay chain
    interior: X1(            // Single junction
        Parachain(1000)      // Moonbase parachain ID
    )
}
```

This translates to the XCM path:
```
Asset Hub → Relay Chain → Moonbase (Para 1000)
```

## Example: Adding Multiple Chains

If you want to support multiple destination chains:

### Moonbase Alpha (Testing)
```javascript
await vault.addChain(
  1000,                          // chainId (Moonbase paraId)
  "0x010100000003e8",           // xcmDestination
  "Moonbase Alpha",              // chainName
  xcmProxyAddress                // executor
);
```

### Moonbeam Mainnet (Production)
```javascript
await vault.addChain(
  2004,                          // chainId (Moonbeam's paraId)
  "0x0101000007d4",             // xcmDestination (0x7d4 = 2004)
  "Moonbeam",                    // chainName
  executorAddress                // executor
);
```

### HydraDX (Another parachain)
```javascript
await vault.addChain(
  2034,                          // chainId (HydraDX paraId)
  "0x0101000007f2",             // xcmDestination (0x7f2 = 2034)
  "HydraDX",                     // chainName
  executorAddress                // executor
);
```

## Troubleshooting

### "Chain already supported"
- Each chainId must be unique
- Check: `await vault.supportedChains(chainId)`
- To update, first remove the chain

### "Invalid XCM destination"
- xcmDestination cannot be empty
- Verify SCALE encoding is correct
- Use the script for automatic encoding

### "Only admin can add chains"
- Ensure you're calling from the admin address
- Check: `await vault.admin()`

## After Adding Chain

Once the chain is added, you can:

1. **Dispatch Investments**
   ```javascript
   await vault.dispatchInvestment(
     userAddress,
     amount,
     1000,  // chainId for Moonbase
     investmentData
   );
   ```

2. **Check Chain Status**
   ```javascript
   const config = await vault.supportedChains(1000);
   console.log(config.supported);    // true if active
   console.log(config.chainName);
   ```

3. **Update Executor** (if needed)
   ```javascript
   await vault.updateChainExecutor(1000, newExecutorAddress);
   ```

4. **Remove Chain** (if needed)
   ```javascript
   await vault.removeChain(1000);
   ```

## Production Considerations

### Before Production Deployment:

1. **Verify Parachain IDs**
   - Testnet: Moonbase = 1000
   - Mainnet: Moonbeam = 2004

2. **Test XCM Path**
   - Verify messages reach destination
   - Test with small amounts first

3. **Set XCM Precompile**
   - Required for actual XCM execution
   - Set via `setXCMPrecompile()`

4. **Disable Test Mode**
   - Call `setTestMode(false)` as admin
   - Only after thorough testing

## Related Documentation

- [Polkadot XCM Format](https://wiki.polkadot.network/docs/learn-xcm)
- [Moonbeam Parachain Info](https://docs.moonbeam.network)
- [Asset Hub Documentation](https://wiki.polkadot.network/docs/learn-asset-hub)

---

**Ready to add chain?** Run: `npx hardhat run scripts/add-moonbase-chain.js --network passethub`
