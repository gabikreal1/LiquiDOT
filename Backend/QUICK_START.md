# 🎯 Quick Start Guide

**⚡ Get your NestJS backend running in 5 minutes!**

---

## Prerequisites

- Node.js 18+ installed
- Docker & Docker Compose installed
- Your smart contracts deployed to AssetHub & Moonbeam

---

## 1️⃣ One-Command Setup

```bash
cd Backend

# Extract contract ABIs first
./extract-abis.sh

# Run complete setup
./complete-setup.sh
```

This will:
- ✅ Install all dependencies
- ✅ Start PostgreSQL
- ✅ Run database migrations
- ✅ Start backend in development mode

**Done!** Access your API at http://localhost:3001/api

---

## 2️⃣ Manual Setup (if scripts fail)

```bash
cd Backend

# 1. Install dependencies
npm install

# 2. Extract ABIs (requires jq: brew install jq)
cd ../SmartContracts
npx hardhat compile
cd ../Backend
# Manually copy ABIs from artifacts/ to src/modules/blockchain/abis/

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Start database
docker-compose up postgres -d

# 5. Run migrations
npm run typeorm migration:generate -- src/migrations/InitialSchema
npm run typeorm migration:run

# 6. Start backend
npm run start:dev
```

---

## 3️⃣ Test It Works

```bash
# Health check
curl http://localhost:3001/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-..."}
```

---

## 4️⃣ Next Steps

### Implement Remaining Services

The core blockchain services are done! Now implement business logic:

```bash
# Generate remaining modules
npx @nestjs/cli g module modules/users
npx @nestjs/cli g module modules/pools
npx @nestjs/cli g module modules/positions
npx @nestjs/cli g module modules/investment-decision
npx @nestjs/cli g module modules/stop-loss-worker

# Generate services
npx @nestjs/cli g service modules/users/users
npx @nestjs/cli g service modules/pools/pools
npx @nestjs/cli g service modules/positions/positions
npx @nestjs/cli g service modules/investment-decision/investment-decision-worker
npx @nestjs/cli g service modules/stop-loss-worker/stop-loss-worker

# Generate controllers
npx @nestjs/cli g controller modules/users/users --flat
npx @nestjs/cli g controller modules/pools/pools --flat
npx @nestjs/cli g controller modules/positions/positions --flat
```

See **NEXT_STEPS.md** for implementation examples!

---

## 5️⃣ Key Files Reference

| File | Purpose |
|------|---------|
| `NEXT_STEPS.md` | Complete implementation guide with code examples |
| `PRD.md` | Product requirements + Mermaid diagrams |
| `IMPLEMENTATION_SUMMARY.md` | What's been created overview |
| `.env.example` | Environment variables template |
| `src/modules/blockchain/services/asset-hub.service.ts` | AssetHub contract wrapper |
| `src/modules/blockchain/services/moonbeam.service.ts` | Moonbeam contract wrapper |

---

## 6️⃣ Environment Variables

Edit `.env` with your values:

```env
# PostgreSQL
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=liquidot
DATABASE_PASSWORD=liquidot_password
DATABASE_NAME=liquidot_db

# AssetHub (Parachain 1000)
ASSETHUB_RPC_URL=https://assethub-polkadot-rpc.polkadot.io
ASSETHUB_VAULT_ADDRESS=0xYourAssetHubVaultAddress

# Moonbeam (Parachain 2004)
MOONBEAM_RPC_URL=https://rpc.api.moonbeam.network
MOONBEAM_XCM_PROXY_ADDRESS=0xYourMoonbeamProxyAddress

# Relayer Wallet (for submitting transactions)
RELAYER_PRIVATE_KEY=0xYourPrivateKeyHere

# API
PORT=3001
NODE_ENV=development
```

---

## 7️⃣ Useful Commands

```bash
# Development
npm run start:dev          # Start with hot-reload
npm run build              # Build for production
npm run start:prod         # Start production build

# Database
npm run typeorm migration:generate -- src/migrations/MigrationName
npm run typeorm migration:run
npm run typeorm migration:revert

# Docker
docker-compose up          # Start all services
docker-compose up -d       # Start in background
docker-compose logs -f     # Follow logs
docker-compose down        # Stop all services

# Testing
npm run test               # Unit tests
npm run test:e2e           # E2E tests
npm run test:cov           # Coverage report
```

---

## 8️⃣ API Endpoints

Once implemented, your API will have:

```
GET    /api/health                           # Health check
GET    /api/pools                            # List top pools
GET    /api/pools/:id                        # Get pool details
GET    /api/positions/:userAddress           # Get user positions
POST   /api/investment/decisions             # Create investment
GET    /api/users/:address/preferences       # Get preferences
PUT    /api/users/:address/preferences       # Update preferences
```

---

## 9️⃣ Architecture Overview

```
┌─────────────┐
│  Frontend   │
│  (Next.js)  │
└──────┬──────┘
       │ HTTP REST
       ↓
┌─────────────────────────────────────┐
│         NestJS Backend              │
│                                     │
│  ┌─────────────┐  ┌──────────────┐│
│  │ Controllers │→ │  Services    ││
│  └─────────────┘  └──────┬───────┘│
│                          │         │
│  ┌─────────────┐  ┌──────▼───────┐│
│  │   Workers   │  │  Blockchain  ││
│  │  (Cron)     │  │   Services   ││
│  └─────────────┘  └──────┬───────┘│
│                          │         │
│  ┌─────────────┐         │        │
│  │  PostgreSQL │         │        │
│  │  (TypeORM)  │         │        │
│  └─────────────┘         │        │
└────────────────────────┬─┴────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
     ┌──────▼──────┐         ┌───────▼──────┐
     │  AssetHub   │   XCM   │   Moonbeam   │
     │  Parachain  │◄───────►│  Parachain   │
     │   (1000)    │         │    (2004)    │
     └─────────────┘         └──────────────┘
```

---

## 🔟 Troubleshooting

### Port 3001 already in use
```bash
lsof -ti:3001 | xargs kill -9
```

### Database connection fails
```bash
docker-compose logs postgres
docker-compose restart postgres
```

### TypeScript errors after npm install
```bash
npm run build  # Should compile without errors
```

### ABIs not working
Check you copied the full "abi" array from:
- `SmartContracts/artifacts/contracts/V1(Current)/AssetHubVault.sol/AssetHubVault.json`
- `SmartContracts/artifacts/contracts/V1(Current)/XCMProxy.sol/XCMProxy.json`

---

## 📚 Need Help?

1. **Read NEXT_STEPS.md** - Complete implementation guide
2. **Check PRD.md** - Contract function signatures
3. **Review service code** - Inline comments explain everything

---

**🎉 Happy coding! Your backend structure is ready to go!**
