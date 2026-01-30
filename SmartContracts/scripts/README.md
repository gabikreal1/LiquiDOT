# Live Testnet Setup Scripts

Deploy and configure LiquiDOT for live testnet testing on Moonbase Alpha.

## Quick Setup

### Prerequisites

1. **Install dependencies:**
   ```bash
   cd SmartContracts
   npm install
   ```

2. **Get testnet tokens:**
   - Moonbase DEV: https://faucet.moonbeam.network/
   - Paseo (Asset Hub) DOT: https://faucet.paseo.network/

3. **Environment setup:**
   ```bash
   # Export env vars in your shell (or create a .env in SmartContracts/)
   export MOON_PK="0x..."
   export ASSETHUB_CONTRACT="0x..."  # deploy via Remix first
   ```

### Deployment Steps

#### 1. Deploy AssetHubVault via Remix (Paseo Asset Hub)

- Go to [Polkadot Remix](https://remix.polkadot.network/)
- Deploy `contracts/V1(Current)/AssetHubVault.sol`
- Save the deployed address → `$env:ASSETHUB_CONTRACT`

#### 2. Deploy Moonbase Infrastructure

Deploy Algebra DEX suite + XCMProxy to Moonbase:

```powershell
npx hardhat run scripts/deploy-moonbase.js --network moonbase
```

Saves addresses to `deployments/` directory.

#### 3. Link and Configure Contracts

See `test/helpers/` for setup scripts:

```bash
export ASSETHUB_CONTRACT="0x..."     # from Remix
export XCMPROXY_CONTRACT="0x..."     # from deployment above

# Configure AssetHub (run on Paseo)
npx hardhat run test/helpers/link-contracts.js --network passethub

# Configure XCMProxy (run on Moonbase)
npx hardhat run test/helpers/link-contracts.js --network moonbase

# Enable test mode
npx hardhat run test/helpers/enable-test-mode.js --network passethub

# Verify configuration
npx hardhat run test/helpers/verify-xcmproxy-config.js --network moonbase
```

## Environment Variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `MOON_PK` | `0x...` | Private key for Moonbase |
| `ASSETHUB_CONTRACT` | `0x...` | AssetHubVault address (from Remix) |
| `XCMPROXY_CONTRACT` | `0x...` | XCMProxy address (from deployment) |

## Running Tests

```bash
# Testnet tests
npx hardhat test test/AssetHubVault/testnet/**/*.test.js --network passethub
npx hardhat test test/XCMProxy/testnet/**/*.test.js --network moonbase

# Integration tests
npx hardhat test test/Integration/testnet/**/*.test.js --network passethub
```

See `test/README.md` for complete testing guide.

## Deployment State

All deployment info is saved automatically to `deployments/`:
- `deployment-state.json` - Complete deployment state
- `moonbase_algebra.json` - Algebra contract addresses

## Troubleshooting

**"Insufficient funds"**
- Request more testnet tokens from faucets above

**"Contract deployment failed"**
- Verify Hardhat config has correct network RPC endpoints
- Check Solidity 0.8.28 compatibility

**"Not admin/owner"**
- Verify signer account matches expected role
- Check private key is correct in .env

See `test/helpers/` for additional setup scripts.
