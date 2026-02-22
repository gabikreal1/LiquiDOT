/**
 * Moonbeam Mainnet Production Deployment Script
 * 
 * This script deploys the XCMProxy infrastructure to Moonbeam Mainnet and connects it 
 * to the verified StellaSwap V4 (Algebra Integral) DEX contracts.
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-moonbeam-mainnet.js --network moonbeam
 * 
 * Prerequisites:
 *   - MOON_PK set in .env (for Moonbeam Mainnet)
 *   - GLMR tokens for gas
 */

const { ethers } = require("hardhat");
const { deployXCMProxy } = require("../test/helpers/deploy-xcm-proxy");
const fs = require("fs");
const path = require("path");

// ============================================================================
// MOONBEAM MAINNET CONFIGURATION
// ============================================================================

// StellaSwap V4 (Algebra Integral 1.2) Contract Addresses on Moonbeam Mainnet
// Verified via algebra.finance and block explorer
const STELLASWAP_V4 = {
    Factory: "0x90dD87C994959A36d725bB98F9008B0b3C3504A0",
    Router: "0x217fd038FF2ac580de8E635a5d726f6f0E5214e3",
    Quoter: "0x8f55D600eD3f79fB300beac0400C44C8cC6eb728",
    NFPM: "0x26c48519bBCf6df3E39d4C724ff82B6F060D3Bbe" // Updated from web search
};

const MOONBEAM_PRECOMPILES = {
    xcmPallet: "0x000000000000000000000000000000000000081A",
    xcmTransactor: "0x0000000000000000000000000000000000000806",
};

const ASSET_HUB_PARAID = 1000;

// Main Deployment Function
async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      LiquiDOT Moonbeam Mainnet Deployment Script          ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("📋 Deployment Info:");
    console.log(`   Network: ${network.name}`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Deployer: ${deployer.address}`);

    if (network.chainId !== 1284n) {
        console.warn("⚠️  WARNING: You are NOT on chainId 1284 (Moonbeam). Proceeding anyway...");
    }

    // Deploy XCMProxy linked to StellaSwap V4
    console.log("\n🚀 Deploying XCMProxy...");
    const xcmpResult = await deployXCMProxy({
        owner: deployer.address,
        operator: deployer.address, // Initially deployer is operator
        quoter: STELLASWAP_V4.Quoter,
        router: STELLASWAP_V4.Router,
        nfpm: STELLASWAP_V4.NFPM,
        xcmPrecompile: MOONBEAM_PRECOMPILES.xcmPallet,
        xcmTransactor: MOONBEAM_PRECOMPILES.xcmTransactor,
        assetHubParaId: ASSET_HUB_PARAID,
        defaultSlippageBps: 100, // 1%
        saveState: true,
    });

    const xcmProxyAddress = xcmpResult.address;

    console.log("\n" + "=".repeat(60) + "\n");
    console.log("✅ Deployment Complete!");
    console.log(`   XCMProxy: ${xcmProxyAddress}`);
    console.log(`   Linked Factory: ${STELLASWAP_V4.Factory}`);
    console.log(`   Linked Router: ${STELLASWAP_V4.Router}`);
    console.log(`   Linked NFPM: ${STELLASWAP_V4.NFPM}`);

    // Save Contract Address for Frontend/Backend usage
    saveDeploymentInfo(xcmProxyAddress, STELLASWAP_V4);
}

function saveDeploymentInfo(proxyAddress, algebraAddresses) {
    try {
        const deploymentsDir = path.join(__dirname, "../deployments");
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        const bootstrap = {
            network: "moonbeam",
            chainId: 1284,
            xcmProxy: {
                address: proxyAddress,
                assetHubParaId: ASSET_HUB_PARAID,
            },
            algebra: {
                factory: algebraAddresses.Factory,
                router: algebraAddresses.Router,
                quoter: algebraAddresses.Quoter,
                nfpm: algebraAddresses.NFPM
            },
            timestamp: new Date().toISOString()
        };

        const filePath = path.join(deploymentsDir, "moonbeam_mainnet_deployment.json");
        fs.writeFileSync(filePath, JSON.stringify(bootstrap, null, 2));
        console.log(`\n💾 Deployment info saved to: ${filePath}`);

    } catch (e) {
        console.warn("\n⚠️  Failed to save deployment info:", e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
