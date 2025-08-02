const { ethers } = require("hardhat");

async function main() {
  console.log("🌙 Deploying XCM Proxy contract to Moonbeam...");

  // Get the contract factory
  const XCMProxy = await ethers.getContractFactory("XCMProxy");
  
  // Deploy the contract
  const xcmProxy = await XCMProxy.deploy();
  
  // Wait for deployment to complete
  await xcmProxy.deployed();

  console.log("✅ XCM Proxy deployed to:", xcmProxy.address);
  
  // Get deployment information
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployed by:", deployer.address);
  console.log("💰 Deployer balance:", ethers.utils.formatEther(await deployer.getBalance()));
  
  // Verify the deployment
  console.log("🔍 Verifying deployment...");
  const proxyCode = await ethers.provider.getCode(xcmProxy.address);
  if (proxyCode !== "0x") {
    console.log("✅ Contract code verified on blockchain");
  } else {
    console.log("❌ Contract code not found on blockchain");
  }

  // Set up initial configuration
  console.log("⚙️ Setting up initial configuration...");
  try {
    // Set the owner (deployer)
    const setOwnerTx = await xcmProxy.transferOwnership(deployer.address);
    await setOwnerTx.wait();
    console.log("✅ Ownership set to deployer");
    
    // Configure supported tokens (DOT, USDC, USDT)
    const supportedTokens = [
      "0x0000000000000000000000000000000000000000", // DOT
      "0x0000000000000000000000000000000000000001", // USDC
      "0x0000000000000000000000000000000000000002"  // USDT
    ];
    
    for (const token of supportedTokens) {
      const addTokenTx = await xcmProxy.addSupportedToken(token);
      await addTokenTx.wait();
      console.log(`✅ Added supported token: ${token}`);
    }
    
  } catch (error) {
    console.log("⚠️ Configuration failed:", error.message);
  }

  // Log deployment summary
  console.log("\n📋 Deployment Summary:");
  console.log("   Contract: XCMProxy");
  console.log("   Address:", xcmProxy.address);
  console.log("   Network:", network.name);
  console.log("   Chain ID:", network.config.chainId);
  
  // Save deployment info to file
  const fs = require('fs');
  const deploymentInfo = {
    contract: "XCMProxy",
    address: xcmProxy.address,
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    `deployments/xcm-proxy-${network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("💾 Deployment info saved to deployments/");
  
  return xcmProxy;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 