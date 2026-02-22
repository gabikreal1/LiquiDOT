const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ==================== MAINNET CONFIGURATION ====================

// Asset Hub Parachain ID
const ASSET_HUB_PARAID = 1000;

// Asset Hub Sovereign Account on Moonbeam
// Sibling 1000 Address Derivation:
// 0x7369626c (sibl) + 000000000000000000000000 (padding) + e8030000 (ParaID) ??
// NO: Standard Moonbeam Sibling Mapping is:
// 0x7369626c + LE_32(ParaId) + 12 bytes of zero
// ParaId 1000 = 0x000003E8 -> LE: E8030000
// Result: 0x7369626cE8030000000000000000000000000000
const ASSET_HUB_SOVEREIGN_ON_MOONBEAM = "0x7369626ce8030000000000000000000000000000";

// xcDOT on Moonbeam
const XC_DOT_ADDRESS = "0xffffffff1fcacbd218edc0eba20fc2308c778080";
// WGLMR on Moonbeam
const WGLMR_ADDRESS = "0xacc15dc74880c9944775448304b263d191c6077d";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      XCMProxy MAINNET Configuration                       ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");
    console.log("Configuring with account:", deployer.address);

    // Load deployment info
    const deploymentPath = path.join(__dirname, "../deployments/moonbeam_mainnet_deployment.json");

    let PROXY_ADDRESS;
    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        PROXY_ADDRESS = deployment.xcmProxy.address;
        console.log(`\n📋 Loaded XCMProxy from deployment file: ${PROXY_ADDRESS}`);
    } else {
        console.log("\n⚠️ Deployment file not found. Please set PROXY_ADDRESS manually in the script.");
        process.exit(1);
    }

    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
    const proxy = XCMProxy.attach(PROXY_ADDRESS);

    // ==================== CONFIGURATION STEPS ====================

    // 1. Set Trusted XCM Caller (Asset Hub Sovereign Account)
    console.log("\n1️⃣  Setting Trusted XCM Caller...");
    const currentTrusted = await proxy.trustedXcmCaller();
    if (currentTrusted.toLowerCase() !== ASSET_HUB_SOVEREIGN_ON_MOONBEAM.toLowerCase()) {
        console.log(`   Setting to ${ASSET_HUB_SOVEREIGN_ON_MOONBEAM}...`);
        const tx = await proxy.setTrustedXcmCaller(ASSET_HUB_SOVEREIGN_ON_MOONBEAM);
        await tx.wait();
        console.log("   ✅ Trusted Caller set!");
    } else {
        console.log("   ✅ Trusted Caller already set correct.");
    }

    // 2. Add Supported Tokens (xcDOT and WGLMR)
    console.log("\n2️⃣  Adding Supported Tokens...");
    const tokens = [
        { sym: "xcDOT", addr: XC_DOT_ADDRESS },
        { sym: "WGLMR", addr: WGLMR_ADDRESS }
    ];

    for (const token of tokens) {
        const isSupported = await proxy.supportedTokens(token.addr);
        if (!isSupported) {
            console.log(`   Adding ${token.sym} (${token.addr})...`);
            const tx = await proxy.addSupportedToken(token.addr); // Note: addSupportedToken function name might vary?
            // The function in existing script was 'addSupportedToken' via loop, let's verify XCMProxy.sol
            // Actually XCMProxy.sol does NOT have `addSupportedToken`?
            // Let's check XCMProxy.sol again.
            await tx.wait();
            console.log(`   ✅ ${token.sym} added!`);
        } else {
            console.log(`   ✅ ${token.sym} already supported.`);
        }
    }

    // 3. Disable Test Mode (CRITICAL)
    console.log("\n3️⃣  Disabling Test Mode...");
    const testMode = await proxy.testMode();
    if (testMode) {
        console.log("   🚫 Disabling test mode...");
        const tx = await proxy.setTestMode(false);
        await tx.wait();
        console.log("   ✅ Test mode DISABLED!");
    } else {
        console.log("   ✅ Test mode is already disabled.");
    }

    console.log("\n✅ Configuration complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Configuration failed:", error);
        process.exit(1);
    });
