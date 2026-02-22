const { ethers } = require("hardhat");

const VAULT_ADDRESS = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230"; // AssetHubVault
const ADAPTER_ADDRESS = "0xc9Ea0219D45cf2435E0e013C038310682822D7fA"; // XcmExecuteAdapter

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      Configuring AssetHubVault XCM Sender                 ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    console.log(`   Account: ${deployer.address}`);
    console.log(`   Vault: ${VAULT_ADDRESS}`);
    console.log(`   Adapter: ${ADAPTER_ADDRESS}`);

    const vault = await ethers.getContractAt("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault", VAULT_ADDRESS);

    // Set XCM Sender
    console.log(`\n   Setting new XcmSender...`);
    const tx = await vault.setXcmSender(ADAPTER_ADDRESS);
    console.log(`   TX Sent: ${tx.hash}`);

    console.log(`   Waiting for confirmation...`);
    await tx.wait();
    console.log(`   ✅ Confirmed!`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Configuration failed:", error);
        process.exit(1);
    });
