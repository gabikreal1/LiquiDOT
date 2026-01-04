

## LiquiDOT 🌊

Cross-chain liquidity automation for the Polkadot ecosystem. Built on Asset Hub for custody and using XCM for execution across parachains, LiquiDOT lets users deposit into a vault, define LP strategy, and earn fees without manual rebalancing.

### Current Testnet Deployments

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Paseo Asset Hub | `0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6` |
| XCMProxy | Moonbase Alpha | `0xe07d18eC747707f29cd3272d48CF84A383647dA1` |

### Current status

- MVP deployed on testnets (Paseo Asset Hub + Moonbase Alpha)
- Smart contracts tested with 61+ passing tests
- XCM integration verified with IXcm and IXTokens precompiles
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
LiquiDOT/
├── Backend/                 # NestJS API + decision engine + chain services
├── Frontend/                # Next.js app
├── SmartContracts/          # Solidity contracts + deployment/test scripts
├── gitbook/                 # Published documentation source
├── images/                  # Docs/media assets
└── WhitePaper.md            # Project white paper
```

For detailed smart contract documentation, deployment guides, and testing instructions, see **[SmartContracts/README.md](./SmartContracts/README.md)**.

### Review evidence (assumptions manifest)

Some integration details (especially XCM/precompile availability and configured addresses) are runtime- and deployment-dependent. To keep review discussions grounded in reproducible facts, the repo includes an “assumptions manifest” workflow that snapshots the on-chain configuration the code is actually pointing at.

- Schema: `deployments/assumptions.schema.json`
- Template (Paseo): `deployments/paseo/assumptions.json`
- Generator: `scripts/generate-assumptions.mjs`

The generator reads chain IDs and key contract configuration via JSON-RPC and writes a generated manifest (defaults to `deployments/paseo/assumptions.generated.json`).

It expects these environment variables:

- `ASSET_HUB_RPC`
- `MOONBEAM_RPC`
- `ASSETHUB_VAULT`
- `MOONBEAM_XCMPROXY`

This is intentionally a “build it / verify it” step: a reviewer can point the generator at any deployment and compare the resulting manifest to what the backend and docs claim.

### Backend

The backend is the “brains” of LiquiDOT:

- **REST API** for pools, user preferences, positions, and running investment decisions
- **Deterministic decision engine** (pure logic + orchestration service) designed to be testable and auditable
- **On-chain integration** via `ethers`:
	- Asset Hub custody contract: `AssetHubVault`
	- Moonbeam execution contract: `XCMProxy`
- **Operationally reproducible pool indexing** via an externally-run Algebra subgraph (Graph Node)
- **Automated test coverage**: unit + E2E (HTTP) tests

Start here: **[Backend/README.md](./Backend/README.md)**.

### Deployment & Testing Workflow

1. Deploy AssetHubVault on Paseo via Remix and set `$env:ASSETHUB_CONTRACT`. Then bootstrap Moonbase with:
	- `npx hardhat run SmartContracts/scripts/deploy-moonbase.js --network moonbase`
	- This deploys Algebra, XCMProxy (test mode enabled), two test tokens, and creates/initializes a pool.
	- It writes `SmartContracts/deployments/moonbase_bootstrap.json` that tests auto-read.
2. Wire and verify using helpers in `SmartContracts/test/helpers/`:
	- Link contracts: `link-contracts.js` on `passethub` then `moonbase`
	- Enable test mode on Asset Hub: `enable-test-mode.js` on `passethub`
	- Optional liquidity: `provide-liquidity.js` on `moonbase` (uses bootstrap addresses)
	- Verify config: `verify-xcmproxy-config.js` on `moonbase`
3. Run tests from `SmartContracts/test` (examples in `.test-commands.md`), including XCMProxy, AssetHubVault, and integration flows.


All required deployment, wiring, and verification helpers ship with the repository—no additional scripts are needed beyond configuring the expected environment variables.

### Architecture overview

- **Asset Hub Vault** (custody, accounting, XCM orchestration)
  - Uses IXcm precompile at `0x00000000000000000000000000000000000a0000`
  - Custom errors for gas-efficient reverts
  - Test mode for development
- **Moonbeam XCM Proxy** (swaps, range LP mint/burn, liquidation)
  - Uses IXTokens precompile at `0x0000000000000000000000000000000000000804`
  - Integrates with Algebra DEX NFPM
  - Operator-triggered liquidation model
- Backend workers (pool analytics, investment decisions, monitoring)
- Frontend dashboard (strategy config, positions, status)

### Technologies

- Polkadot, XCM, Moonbeam (EVM)
- Solidity, Hardhat
- Node.js services
- Next.js frontend

### License

Licensed under the Apache License, Version 2.0. See `LICENSE`.
