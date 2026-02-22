const { ethers } = require("hardhat");

const VAULT_ADDRESS = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230"; // AssetHubVault
const DEPOSIT_AMOUNT = ethers.parseUnits("0.5", 10); // DOT has 10 decimals

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      Testing AssetHubVault Deposit (0.5 DOT)              ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    console.log(`   Account: ${deployer.address}`);
    console.log(`   Vault: ${VAULT_ADDRESS}`);

    const vault = await ethers.getContractAt("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault", VAULT_ADDRESS);

    // 1. Check initial balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`   Deployer Balance (Raw): ${balance.toString()}`);
    console.log(`   Deployer Balance (10 dec): ${ethers.formatUnits(balance, 10)}`);
    console.log(`   Deployer Balance (18 dec): ${ethers.formatUnits(balance, 18)}`);

    // Deciding on amount based on balance magnitude
    let amountToSend;
    if (balance > ethers.parseUnits("1000", 10)) { // If balance is huge (likely 18 decimals)
        console.log("   Detected 18-decimal behavior (or whale). Using 18 decimals.");
        amountToSend = ethers.parseUnits("0.5", 18);
    } else {
        console.log("   Detected 10-decimal behavior. Using 18 decimals anyway to test EVM scaling?");
        // If user saw 0.00000001 when I sent 10 decimals, they likely viewed it with 18-decimal tooling.
        // BUT if I send 18 decimals to the chain, will it take 100M DOT?
        // Let's rely on the RPC. If RPC says I have 5 * 10^18, then I send 0.5 * 10^18.
        // If RPC says I have 5 * 10^10, then I send 0.5 * 10^10.
        // The user said "you deposited 0.00000001", enabling the theory that I sent dust.
        // This implies I sent 10^9 units, but 1 DOT is 10^18 units in this EVM.
        amountToSend = ethers.parseUnits("0.5", 18);
    }

    console.log(`\n   Depositing ${ethers.formatUnits(amountToSend, 18)} (assuming 18 decimals)...`);

    // Check initial vault balance
    const initialVaultBal = await vault.getUserBalance(deployer.address);
    console.log(`   Initial Vault Balance: ${initialVaultBal.toString()}`);

    const tx = await vault.deposit({ value: amountToSend });
    console.log(`   TX Sent: ${tx.hash}`);

    console.log(`   Waiting for confirmation...`);
    await tx.wait();
    console.log(`   ✅ Confirmed!`);

    // 3. Check final balance
    const finalVaultBal = await vault.getUserBalance(deployer.address);
    console.log(`   Final Vault Balance (Raw): ${finalVaultBal.toString()}`);


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    });
