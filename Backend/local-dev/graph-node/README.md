# Local Graph Node (Moonbase Alpha)

This is a small helper stack for running a **local Graph Node** (graph-node + postgres + ipfs) so the LiquiDOT backend can ingest pool data from a locally deployed Algebra subgraph.

## Start

```zsh
docker compose up -d
```

## Endpoints

- GraphQL (query): `http://localhost:8000`  
- Graph Node admin (deploy): `http://localhost:8020`  
- IPFS API: `http://localhost:5001`

## Deploy the Algebra analytics subgraph

Pull the upstream repo:
- https://github.com/cryptoalgebra/Algebra_Subgraph

Then follow their README “Deploy to Custom Graph Node”, using the local endpoints above.

Once deployed, set in `Backend/.env`:

```env
ALGEBRA_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/<you>/<subgraph-name>
```

## Verify from backend

- `GET /api/pools/sync/status`
- `POST /api/pools/sync`
- `GET /api/pools`
