# LiquiDOT Local Development Environment

## 🚀 Quick Start

This guide will help you set up a complete local development environment for LiquiDOT with local Asset Hub, Moonbeam, and XCM relayer nodes.

### Prerequisites

- **Docker & Docker Compose** - For running local nodes
- **Node.js 18+** - For contract development and testing
- **Git** - For version control
- **Windows PowerShell** - For running setup scripts

### 1. Initial Setup

```bash
# Run the setup script to create the local environment
./scripts/setup-local-dev.sh
```

This will create:
- Docker Compose configuration
- Local node directories
- Environment configuration files
- Deployment scripts

### 2. Start Local Environment

```bash
# Start all local services
./start-local-dev.sh
```

This starts:
- **Asset Hub Local Node** (ws://localhost:9944)
- **Moonbeam Local Node** (ws://localhost:9945)
- **XCM Relayer** (http://localhost:8000)
- **PostgreSQL Database** (localhost:5432)
- **Redis Cache** (localhost:6379)

### 3. Deploy Contracts

```bash
# Deploy contracts to local nodes
./deploy-local-contracts.sh
```

This deploys:
- Asset Hub Vault contract to local Asset Hub
- XCM Proxy contract to local Moonbeam

### 4. Test the Setup

```bash
# Test all components
node scripts/test-local-setup.js
```

## 🌐 Local Services Overview

### Asset Hub Local Node
- **RPC URL:** ws://localhost:9944
- **HTTP URL:** http://localhost:9944
- **Chain ID:** 1000
- **Purpose:** Primary custody layer for user deposits

### Moonbeam Local Node
- **RPC URL:** ws://localhost:9945
- **HTTP URL:** http://localhost:9945
- **Chain ID:** 1284
- **Purpose:** DEX integration and LP position management

### XCM Relayer
- **URL:** http://localhost:8000
- **Purpose:** Cross-chain message routing between Asset Hub and Moonbeam

### Database Services
- **PostgreSQL:** localhost:5432 (liquidot_dev database)
- **Redis:** localhost:6379 (caching layer)

## 🔧 Development Workflow

### Smart Contract Development

1. **Edit contracts** in `SmartContracts/contracts/`
2. **Test locally** with `npx hardhat test`
3. **Deploy to local nodes** with deployment scripts
4. **Interact with contracts** using Hardhat console

```bash
# Deploy to local Asset Hub
npx hardhat run scripts/deploy-asset-hub-vault.js --network assetHubLocal

# Deploy to local Moonbeam
npx hardhat run scripts/deploy-xcm-proxy.js --network moonbeamLocal
```

### Backend Development

1. **Connect to local nodes** using environment variables
2. **Use local database** for development data
3. **Test XCM functionality** with local relayer

```bash
# Start backend with local configuration
cd Backend
npm install
npm run dev
```

### Frontend Development

1. **Connect to local nodes** for blockchain interactions
2. **Use local backend** for API calls
3. **Test cross-chain functionality**

```bash
# Start frontend with local configuration
cd Frontend
npm install
npm run dev
```

## 🛠️ Useful Commands

### Docker Management
```bash
# View all services
docker-compose ps

# View logs for specific service
docker-compose logs -f asset-hub-local
docker-compose logs -f moonbeam-local
docker-compose logs -f xcm-relayer

# Restart specific service
docker-compose restart postgres

# Stop all services
docker-compose down
```

### Database Access
```bash
# Connect to PostgreSQL
docker exec -it liquidot-postgres psql -U liquidot_user -d liquidot_dev

# Connect to Redis
docker exec -it liquidot-redis redis-cli
```

### Contract Interaction
```bash
# Hardhat console for local network
npx hardhat console --network assetHubLocal

# Run specific script
npx hardhat run scripts/deploy-asset-hub-vault.js --network assetHubLocal
```

## 📊 Monitoring & Debugging

### Node Status
```bash
# Check Asset Hub node
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system_chain","params":[],"id":1}' \
  http://localhost:9944

# Check Moonbeam node
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system_chain","params":[],"id":1}' \
  http://localhost:9945
```

### XCM Message Testing
```bash
# Test XCM relayer health
curl http://localhost:8000/health

# Monitor XCM messages
docker-compose logs -f xcm-relayer
```

### Database Monitoring
```bash
# Check PostgreSQL status
docker exec liquidot-postgres pg_isready -U liquidot_user

# Check Redis status
docker exec liquidot-redis redis-cli ping
```

## 🐛 Troubleshooting

### Common Issues

1. **Nodes not starting**
   ```bash
   # Check Docker resources
   docker system df
   
   # Restart Docker Desktop
   # Then restart services
   docker-compose down
   docker-compose up -d
   ```

2. **Contract deployment fails**
   ```bash
   # Ensure nodes are fully synced
   # Check node logs
   docker-compose logs -f asset-hub-local
   
   # Verify network configuration
   npx hardhat console --network assetHubLocal
   ```

3. **Database connection issues**
   ```bash
   # Check PostgreSQL container
   docker-compose logs postgres
   
   # Restart database
   docker-compose restart postgres
   ```

4. **XCM not working**
   ```bash
   # Check relayer configuration
   cat config/relayer.toml
   
   # Restart relayer
   docker-compose restart xcm-relayer
   ```

### Reset Environment

To completely reset the local environment:

```bash
# Stop all services
./stop-local-dev.sh

# Remove all data
docker-compose down -v
rm -rf local-nodes/*

# Restart fresh
./start-local-dev.sh
```

## 📁 File Structure

```
PolkadotHack2025/
├── docker-compose.yml          # Local services configuration
├── config/
│   └── relayer.toml           # XCM relayer configuration
├── local-nodes/               # Node data directories
│   ├── asset-hub/
│   ├── moonbeam/
│   ├── relayer/
│   ├── postgres/
│   └── redis/
├── scripts/
│   ├── setup-local-dev.sh     # Initial setup script
│   ├── start-local-dev.sh     # Start environment
│   ├── deploy-local-contracts.sh # Deploy contracts
│   ├── stop-local-dev.sh      # Stop environment
│   └── test-local-setup.js    # Test environment
├── SmartContracts/
│   ├── hardhat.config.js      # Updated with local networks
│   ├── contracts/
│   │   ├── AssetHubVault.sol  # Asset Hub contract
│   │   └── XCMProxy.sol       # Moonbeam contract
│   └── scripts/
│       ├── deploy-asset-hub-vault.js
│       └── deploy-xcm-proxy.js
└── .env.local                 # Local environment variables
```

## 🔄 Environment Variables

The `.env.local` file contains:

```bash
# Database Configuration
DATABASE_URL=postgresql://liquidot_user:liquidot_password@localhost:5432/liquidot_dev
REDIS_URL=redis://localhost:6379

# Local Node URLs
ASSET_HUB_LOCAL_WS=ws://localhost:9944
ASSET_HUB_LOCAL_HTTP=http://localhost:9944
MOONBEAM_LOCAL_WS=ws://localhost:9945
MOONBEAM_LOCAL_HTTP=http://localhost:9945

# XCM Relayer
XCM_RELAYER_URL=http://localhost:8000

# Development Accounts
DEV_ALICE_PRIVATE_KEY=0xe5be9a5092b81b6d65882121460a8761541d9f6f
DEV_BOB_PRIVATE_KEY=0x398f0c28f98885e046333d4a41c19cee4c37368a

# Contract Addresses (populated after deployment)
ASSET_HUB_VAULT_ADDRESS=
XCM_PROXY_ADDRESS=
```

## 🎯 Benefits of Local Development

1. **Faster Testing** - No network delays or gas costs
2. **Full Control** - Complete control over node state and data
3. **Isolated Environment** - No interference from other developers
4. **Cost Effective** - No testnet fees or token requirements
5. **Reliable** - No dependency on external network stability
6. **Debugging** - Easy to trace and debug issues

## 📈 Performance Expectations

- **Node Sync Time:** 2-5 minutes for initial startup
- **Contract Deployment:** <30 seconds per contract
- **XCM Message Processing:** <10 seconds
- **Database Queries:** <100ms average
- **Overall Setup Time:** 5-10 minutes for complete environment

## 🔗 Next Steps

After setting up the local environment:

1. **Deploy contracts** to local nodes
2. **Test XCM functionality** between Asset Hub and Moonbeam
3. **Develop backend services** with local database
4. **Build frontend** with local blockchain connections
5. **Test complete workflow** from deposit to LP position creation

This local development environment provides a solid foundation for rapid development and testing of the LiquiDOT cross-chain liquidity management system. 