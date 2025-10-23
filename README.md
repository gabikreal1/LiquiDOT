

## LiquiDOT 🌊

Cross-chain liquidity automation for the Polkadot ecosystem. Built on Asset Hub for custody and using XCM for execution across parachains, LiquiDOT lets users deposit into a vault, define LP strategy, and earn fees without manual rebalancing.

[![Demo Video](https://img.youtube.com/vi/9bX0Up0pLww/0.jpg)](https://youtu.be/9bX0Up0pLww)

### Current status

- Ongoing development; MVP targeting Moonbeam Algebra pools with Asset Hub custody and an XCM Proxy on Moonbeam.
- Prototype contracts and frontend are in this repo; cross-chain wiring and production hardening are in progress.
- Have been approved a grant application to support development: see Polkadot Fast Grants PR [#86](https://github.com/Polkadot-Fast-Grants/apply/pull/86).

### Documentation

[Our official documentation] (https://liquidot.gitbook.io/liquidot-docs)

### White paper

- See `WhitePaper.md` in this repo for full architecture and scope.
- Quick excerpt: LiquiDOT follows a hub-and-spoke model with an Asset Hub Vault for custody/orchestration and a Moonbeam XCM Proxy for DEX execution. Users select asymmetric percentage ranges (e.g., -5%/+10%); contracts convert these to precise tick ranges and automate mint/burn, rebalancing, and stop-loss actions across chains.

### What LiquiDOT delivers

- Automated LP position management across parachains via XCM
- Asymmetric range selection with automatic tick conversion
- Stop-loss/take-profit style liquidations returned back to Asset Hub
- Data-driven decision engine (backend) aligned with user preferences

### Demos

- Smart Contracts walkthrough: https://youtu.be/uR1Q-MbCqyc
- UI walkthrough: https://youtu.be/kveBw8GVIVk

### Repository structure

```
PolkadotHack2025/
├── Backend/                 # Node.js workers and services
├── DataAggregatorService/   # Pool analytics service
├── Frontend/                # Next.js app (Wagmi + Polkadot integrations)
├── SmartContracts/          # Solidity contracts and scripts (see SmartContracts/README.md)
├── local-dev/               # Local dev helper scripts and configs
└── WhitePaper.md            # Project white paper
```

For detailed smart contract documentation, deployment guides, and testing instructions, see **[SmartContracts/README.md](./SmartContracts/README.md)**.

### Architecture overview

- Asset Hub Vault (custody, accounting, XCM orchestration)
- Moonbeam XCM Proxy (swaps, range LP mint/burn, liquidation)
- Backend workers (pool analytics, investment decisions, monitoring)
- Frontend dashboard (strategy config, positions, status)

### Technologies

- Polkadot, XCM, Moonbeam (EVM)
- Solidity, Hardhat
- Node.js services
- Next.js frontend

### License

Licensed under the Apache License, Version 2.0. See `LICENSE`.
