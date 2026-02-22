const { ethers } = require("hardhat");

const PRECOMPILE_ADDR = "0x0000000000000000000000000000000000000804";
const ALT_ADDR = "0x0000000000000000000000000000000000000800";

// Simple V3 XCM: WithdrawAsset(Here, 0) -> ClearOrigin
// Hex: 0x0302000400010000000600
// V4 Hex: ???
// Let's use the one from Calc script if possible or construct minimal.
// I will use a hardcoded minimal V3 first, as V3 is widely supported even if V4 is default.
// 0x03 (V3)
// 0x02 (2 instructions)
// Inst 1: WithdrawAsset (0x04) -> ...
// Let's use a known simple hex string from Polkadot JS apps or similar.
// Or just try the full V4 message we have, but also try a simpler one.

// Using the FULL message first, as that is what we need.
// Hex Message from previous step output (which is V4)
const FULL_XCM_HEX = "0x040800040100000700f2052a010e0100010100511f0c1301000002286bee000d010204000103000cfb7ce7d66c7cdae5827074c5f5a62223a0c23006010700f2052a0142420f0011083e4fba36c129b1150c607e89d5ee9437a1c04bfdc88b181ded66c3e9e20b7d5d0fe35d88000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000ee6b280000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c77808000000000000000000000000000000000000000000000000000000000000000e0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff3cb0000000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

async function main() {
    console.log("Testing weighMessage() with FULL XCM V4 Message...");
    const [deployer] = await ethers.getSigners();

    // Interface
    const iface = new ethers.Interface([
        "function weighMessage(bytes calldata message) external view returns (uint64 refTime, uint64 proofSize)"
    ]);

    // Check main address
    let precompile = new ethers.Contract(PRECOMPILE_ADDR, iface, deployer);
    console.log(`Calling weighMessage at ${PRECOMPILE_ADDR}...`);
    try {
        const result = await precompile.weighMessage(FULL_XCM_HEX);
        console.log("✅ Success!");
        console.log("   RefTime:", result.refTime.toString());
        console.log("   ProofSize:", result.proofSize.toString());
        return;
    } catch (e) {
        console.log("❌ Failed (Main):", e.shortMessage || e.message);
    }

    // Check alt address
    precompile = new ethers.Contract(ALT_ADDR, iface, deployer);
    console.log(`Calling weighMessage at ${ALT_ADDR}...`);
    try {
        const result = await precompile.weighMessage(FULL_XCM_HEX);
        console.log("✅ Success!");
        console.log("   RefTime:", result.refTime.toString());
        console.log("   ProofSize:", result.proofSize.toString());
        return;
    } catch (e) {
        console.log("❌ Failed (Alt):", e.shortMessage || e.message);
    }
}

main().catch(console.error);
