# LiquiDOT Backend — Milestone 2 Ops PRD (Local Graph Node + Algebra Subgraph)

**Status:** Draft (submission-ready addendum)

This PRD addendum describes the **operational deliverable** required to make Milestone 2’s pool aggregation reproducible in a reviewer environment:

- Run a **local Graph Node** stack (graph-node + postgres + ipfs)
- Deploy **Algebra analytics subgraph** (from `cryptoalgebra/Algebra_Subgraph`) to that node
- Point the LiquiDOT backend pool aggregator at that local GraphQL endpoint
- Manually trigger and verify pool syncing via API

This is designed for **Moonbase Alpha (testnet)**.

---

## 🎯 Goals

1. **Reproducible pool aggregation**: a reviewer can run the subgraph and see pools populate in Postgres.
2. **Separation of concerns**: subgraph runs independently of backend.
3. **Ops ergonomics**: one endpoint to trigger sync + one endpoint to confirm configuration.

---

## Non-goals

- Shipping the Algebra subgraph code inside this repository.
- Guaranteeing production-grade indexing performance.
- Indexing mainnet (Moonbeam) as part of M2.

---

## System overview

### Components

- **Graph Node stack (external)**
  - `graphprotocol/graph-node`
  - `postgres` (Graph Node’s DB)
  - `ipfs` (stores subgraph files)

- **Algebra analytics subgraph (external repo)**
  - Source: https://github.com/cryptoalgebra/Algebra_Subgraph
  - Subgraph: `analytics`
  - Network: Moonbase Alpha

- **LiquiDOT backend (this repo)**
  - Module: `src/modules/pools/pool-scanner.service.ts`
  - API endpoints:
    - `GET /api/pools` and `GET /api/pools/:id`
    - `POST /api/pools/sync` (manual trigger)
    - `GET /api/pools/sync/status`

---

## Configuration

### Backend environment variables

- `ALGEBRA_SUBGRAPH_URL` (required for pool syncing)
  - Example:
    - `http://localhost:8000/subgraphs/name/<you>/<subgraph-name>`

Optional:
- `POOL_UPDATE_INTERVAL` (used by other deployment modes; current scanner uses a fixed interval inside service)

### Graph Node endpoints

- GraphQL query endpoint:
  - `http://localhost:8000/subgraphs/name/<you>/<subgraph-name>`
- Graph Node deploy/admin endpoint:
  - `http://localhost:8020`
- IPFS API:
  - `http://localhost:5001`

---

## Functional requirements

### FR-OPS-1 — Manual pool sync
- Backend exposes `POST /api/pools/sync`
- Calling this endpoint triggers `PoolScannerService.syncPools()` once

### FR-OPS-2 — Sync status
- Backend exposes `GET /api/pools/sync/status`
- Response includes:
  - whether syncing is configured (`configured`)
  - configured GraphQL endpoint (`subgraphUrl`)

### FR-OPS-3 — Pools listing
- Backend exposes `GET /api/pools`
- Returns pools stored in backend Postgres

---

## Acceptance criteria

### AC-OPS-1: Graph Node stack can be started locally
- Reviewer can boot graph-node + postgres + ipfs (Docker Compose is acceptable)

### AC-OPS-2: Algebra analytics subgraph can be deployed to the local node
- Using the upstream `Algebra_Subgraph` repo, reviewer can:
  - configure a Moonbase network profile
  - run `prepare-network`
  - deploy the `analytics` subgraph to the local graph-node

### AC-OPS-3: Backend can sync pools from the local Graph Node
- With `ALGEBRA_SUBGRAPH_URL` set to the local endpoint:
  - calling `POST /api/pools/sync` returns `{ ok: true }`
  - backend persists pools into Postgres

### AC-OPS-4: Automated tests exist for the ops endpoints
- E2E tests validate:
  - `GET /api/pools/sync/status` returns a reasonable object
  - `POST /api/pools/sync` returns `{ ok: true }` and does not require live infra

---

## Test plan

### E2E tests (deterministic)

- `GET /api/pools/sync/status`
  - asserts `configured` is boolean and `subgraphUrl` is present or null

- `POST /api/pools/sync`
  - asserts `{ ok: true }`
  - uses mocked `PoolScannerService` (no GraphQL calls)

---

## Rollout / Ops checklist

1. Start Graph Node stack (Docker Compose)
2. Pull `cryptoalgebra/Algebra_Subgraph`
3. Create network config folder (Moonbase Alpha)
4. Run `yarn prepare-network <your-network-profile>`
5. Deploy `analytics` to your local node
6. Set backend `ALGEBRA_SUBGRAPH_URL`
7. Start backend with Postgres
8. Call `GET /api/pools/sync/status`
9. Call `POST /api/pools/sync`
10. Call `GET /api/pools`

---

## Risks & mitigations

- **Missing Moonbase contract addresses / startBlock**
  - Mitigation: document the exact deployed factory/position-manager addresses and the deployment block.

- **Graph Node indexing lag**
  - Mitigation: keep testnet scope (Moonbase) and limit pool queries to top pools.

- **Backend / graph-node networking mismatch**
  - Mitigation: use explicit hostnames and ports; validate with `/api/pools/sync/status` before syncing.
