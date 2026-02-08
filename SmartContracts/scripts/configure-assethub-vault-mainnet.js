const { ethers } = require("hardhat");

// ==================== MAINNET CONFIGURATION ====================
// TODO: Enter the deployed AssetHubVault address here
const VAULT_ADDRESS = "0x...";

// Official Polkadot XCM Precompile address (Same for AssetHub)
// https://docs.polkadot.com/develop/smart-contracts/precompiles/xcm-precompile/
const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";

// Moonbeam Parachain ID
const MOONBEAM_PARA_ID = 2004;

// TODO: Enter the correct XCM MultiLocation for Moonbeam (Parent: 1, Parachain: 2004)
// This must be the SCALE-encoded bytes of the MultiLocation.
const MOONBEAM_XCM_DESTINATION = "0x0100000000000000000000000000000000000000000000000000000000000000"; // Placeholder - REPLACE THIS

// TODO: Enter the deployed XCMProxy address on Moonbeam
const MOONBEAM_XCMPROXY = "0x...";

// TODO: Enter the Sovereign Account of Moonbeam on AssetHub
// This is the address that AssetHub sees when Moonbeam sends an XCM message.
// It is usually calculated from the Parachain ID.
// For Parachain 2004, it is likely: 0x7369626C04080000000000000000000000000000
const MOONBEAM_SOVEREIGN_ACCOUNT = "0x7369626C04080000000000000000000000000000"; // Check this!

// Helper to wait for block confirmation
async function waitForBlock(ms = 12000) {
    console.log(`   ⏳ Waiting ${ms / 1000}s for block...`);
    await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      AssetHubVault MAINNET Configuration                  ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("📋 Network Info:");
    console.log(`   Network: ${network.name} (chainId: ${network.chainId})`);
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   Vault: ${VAULT_ADDRESS}\n`);

    if (VAULT_ADDRESS === "0x..." || MOONBEAM_XCMPROXY === "0x...") {
        console.error("❌ ERROR: Please configure VAULT_ADDRESS and MOONBEAM_XCMPROXY in the script.");
        process.exit(1);
    }

    // Connect to vault
    const vaultAbi = [
        // Read functions
        "function admin() view returns (address)",
        "function operator() view returns (address)",
        "function emergency() view returns (address)",
        "function XCM_PRECOMPILE() view returns (address)",
        "function XCM_SENDER() view returns (address)",
        "function xcmPrecompileFrozen() view returns (bool)",
        "function xcmSenderFrozen() view returns (bool)",
        "function testMode() view returns (bool)",
        "function paused() view returns (bool)",
        "function trustedSettlementCaller() view returns (address)",
        "function getUserBalance(address) view returns (uint256)",
        "function isChainSupported(uint32) view returns (bool)",
        "function getChainConfig(uint32) view returns (tuple(bool supported, bytes xcmDestination, string chainName, uint64 timestamp))",

        // Write functions
        "function setXcmPrecompile(address) external",
        "function setXcmSender(address) external",
        "function setTestMode(bool) external",
        "function setTrustedSettlementCaller(address) external",
        "function addChain(uint32 chainId, bytes xcmDestination, string chainName, address executor) external",
        "function deposit() payable external",
        "function withdraw(uint256) external",
    ];

    const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, deployer);

    // ==================== READ CURRENT STATE ====================
    console.log("📖 Reading current vault state...\n");

    try {
        const xcmPrecompile = await vault.XCM_PRECOMPILE();
        const testMode = await vault.testMode();
        const trustedCaller = await vault.trustedSettlementCaller();
        const moonbeamSupported = await vault.isChainSupported(MOONBEAM_PARA_ID);

        console.log("   Current Configuration:");
        console.log(`   ├── XCM_PRECOMPILE:      ${xcmPrecompile}`);
        console.log(`   ├── testMode:            ${testMode}`);
        console.log(`   ├── trustedCaller:       ${trustedCaller}`);
        console.log(`   ├── Moonbeam (${MOONBEAM_PARA_ID}) supported: ${moonbeamSupported}\n`);

        if (testMode) {
            console.warn("   ⚠️ WARNING: Test mode is currently ENABLED. It should be DISABLED for mainnet.\n");
        }

    } catch (err) {
        console.log("   ⚠️  Error reading state:", err.message, "\n");
    }

    // ==================== CONFIGURE VAULT ====================
    console.log("⚙️  Configuring vault for MAINNET...\n");

    // Get current nonce
    let nonce = await ethers.provider.getTransactionCount(deployer.address);
    console.log(`   Starting nonce: ${nonce}\n`);

    // 1. Set XCM Precompile
    try {
        const currentPrecompile = await vault.XCM_PRECOMPILE();
        if (currentPrecompile === ethers.ZeroAddress) {
            console.log(`   Setting XCM_PRECOMPILE to ${XCM_PRECOMPILE}...`);
            const tx = await vault.setXcmPrecompile(XCM_PRECOMPILE, { gasLimit: 500000, nonce: nonce++ });
            const receipt = await tx.wait(2); // Wait for 2 confirmations
            console.log(`   ✅ XCM_PRECOMPILE set! TX: ${tx.hash}`);
            await waitForBlock();
        } else {
            console.log(`   ℹ️  XCM_PRECOMPILE already set: ${currentPrecompile}\n`);
        }
    } catch (err) {
        console.log(`   ⚠️  Error setting XCM_PRECOMPILE: ${err.message}\n`);
    }

    // 2. DISABLE Test Mode (Critical for Mainnet)
    try {
        const currentTestMode = await vault.testMode();
        if (currentTestMode) {
            console.log("   🚫 Disabling test mode...");
            nonce = await ethers.provider.getTransactionCount(deployer.address);
            const tx = await vault.setTestMode(false, { gasLimit: 500000, nonce: nonce++ });
            const receipt = await tx.wait(2);
            console.log(`   ✅ Test mode DISABLED! TX: ${tx.hash}`);
            await waitForBlock();
        } else {
            console.log("   ℹ️  Test mode is correctly disabled\n");
        }
    } catch (err) {
        console.log(`   ⚠️  Error disabling test mode: ${err.message}\n`);
    }

    // 3. Set Trusted Settlement Caller (Moonbeam Sovereign Account)
    try {
        const currentCaller = await vault.trustedSettlementCaller();
        const expectedCaller = MOONBEAM_SOVEREIGN_ACCOUNT;

        if (currentCaller.toLowerCase() !== expectedCaller.toLowerCase()) {
            console.log(`   Setting trustedSettlementCaller to Moonbeam Sovereign Account (${expectedCaller})...`);
            nonce = await ethers.provider.getTransactionCount(deployer.address);
            const tx = await vault.setTrustedSettlementCaller(expectedCaller, { gasLimit: 500000, nonce: nonce++ });
            const receipt = await tx.wait(2);
            console.log(`   ✅ trustedSettlementCaller set! TX: ${tx.hash}`);
            await waitForBlock();
        } else {
            console.log(`   ℹ️  trustedSettlementCaller already set: ${currentCaller}\n`);
        }
    } catch (err) {
        console.log(`   ⚠️  Error setting trustedSettlementCaller: ${err.message}\n`);
    }

    // 4. Add Moonbeam as supported chain
    try {
        const moonbeamSupported = await vault.isChainSupported(MOONBEAM_PARA_ID);
        if (!moonbeamSupported) {
            console.log(`   Adding Moonbeam (chainId: ${MOONBEAM_PARA_ID}) as supported chain...`);
            nonce = await ethers.provider.getTransactionCount(deployer.address);
            const tx = await vault.addChain(
                MOONBEAM_PARA_ID,
                MOONBEAM_XCM_DESTINATION,
                "Moonbeam",
                MOONBEAM_XCMPROXY,
                { gasLimit: 500000, nonce: nonce++ }
            );
            const receipt = await tx.wait(2);
            console.log(`   ✅ Moonbeam added! TX: ${tx.hash}`);
            await waitForBlock();
        } else {
            console.log("   ℹ️  Moonbeam already supported\n");
        }
    } catch (err) {
        console.log(`   ⚠️  Error adding Moonbeam: ${err.message}\n`);
    }

    console.log("✅ Mainnet Configuration complete!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
