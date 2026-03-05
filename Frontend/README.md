# Frontend

Next.js 15 DApp for LiquiDOT — deposit DOT, set LP preferences, and monitor positions in real time.

## Stack

- **Next.js 15** with App Router
- **Tailwind CSS** + **shadcn/ui** for styling
- **Wagmi v2** + **RainbowKit** for wallet connections (EVM + Substrate)
- **React Query** for server state
- **recharts** for portfolio visualizations

## Getting Started

```bash
pnpm install
pnpm run dev
```

Dev server runs at `http://localhost:3000`.

## Build

```bash
pnpm run build
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_ASSET_HUB_VAULT_ADDRESS` | AssetHubVault contract address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID |

## Supported Chains

| Chain | ID | Use |
|-------|----|-----|
| Asset Hub (Polkadot) | 420420419 | Deposits + custody |
| Moonbeam | 1284 | LP execution |
| Paseo Asset Hub (testnet) | 420420422 | Testnet deposits |
| Moonbase Alpha (testnet) | 1287 | Testnet execution |
