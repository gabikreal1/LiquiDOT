const { ethers } = require("hardhat");

async function main() {
    console.log("🔧 Setting up deployed contracts for live network testing...");

    // Configuration
    const XCMPROXY_ADDRESS = "0x392cb5A2d241f1b63f361C3FA0949eB2D34ad92E";
    const ASSETHUBVAULT_ADDRESS = "0x2F69311476Af3997528c8897023a23F3E5ABF6D2";
    const DEPLOYER_ADDRESS = "0x2372cB955817cD5200a559c2faAC93d0B3a88f2d";

    // Connect to Moonbase
    const provider = new ethers.JsonRpcProvider("https://rpc.api.moonbase.moonbeam.network");
    const deployerWallet = new ethers.Wallet(process.env.MOON_PK || process.env.PRIVATE_KEY, provider);

    console.log(`📡 Connected as: ${deployerWallet.address}`);

    // Setup XCMProxy
    console.log("\n🔧 Configuring XCMProxy...");
    const xcmProxy = await ethers.getContractAt("XCMProxy", XCMPROXY_ADDRESS, deployerWallet);

    // Add BASE_ASSET (native token) as supported token
    const BASE_ASSET = "0x0000000000000000000000000000000000000000";
    const isBaseAssetSupported = await xcmProxy.supportedTokens(BASE_ASSET);

    if (!isBaseAssetSupported) {
        console.log("➕ Adding BASE_ASSET as supported token...");
        const tx = await xcmProxy.addSupportedToken(BASE_ASSET);
        await tx.wait();
        console.log("✅ BASE_ASSET added successfully");
    } else {
        console.log("✅ BASE_ASSET already supported");
    }

    // Setup AssetHubVault
    console.log("\n🏦 Configuring AssetHubVault...");
    const assetHubVault = await ethers.getContractAt("AssetHubVault", ASSETHUBVAULT_ADDRESS, deployerWallet);

    // Set XCM precompile
    const xcmPrecompile = "0x0000000000000000000000000000000000000804";
    const currentPrecompile = await assetHubVault.XCM_PRECOMPILE();

    if (currentPrecompile === "0x0000000000000000000000000000000000000000") {
        console.log("➕ Setting XCM precompile...");
        const tx = await assetHubVault.setXcmPrecompile(xcmPrecompile);
        await tx.wait();
        console.log("✅ XCM precompile set successfully");
    } else {
        console.log("✅ XCM precompile already configured");
    }

    // Verify final state
    console.log("\n✅ Verifying final configuration...");

    const finalBaseAssetSupported = await xcmProxy.supportedTokens(BASE_ASSET);
    const finalXcmPrecompile = await assetHubVault.XCM_PRECOMPILE();

    console.log(`XCMProxy BASE_ASSET supported: ${finalBaseAssetSupported}`);
    console.log(`AssetHubVault XCM precompile: ${finalXcmPrecompile}`);

    if (finalBaseAssetSupported && finalXcmPrecompile !== "0x0000000000000000000000000000000000000000") {
        console.log("\n🎉 Setup complete! Tests should now pass on live network.");
    } else {
        console.log("\n❌ Setup incomplete. Some configurations may still be missing.");
    }
}

main().catch(console.error);


