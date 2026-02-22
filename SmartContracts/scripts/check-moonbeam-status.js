const { ethers } = require("hardhat");

const XCMPROXY_ADDRESS = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
const REMOTE_ID = "0xd77ed9debf12b058cfb4f1e0353f30f62df80ede5485e49131451ea19f01f4aa";

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      Checking Moonbeam XCM Status                         ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const provider = new ethers.JsonRpcProvider("https://moonbeam.api.onfinality.io/public");
    const artifact = require("../artifacts-evm/contracts/V1(Current)/XcmProxy.sol/XcmProxy.json");
    const proxy = new ethers.Contract(XCMPROXY_ADDRESS, artifact.abi, provider);

    console.log(`   Proxy: ${XCMPROXY_ADDRESS}`);
    console.log(`   Checking Remote ID: ${REMOTE_ID}`);

    try {
        const position = await proxy.pendingPositions(REMOTE_ID);
        console.log("\n   📦 Pending Position Data:");
        console.log(`      User: ${position.user}`);
        console.log(`      Token: ${position.token}`);
        console.log(`      Amount: ${position.amount.toString()} (Should be ~0.4 DOT after fees)`);
        console.log(`      Params (Bytes): ${position.params}`);

        if (position.user === ethers.ZeroAddress) {
            console.log("\n   ❌ Status: Position NOT found (or zero initialized).");
            console.log("      Possible reasons:");
            console.log("      1. XCM Message hasn't arrived yet (check block explorer).");
            console.log("      2. XCM Execution failed on Moonbeam (check XCM events).");
            console.log("      3. Asset Hub failed to send.");
        } else {
            console.log("\n   ✅ Status: XCM Message RECEIVED and PROCESSED successfully!");
        }

    } catch (e) {
        console.error("   ❌ Error querying contract:", e);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
