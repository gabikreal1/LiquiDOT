---
icon: vial
---

# Testing Guide

End-to-end steps to test LiquiDOT on Moonbase Alpha and Paseo Asset Hub.

## Current Testnet Deployments

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Paseo Asset Hub | `0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6` |
| XCMProxy | Moonbase Alpha | `0xe07d18eC747707f29cd3272d48CF84A383647dA1` |

## Prerequisites

### Testnet Funds
- Moonbase DEV: https://faucet.moonbeam.network/
- Paseo PAS: https://faucet.paseo.network/

### Environment Setup

Create a `.env` file in `SmartContracts/`:

```bash
# Private keys (with 0x prefix)
MOON_PK=0x...      # Moonbase deployer key
ASSET_PK=0x...     # Asset Hub deployer key

# Contract addresses
ASSETHUB_CONTRACT=0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6
XCMPROXY_CONTRACT=0xe07d18eC747707f29cd3272d48CF84A383647dA1
```

### Install Dependencies

```bash
cd SmartContracts
npm install
```

## Test Suite Structure

### AssetHubVault Tests (Paseo Asset Hub)

Located in `test/AssetHubVault/testnet/`:

| File | Description | Test IDs |
|------|-------------|----------|
| `1.config-check.test.js` | Configuration verification | TEST-AHV-001 to 006 |
| `2.deposits.test.js` | Deposit/Withdraw flows | TEST-AHV-007 to 015 |
| `3.investment.test.js` | Investment dispatch | TEST-AHV-016 to 023 |
| `4.liquidation.test.js` | Liquidation settlement | TEST-AHV-024 to 028 |
| `5.emergency.test.js` | Emergency functions | TEST-AHV-029 to 033 |
| `6.security-checks.test.js` | Security validation | Security checks |

### XCMProxy Tests (Moonbase Alpha)

Located in `test/XCMProxy/testnet/`:

| File | Description |
|------|-------------|
| `1.config-check.test.js` | Configuration verification |
| `2.receive-assets.test.js` | Asset reception |
| `3.execute-position.test.js` | Position execution |
| `4.liquidation.test.js` | Liquidation flows |
| `5.emergency.test.js` | Emergency functions |

## Running Tests

### AssetHubVault Tests

```bash
# Run individual test files
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/3.investment.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/4.liquidation.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/5.emergency.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/6.security-checks.test.js --network passethub
```

### XCMProxy Tests

```bash
# Run individual test files
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
npx hardhat test test/XCMProxy/testnet/2.receive-assets.test.js --network moonbase
npx hardhat test test/XCMProxy/testnet/3.execute-position.test.js --network moonbase
```

## Test Results

Latest test run (January 2026):
- **AssetHubVault**: 61 passing, 5 pending
- **XCMProxy**: 57 passing, 0 failing

## Test Mode

Both contracts support a `testMode` flag for development:

- **AssetHubVault**: Skips XCM send calls, allows operator to confirm/settle locally
- **XCMProxy**: Skips XCM return transfers

Enable via:
```javascript
await vault.setTestMode(true);
await proxy.setTestMode(true);
```

## Troubleshooting

### "Transaction is temporarily banned"
Paseo Asset Hub requires higher gas prices (~1000 Gwei). Remove any explicit `gasPrice` from hardhat config.

### "Priority is too low"
Transactions submitted too quickly. Wait a few seconds between transactions.

### Timeouts
Some tests take 2-4 minutes. Tests have 120-240s timeouts configured.

### Missing Environment Variables
Ensure `ASSETHUB_CONTRACT` and `ASSET_PK` are set in `.env`.

**Next:** [Smart Contracts](smart-contracts.md)
