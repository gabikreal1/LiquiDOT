const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);
    
    const deployment = {
        network: "localhost",
        chainId: 31337,
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };
    
    // 1. Deploy Test ERC20 Tokens
    console.log("\n1. Deploying test tokens...");
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    
    const token0 = await TestERC20.deploy("TestToken0", "TT0");
    await token0.deployed();
    deployment.token0 = token0.address;
    console.log("Token0:", token0.address);
    
    const token1 = await TestERC20.deploy("TestToken1", "TT1");
    await token1.deployed();
    deployment.token1 = token1.address;
    console.log("Token1:", token1.address);
    
    // 2. Deploy XCMProxy
    console.log("\n2. Deploying XCMProxy...");
    const XCMProxy = await ethers.getContractFactory("XCMProxy");
    const xcmProxy = await XCMProxy.deploy(deployer.address);
    await xcmProxy.deployed();
    deployment.xcmProxy = xcmProxy.address;
    console.log("XCMProxy:", xcmProxy.address);
    
    // 3. Configure XCMProxy for testing
    console.log("\n3. Configuring XCMProxy...");
    await xcmProxy.setTestMode(true);
    await xcmProxy.addSupportedToken(token0.address);
    await xcmProxy.addSupportedToken(token1.address);
    
    // Set dummy XTokens address (test mode skips actual calls)
    const XTOKENS_PRECOMPILE = "0x0000000000000000000000000000000000000804";
    await xcmProxy.setXTokensPrecompile(XTOKENS_PRECOMPILE);
    console.log("Test mode enabled, XTokens set to:", XTOKENS_PRECOMPILE);
    
    // 4. Deploy AssetHubVault (for local testing)
    console.log("\n4. Deploying AssetHubVault...");
    const AssetHubVault = await ethers.getContractFactory("AssetHubVault");
    const assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.deployed();
    deployment.assetHubVault = assetHubVault.address;
    console.log("AssetHubVault:", assetHubVault.address);
    
    // 5. Configure AssetHubVault for testing
    console.log("\n5. Configuring AssetHubVault...");
    await assetHubVault.setTestMode(true);
    await assetHubVault.setOperator(deployer.address);
    
    // Set dummy XCM precompile address (test mode skips actual calls)
    const XCM_PRECOMPILE = "0x0000000000000000000000000000000000000808";
    await assetHubVault.setXcmPrecompile(XCM_PRECOMPILE);
    console.log("Test mode enabled, XCM precompile set to:", XCM_PRECOMPILE);
    
    // 6. Save deployment
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = path.join(deploymentsDir, "localhost.json");
    fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
    console.log("\n✅ Deployment saved to:", filename);
    
    console.log("\n📝 Summary:");
    console.log("- AssetHubVault:", assetHubVault.address);
    console.log("- XCMProxy:", xcmProxy.address);
    console.log("- Token0:", token0.address);
    console.log("- Token1:", token1.address);
    console.log("- Test mode: ENABLED");
    
    return deployment;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

