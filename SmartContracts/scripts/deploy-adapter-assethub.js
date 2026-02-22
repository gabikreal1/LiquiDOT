const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      XcmExecuteAdapter Deployment                         ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    console.log(`   Deployer: ${deployer.address}`);

    // The authorizedCaller should be the AssetHubVault contract address
    const AUTHORIZED_CALLER = process.env.ASSET_HUB_VAULT_ADDRESS;
    if (!AUTHORIZED_CALLER || AUTHORIZED_CALLER === ethers.ZeroAddress) {
        console.error("   ❌ ASSET_HUB_VAULT_ADDRESS env var must be set to the AssetHubVault contract address");
        process.exit(1);
    }
    console.log(`   Authorized Caller (AssetHubVault): ${AUTHORIZED_CALLER}`);

    const Adapter = await ethers.getContractFactory("contracts/V1(Current)/XcmExecuteAdapter.sol:XcmExecuteAdapter");
    console.log("   Deploying XcmExecuteAdapter...");
    const adapter = await Adapter.deploy(AUTHORIZED_CALLER);
    await adapter.waitForDeployment();

    const address = await adapter.getAddress();

    console.log(`   ✅ Deployed!`);
    console.log(`   Address: ${address}`);
    console.log(`   Authorized Caller: ${AUTHORIZED_CALLER}\n`);

    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    const deploymentData = {
        adapterAddress: address,
        authorizedCaller: AUTHORIZED_CALLER,
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(path.join(deploymentsDir, "assethub_adapter.json"), JSON.stringify(deploymentData, null, 2));
    console.log("   💾 Deployment info saved to deployments/assethub_adapter.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
