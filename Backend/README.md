# LiquiDOT Backend (NestJS)

This folder contains the **LiquiDOT backend API** implemented with **NestJS**.

It exposes HTTP endpoints for:

- **Pools** (ingested from an Algebra subgraph)
- **User preferences** (strategy inputs)
- **Positions** (portfolio state)
- **Investment decision runs** (deterministic decision output)

It also integrates with the on-chain contracts via `ethers`:

- **Asset Hub custody/orchestration**: `AssetHubVault`
- **Moonbeam execution engine**: `XCMProxy`

## Quick map of the folder

- `src/` — NestJS source
  - `modules/investment-decision/` — decision logic + orchestration
  - `modules/pools/` — pool ingestion + querying
  - `modules/blockchain/` — on-chain services (Asset Hub + Moonbeam)
- `test/` — Jest E2E tests (HTTP-level, deterministic mocks)
- `local-dev/` — local dev helpers (e.g. Graph Node stack)
- `legacy/` — old one-off scripts/data (not required for running the backend)

## Setup

Install deps:

```bash
npm install
```

Create your env file:

```bash
cp .env.example .env
```

### Environment variables

```env
# Asset Hub RPC (typically WebSocket)
ASSETHUB_RPC_URL=wss://westend-asset-hub-rpc.polkadot.io

# Moonbeam / Moonbase Alpha EVM RPC (HTTP)
MOONBEAM_RPC_URL=https://rpc.api.moonbase.moonbeam.network

# Contract addresses
ASSETHUB_VAULT_ADDRESS=0x...
MOONBEAM_XCM_PROXY_ADDRESS=0x...

# Used by the XCM builder (often same as MOONBEAM_XCM_PROXY_ADDRESS)
XCM_PROXY_ADDRESS=0x...

# Relayer wallet (signs txs)
RELAYER_PRIVATE_KEY=0x...

# Pool data source
ALGEBRA_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/<you>/<subgraph-name>

# Optional: supported token discovery seed (comma-separated addresses)
TOKEN_CANDIDATES=0x...,0x...
```

Notes:

- The backend expects **two distinct RPC URLs** (Asset Hub + Moonbeam).
- `TOKEN_CANDIDATES` is used to resolve **supported token names** from the `XCMProxy` allowlist.
  - The contract exposes `supportedTokens(address) -> bool` and is not enumerable, so the backend filters a candidate list.

## How the backend works (high level)

### Pool ingestion

Pools are fetched from `ALGEBRA_SUBGRAPH_URL`.

You can manually refresh pools:

- `GET /api/pools/sync/status`
- `POST /api/pools/sync`

### Decision flow

The decision stack is split into:

- **Pure logic** functions (deterministic, testable)
- A NestJS service that gathers inputs (pools + preferences + positions) and produces a decision object

HTTP:

- `POST /api/users/:userId/decision/run`
- `POST /api/users/:userId/decision/execute` (env-gated)

### Contract-backed token names

To inspect on-chain supported tokens:

- `GET /api/blockchain/supported-tokens`
  - pass candidates: `?candidates=0x...,0x...`
  - or set `TOKEN_CANDIDATES` in env

## Tests

Run unit tests:

```bash
npm test
```

Run E2E tests:

```bash
npm run test:e2e
```

## Ops notes (pool indexing)

Pool updates depend on an Algebra subgraph running separately.

See:

- `local-dev/graph-node/README.md` (local Graph Node scaffold)
- `M2_OPS_PRD.md` (ops notes)

## Legacy scripts (optional)

Legacy one-off scripts are in `legacy/scripts/`.

They are **not required** for running the NestJS backend and are kept only for reference.

```javascript
import { swapExactInputSingle, swapExactInputMultihop } from './liquidity-swapper.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Get token addresses from environment variables
    const WGLMR = process.env.TOKEN0_ADDRESS; // Assuming TOKEN0_ADDRESS is WGLMR
    const DOT = process.env.TOKEN1_ADDRESS;   // Assuming TOKEN1_ADDRESS is DOT
    const USDT = process.env.TOKEN2_ADDRESS;  // You would need to add this to your .env file
    
    // Validate environment variables
    if (!WGLMR || !DOT) {
      console.error('Error: Required environment variables not set');
      console.error('Please ensure TOKEN0_ADDRESS and TOKEN1_ADDRESS are set in your .env file');
      return;
    }
    
    console.log('Token addresses:');
    console.log(`WGLMR: ${WGLMR}`);
    console.log(`DOT: ${DOT}`);
    if (USDT) console.log(`USDT: ${USDT}`);
    
    // Simple swap
    const amountIn = ethers.parseUnits('1', 18); // 1 WGLMR
    console.log(`\nPerforming simple swap: ${ethers.formatUnits(amountIn)} WGLMR -> DOT with 5% slippage`);
    await swapExactInputSingle(WGLMR, DOT, amountIn, 5); // 5% slippage
    
    // Multi-hop swap (only if USDT is defined)
    if (USDT) {
      console.log(`\nPerforming multi-hop swap: ${ethers.formatUnits(amountIn)} WGLMR -> DOT -> USDT with 5% slippage`);
      const tokensPath = [WGLMR, DOT, USDT];
      const fees = [3000, 500]; // Fee tiers in basis points
      await swapExactInputMultihop(tokensPath, fees, amountIn, 5);
    }
    
    console.log('\nSwap operations completed successfully!');
  } catch (error) {
    console.error('Error performing swaps:', error);
  }
}

main();
```

## Troubleshooting

### Common Issues

1. **"Error: PRIVATE_KEY environment variable is required"**
   - Make sure you've created a `.env` file with your private key
   - Ensure the private key is correctly formatted (with or without '0x' prefix)

2. **"Error: PROVIDER_CONTRACT_ADDRESS environment variable is required"**
   - Make sure you've set the contract addresses in your `.env` file

3. **Connection Issues**
   - Check that the RPC_URL in your `.env` file is correct and the node is accessible
   - Try using a different RPC provider if you're experiencing connection timeouts

4. **Transaction Errors**
   - Ensure your wallet has sufficient funds for transactions
   - Check that the contract addresses are correct and deployed on the network you're connecting to

### Getting Help

If you encounter issues not covered here, please:
1. Check the contract's documentation
2. Review the error messages carefully, they often provide useful information
3. Open an issue on the GitHub repository with details about the problem

## Note on Mock Functions

Some functions in `liquidity-swapper.js` use mock implementations for price quotes:

- `getEstimatedOutput`
- `getEstimatedInput`
- `getEstimatedMultihopOutput`
- `getEstimatedMultihopInput`

In a production environment, these should be replaced with actual price oracle calls or on-chain quote functions. 