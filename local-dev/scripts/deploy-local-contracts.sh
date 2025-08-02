#!/bin/bash

echo "📦 Deploying contracts to local nodes..."

# Navigate to SmartContracts directory
cd ../SmartContracts

# Deploy to local Asset Hub
echo "🏦 Deploying Asset Hub Vault to local Asset Hub..."
npx hardhat run scripts/deploy-asset-hub-vault.js --network assetHubLocal

# Deploy to local Moonbeam
echo "🌙 Deploying XCM Proxy to local Moonbeam..."
npx hardhat run scripts/deploy-xcm-proxy.js --network moonbeamLocal

echo "✅ Contract deployment completed!"
echo ""
echo "📋 Update your .env.local file with the deployed contract addresses" 