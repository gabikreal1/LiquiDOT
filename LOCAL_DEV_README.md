# LiquiDOT Local Development Setup

## 🚀 Quick Access

All local development files have been organized in the `local-dev/` directory for better project structure.

### To start local development:

```bash
# Navigate to local development directory
cd local-dev

# Run initial setup
./scripts/setup-local-dev.sh

# Start local environment
./scripts/start-local-dev.sh

# Deploy contracts
./scripts/deploy-local-contracts.sh

# Test setup
node scripts/test-local-setup.js
```

## 📁 Local Development Structure

```
PolkadotHack2025/
├── local-dev/                  # 🆕 Local development environment
│   ├── docker-compose.yml      # Local services configuration
│   ├── config/
│   │   └── relayer.toml       # XCM relayer configuration
│   ├── local-nodes/           # Node data directories
│   │   ├── asset-hub/
│   │   ├── moonbeam/
│   │   ├── relayer/
│   │   ├── postgres/
│   │   └── redis/
│   ├── scripts/
│   │   ├── setup-local-dev.sh
│   │   ├── start-local-dev.sh
│   │   ├── deploy-local-contracts.sh
│   │   ├── stop-local-dev.sh
│   │   └── test-local-setup.js
│   ├── README.md              # Local dev documentation
│   └── LOCAL_DEVELOPMENT_SETUP.md
├── SmartContracts/            # Contract development
├── Backend/                   # Backend services
├── Frontend/                  # Frontend application
└── ... (other project files)
```

## 🌐 Local Services Available

When running the local environment, you'll have access to:

- **Asset Hub Local Node:** ws://localhost:9944
- **Moonbeam Local Node:** ws://localhost:9945
- **PostgreSQL Database:** localhost:5432
- **Redis Cache:** localhost:6379
- **XCM Relayer:** http://localhost:8000

## 🔧 Development Workflow

1. **Start local environment** from `local-dev/` directory
2. **Deploy contracts** to local nodes
3. **Develop backend** connecting to local services
4. **Build frontend** with local blockchain connections
5. **Test complete workflow** from deposit to LP position creation

## 📖 Documentation

- **Quick Start:** `local-dev/README.md`
- **Detailed Guide:** `local-dev/LOCAL_DEVELOPMENT_SETUP.md`
- **Troubleshooting:** See local-dev documentation

## 🎯 Benefits

- **Faster Testing** - No network delays or gas costs
- **Full Control** - Complete control over node state and data
- **Isolated Environment** - No interference from other developers
- **Cost Effective** - No testnet fees or token requirements
- **Reliable** - No dependency on external network stability
- **Debugging** - Easy to trace and debug issues

## 🚀 Next Steps

1. Navigate to `local-dev/` directory
2. Follow the setup instructions in `local-dev/README.md`
3. Start developing with your local environment!

For detailed instructions, see `local-dev/README.md`. 