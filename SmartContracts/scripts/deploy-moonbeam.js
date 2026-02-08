/**
 * Moonbeam Mainnet Production Deployment Script
 * 
 * This script deploys the XCMProxy infrastructure to Moonbeam Mainnet and connects it 
 * to the existing Stellaswap V4 (Algebra Integral) DEX contracts.
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-moonbeam.js --network moonbeam
 * 
 * Prerequisites:
 *   - MOON private key set in .env
 *   - GLMR tokens for gas
 */

const { ethers } = require("hardhat");
const { deployXCMProxy } = require("../test/helpers/deploy-xcm-proxy");
const fs = require("fs");
const path = require("path");

// ============================================================================
// MOONBEAM MAINNET CONFIGURATION
// ============================================================================

// Stellaswap V4 (Algebra Integral 1.2) Contract Addresses
const STELLASWAP_V4 = {
    Factory: "0x90dD87C994959A36d725bB98F9008B0b3C3504A0",
    Router: "0x217fd038FF2ac580de8E635a5d726f6f0E5214e3",
    Quoter: "0x8f55D600eD3f79fB300beac0400C44C8cC6eb728",
    NFPM: "0x1FF2ADAa387dD27c22b31086E658108588eDa03a"
};

const MOONBEAM_PRECOMPILES = {
    xTokens: "0x0000000000000000000000000000000000000804",
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

    // Deploy XCMProxy linked to Stellaswap V4
    console.log("\n🚀 Deploying XCMProxy...");
    const xcmpResult = await deployXCMProxy({
        owner: deployer.address,
        operator: deployer.address, // Initially deployer is operator
        quoter: STELLASWAP_V4.Quoter,
        router: STELLASWAP_V4.Router,
        nfpm: STELLASWAP_V4.NFPM,
        xtokensPrecompile: MOONBEAM_PRECOMPILES.xTokens,
        xcmTransactor: MOONBEAM_PRECOMPILES.xcmTransactor,
        assetHubParaId: ASSET_HUB_PARAID,
        defaultSlippageBps: 100, // 1%
        saveState: true,
    });

    const xcmProxyAddress = xcmpResult.address;
    const xcmProxy = xcmpResult.proxy;

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
        const deploymentsDir = path.join(process.cwd(), "deployments");
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        const bootstrap = {
            network: "moonbeam",
            chainId: 1284,
            xcmProxy: { address: proxyAddress },
            algebra: {
                factory: algebraAddresses.Factory,
                router: algebraAddresses.Router,
                quoter: algebraAddresses.Quoter,
                nfpm: algebraAddresses.NFPM
            },
            timestamp: new Date().toISOString()
        };

        const filePath = path.join(deploymentsDir, "moonbeam_bootstrap.json");
        fs.writeFileSync(filePath, JSON.stringify(bootstrap, null, 2));
        console.log(`\n💾 Deployment info saved to: ${filePath}`);

        // Also append to a markdown file for easy reading
        const mdContent = `
## Moonbeam Mainnet Deployment (${new Date().toISOString()})
- **XCMProxy**: \`${proxyAddress}\`
- **Algebra Factory**: \`${algebraAddresses.Factory}\`
- **Algebra Router**: \`${algebraAddresses.Router}\`
- **Algebra NFPM**: \`${algebraAddresses.NFPM}\`
`;
        fs.appendFileSync(path.join(process.cwd(), "CONTRACT_ADDRESSES.md"), mdContent);

    } catch (e) {
        console.warn("\n⚠️  Failed to save deployment info:", e.message);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("\n❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = { main };
