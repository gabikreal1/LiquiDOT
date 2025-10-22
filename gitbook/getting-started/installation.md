---
icon: download
---

# Installation

Set up LiquiDOT for local development or deployment. This guide covers both user and developer installation.

## For Users

### Web Interface (Recommended)

The easiest way to use LiquiDOT is through our web interface:

1. Visit [liquidot.xyz](https://liquidot.xyz) (coming soon)
2. Connect your Polkadot-compatible wallet
3. Start providing liquidity

**No installation required!**

### Wallet Setup

You'll need a compatible wallet:

**Recommended Wallets:**
* [Talisman](https://talisman.xyz/) - Multi-chain wallet with excellent UX
* [SubWallet](https://subwallet.app/) - Full-featured Polkadot wallet
* [Polkadot.js Extension](https://polkadot.js.org/extension/) - Official extension

**Mobile Support:**
* [Nova Wallet](https://novawallet.io/) - iOS & Android
* [SubWallet Mobile](https://subwallet.app/) - iOS & Android

## For Developers

### Prerequisites

Ensure you have the following installed:

```bash
# Node.js (v18+ required)
node --version

# npm or pnpm
npm --version
# or
pnpm --version

# Git
git --version
```

### Clone the Repository

```bash
git clone https://github.com/gabikreal1/LiquiDOT.git
cd LiquiDOT
```

### Project Structure

```
LiquiDOT/
├── Frontend/           # Next.js web interface
├── Backend/           # NestJS backend services
├── SmartContracts/    # Solidity contracts
├── DataAggregatorService/  # Pool analytics
├── docs/              # Documentation
└── gitbook/           # GitBook documentation
```

## Smart Contracts Setup

### Install Dependencies

```bash
cd SmartContracts
npm install
```

### Environment Configuration

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Private keys (without 0x prefix)
MOON=your_moonbase_private_key
ASSET=your_asset_hub_private_key

# Contract addresses (set after deployment)
ASSETHUB_CONTRACT=0x...
XCMPROXY_CONTRACT=0x...

# RPC endpoints
MOONBASE_RPC=https://rpc.api.moonbase.moonbeam.network
ASSETHUB_RPC=wss://paseo-asset-hub-rpc.polkadot.io
```

{% hint style="warning" %}
Never commit your `.env` file or private keys to version control!
{% endhint %}

### Get Testnet Tokens

**Moonbase DEV:**
```bash
# Visit https://faucet.moonbeam.network/
# Enter your Moonbase address
```

**Paseo DOT:**
```bash
# Visit https://faucet.paseo.network/
# Enter your Asset Hub address
```

### Deploy Contracts

Follow the [Contract Deployment Guide](../basics/contract-deployment.md) for detailed instructions.

Quick deployment:

```bash
# Deploy Asset Hub Vault (via Remix)
# See scripts/README.md for details

# Deploy Moonbase infrastructure
npm run deploy:moonbase

# Run tests
npm test
```

## Backend Setup

### Install Backend Dependencies

```bash
cd Backend
npm install
```

### Configure Backend

Create `config.json`:

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "liquidot",
    "username": "liquidot_user",
    "password": "your_password"
  },
  "contracts": {
    "assetHub": "0x...",
    "xcmProxy": "0x..."
  },
  "monitoring": {
    "interval": 12000,
    "chains": ["moonbase"]
  }
}
```

### Database Setup

```bash
# Install PostgreSQL
brew install postgresql@15  # macOS
# or
apt-get install postgresql  # Linux

# Create database
createdb liquidot

# Run migrations
npm run migrate
```

### Start Backend Services

```bash
# Start all services
npm run start

# Or start individually
npm run start:server          # API server
npm run start:decision-worker # Investment worker
npm run start:monitor         # Stop-loss monitor
```

## Frontend Setup

### Install Frontend Dependencies

```bash
cd Frontend
npm install
# or
pnpm install
```

### Configure Frontend

Create `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ASSETHUB_CONTRACT=0x...
NEXT_PUBLIC_XCMPROXY_CONTRACT=0x...
NEXT_PUBLIC_MOONBASE_RPC=https://rpc.api.moonbase.moonbeam.network
```

### Start Development Server

```bash
npm run dev
# or
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Data Aggregator Service

### Install Service Dependencies

```bash
cd DataAggregatorService
npm install
```

### Configure Service

```bash
cp env.example .env
```

Edit `.env`:

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=liquidot
POSTGRES_USER=liquidot_user
POSTGRES_PASSWORD=your_password

# API Keys (if needed)
COINGECKO_API_KEY=your_key
DEXSCREENER_API_KEY=your_key
```

### Start Aggregator

```bash
npm start

# Or run manual sync
npm run sync
```

## Verification

### Test Smart Contracts

```bash
cd SmartContracts

# Run full test suite
npm test

# Run specific tests
npm test -- test/AssetHubVault/
npm test -- test/XCMProxy/
npm test -- test/Integration/
```

### Test Backend

```bash
cd Backend

# Run tests
npm test

# Check services
curl http://localhost:3000/health
```

### Test Frontend

```bash
cd Frontend

# Run tests
npm test

# Build for production
npm run build
```

## Docker Deployment (Optional)

### Build Images

```bash
# Build all services
docker-compose build

# Or build individually
docker build -t liquidot-frontend ./Frontend
docker build -t liquidot-backend ./Backend
```

### Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Troubleshooting

### Common Issues

**Node.js Version Error:**
```bash
# Use Node 18+
nvm install 18
nvm use 18
```

**Contract Deployment Fails:**
```bash
# Check gas limits
# Verify RPC connection
# Ensure sufficient testnet tokens
```

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
