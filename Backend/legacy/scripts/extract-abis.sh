#!/bin/bash

# LiquiDOT Backend - Extract Contract ABIs
# This script compiles your Solidity contracts and extracts the ABIs

set -e

echo "🔧 Extracting Contract ABIs..."

# Navigate to SmartContracts directory
cd ../SmartContracts

# Compile contracts
echo "📦 Compiling contracts..."
npx hardhat compile

# Extract ABIs
echo "📝 Extracting ABIs..."

ASSETHUB_ABI=$(cat artifacts/contracts/V1\(Current\)/AssetHubVault.sol/AssetHubVault.json | jq '.abi')
XCMPROXY_ABI=$(cat artifacts/contracts/V1\(Current\)/XCMProxy.sol/XCMProxy.json | jq '.abi')

# Navigate back to Backend
cd ../Backend

# Create AssetHubVault ABI file
cat > src/modules/blockchain/abis/AssetHubVault.abi.ts << EOF
// Auto-generated from SmartContracts/contracts/V1(Current)/AssetHubVault.sol
// Generated: $(date)

export const AssetHubVaultABI = ${ASSETHUB_ABI};
EOF

# Create XCMProxy ABI file
cat > src/modules/blockchain/abis/XCMProxy.abi.ts << EOF
// Auto-generated from SmartContracts/contracts/V1(Current)/XCMProxy.sol
// Generated: $(date)

export const XCMProxyABI = ${XCMPROXY_ABI};
EOF

echo "✅ ABIs extracted successfully!"
echo "📁 Files created:"
echo "   - src/modules/blockchain/abis/AssetHubVault.abi.ts"
echo "   - src/modules/blockchain/abis/XCMProxy.abi.ts"
