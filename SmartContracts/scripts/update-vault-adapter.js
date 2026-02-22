const { ethers } = require("hardhat");

const VAULT_ADDRESS = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
const NEW_ADAPTER = "0x1C8F7F822A52C00fCF32B88A74a955475535672B";

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      Updating Vault XCM Adapter (V4 / Weight First)       ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    const artifact = require("../artifacts-evm/contracts/V1(Current)/AssetHubVault.sol/AssetHubVault.json");
    const vault = new ethers.Contract(VAULT_ADDRESS, artifact.abi, deployer);

    console.log(`   Vault: ${VAULT_ADDRESS}`);
    console.log(`   New Adapter: ${NEW_ADAPTER}`);

    try {
        console.log("\n   Setting XCM Sender...");
        const tx = await vault.setXcmSender(NEW_ADAPTER);
        console.log(`   TX Sent: ${tx.hash}`);
        await tx.wait();
        console.log("   ✅ XCM Sender Updated Successfully!");
    } catch (e) {
        console.error("   ❌ Failed to update adapter:", e);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
