const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying to Moonbase Alpha with:", deployer.address);
    console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "DEV");
    
    const deployment = {
        network: "moonbase",
        chainId: 1287,
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };
    
    // 1. Deploy Test ERC20 Tokens (for testing)
    console.log("\n1. Deploying test tokens...");
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    
    const dot = await TestERC20.deploy("Test DOT", "tDOT");
    await dot.deployed();
    deployment.DOT = dot.address;
    console.log("DOT:", dot.address);
    
    const usdc = await TestERC20.deploy("Test USDC", "tUSDC");
    await usdc.deployed();
    deployment.USDC = usdc.address;
    console.log("USDC:", usdc.address);
    
    const usdt = await TestERC20.deploy("Test USDT", "tUSDT");
    await usdt.deployed();
    deployment.USDT = usdt.address;
    console.log("USDT:", usdt.address);
    
    // 2. Deploy XCMProxy
    console.log("\n2. Deploying XCMProxy...");
    const XCMProxy = await ethers.getContractFactory("XCMProxy");
    const xcmProxy = await XCMProxy.deploy(deployer.address);
    await xcmProxy.deployed();
    deployment.XCMProxy = xcmProxy.address;
    console.log("XCMProxy:", xcmProxy.address);
    
    // 3. Configure XCMProxy
    console.log("\n3. Configuring XCMProxy...");
    
    // Enable test mode (until XCM channel is established)
    console.log("Setting test mode...");
    await xcmProxy.setTestMode(true);
    console.log("✅ Test mode enabled");
    
    // Add supported tokens
    console.log("Adding supported tokens...");
    await xcmProxy.addSupportedToken(dot.address);
    await xcmProxy.addSupportedToken(usdc.address);
    await xcmProxy.addSupportedToken(usdt.address);
    console.log("✅ Tokens added");
    
    // Set XTokens precompile address (REAL Moonbase precompile)
    const XTOKENS_PRECOMPILE = "0x0000000000000000000000000000000000000804";
    console.log("Setting XTokens precompile...");
    await xcmProxy.setXTokensPrecompile(XTOKENS_PRECOMPILE);
    console.log("✅ XTokens precompile set:", XTOKENS_PRECOMPILE);
    
    // Set Asset Hub Para ID
    const ASSET_HUB_PARA_ID = 1000; // Paseo Asset Hub
    console.log("Setting Asset Hub Para ID...");
    await xcmProxy.setAssetHubParaId(ASSET_HUB_PARA_ID);
    console.log("✅ Asset Hub Para ID set:", ASSET_HUB_PARA_ID);
    
    // Set Operator
    await xcmProxy.setOperator(deployer.address);
    console.log("✅ Operator set to:", deployer.address);
    
    // TODO: Set Algebra integrations when available
    // const ALGEBRA_QUOTER = "0x...";
    // const ALGEBRA_ROUTER = "0x...";
    // const ALGEBRA_NFPM = "0x...";
    // await xcmProxy.setIntegrations(ALGEBRA_QUOTER, ALGEBRA_ROUTER);
    // await xcmProxy.setNFPM(ALGEBRA_NFPM);
    
    // 4. Save deployment
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = path.join(deploymentsDir, "moonbase.json");
    fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
    console.log("\n✅ Deployment saved to:", filename);
    
    console.log("\n📝 Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Network:         Moonbase Alpha");
    console.log("XCMProxy:        ", xcmProxy.address);
    console.log("Test DOT:        ", dot.address);
    console.log("Test USDC:       ", usdc.address);
    console.log("Test USDT:       ", usdt.address);
    console.log("Test Mode:       ENABLED");
    console.log("XTokens:         ", XTOKENS_PRECOMPILE);
    console.log("Asset Hub ID:    ", ASSET_HUB_PARA_ID);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    console.log("\n⚠️  IMPORTANT NEXT STEPS:");
    console.log("1. Set Algebra integrations when you have the addresses:");
    console.log("   - xcmProxy.setIntegrations(quoter, router)");
    console.log("   - xcmProxy.setNFPM(nfpm)");
    console.log("2. Deploy AssetHubVault to Paseo Asset Hub via Remix");
    console.log("3. Disable test mode when XCM channel is established:");
    console.log("   - xcmProxy.setTestMode(false)");
    console.log("4. Mint test tokens to users for testing:");
    console.log("   - dot.mint(userAddress, amount)");
    
    return deployment;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

