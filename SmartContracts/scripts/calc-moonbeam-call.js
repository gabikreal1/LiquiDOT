const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");
const { u8aToHex } = require("@polkadot/util");
const { blake2AsU8a } = require("@polkadot/util-crypto");

async function main() {
    console.log("=== Calculate Moonbeam Encoded Call (evm.call) ===\n");
    const wsProvider = new WsProvider("wss://wss.api.moonbeam.network");
    const api = await ApiPromise.create({ provider: wsProvider });

    // 1. Calculate Sovereign Account of Asset Hub (ParaId 1000) on Moonbeam
    const paraId = 1000;
    const prefix = new Uint8Array([0x73, 0x69, 0x62, 0x6c]); // "sibl"
    const paraIdBytes = new Uint8Array(4);
    new DataView(paraIdBytes.buffer).setUint32(0, paraId, true); // Little endian

    const combined = new Uint8Array(prefix.length + paraIdBytes.length);
    combined.set(prefix);
    combined.set(paraIdBytes, prefix.length);

    const hash = blake2AsU8a(combined, 256);
    const sovereignAddress = u8aToHex(hash.slice(0, 20));
    console.log("Asset Hub (1000) Sovereign Address on Moonbeam:", sovereignAddress);

    // 2. Build Inner EVM Call (receiveAssets)
    const XCMPROXY_ADDRESS = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
    const xcDOT = "0xffffffff1fcacbd218edc0eba20fc2308c778080";
    const user = "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58";
    const NET_AMOUNT = "3000000000"; // 0.3 DOT

    const proxyIface = new ethers.Interface([
        "function receiveAssets(bytes32, address, address, uint256, bytes)"
    ]);

    const REMOTE_ID = ethers.hexlify(ethers.randomBytes(32));

    const paramsType = ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"];
    const paramsVal = [
        "0x0000000000000000000000000000000000000001", // pool
        xcDOT, [0, 0], -800000, 800000, user, 500
    ];
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(paramsType, paramsVal);

    const evmInput = proxyIface.encodeFunctionData("receiveAssets", [
        REMOTE_ID, xcDOT, user, NET_AMOUNT, encodedParams
    ]);

    console.log("Inner EVM Input:", evmInput.substring(0, 50) + "...");

    // 3. Encode runtime call: evm.call
    if (api.tx.evm && api.tx.evm.call) {
        // Based on metadata inspection, call expects 10 args on Moonbeam
        const call = api.tx.evm.call(
            sovereignAddress,         // source
            XCMPROXY_ADDRESS,         // target
            evmInput,                 // input
            0n,                       // value
            5000000n,                 // gas_limit (generous)
            100000000000n,            // max_fee_per_gas (100 Gwei)
            0n,                       // max_priority_fee_per_gas
            null,                     // nonce
            [],                       // access_list
            []                        // authorization_list (EIP-7702) - 10th arg
        );

        console.log("\nEncoded Call Hex:", call.method.toHex());
        console.log("Call Length:", call.method.toHex().length / 2, "bytes");
    } else {
        console.log("Error: api.tx.evm.call not found!");
    }

    await api.disconnect();
    process.exit(0);
}

main().catch(console.error);
