# LiquiDOT 🌊

A customizable liquidity provider (LP) manager designed to simplify and improve participation in DeFi. LiquiDOT allows users to automate their LP strategies, set stop-loss and take-profit levels, and rebalance positions without constant manual oversight.

Built on Asset Hub for custody and using XCM for execution across parachains, LiquiDOT offers a single platform for managing liquidity across different ecosystems—bringing meaningful control, automation, and flexibility to liquidity providers.

### 🌟 Key Features

- **Automated LP Management** - Set your strategy and let LiquiDOT handle the rest
- **Cross-Chain Support** - Manage liquidity across multiple parachains via XCM
- **Risk Management** - Built-in stop-loss and take-profit mechanisms
- **Customizable Strategies** - Asymmetric ranges (e.g., -5%/+10%) with automatic tick conversion
- **User-Friendly Interface** - No constant manual oversight required

### 📍 Deployments

**Mainnet**

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Asset Hub (420420419) | `0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230` |
| XCMProxy | Moonbeam (1284) | `0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230` |

**Testnet**

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Paseo Asset Hub | `0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6` |
| XCMProxy | Moonbase Alpha | `0x7f4b3620d6Ffcc15b11ca8679c57c076DCE109d1` |

### Current Status

- ✅ Smart contracts deployed and verified on mainnet (Asset Hub + Moonbeam)
- ✅ End-to-end XCM transactions working on mainnet
- ✅ Smart contracts tested with 61+ passing tests
- ✅ XCM integration verified with IXcm and IPalletXcm precompiles
- ✅ StellaSwap Pulsar compatible (Algebra Integral v1.2)
- ✅ Backend complete — decision engine, stop-loss worker, XCM retry, dashboard API
- ✅ Full-stack dashboard with real-time position tracking via SSE
- ✅ CI/CD pipeline with GitHub Actions + Terraform on DigitalOcean
- 🚧 Frontend v2 in progress — polishing UI for production deployment
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
| [🖥️ Frontend/README.md](./Frontend/README.md) | Next.js dashboard + DApp |

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
│  │  • XCM returns (IPalletXcm @ 0x...0810)                 │    │
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
│   └── terraform-do/        # Terraform config for DigitalOcean deployment
├── Frontend/                # Next.js dashboard + investment form
├── SmartContracts/          # Solidity contracts + deployment/test scripts
├── .github/workflows/       # CI (build+test) + CD (Terraform deploy)
├── gitbook/                 # Published documentation source
├── images/                  # Docs/media assets
└── WhitePaper.md            # Project white paper
```

### ⚙️ Backend

The backend is the "brains" of LiquiDOT:

| Service | Description |
|---------|-------------|
| **REST API** | Pools, user preferences, positions, investment decisions, dashboard |
| **Decision Engine** | Deterministic, testable logic for strategy execution |
| **LP Data Aggregator** | Pool analytics from Algebra subgraph |
| **Stop-Loss Worker** | 24/7 position monitoring with batch pool state optimization |
| **Dashboard API** | Pre-aggregated portfolio view (balance, P&L, positions, activity) |
| **SSE Events** | Real-time position status updates via Server-Sent Events |
| **XCM Retry** | Automatic retry with exponential backoff for cross-chain operations |

On-chain integration via `ethers` + `polkadot-api`:
- Asset Hub: `AssetHubVault` for custody + XCM orchestration
- Moonbeam: `XCMProxy` for DEX execution + liquidation returns

See **[Backend/README.md](./Backend/README.md)** for full details.

### 🚀 Quick Start

**For Users:**
- Connect an EVM wallet (MetaMask, Talisman, SubWallet) or a Substrate wallet
- Deposit DOT on Asset Hub — minimum position size: **10 DOT**
- Set your preferences (risk profile, APY target, stop-loss/take-profit)
- The system handles LP management, monitoring, and rebalancing automatically

**For Developers:**

```bash
# Smart Contracts
cd SmartContracts && npm install
npm run compile:evm && npm run test:evm

# Backend
cd Backend && pnpm install
pnpm run build && pnpm test

# Frontend
cd Frontend && pnpm install
pnpm run dev
```

See individual READMEs for full setup guides.

### 🔧 Technologies

| Layer | Stack |
|-------|-------|
| **Blockchain** | Polkadot, XCM, Asset Hub, Moonbeam (EVM) |
| **Contracts** | Solidity, Hardhat, Foundry, OpenZeppelin |
| **DEX** | Algebra Integral (StellaSwap Pulsar compatible) |
| **Backend** | NestJS, TypeScript, PostgreSQL, ethers.js, P-API (polkadot-api) |
| **Frontend** | Next.js 15, React Query, Wagmi, Tailwind CSS, shadcn/ui, recharts |
| **CI/CD** | GitHub Actions, Terraform, DigitalOcean App Platform |

### 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
