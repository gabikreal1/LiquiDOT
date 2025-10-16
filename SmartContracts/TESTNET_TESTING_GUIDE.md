# AssetHubVault Testnet Testing Guide

## Overview
Your AssetHubVault contract deployed via Remix/Revive on Paseo Asset Hub **DOES work with ethers.js/Hardhat** via the EVM-RPC translation layer.

## Key Findings

### ✅ What Works
- **EVM-RPC endpoint**: `https://testnet-passet-hub-eth-rpc.polkadot.io`
- **ethers.js compatibility**: Full support for contract interactions
- **Hardhat tests**: Work perfectly when run with `--network passethub`
- **Event monitoring**: Works correctly
- **Transaction submission**: Works (with gas price considerations)

### ❌ What Was Wrong
- Tests were running on default network instead of `--network passethub`
- Contract address variable name mismatch (`ASSETHUB_ADDRESS` vs `ASSETHUB_CONTRACT`)
- Event name mismatch (`Withdraw` vs `Withdrawal`)
- Gas price issues from sending transactions too fast

## Running Tests

### Configuration Check
```bash
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
```

### Deposit/Withdrawal Tests
```bash
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub
```

### Run All Testnet Tests
```bash
npx hardhat test test/AssetHubVault/testnet/*.test.js --network passethub
```

## Environment Setup

Your `.env` file should have:
```env
ASSET_PK=your_private_key_here
ASSETHUB_CONTRACT=0x9b9aA4EDF7937a2A958d9375a871ab84a0876F60
```

## Network Configuration

In `hardhat.config.js`:
```javascript
passethub: {
  url: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
  chainId: 420420422,
  accounts: [ASSET_PRIVATE_KEY],
  gasPrice: 1000000000,
}
```

## Current Test Results

### ✅ Configuration Tests (11/11 passing)
- Contract deployment verification
- Role configuration (admin, operator, emergency)
- XCM configuration check
- Contract state (paused, testMode)
- Balance checking

### ✅ Deposit/Withdrawal Tests (12/12 passing, 2 skipped)
- Deposit functionality (TEST-AHV-007)
- Deposit events
- Zero deposit rejection (TEST-AHV-008)
- Multiple deposits from same user
- Withdrawal with balance (TEST-AHV-010/011)
- Withdrawal events
- Insufficient balance rejection (TEST-AHV-012)
- Zero withdrawal rejection (TEST-AHV-013)
- Full balance withdrawal
- Balance consistency
- Contract balance updates

**Skipped Tests** (require 2nd funded account):
- Multiple user deposit independence (TEST-AHV-009)
- Cross-user balance isolation

## Contract Status

```
Contract: 0x9b9aA4EDF7937a2A958d9375a871ab84a0876F60
Network: Paseo Asset Hub (passethub)
Admin: 0x1bdBC0e9B77d413124F790d162a88FE97B984cbc
Operator: 0x1bdBC0e9B77d413124F790d162a88FE97B984cbc
Test Mode: ✅ Enabled
Paused: ❌ Not paused
XCM Precompile: ⚠️ Not set (required for production)
Balance: ~0.6 PAS
```

## Adding a Second Test Account (Optional)

If you want to test multi-user scenarios:

1. Create a second Paseo account and get PAS tokens from faucet
2. Add to `.env`:
   ```env
   ASSET_PK2=second_private_key_here
   ```

3. Update `hardhat.config.js`:
   ```javascript
   passethub: {
     url: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
     chainId: 420420422,
     accounts: [ASSET_PRIVATE_KEY, ASSET_PRIVATE_KEY_2], // Add second account
     gasPrice: 1000000000,
   }
   ```

## Important Notes

### Transaction Timing
- Paseo Asset Hub has 12-second block times
- Add 6-second delays between transactions to avoid "Priority too low" errors
- Tests include automatic delays for consecutive operations

### Gas Price
- Current setting: 1 Gwei (1000000000)
- May need adjustment based on network congestion

### Test Mode
- ✅ Currently ENABLED - safe for testing
- Skips XCM calls during `dispatchInvestment`
- Disable for production: Call `setTestMode(false)` as admin

### XCM Integration
- ⚠️ XCM precompile not set (shows as 0x000...000)
- Required for actual cross-chain operations
- Set via `setXCMPrecompile()` as admin before production use

## Next Steps

1. ✅ **Done**: Basic deposit/withdrawal testing
2. **TODO**: Set XCM precompile address
3. **TODO**: Test investment dispatch flow (TEST-AHV-014 to TEST-AHV-016)
4. **TODO**: Test liquidation settlement flow (TEST-AHV-017 to TEST-AHV-019)
5. **TODO**: Cross-chain integration tests with XCMProxy on Moonbase

## Troubleshooting

### "could not decode result data"
- **Cause**: Running tests without `--network passethub`
- **Fix**: Always include `--network passethub` in test commands

### "Priority is too low"
- **Cause**: Sending transactions too fast (nonce collision)
- **Fix**: Tests now include 6-second delays between transactions

### "Event doesn't exist"
- **Cause**: Event name mismatch in test expectations
- **Fix**: Use correct event names from contract (e.g., `Withdrawal` not `Withdraw`)

### Contract not found
- **Cause**: Wrong contract address
- **Fix**: Verify `ASSETHUB_CONTRACT` in `.env` matches deployed address

## Resources

- **Paseo Asset Hub Explorer**: https://polkadot.js.org/apps/?rpc=wss://paseo-asset-hub-rpc.polkadot.io
- **PAS Faucet**: https://faucet.polkadot.io/paseo
- **EVM-RPC Endpoint**: https://testnet-passet-hub-eth-rpc.polkadot.io
- **Moonbase RPC**: https://rpc.api.moonbase.moonbeam.network

---

**Summary**: Your Revive-deployed contract works perfectly with ethers.js! The issue was just running tests on the wrong network. All deposit/withdrawal tests now passing. Ready to proceed with investment dispatch and liquidation testing.
