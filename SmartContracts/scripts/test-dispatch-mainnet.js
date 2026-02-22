const { ethers } = require("hardhat");

const VAULT_ADDRESS = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
const XCM_MESSAGE_HEX = "0x040800040100000700f2052a010e0100010100511f0c1301000002286bee000d010204000103000cfb7ce7d66c7cdae5827074c5f5a62223a0c23006010700f2052a0142420f0011083e4fba36bdc204a50b4c0f2475708e5ec2f07a1d2ec633ebae99f3505f24bdfc6693a6d1000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000ee6b280000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c77808000000000000000000000000000000000000000000000000000000000000000e0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff3cb0000000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      Testing Dispatch Investment (Mainnet) - XCM V4       ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");
    // ... (unchanged)


    const [deployer] = await ethers.getSigners();
    const artifact = require("../artifacts-evm/contracts/V1(Current)/AssetHubVault.sol/AssetHubVault.json");
    const vault = new ethers.Contract(VAULT_ADDRESS, artifact.abi, deployer);

    // Debug ABI
    const frag = vault.interface.getFunction("dispatchInvestment");
    console.log("ABI Fragment inputs:", frag.inputs);

    // Params corresponding to the XCM Message content
    const CHAIN_ID = 2004;
    const POOL_ID = "0x90dD87C994959A36d725bB98F9008B0b3C3504A0"; // Using Factory/Dummy as placeholder for local ID gen
    const BASE_ASSET = "0xffffffff1fcacbd218edc0eba20fc2308c778080"; // xcDOT
    const OWNER = deployer.address;

    // Amount to deduct from Vault Balance (18 decimals for EVM accounting)
    const AMOUNT_FOR_CHECK = ethers.parseUnits("0.5", 18);

    console.log(`   Vault: ${VAULT_ADDRESS}`);
    console.log(`   Dispatching Amount (check): ${ethers.formatUnits(AMOUNT_FOR_CHECK, 18)}`);

    // Destination is strictly for the 'send' call, but our Adapter ignores it and uses the Message content.
    // However, we should pass a valid destination bytes just in case (e.g. Parachain 2004).
    // Usually encoded multilocation. Empty bytes might be rejected by Vault if checked?
    // Vault checks: if (destination.length == 0) revert InvalidDestination();
    // So we must pass something.
    const DUMMY_DESTINATION = "0x01"; // Just not empty

    // Execute
    console.log(`\n   Sending Transaction...`);

    // Correct Signature:
    // dispatchInvestment(user, chainId, poolId, baseAsset, amount, lower, upper, destination, msg)
    const tx = await vault.dispatchInvestment(
        OWNER,              // user (1)
        CHAIN_ID,           // chainId (2)
        POOL_ID,            // poolId (3)
        BASE_ASSET,         // baseAsset (4)
        AMOUNT_FOR_CHECK,   // amount (5)
        -800000,            // lower (6)
        800000,             // upper (7)
        DUMMY_DESTINATION,  // destination (8)
        XCM_MESSAGE_HEX,    // preBuiltXcmMessage (9)
        { gasLimit: 500000 } // Explicit Gas Limit
    );

    console.log(`   TX Sent: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);
    await tx.wait();
    console.log(`   ✅ Confirmed!`);
    console.log(`   Use the Remote ID (from calculator) to track execution on Moonbeam.`);
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Dispatch failed:", error);
        process.exit(1);
    });
