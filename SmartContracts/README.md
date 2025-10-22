# LiquiDOT Smart Contracts

Cross-chain liquidity management infrastructure for Polkadot parachains, enabling automated trading on Moonbeam DEXs with custody on Asset Hub.

## 📁 Directory Structure

```
SmartContracts/
├── contracts/              # Smart contract source code
│   ├── V1(Current)/        # Production contracts
│   │   ├── AssetHubVault.sol    # Asset Hub custody layer
│   │   └── XCMProxy.sol         # Moonbeam execution layer
│   └── test/               # Test contracts
├── test/                   # Comprehensive test suite
│   ├── AssetHubVault/      # Asset Hub tests
│   ├── XCMProxy/           # Moonbase tests
│   ├── Integration/        # Cross-chain tests
│   └── helpers/            # Setup utilities
├── scripts/                # Deployment & setup scripts
├── deployments/            # Deployment state & addresses
└── foundry.toml            # Foundry configuration
```

## 🏗️ Architecture

**AssetHubVault** (Asset Hub / Paseo)
- Primary custody layer for user funds
- Dispatches investment decisions via XCM
- Handles deposits, withdrawals, and emergency functions
- Uses only IXcm precompile (native to Asset Hub)

**XCMProxy** (Moonbeam / Moonbase)
- Cross-chain execution engine
- Integrates with Algebra DEX for trading
- Manages liquidity positions
- Returns profits via XCM

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Get testnet tokens
# - Moonbase DEV: https://faucet.moonbeam.network/
# - Paseo DOT: https://faucet.paseo.network/
```

### Deployment

See **[scripts/README.md](./scripts/README.md)** for complete deployment guide:

1. Deploy AssetHubVault to Asset Hub (via Remix)
2. Deploy Moonbase infrastructure (Algebra + XCMProxy)
3. Link contracts and enable test mode

### Testing

See **[test/README.md](./test/README.md)** for complete testing guide:

```bash
# Asset Hub tests
npx hardhat test test/AssetHubVault/testnet/**/*.test.js --network passethub

# Moonbase tests
npx hardhat test test/XCMProxy/testnet/**/*.test.js --network moonbase

# Integration tests
npx hardhat test test/Integration/testnet/**/*.test.js --network passethub
```

## 📦 Deployments

Current testnet deployments are tracked in `deployments/`:

- `deployment-state.json` - Complete XCMProxy deployment state
- `moonbase_bootstrap.json` - Bootstrap configuration with all addresses
- `xcmproxy-moonbase-*.json` - Timestamped deployment records

## 🔧 Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Private keys (without 0x prefix)
MOON=your_moonbase_private_key
ASSET=your_asset_hub_private_key

# Contract addresses (set after deployment)
ASSETHUB_CONTRACT=0x...
XCMPROXY_CONTRACT=0x...
```

## 📚 Documentation

- **[Test Suite](./test/README.md)** - Complete testing guide
- **[Deployment Scripts](./scripts/README.md)** - Setup & deployment
- **[Test Commands](./test/.test-commands.md)** - Quick command reference

## 🔗 Networks

- **Moonbase Alpha** - Moonbeam testnet (ChainId: 1287)
- **Paseo Asset Hub** - Asset Hub testnet (ParaId: 1000)

## 🛠️ Development Tools

- **Hardhat** - Primary development framework
- **Foundry** - Testing and verification
- **OpenZeppelin** - Security libraries
- **Algebra Integral** - DEX integration

## ⚖️ License

Apache-2.0

## 🆘 Support

For issues or questions:
1. Check the documentation in `test/README.md` and `scripts/README.md`
2. Review deployment state in `deployments/`
3. See the main project [README](../README.md)
