const { createClient } = require("polkadot-api");
const { getWsProvider } = require("polkadot-api/ws-provider/node");
const { dotah } = require("@polkadot-api/descriptors");

// Constants
const MOONBEAM_PARA_ID = 2004;
const XCMPROXY_ADDRESS = "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58";
const FEE_DOT = 10000000000n; // 1 DOT Fee
const AMOUNT_DOT = 5000000000n; // 0.5 DOT Amount
const CALL_DATA_HEX = "0x3e4fba36c129b1150c607e89d5ee9437a1c04bfdc88b181ded66c3e9e20b7d5d0fe35d88000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000ee6b280000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c77808000000000000000000000000000000000000000000000000000000000000000e0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff3cb0000000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

const Binary = (hex) => ({
    asHex: () => hex,
    asBytes: () => {
        const bytes = [];
        for (let c = 2; c < hex.length; c += 2)
            bytes.push(parseInt(hex.substr(c, 2), 16));
        return new Uint8Array(bytes);
    }
});

async function main() {
    console.log("Connecting to Asset Hub via PAPI...");
    const client = createClient(getWsProvider("wss://polkadot-asset-hub-rpc.polkadot.io"));
    const api = client.getTypedApi(dotah); // Get typed API from descriptors

    // 1. Get Codecs
    // Need to verify exact path for XcmVersionedXcm in PAPI descriptors
    // Usually via api.types or external import from descriptors

    // Using import from descriptors directly may be easier if generated
    const { XcmVersionedXcm } = require("@polkadot-api/descriptors");

    // 2. Construct XCM V4 Message
    // Structure: V4([{ WithdrawAsset: ... }, { DepositReserveAsset: ... }])

    const message = {
        type: "V4",
        value: [
            {
                type: "WithdrawAsset", // Instruction
                value: [
                    {
                        id: {
                            parents: 1,
                            interior: { type: "Here" }
                        },
                        fun: {
                            type: "Fungible",
                            value: AMOUNT_DOT
                        }
                    }
                ]
            },
            {
                type: "DepositReserveAsset",
                value: {
                    assets: {
                        type: "Wild",
                        value: { type: "All" }
                    },
                    dest: {
                        parents: 1,
                        interior: {
                            type: "X1",
                            value: [{
                                type: "Parachain",
                                value: MOONBEAM_PARA_ID
                            }]
                        }
                    },
                    xcm: [
                        {
                            type: "BuyExecution",
                            value: {
                                fees: {
                                    id: {
                                        parents: 1,
                                        interior: { type: "Here" }
                                    },
                                    fun: {
                                        type: "Fungible",
                                        value: FEE_DOT
                                    }
                                },
                                weight_limit: { type: "Unlimited" }
                            }
                        },
                        {
                            type: "DepositAsset",
                            value: {
                                assets: {
                                    type: "Wild",
                                    value: { type: "AllCounted", value: 1 }
                                },
                                beneficiary: {
                                    parents: 0,
                                    interior: {
                                        type: "X1",
                                        value: [{
                                            type: "AccountKey20",
                                            value: {
                                                network: undefined, // Option<NetworkId> -> undefined for None
                                                key: Binary(XCMPROXY_ADDRESS).asBytes() // 20 bytes
                                            }
                                        }]
                                    }
                                }
                            }
                        },
                        {
                            type: "Transact",
                            value: {
                                origin_kind: "SovereignAccount",
                                require_weight_at_most: { ref_time: 5000000000n, proof_size: 250000n },
                                call: {
                                    encoded: Binary(CALL_DATA_HEX).asBytes()
                                }
                            }
                        }
                    ]
                }
            }
        ]
    };

    // 3. Encode
    // We need the codec for XcmVersionedXcm.
    // PAPI exposes verify/encode often via .enc() on the type definition if imported from descriptors?
    // Or via the API client.

    // Let's try to get the codec via the typed API if possible or check docs usage.
    // Based on user snippet/docs: `codecs.Types.XcmVersionedXcm.enc(xcmMessage)`
    // But getting codecs requires API?

    // const codecs = await api.compatibility.getTypedCodecs(); // Not standard PAPI?
    // PAPI (v1) uses generated types that have .enc() ?

    // Let's try importing the specific type from descriptors if it has .enc
    // require("@polkadot-api/descriptors").dotah.types.XcmVersionedXcm ?

    // Let's guess:
    // import { dotah } from "@polkadot-api/descriptors";
    // const encoder = dotah.types.staging_xcm_v4_location_Location.enc; // Example

    // Let's print available types to verify path
    console.log("Checking available types in dotah descriptor...");
    // console.log(Object.keys(dotah.types)); 

    // Wait, the standard way in modern PAPI: 
    // const myCodec = XcmVersionedXcm.enc(myValue); (If imported correctly)

    // I will try to use the `dotah` object to find the `enc` function for `XcmVersionedXcm`.
    // It is likely `dotah.types.xcm_versioned_xcm.enc`.

    try {
        // Warning: Type names are often snake_cased in PAPI generated descriptors keys
        // XcmVersionedXcm -> xcm_versioned_xcm?
        // Or capitalized?

        // I'll try to iterate or guess.
        // Actually, let's use the Dynamic API as a fallback if typed fails locally.

        // BUT user wanted typed PAPI.
        // Let's assume standard path: `dotah.types.XcmVersionedXcm`

        // Note: Hex string for AccountKey20 must be Uint8Array(20).

    } catch (e) { console.error(e); }

    // Placeholder until I verify the import path in the next step by running a probe.
    console.log("To be implemented: Encoding logic verification.");
}

// I will write a probe script first to find the exact codec location.
// SKIP writing this full script and write a PROBE first.
