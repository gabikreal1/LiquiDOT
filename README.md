

## LiquiDOT 🌊

A customizable liquidity provider (LP) manager designed to simplify and improve participation in DeFi. LiquiDOT allows users to automate their LP strategies, set stop-loss and take-profit levels, and rebalance positions without constant manual oversight.

Built on Asset Hub for custody and using XCM for execution across parachains, LiquiDOT offers a single platform for managing liquidity across different ecosystems—bringing meaningful control, automation, and flexibility to liquidity providers.

### 🌟 Key Features

- **Automated LP Management** - Set your strategy and let LiquiDOT handle the rest
- **Cross-Chain Support** - Manage liquidity across multiple parachains via XCM
- **Risk Management** - Built-in stop-loss and take-profit mechanisms
- **Customizable Strategies** - Asymmetric ranges (e.g., -5%/+10%) with automatic tick conversion
- **User-Friendly Interface** - No constant manual oversight required

### 📍 Current Testnet Deployments

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Paseo Asset Hub | `0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6` |
| XCMProxy | Moonbase Alpha | `0x7f4b3620d6Ffcc15b11ca8679c57c076DCE109d1` |

### Current Status

- ✅ MVP deployed on testnets (Paseo Asset Hub + Moonbase Alpha)
- ✅ Smart contracts tested with 61+ passing tests
- ✅ XCM integration verified with IXcm and IXTokens precompiles
- ✅ StellaSwap Pulsar compatible (Algebra Integral v1.2)
- 🎉 Approved for [Polkadot Fast Grants PR #86](https://github.com/Polkadot-Fast-Grants/apply/pull/86)

### 🎯 Target Audience

- **Crypto enthusiasts** looking to optimize their Polkadot ecosystem experience
- **Experienced DeFi users** seeking higher yields than basic spot/HODL strategies
- **LP newcomers** who want a reliable, automated entry into liquidity provision
- **Developers and projects** building on parachains who need efficient liquidity management

### 📚 Documentation

| Resource | Description |
|----------|-------------|
| [📖 GitBook Docs](https://liquidot.gitbook.io/liquidot-docs) | Official documentation |
| [📜 WhitePaper.md](./WhitePaper.md) | Full architecture and scope |
| [🔧 SmartContracts/README.md](./SmartContracts/README.md) | Contract docs, deployment, testing |
| [⚙️ Backend/README.md](./Backend/README.md) | API and decision engine |

### 🏗️ Architecture

LiquiDOT follows a **hub-and-spoke model** designed for scalable cross-chain liquidity management:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend UI   │     │ Backend Services│     │   DEX Pools     │
│   (Next.js)     │     │   (NestJS)      │     │  (Algebra)      │
└────────┬────────┘     └────────┬────────┘     └────────▲────────┘
         │                       │                       │
         ▼                       ▼                       │
┌─────────────────────────────────────────────────────────────────┐
│                        Asset Hub                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              AssetHubVault Contract                     │    │
│  │  • User deposits/withdrawals                            │    │
│  │  • Position accounting                                  │    │
│  │  • XCM orchestration (IXcm @ 0x...a0000)                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────┘
                              │ XCM
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Moonbeam                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               XCMProxy Contract                         │    │
│  │  • LP mint/burn via Algebra NFPM                        │    │
│  │  • Swap execution                                       │    │
│  │  • Operator-triggered liquidations                      │    │
│  │  • XCM returns (IXTokens @ 0x...0804)                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**
- **Custody on Asset Hub** - User funds never leave the secure vault
- **Execution on Moonbeam** - DEX operations run where liquidity exists
- **XCM for messaging** - Native Polkadot cross-chain communication
- **Operator model** - Backend triggers liquidations based on strategy rules

### Repository Structure

```
LiquiDOT/
├── Backend/                 # NestJS API + decision engine + chain services
├── Frontend/                # Next.js app
├── SmartContracts/          # Solidity contracts + deployment/test scripts
├── gitbook/                 # Published documentation source
├── images/                  # Docs/media assets
└── WhitePaper.md            # Project white paper
```


### ⚙️ Backend

The backend is the "brains" of LiquiDOT:

| Service | Description |
|---------|-------------|
| **REST API** | Pools, user preferences, positions, investment decisions |
| **Decision Engine** | Deterministic, testable logic for strategy execution |
| **LP Data Aggregator** | Pool analytics from Algebra subgraph |
| **Stop-Loss Worker** | 24/7 position monitoring |

On-chain integration via `ethers`:
- Asset Hub: `AssetHubVault` for custody
- Moonbeam: `XCMProxy` for DEX execution

See **[Backend/README.md](./Backend/README.md)** for full details.

### 🚀 Quick Start

**Prerequisites:**
- Polkadot-compatible wallet (Talisman, SubWallet, Polkadot.js)
- Testnet tokens: [Moonbase DEV](https://faucet.moonbeam.network/) + [Paseo PAS](https://faucet.polkadot.io/)

**Deploy & Test:**

```bash
# 1. Deploy AssetHubVault on Paseo (via Remix), then:
export ASSETHUB_CONTRACT=0x...

# 2. Bootstrap Moonbase (Algebra + XCMProxy + test tokens + pool)
cd SmartContracts
npx hardhat run scripts/deploy-moonbase.js --network moonbase

# 3. Link contracts
npx hardhat run test/helpers/link-contracts.js --network passethub
npx hardhat run test/helpers/link-contracts.js --network moonbase

# 4. Enable test mode
npx hardhat run test/helpers/enable-test-mode.js --network passethub

# 5. Run tests
npx hardhat test test/AssetHubVault/testnet/*.test.js --network passethub
```

See **[SmartContracts/README.md](./SmartContracts/README.md)** for full deployment guide.

### 🔧 Technologies

| Layer | Stack |
|-------|-------|
| **Blockchain** | Polkadot, XCM, Asset Hub, Moonbeam (EVM) |
| **Contracts** | Solidity, Hardhat, Foundry, OpenZeppelin |
| **DEX** | Algebra Integral (StellaSwap Pulsar compatible) |
| **Backend** | NestJS, TypeScript, PostgreSQL, ethers.js |
| **Frontend** | Next.js, Wagmi, Tailwind CSS |

### 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
