const { ethers } = require("hardhat");

async function main() {
  console.log("🏦 Deploying Asset Hub Vault contract...");

  // Get the contract factory
  const AssetHubVault = await ethers.getContractFactory("AssetHubVault");
  
  // Deploy the contract
  const assetHubVault = await AssetHubVault.deploy();
  
  // Wait for deployment to complete
  await assetHubVault.deployed();

  console.log("✅ Asset Hub Vault deployed to:", assetHubVault.address);
  
  // Get deployment information
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployed by:", deployer.address);
  console.log("💰 Deployer balance:", ethers.utils.formatEther(await deployer.getBalance()));
  
  // Verify the deployment
  console.log("🔍 Verifying deployment...");
  const vaultCode = await ethers.provider.getCode(assetHubVault.address);
  if (vaultCode !== "0x") {
    console.log("✅ Contract code verified on blockchain");
  } else {
    console.log("❌ Contract code not found on blockchain");
  }

  // Initialize the contract with basic setup
  console.log("⚙️ Initializing contract...");
  try {
    const initTx = await assetHubVault.initialize();
    await initTx.wait();
    console.log("✅ Contract initialized successfully");
  } catch (error) {
    console.log("⚠️ Contract initialization failed (may already be initialized):", error.message);
  }

  // Log deployment summary
  console.log("\n📋 Deployment Summary:");
  console.log("   Contract: AssetHubVault");
  console.log("   Address:", assetHubVault.address);
  console.log("   Network:", network.name);
  console.log("   Chain ID:", network.config.chainId);
  
  // Save deployment info to file
  const fs = require('fs');
  const deploymentInfo = {
    contract: "AssetHubVault",
    address: assetHubVault.address,
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    `deployments/asset-hub-vault-${network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("💾 Deployment info saved to deployments/");
  
  return assetHubVault;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 