#!/bin/bash

# LiquiDOT Local Development Setup Script
echo "🚀 Setting up LiquiDOT local development environment..."

# Create necessary directories
echo "📁 Creating directory structure..."
mkdir -p local-nodes/asset-hub
mkdir -p local-nodes/moonbeam
mkdir -p local-nodes/relayer
mkdir -p local-nodes/postgres
mkdir -p local-nodes/redis
mkdir -p config

# Create .env file for local development
echo "🔧 Creating environment configuration..."
cat > .env.local << EOF
# Local Development Environment Variables

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

# Development Accounts (Alice and Bob from Substrate)
DEV_ALICE_PRIVATE_KEY=0xe5be9a5092b81b6d65882121460a8761541d9f6f
DEV_BOB_PRIVATE_KEY=0x398f0c28f98885e046333d4a41c19cee4c37368a

# Contract Addresses (will be populated after deployment)
ASSET_HUB_VAULT_ADDRESS=
XCM_PROXY_ADDRESS=

# API Keys (for external services when needed)
POLKADOT_API_KEY=
MOONBEAM_API_KEY=
EOF

# Create a script to start the local environment
cat > start-local-dev.sh << 'EOF'
#!/bin/bash

echo "🌐 Starting LiquiDOT local development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start the local nodes and services
echo "📦 Starting local nodes and services..."
docker-compose up -d

# Wait for nodes to be ready
echo "⏳ Waiting for nodes to be ready..."
sleep 30

# Check if nodes are responding
echo "🔍 Checking node connectivity..."

# Check Asset Hub
if curl -s -X POST -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"system_chain","params":[],"id":1}' \
    http://localhost:9944 > /dev/null 2>&1; then
    echo "✅ Asset Hub local node is running"
else
    echo "❌ Asset Hub local node is not responding"
fi

# Check Moonbeam
if curl -s -X POST -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"system_chain","params":[],"id":1}' \
    http://localhost:9945 > /dev/null 2>&1; then
    echo "✅ Moonbeam local node is running"
else
    echo "❌ Moonbeam local node is not responding"
fi

# Check PostgreSQL
if docker exec liquidot-postgres pg_isready -U liquidot_user > /dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not responding"
fi

# Check Redis
if docker exec liquidot-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "❌ Redis is not responding"
fi

echo ""
echo "🎉 Local development environment is ready!"
echo ""
echo "📊 Service URLs:"
echo "   Asset Hub RPC: ws://localhost:9944"
echo "   Moonbeam RPC:  ws://localhost:9945"
echo "   PostgreSQL:     localhost:5432"
echo "   Redis:         localhost:6379"
echo "   XCM Relayer:   http://localhost:8000"
echo ""
echo "🔧 Next steps:"
echo "   1. Deploy contracts to local nodes"
echo "   2. Run backend services"
echo "   3. Start frontend development server"
echo ""
echo "📝 To stop the environment: docker-compose down"
EOF

chmod +x start-local-dev.sh

# Create a script to deploy contracts to local nodes
cat > deploy-local-contracts.sh << 'EOF'
#!/bin/bash

echo "📦 Deploying contracts to local nodes..."

# Navigate to SmartContracts directory
cd SmartContracts

# Deploy to local Asset Hub
echo "🏦 Deploying Asset Hub Vault to local Asset Hub..."
npx hardhat run scripts/deploy-asset-hub-vault.js --network assetHubLocal

# Deploy to local Moonbeam
echo "🌙 Deploying XCM Proxy to local Moonbeam..."
npx hardhat run scripts/deploy-xcm-proxy.js --network moonbeamLocal

echo "✅ Contract deployment completed!"
echo ""
echo "📋 Update your .env.local file with the deployed contract addresses"
EOF

chmod +x deploy-local-contracts.sh

# Create a script to stop the local environment
cat > stop-local-dev.sh << 'EOF'
#!/bin/bash

echo "🛑 Stopping LiquiDOT local development environment..."

# Stop all services
docker-compose down

echo "✅ Local development environment stopped"
EOF

chmod +x stop-local-dev.sh

# Create a development README
cat > LOCAL_DEVELOPMENT.md << 'EOF'
# LiquiDOT Local Development Guide

## 🚀 Quick Start

1. **Start the local environment:**
   ```bash
   ./start-local-dev.sh
   ```

2. **Deploy contracts to local nodes:**
   ```bash
   ./deploy-local-contracts.sh
   ```

3. **Update environment variables:**
   Edit `.env.local` with the deployed contract addresses

4. **Start backend services:**
   ```bash
   cd Backend
   npm install
   npm run dev
   ```

5. **Start frontend:**
   ```bash
   cd Frontend
   npm install
   npm run dev
   ```

## 🌐 Local Services

- **Asset Hub Node:** ws://localhost:9944
- **Moonbeam Node:** ws://localhost:9945
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379
- **XCM Relayer:** http://localhost:8000

## 🔧 Development Workflow

1. **Contract Development:**
   - Edit contracts in `SmartContracts/contracts/`
   - Test with `npx hardhat test`
   - Deploy with `npx hardhat run scripts/deploy-*.js --network [network]`

2. **Backend Development:**
   - Services connect to local nodes automatically
   - Database migrations run automatically
   - Real-time updates via WebSocket

3. **Frontend Development:**
   - Connects to local nodes for blockchain interactions
   - Hot reload for development
   - Mock data available for testing

## 🛠️ Useful Commands

- **View logs:** `docker-compose logs -f [service]`
- **Restart service:** `docker-compose restart [service]`
- **Access database:** `docker exec -it liquidot-postgres psql -U liquidot_user -d liquidot_dev`
- **Access Redis:** `docker exec -it liquidot-redis redis-cli`

## 🐛 Troubleshooting

1. **Nodes not starting:** Check Docker resources and restart
2. **Contract deployment fails:** Ensure nodes are fully synced
3. **Database connection issues:** Check PostgreSQL container status
4. **XCM not working:** Verify relayer configuration and node connectivity

## 📊 Monitoring

- **Node Status:** Check container logs
- **Database:** Use pgAdmin or direct psql connection
- **XCM Messages:** Monitor relayer logs
- **Performance:** Use Docker stats

## 🔄 Reset Environment

To completely reset the local environment:

```bash
./stop-local-dev.sh
docker-compose down -v
rm -rf local-nodes/*
./start-local-dev.sh
```
EOF

echo "✅ Local development environment setup completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Run: ./start-local-dev.sh"
echo "   2. Run: ./deploy-local-contracts.sh"
echo "   3. Update .env.local with contract addresses"
echo "   4. Start your backend and frontend services"
echo ""
echo "📖 See LOCAL_DEVELOPMENT.md for detailed instructions" 