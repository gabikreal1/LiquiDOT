const { ethers } = require("hardhat");

const XCM_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000804"; // Standard XCM Precompile?
// Wait. Asset Hub might use a different address.
// Common Polkadot XCM Precompile: 0x0000000000000000000000000000000000000804 ??
// Or 0x00...0a0000 ??
// My Adapter used: 0x00000000000000000000000000000000000a0000 (standard for some parachains)
// Let's verify the address. 
// Standard Precompiles often start at 0x...0800 or 0x...0400.
// But check what I used in Adapter: 0x00000000000000000000000000000000000a0000
// I will reuse that.

const PRECOMPILE_ADDR = "0x0000000000000000000000000000000000000804";
// Wait, I should check my Adapter source code to be sure what I deployed.
// View file 436 showed XCM_PRECOMPILE but didn't show the constant definition in Adapter.
// I'll assume 0x0000000000000000000000000000000000000804 (Common) or 0x...0800.
// Let's check the code first in next step if verification fails.
// For now I will use the one from generic docs: 0x0000000000000000000000000000000000000804 usually.
// Contract `XcmExecuteAdapter.sol` had: address public constant XCM_PRECOMPILE = 0x0000000000000000000000000000000000000804; (I need to verify this).

const XCM_MESSAGE_HEX = "0x040800040100000700f2052a010e0100010100511f0c1301000002286bee000d010204000103000cfb7ce7d66c7cdae5827074c5f5a62223a0c23006010700f2052a0142420f0011083e4fba36bdc204a50b4c0f2475708e5ec2f07a1d2ec633ebae99f3505f24bdfc6693a6d1000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000ee6b280000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c77808000000000000000000000000000000000000000000000000000000000000000e0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff3cb0000000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

async function main() {
    console.log("Testing Direct XCM Execution...");
    const [deployer] = await ethers.getSigners();

    // Check actual balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatUnits(balance, 18), "DOT");

    // XCM Precompile Interface (Minimal)
    const abi = [
        "function execute(bytes calldata message, uint256 maxWeight) external returns (uint256)"
        // Note: Some use tuple params for weight?
        // (uint64 refTime, uint64 proofSize)
        // Let's check standard: "function execute(bytes calldata message, (uint64, uint64) maxWeight)"
    ];

    // I need to know the specific ABI signature.
    // I'll guess Tuple first.
    const iface = new ethers.Interface([
        "function execute(bytes message, tuple(uint64 refTime, uint64 proofSize) maxWeight)"
    ]);

    const precompile = new ethers.Contract(PRECOMPILE_ADDR, iface, deployer);

    const weight = { refTime: 10_000_000_000n, proofSize: 500_000n }; // Generous

    console.log("Sending...");
    try {
        const tx = await precompile.execute(XCM_MESSAGE_HEX, weight, { gasLimit: 500000 });
        console.log("TX Signed:", tx.hash);
        await tx.wait();
        console.log("✅ Executed Successfully!");
    } catch (e) {
        console.log("❌ Failed:", e);
    }
}

main().catch(console.error);
