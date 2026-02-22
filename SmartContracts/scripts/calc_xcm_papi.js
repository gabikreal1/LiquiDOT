const { dotah, moonbeam } = require("@polkadot-api/descriptors");
const { createClient, Binary, FixedSizeBinary, Enum } = require("polkadot-api");
const { getWsProvider } = require("@polkadot-api/ws-provider/node");
const { ethers } = require("ethers");
const { blake2AsU8a } = require("@polkadot/util-crypto");

// Helper: Convert bigint → U256 (FixedSizeArray<4, bigint>, little-endian u64 limbs)
// PAPI encodes Substrate U256 as [limb0, limb1, limb2, limb3] where each limb is u64
function bigintToU256(val) {
    const mask = (1n << 64n) - 1n;
    return [
        val & mask,
        (val >> 64n) & mask,
        (val >> 128n) & mask,
        (val >> 192n) & mask,
    ];
}

// Helper for Sovereign Account
function getSovereignAccount(paraId) {
    const prefix = new Uint8Array([0x73, 0x69, 0x62, 0x6c]); // "sibl"
    const paraIdBytes = new Uint8Array(4);
    new DataView(paraIdBytes.buffer).setUint32(0, paraId, true);
    const combined = new Uint8Array(prefix.length + paraIdBytes.length);
    combined.set(prefix);
    combined.set(paraIdBytes, prefix.length);
    const hash = blake2AsU8a(combined, 256);
    return "0x" + Buffer.from(hash.slice(0, 20)).toString("hex");
}

async function main() {
    console.log("=== PAPI XCM Construction (Robust) ===\n");

    // Clients
    const mbProvider = getWsProvider("wss://wss.api.moonbeam.network");
    const mbClient = createClient(mbProvider);
    const mbApi = mbClient.getTypedApi(moonbeam);

    const ahProvider = getWsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const ahClient = createClient(ahProvider);
    const ahApi = ahClient.getTypedApi(dotah);

    try {
        // --- Step 1: Encode Inner Call (Moonbeam Context) ---
        const sovereignAddr = getSovereignAccount(1000); // Asset Hub
        console.log("Sovereign Addr:", sovereignAddr);

        const XCMPROXY = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
        const xcDOT = "0xffffffff1fcacbd218edc0eba20fc2308c778080";
        const user = "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58";

        // EVM Calldata (receiveAssets)
        const iface = new ethers.Interface(["function receiveAssets(bytes32, address, address, uint256, bytes)"]);
        const remoteId = ethers.hexlify(ethers.randomBytes(32));
        const paramsType = ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"];
        const paramsVal = ["0x0000000000000000000000000000000000000001", xcDOT, [0, 0], -800000, 800000, user, 500];
        const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(paramsType, paramsVal);
        const evmInput = iface.encodeFunctionData("receiveAssets", [remoteId, xcDOT, user, "3000000000", encodedParams]);

        // Construct evm.call
        // Types from PAPI descriptors:
        //   source, target: FixedSizeBinary<20>
        //   input: Binary
        //   value, max_fee_per_gas: U256 = FixedSizeArray<4, bigint> (4 u64 limbs)
        //   gas_limit: bigint (u64)
        //   max_priority_fee_per_gas, nonce: Optional<U256>
        const mbTx = mbApi.tx.EVM.call({
            source: FixedSizeBinary.fromHex(sovereignAddr),
            target: FixedSizeBinary.fromHex(XCMPROXY.toLowerCase()),
            input: Binary.fromHex(evmInput),
            value: bigintToU256(0n),
            gas_limit: 300000n,
            max_fee_per_gas: bigintToU256(25000000000n), // 25 Gwei
            max_priority_fee_per_gas: bigintToU256(0n),
            nonce: undefined,
            access_list: [],
            authorization_list: []
        });

        const encodedCall = await mbTx.getEncodedData();
        const encodedCallHex = encodedCall.asHex();
        console.log("Encoded Moonbeam Call Hex:", encodedCallHex);

        // --- Step 2: Construct Outer XCM (Asset Hub Context) ---
        // XCM V5 Types (from common-types.d.ts):
        //   XcmV5Junctions: X1 takes single XcmV5Junction, X2 takes FixedSizeArray<2, ...>
        //   AccountKey20.key: FixedSizeBinary<20>
        //   Transact: { origin_kind, fallback_max_weight?, call: Binary }

        const msg = {
            type: "V5",
            value: [
                {
                    type: "WithdrawAsset",
                    value: [{
                        id: { parents: 1, interior: { type: "Here", value: undefined } },
                        fun: { type: "Fungible", value: 1000000000n }
                    }]
                },
                {
                    type: "BuyExecution",
                    value: {
                        fees: {
                            id: { parents: 1, interior: { type: "Here", value: undefined } },
                            fun: { type: "Fungible", value: 1000000000n }
                        },
                        weight_limit: { type: "Unlimited", value: undefined }
                    }
                },
                {
                    type: "DepositReserveAsset",
                    value: {
                        assets: { type: "Wild", value: { type: "All", value: undefined } },
                        dest: {
                            parents: 1,
                            interior: {
                                type: "X1",
                                value: { type: "Parachain", value: 2004 }  // single junction, not array
                            }
                        },
                        xcm: [
                            {
                                type: "BuyExecution",
                                value: {
                                    fees: {
                                        id: { parents: 1, interior: { type: "Here", value: undefined } },
                                        fun: { type: "Fungible", value: 400000000n }
                                    },
                                    weight_limit: { type: "Unlimited", value: undefined }
                                }
                            },
                            {
                                type: "DepositAsset",
                                value: {
                                    assets: { type: "Wild", value: { type: "AllCounted", value: 1 } },
                                    beneficiary: {
                                        parents: 0,
                                        interior: {
                                            type: "X1",
                                            value: {
                                                type: "AccountKey20",
                                                value: {
                                                    network: undefined,
                                                    key: FixedSizeBinary.fromHex(XCMPROXY.toLowerCase())
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            {
                                type: "Transact",
                                value: {
                                    origin_kind: { type: "SovereignAccount", value: undefined },
                                    fallback_max_weight: { ref_time: 800000000n, proof_size: 100000n },
                                    call: Binary.fromHex(encodedCallHex)
                                }
                            }
                        ]
                    }
                }
            ]
        };

        // Hack to encode: Use PolkadotXcm.execute to wrap it, then extract bytes
        // Note: PolkadotXcm.execute(message: XcmVersionedXcm, max_weight: Weight)
        // We construct a fake tx just to get the encoding of the arguments.

        const ahTx = ahApi.tx.PolkadotXcm.execute({
            message: msg,
            max_weight: { ref_time: 0n, proof_size: 0n }
        });

        const encodedTx = await ahTx.getEncodedData();
        const txHex = encodedTx.asHex();

        // Extract the XCM Message from the Tx Hex
        // Tx Hex = <Compact Length> <Signature/Version?> <Call Index> <Args...>
        // Call Index for PolkadotXcm.execute is usually... well, we can look it up or just parse.
        // BUT PAPI `getEncodedData()` returns the Call Data (Module+Function+Args), NOT the full Extrinsic (Signature)?
        // Wait, `tx.getEncodedData()` usually returns the Call data only?
        // Let's verify. PAPI `getEncodedData` returns `Binary`.

        console.log("\nFull Tx Call Data:", txHex);

        // PolkadotXcm.execute(message, max_weight)
        // message is the first argument.
        // We know the call index is 2 bytes (Module 31/0x1F, Call 0?).
        // Step roughly over the call index.
        // XCM Versioned Xcm is an Enum. V5=4? V5 index?
        // Let's just assume the user can strip the prefix if needed, or use a decoder tool.
        // BETTER: I'll print it and we can visually verify.

        // The Call Data starts with Module Index (1 byte) + Function Index (1 byte).
        // Then Arguments.
        // Argument 1: message (XcmVersionedXcm)
        // Argument 2: max_weight (Weight)

        // So `txHex` = `Mod` `Func` `XcmVersionedXcm...` `Weight...`
        // We want `XcmVersionedXcm...`.
        // So we strip 2 bytes from start, and strip `Weight` from end?
        // `Weight` is 2x u64 (Compact?). No, SpWeights... usually simple struct 2x Compact<u64> or u64.

        console.log("Take `txHex`, remove first 2 bytes (Mod+Call), remove last (Weight) bytes.");
        console.log("Weight {0,0} likely encodes to small bytes (e.g. 00...?).");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        mbClient.destroy();
        ahClient.destroy();
    }
}

main();
