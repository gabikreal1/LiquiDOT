const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");
const { encodeAddress } = require("@polkadot/util-crypto");
require("dotenv").config();

async function main() {
    console.log("=== Asset Hub Account Mapping Check ===\n");

    // Your EVM address (derived from ASSET_PK)
    const wallet = new ethers.Wallet(process.env.ASSET_PK);
    const evmAddress = wallet.address;
    console.log("EVM Address (H160):", evmAddress);

    // pallet-revive mapping: H160 + 12 bytes of 0xEE = AccountId32
    const evmBytes = ethers.getBytes(evmAddress); // 20 bytes
    const padding = new Uint8Array(12).fill(0xEE); // 12 bytes of 0xEE
    const mappedAccountId32 = new Uint8Array(32);
    mappedAccountId32.set(evmBytes, 0);
    mappedAccountId32.set(padding, 20);

    const mappedHex = "0x" + Buffer.from(mappedAccountId32).toString("hex");
    const mappedSS58 = encodeAddress(mappedAccountId32, 0); // Polkadot prefix = 0

    console.log("Mapped AccountId32 (hex):", mappedHex);
    console.log("Mapped SS58 Address:", mappedSS58);

    // Connect to Asset Hub
    const wsProvider = new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const api = await ApiPromise.create({ provider: wsProvider });

    // Check balances
    console.log("\n--- Balance Check ---");

    // 1. Check mapped account balance (the one XCM execute will use)
    const mappedAccount = await api.query.system.account(mappedAccountId32);
    console.log("Mapped EVM Account Balance:");
    console.log("  Free:", mappedAccount.data.free.toString(), "planck");
    console.log("  Free:", (Number(mappedAccount.data.free) / 1e10).toFixed(4), "DOT");
    console.log("  Reserved:", mappedAccount.data.reserved.toString(), "planck");

    // 2. Check EVM balance via eth-rpc
    const ethProvider = new ethers.JsonRpcProvider("https://eth-rpc.polkadot.io/");
    const evmBalance = await ethProvider.getBalance(evmAddress);
    console.log("\nEVM Balance (via eth-rpc):");
    console.log("  Wei:", evmBalance.toString());
    console.log("  DOT:", ethers.formatEther(evmBalance));

    // Summary
    console.log("\n--- Summary ---");
    const mappedFree = Number(mappedAccount.data.free);
    if (mappedFree > 0) {
        console.log("✅ Mapped account has", (mappedFree / 1e10).toFixed(4), "DOT");
        console.log("   XCM WithdrawAsset should work from EVM!");
    } else {
        console.log("❌ Mapped account has 0 DOT");
        console.log("   XCM WithdrawAsset will fail from EVM.");
        console.log("\n   To fix, send DOT to this SS58 address:");
        console.log("   ", mappedSS58);
        console.log("\n   Or transfer from your native account using polkadot.js");
    }

    await api.disconnect();
    process.exit(0);
}

main().catch(console.error);
