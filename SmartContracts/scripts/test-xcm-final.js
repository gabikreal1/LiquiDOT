const { ethers } = require("ethers");
require("dotenv").config();

// Updated XCM Message with BuyExecution (from calc_xcm_message.js)
const XCM_MESSAGE_HEX = "0x050c00040100000300286bee130100000300286bee000e0100010100511f0c1301000002286bee000d010204000103000cfb7ce7d66c7cdae5827074c5f5a62223a0c23006010011083e4fba368fc1ceb44d75dca48753cfc775698ec93b4dae3889d02209489c2bd54cfce1ed000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000b2d05e0000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c77808000000000000000000000000000000000000000000000000000000000000000e0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff3cb0000000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const ASSET_HUB_RPC = "https://eth-rpc.polkadot.io/";

async function main() {
    console.log("=== Final XCM Test: WithdrawAsset + BuyExecution + DepositReserveAsset ===\n");

    const provider = new ethers.JsonRpcProvider(ASSET_HUB_RPC);
    const wallet = new ethers.Wallet(process.env.ASSET_PK, provider);
    console.log("Caller:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "DOT\n");

    const iface = new ethers.Interface([
        "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
        "function execute(bytes calldata message, tuple(uint64 refTime, uint64 proofSize) weight) external"
    ]);

    // Step 1: weighMessage
    console.log("--- Step 1: weighMessage ---");
    const weighData = iface.encodeFunctionData("weighMessage", [XCM_MESSAGE_HEX]);
    const weighResult = await provider.call({ to: XCM_PRECOMPILE, data: weighData });
    const weightDecoded = iface.decodeFunctionResult("weighMessage", weighResult);
    const refTime = weightDecoded[0].refTime;
    const proofSize = weightDecoded[0].proofSize;
    console.log(`✅ RefTime: ${refTime}, ProofSize: ${proofSize}`);

    // Step 2: execute dry-run with 10% buffer
    console.log("\n--- Step 2: execute (dry-run) ---");
    const weight = {
        refTime: refTime * 110n / 100n,
        proofSize: proofSize * 110n / 100n
    };
    console.log(`Using weight: RefTime=${weight.refTime}, ProofSize=${weight.proofSize}`);

    const execData = iface.encodeFunctionData("execute", [XCM_MESSAGE_HEX, weight]);
    try {
        const result = await wallet.call({ to: XCM_PRECOMPILE, data: execData });
        console.log(`✅ execute dry-run: SUCCESS! Result: ${result || "(empty = success)"}`);
    } catch (e) {
        console.log(`❌ execute dry-run FAILED: ${e.reason || e.message}`);
        if (e.data) console.log("   Revert data:", e.data.substring(0, 200));
    }

    console.log("\n=== Test Complete ===");
}

main().catch(console.error);
