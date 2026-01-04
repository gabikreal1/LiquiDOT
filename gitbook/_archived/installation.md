---
icon: download
---

# Installation

Set up LiquiDOT for local development.

> Note: this page lives under `gitbook/_archived/` for history, but the instructions below are updated for the current repository.

## Prerequisites

- Node.js 18+
- npm (or pnpm)
- Git
- Docker (recommended for Postgres + Graph Node)

```bash
node --version
npm --version
git --version
docker --version
```

## Clone the repository

```bash
git clone https://github.com/gabikreal1/LiquiDOT.git
cd LiquiDOT
```

## Project structure

```
LiquiDOT/
├── Frontend/           # Next.js web interface
├── Backend/            # NestJS API + pool sync + decision engine
├── SmartContracts/     # Solidity contracts + tests
└── gitbook/            # Documentation sources
```

## Smart contracts

### Install

```bash
cd SmartContracts
npm install
```

### Configure

```bash
cp .env.example .env
```

Configure the chain RPCs and private keys in `SmartContracts/.env`.

> Never commit `.env` files or private keys.

### Test

```bash
npm test
```

### Deploy

See:
- `SmartContracts/README.md`
- `SmartContracts/scripts/README.md`

## Subgraph (pool data)

Pool discovery/analytics are ingested from an Algebra analytics subgraph.

### Option A: run your own Graph Node (recommended for reviewers)

See:
- `Backend/local-dev/graph-node/README.md`

Start the local Graph Node stack:

```bash
cd Backend/local-dev/graph-node
docker compose up -d
```

Deploy the Algebra subgraph to your local Graph Node (per upstream Algebra_Subgraph docs). Once deployed, you should have a GraphQL endpoint like:

```
http://localhost:8000/subgraphs/name/<you>/<subgraph-name>
```

### Option B: use an existing hosted Graph endpoint

If you already have a deployed subgraph endpoint, you can use that URL instead.

## Backend

### Install

```bash
cd Backend
npm install
```

### Configure

The backend is configured via environment variables.

```bash
cp .env.example .env
```

At minimum, configure these in `Backend/.env`:

```bash
# RPCs (two chains)
ASSETHUB_RPC_URL=wss://paseo-asset-hub-rpc.polkadot.io
MOONBEAM_RPC_URL=https://rpc.api.moonbase.moonbeam.network

# Deployed contracts
ASSETHUB_VAULT_ADDRESS=0x...
MOONBEAM_XCM_PROXY_ADDRESS=0x...

# Relayer key (never commit)
RELAYER_PRIVATE_KEY=...

# Pools ingestion
ALGEBRA_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/<you>/<subgraph-name>

# Optional: candidate tokens to resolve supported token names (comma-separated)
TOKEN_CANDIDATES=0x...,0x...
```

### Database

For local development, the easiest path is to use the Docker Compose stack in the `Backend/` folder (see `Backend/QUICK_START.md`).

### Run

```bash
npm run start:dev
```

### Verify

```bash
curl http://localhost:3001/api/health
```

### Pool sync (manual trigger)

```bash
# Check sync configuration
curl http://localhost:3001/api/pools/sync/status

# Trigger a manual sync
curl -X POST http://localhost:3001/api/pools/sync

# List pools
curl http://localhost:3001/api/pools
```

## Frontend

### Install

```bash
cd Frontend
npm install
```

### Configure

Set your API base URL to the backend:

```bash
# example
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Run

```bash
npm run dev
```

## Testing

### Smart contracts

```bash
cd SmartContracts
npm test
```

### Backend

```bash
cd Backend
npm test
npm run test:e2e
```

## Getting help

- Docs: https://liquidot.gitbook.io/liquidot-docs
- Issues: https://github.com/gabikreal1/LiquiDOT/issues
- Email: gabrielsoftware04@gmail.com

**Database Connection Error:**
```bash
# Verify PostgreSQL is running
brew services start postgresql@15

# Check connection
psql -h localhost -U liquidot_user -d liquidot
```

**Frontend Build Error:**
```bash
# Clear cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

## Next Steps

<table data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><strong>Deploy Contracts</strong></td><td>Follow the deployment guide</td><td><a href="../basics/contract-deployment.md">contract-deployment.md</a></td></tr><tr><td><strong>Run Tests</strong></td><td>Verify your installation</td><td><a href="../basics/testing-guide.md">testing-guide.md</a></td></tr><tr><td><strong>Explore Architecture</strong></td><td>Understand the system</td><td><a href="../basics/architecture.md">architecture.md</a></td></tr></tbody></table>

## Getting Help

* 📖 [Documentation](https://docs.liquidot.xyz)
* 💬 [Discord Community](https://discord.gg/liquidot)
* 🐛 [GitHub Issues](https://github.com/gabikreal1/LiquiDOT/issues)
* 📧 [Email Support](mailto:gabrielsoftware04@gmail.com)
