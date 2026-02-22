/**
 * Debug gas parameters for Asset Hub pallet-revive EVM
 */
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
    const provider = new ethers.JsonRpcProvider("https://eth-rpc.polkadot.io/");
    const wallet = new ethers.Wallet(process.env.ASSET_PK, provider);

    console.log("=== Asset Hub EVM Gas Debug ===\n");
    console.log("Address:", wallet.address);

    // Check chain ID
    const network = await provider.getNetwork();
    console.log("Chain ID:", network.chainId);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "DOT");

    // Check gas price
    const feeData = await provider.getFeeData();
    console.log("\nFee Data:");
    console.log("  gasPrice:", feeData.gasPrice?.toString());
    console.log("  maxFeePerGas:", feeData.maxFeePerGas?.toString());
    console.log("  maxPriorityFeePerGas:", feeData.maxPriorityFeePerGas?.toString());

    // Check nonce
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log("\nNonce:", nonce);

    // Check block
    const block = await provider.getBlock("latest");
    console.log("Block:", block.number);
    console.log("Block gasLimit:", block.gasLimit?.toString());
    console.log("Block baseFeePerGas:", block.baseFeePerGas?.toString());

    // Try estimateGas for the execute call
    const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
    const iface = new ethers.Interface([
        "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
        "function execute(bytes calldata message, tuple(uint64 refTime, uint64 proofSize) weight) external"
    ]);

    // Simple test hex (ClearOrigin — known working)
    const simpleHex = "0x0504020000";  // V5, 1 instruction, ClearOrigin

    // Actually let's build a proper one
    const { ApiPromise, WsProvider } = require("@polkadot/api");
    const wsProvider = new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const api = await ApiPromise.create({ provider: wsProvider });

    const msg = api.createType("XcmVersionedXcm", {
        V5: [{ ClearOrigin: null }]
    });
    const msgHex = msg.toHex();

    // weighMessage
    const weighData = iface.encodeFunctionData("weighMessage", [msgHex]);
    const weighResult = await provider.call({ to: XCM_PRECOMPILE, data: weighData });
    const decoded = iface.decodeFunctionResult("weighMessage", weighResult);
    console.log("\nClearOrigin weight:", decoded[0].refTime.toString(), decoded[0].proofSize.toString());

    const weight = { refTime: decoded[0].refTime * 2n, proofSize: decoded[0].proofSize * 2n + 1000n };
    const execData = iface.encodeFunctionData("execute", [msgHex, weight]);

    // Try estimateGas
    console.log("\n--- Estimate Gas ---");
    try {
        const gasEstimate = await provider.estimateGas({
            from: wallet.address,
            to: XCM_PRECOMPILE,
            data: execData,
        });
        console.log("Gas estimate:", gasEstimate.toString());
    } catch (e) {
        console.log("estimateGas error:", e.message.substring(0, 200));
    }

    // Try sending a simple ClearOrigin execute as a legacy tx (type 0)
    console.log("\n--- Test: Send ClearOrigin (type 0 / legacy tx) ---");
    try {
        const tx = await wallet.sendTransaction({
            to: XCM_PRECOMPILE,
            data: execData,
            type: 0,  // Legacy tx
            gasLimit: 1000000n,
            gasPrice: feeData.gasPrice || 1000000000n,
        });
        console.log("TX Hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Status:", receipt.status === 1 ? "SUCCESS" : "REVERT");
        console.log("Gas used:", receipt.gasUsed.toString());
    } catch (e) {
        console.log("❌ Error:", e.message.substring(0, 300));

        // Try type 2 (EIP-1559)
        console.log("\n--- Test: Send ClearOrigin (type 2 / EIP-1559) ---");
        try {
            const tx = await wallet.sendTransaction({
                to: XCM_PRECOMPILE,
                data: execData,
                type: 2,
                gasLimit: 1000000n,
                maxFeePerGas: (feeData.maxFeePerGas || 10000000000n) * 2n,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0n,
            });
            console.log("TX Hash:", tx.hash);
            const receipt = await tx.wait();
            console.log("✅ Status:", receipt.status === 1 ? "SUCCESS" : "REVERT");
            console.log("Gas used:", receipt.gasUsed.toString());
        } catch (e2) {
            console.log("❌ Error:", e2.message.substring(0, 300));
        }
    }

    await api.disconnect();
    process.exit(0);
}

main().catch(console.error);
