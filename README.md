

## LiquiDOT 🌊

Cross-chain liquidity automation for the Polkadot ecosystem. Built on Asset Hub for custody and using XCM for execution across parachains, LiquiDOT lets users deposit into a vault, define LP strategy, and earn fees without manual rebalancing.

### Current status

- Ongoing development; MVP targeting Moonbeam Algebra pools with Asset Hub custody and an XCM Proxy on Moonbeam.
- Contracts are deployed on testnet, currently bringing the backend to production grade.
- Have been approved a grant application to support development: see Polkadot Fast Grants PR [#86](https://github.com/Polkadot-Fast-Grants/apply/pull/86).

### Documentation

[Our official documentation](https://liquidot.gitbook.io/liquidot-docs)

### White paper

- See `WhitePaper.md` in this repo for full architecture and scope.
- Quick excerpt: LiquiDOT follows a hub-and-spoke model with an Asset Hub Vault for custody/orchestration and a Moonbeam XCM Proxy for DEX execution. Users select asymmetric percentage ranges (e.g., -5%/+10%); contracts convert these to precise tick ranges and automate mint/burn, rebalancing, and stop-loss actions across chains.

### What LiquiDOT delivers

- Automated LP position management across parachains via XCM
- Asymmetric range selection with automatic tick conversion
- Stop-loss/take-profit style liquidations returned back to Asset Hub
- Data-driven decision engine (backend) aligned with user preferences

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

### Deployment & Testing Workflow

1. Bootstrap Moonbase fixtures with `npx hardhat run SmartContracts/scripts/deploy-moonbase.js --network moonbase` so `SmartContracts/deployments/moonbase_bootstrap.json` contains Algebra token, pool, and NFPM addresses (or export the equivalent `MOONBASE_*` env vars).
2. Run the helper scripts in `SmartContracts/test/helpers/` in order: link contracts on both networks, enable AssetHubVault test mode, seed liquidity via `provide-liquidity.js` (it reuses the bootstrap addresses, it does not deploy tokens or pools), then confirm setup with `verify-xcmproxy-config.js`.
3. Execute Hardhat tests from `SmartContracts/test` using the commands in `.test-commands.md`; they cover AssetHubVault, XCMProxy, and the guided integration flow.


All required deployment, wiring, and verification helpers ship with the repository—no additional scripts are needed beyond configuring the expected environment variables.

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
