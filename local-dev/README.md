# LiquiDOT Local Development Environment

This directory contains everything needed to run a complete local development environment for LiquiDOT with local Asset Hub, Moonbeam, and XCM relayer nodes.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Git

### 1. Initial Setup
```bash
# Run the setup script
./scripts/setup-local-dev.sh
```

### 2. Start Local Environment
```bash
# Start all services
./scripts/start-local-dev.sh
```

### 3. Deploy Contracts
```bash
# Deploy contracts to local nodes
./scripts/deploy-local-contracts.sh
```

### 4. Test the Setup
```bash
# Test all components
node scripts/test-local-setup.js
```

## 📁 Directory Structure

```
local-dev/
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
└── README.md                  # This file
```

## 🌐 Local Services

- **Asset Hub Node:** ws://localhost:9944
- **Moonbeam Node:** ws://localhost:9945
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379
- **XCM Relayer:** http://localhost:8000

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
cd ../SmartContracts
npx hardhat console --network assetHubLocal

# Run specific script
npx hardhat run scripts/deploy-asset-hub-vault.js --network assetHubLocal
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
   cd ../SmartContracts
   npx hardhat console --network assetHubLocal
   ```

3. **Database connection issues**
   ```bash
   # Check PostgreSQL container
   docker-compose logs postgres
   
   # Restart database
   docker-compose restart postgres
   ```

### Reset Environment

To completely reset the local environment:

```bash
# Stop all services
./scripts/stop-local-dev.sh

# Remove all data
docker-compose down -v
rm -rf local-nodes/*

# Restart fresh
./scripts/start-local-dev.sh
```

## 📊 Monitoring

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

## 🎯 Benefits

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

For detailed documentation, see `LOCAL_DEVELOPMENT_SETUP.md`. 