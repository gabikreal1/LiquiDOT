const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      LiquiDOT Asset Hub Vault Deployment                  ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📋 Deployment Info:");
    console.log(`   Network: ${network.name} (chainId: ${network.chainId})`);
    console.log(`   Deployer: ${deployer.address}`);

    console.log("\n📦 Deploying AssetHubVault contract...");
    const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    const vault = await AssetHubVault.deploy({ gasLimit: 15000000 });
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    
    console.log(`✅ AssetHubVault deployed: ${vaultAddress}`);

    // Save deployment info
    const deploymentInfo = {
        network: network.name,
        chainId: Number(network.chainId),
        address: vaultAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };

    const deploymentPath = path.join(__dirname, "../deployments/assethub_deployment.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Deployment saved to: ${deploymentPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });