const { ethers } = require("hardhat");

// ==================== CONFIGURATION ====================
const VAULT_ADDRESS = "0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6";

// Official Polkadot XCM Precompile address
// https://docs.polkadot.com/develop/smart-contracts/precompiles/xcm-precompile/
const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";

// Moonbeam Moonbase Alpha parachain ID (for chain registry)
const MOONBASE_PARA_ID = 1000; // Moonbase Alpha paraId

// XCM destination for Moonbase Alpha (placeholder - update with actual MultiLocation)
const MOONBASE_XCM_DESTINATION = "0x00"; // Simplified placeholder

// XCMProxy on Moonbase Alpha (from previous deployment)
const MOONBASE_XCMPROXY = "0x7f4b3620d6Ffcc15b11ca8679c57c076DCE109d1";

// Helper to wait for block confirmation
async function waitForBlock(ms = 6000) {
    console.log(`   ⏳ Waiting ${ms/1000}s for block...`);
    await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      AssetHubVault Configuration & Testing                ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📋 Network Info:");
    console.log(`   Network: ${network.name} (chainId: ${network.chainId})`);
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   Vault: ${VAULT_ADDRESS}\n`);

    // Get balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH\n`);

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
        const admin = await vault.admin();
        const operator = await vault.operator();
        const emergency = await vault.emergency();
        const xcmPrecompile = await vault.XCM_PRECOMPILE();
        const xcmSender = await vault.XCM_SENDER();
        const xcmPrecompileFrozen = await vault.xcmPrecompileFrozen();
        const xcmSenderFrozen = await vault.xcmSenderFrozen();
        const testMode = await vault.testMode();
        const paused = await vault.paused();
        const trustedCaller = await vault.trustedSettlementCaller();
        const userBalance = await vault.getUserBalance(deployer.address);

        console.log("   Current Configuration:");
        console.log(`   ├── Admin:               ${admin}`);
        console.log(`   ├── Operator:            ${operator}`);
        console.log(`   ├── Emergency:           ${emergency}`);
        console.log(`   ├── XCM_PRECOMPILE:      ${xcmPrecompile}`);
        console.log(`   ├── XCM_SENDER:          ${xcmSender}`);
        console.log(`   ├── xcmPrecompileFrozen: ${xcmPrecompileFrozen}`);
        console.log(`   ├── xcmSenderFrozen:     ${xcmSenderFrozen}`);
        console.log(`   ├── testMode:            ${testMode}`);
        console.log(`   ├── paused:              ${paused}`);
        console.log(`   ├── trustedCaller:       ${trustedCaller}`);
        console.log(`   └── userBalance:         ${ethers.formatEther(userBalance)} ETH\n`);

        // Check if Moonbase chain is supported
        const moonbaseSupported = await vault.isChainSupported(MOONBASE_PARA_ID);
        console.log(`   Moonbase Alpha (${MOONBASE_PARA_ID}) supported: ${moonbaseSupported}\n`);

    } catch (err) {
        console.log("   ⚠️  Error reading state:", err.message, "\n");
    }

    // ==================== CONFIGURE VAULT ====================
    console.log("⚙️  Configuring vault...\n");

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
            console.log(`   Block: ${receipt.blockNumber}\n`);
            await waitForBlock();
        } else {
            console.log(`   ℹ️  XCM_PRECOMPILE already set: ${currentPrecompile}\n`);
        }
    } catch (err) {
        console.log(`   ⚠️  Error setting XCM_PRECOMPILE: ${err.message}\n`);
    }

    // 2. Enable Test Mode (for local testing without actual XCM)
    try {
        const currentTestMode = await vault.testMode();
        if (!currentTestMode) {
            console.log("   Enabling test mode...");
            nonce = await ethers.provider.getTransactionCount(deployer.address);
            const tx = await vault.setTestMode(true, { gasLimit: 500000, nonce: nonce++ });
            const receipt = await tx.wait(2);
            console.log(`   ✅ Test mode enabled! TX: ${tx.hash}`);
            console.log(`   Block: ${receipt.blockNumber}\n`);
            await waitForBlock();
        } else {
            console.log("   ℹ️  Test mode already enabled\n");
        }
    } catch (err) {
        console.log(`   ⚠️  Error enabling test mode: ${err.message}\n`);
    }

    // 3. Set Trusted Settlement Caller (operator in test mode)
    try {
        const currentCaller = await vault.trustedSettlementCaller();
        if (currentCaller === ethers.ZeroAddress) {
            console.log(`   Setting trustedSettlementCaller to operator (${deployer.address})...`);
            nonce = await ethers.provider.getTransactionCount(deployer.address);
            const tx = await vault.setTrustedSettlementCaller(deployer.address, { gasLimit: 500000, nonce: nonce++ });
            const receipt = await tx.wait(2);
            console.log(`   ✅ trustedSettlementCaller set! TX: ${tx.hash}`);
            console.log(`   Block: ${receipt.blockNumber}\n`);
            await waitForBlock();
        } else {
            console.log(`   ℹ️  trustedSettlementCaller already set: ${currentCaller}\n`);
        }
    } catch (err) {
        console.log(`   ⚠️  Error setting trustedSettlementCaller: ${err.message}\n`);
    }

    // 4. Add Moonbase Alpha as supported chain
    try {
        const moonbaseSupported = await vault.isChainSupported(MOONBASE_PARA_ID);
        if (!moonbaseSupported) {
            console.log(`   Adding Moonbase Alpha (chainId: ${MOONBASE_PARA_ID}) as supported chain...`);
            nonce = await ethers.provider.getTransactionCount(deployer.address);
            const tx = await vault.addChain(
                MOONBASE_PARA_ID,
                MOONBASE_XCM_DESTINATION,
                "Moonbase Alpha",
                MOONBASE_XCMPROXY,
                { gasLimit: 500000, nonce: nonce++ }
            );
            const receipt = await tx.wait(2);
            console.log(`   ✅ Moonbase Alpha added! TX: ${tx.hash}`);
            console.log(`   Block: ${receipt.blockNumber}\n`);
            await waitForBlock();
        } else {
            console.log("   ℹ️  Moonbase Alpha already supported\n");
        }
    } catch (err) {
        console.log(`   ⚠️  Error adding Moonbase Alpha: ${err.message}\n`);
    }

    // ==================== TEST DEPOSIT/WITHDRAW ====================
    console.log("🧪 Testing deposit/withdraw...\n");

    const testAmount = ethers.parseEther("0.001"); // Small test amount

    // Check if we have enough balance
    const currentBalance = await ethers.provider.getBalance(deployer.address);
    if (currentBalance < testAmount * 2n) {
        console.log(`   ⚠️  Insufficient balance for test. Have: ${ethers.formatEther(currentBalance)} ETH\n`);
    } else {
        // Test deposit
        try {
            console.log(`   Depositing ${ethers.formatEther(testAmount)} ETH...`);
            const tx = await vault.deposit({ value: testAmount, gasLimit: 500000 });
            await tx.wait();
            console.log(`   ✅ Deposit successful! TX: ${tx.hash}`);
            
            const newBalance = await vault.getUserBalance(deployer.address);
            console.log(`   User vault balance: ${ethers.formatEther(newBalance)} ETH\n`);
        } catch (err) {
            console.log(`   ⚠️  Deposit failed: ${err.message}\n`);
        }

        // Test withdraw
        try {
            const vaultBalance = await vault.getUserBalance(deployer.address);
            if (vaultBalance > 0) {
                console.log(`   Withdrawing ${ethers.formatEther(vaultBalance)} ETH...`);
                const tx = await vault.withdraw(vaultBalance, { gasLimit: 500000 });
                await tx.wait();
                console.log(`   ✅ Withdraw successful! TX: ${tx.hash}`);
                
                const finalBalance = await vault.getUserBalance(deployer.address);
                console.log(`   User vault balance: ${ethers.formatEther(finalBalance)} ETH\n`);
            }
        } catch (err) {
            console.log(`   ⚠️  Withdraw failed: ${err.message}\n`);
        }
    }

    // ==================== FINAL STATE ====================
    console.log("📋 Final vault state:\n");
    
    try {
        const xcmPrecompile = await vault.XCM_PRECOMPILE();
        const testMode = await vault.testMode();
        const trustedCaller = await vault.trustedSettlementCaller();
        const moonbaseSupported = await vault.isChainSupported(MOONBASE_PARA_ID);
        const userBalance = await vault.getUserBalance(deployer.address);

        console.log(`   ├── XCM_PRECOMPILE:      ${xcmPrecompile}`);
        console.log(`   ├── testMode:            ${testMode}`);
        console.log(`   ├── trustedCaller:       ${trustedCaller}`);
        console.log(`   ├── Moonbase supported:  ${moonbaseSupported}`);
        console.log(`   └── userBalance:         ${ethers.formatEther(userBalance)} ETH\n`);
    } catch (err) {
        console.log(`   ⚠️  Error reading final state: ${err.message}\n`);
    }

    console.log("✅ Configuration complete!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
