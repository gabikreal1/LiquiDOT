/**
 * Dry-run XCM on Asset Hub + Moonbeam using PAPI DryRunApi
 * 
 * 1) Asset Hub: dry_run_call(PolkadotXcm.execute(...)) — simulates the sender side
 * 2) Moonbeam:  dry_run_xcm(origin, inner_xcm)        — simulates the receiver side
 */
const { dotah, moonbeam } = require("@polkadot-api/descriptors");
const { createClient, Binary, FixedSizeBinary } = require("polkadot-api");
const { getWsProvider } = require("@polkadot-api/ws-provider/node");
const { ethers } = require("ethers");
const { blake2AsU8a } = require("@polkadot/util-crypto");
require("dotenv").config();

// ─── Helpers ─────────────────────────────────────────────
function bigintToU256(val) {
    const mask = (1n << 64n) - 1n;
    return [val & mask, (val >> 64n) & mask, (val >> 128n) & mask, (val >> 192n) & mask];
}

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

// ─── Config ──────────────────────────────────────────────
const XCMPROXY = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
const xcDOT = "0xffffffff1fcacbd218edc0eba20fc2308c778080";
const USER = "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58";
// SS58 address of the sender on Asset Hub (from PRIVATE_KEY)
const SENDER_SS58 = process.env.SENDER_SS58 || "13dEYKDJZwY7nxXj3Y5FXJYp8zktsmQikpbGe2otP5u52BKY";

async function main() {
    console.log("═══════════════════════════════════════════");
    console.log("  XCM DRY RUN — Asset Hub → Moonbeam");
    console.log("═══════════════════════════════════════════\n");

    // ─── Clients ─────────────────────────────────────────
    const mbProvider = getWsProvider("wss://wss.api.moonbeam.network");
    const mbClient = createClient(mbProvider);
    const mbApi = mbClient.getTypedApi(moonbeam);

    const ahProvider = getWsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const ahClient = createClient(ahProvider);
    const ahApi = ahClient.getTypedApi(dotah);

    try {
        // ─── Build Moonbeam EVM.call ─────────────────────
        const sovereignAddr = getSovereignAccount(1000);
        console.log("Sovereign Addr:", sovereignAddr);

        const iface = new ethers.Interface(["function receiveAssets(bytes32, address, address, uint256, bytes)"]);
        const remoteId = ethers.hexlify(ethers.randomBytes(32));
        const paramsType = ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"];
        const paramsVal = ["0x0000000000000000000000000000000000000001", xcDOT, [0, 0], -800000, 800000, USER, 500];
        const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(paramsType, paramsVal);
        const evmInput = iface.encodeFunctionData("receiveAssets", [remoteId, xcDOT, USER, "3000000000", encodedParams]);

        const mbTx = mbApi.tx.EVM.call({
            source: FixedSizeBinary.fromHex(sovereignAddr),
            target: FixedSizeBinary.fromHex(XCMPROXY.toLowerCase()),
            input: Binary.fromHex(evmInput),
            value: bigintToU256(0n),
            gas_limit: 300000n,
            max_fee_per_gas: bigintToU256(25000000000n),
            max_priority_fee_per_gas: bigintToU256(0n),
            nonce: undefined,
            access_list: [],
            authorization_list: [],
        });

        const encodedCall = await mbTx.getEncodedData();
        const encodedCallHex = encodedCall.asHex();
        console.log("Moonbeam EVM.call encoded ✓  (", encodedCallHex.length / 2, "bytes)\n");

        // ─── Build inner XCM (what Moonbeam receives) ────
        const innerXcm = [
            {
                type: "BuyExecution",
                value: {
                    fees: {
                        id: { parents: 1, interior: { type: "Here", value: undefined } },
                        fun: { type: "Fungible", value: 400000000n }, // 0.4 DOT
                    },
                    weight_limit: { type: "Unlimited", value: undefined },
                },
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
                                value: { network: undefined, key: FixedSizeBinary.fromHex(XCMPROXY.toLowerCase()) },
                            },
                        },
                    },
                },
            },
            {
                type: "Transact",
                value: {
                    origin_kind: { type: "SovereignAccount", value: undefined },
                    fallback_max_weight: { ref_time: 800000000n, proof_size: 100000n },
                    call: Binary.fromHex(encodedCallHex),
                },
            },
        ];

        // ─── Build outer XCM (what sender executes on Asset Hub) ───
        const outerMsg = {
            type: "V5",
            value: [
                {
                    type: "WithdrawAsset",
                    value: [{
                        id: { parents: 1, interior: { type: "Here", value: undefined } },
                        fun: { type: "Fungible", value: 1000000000n }, // 1 DOT
                    }],
                },
                {
                    type: "BuyExecution",
                    value: {
                        fees: {
                            id: { parents: 1, interior: { type: "Here", value: undefined } },
                            fun: { type: "Fungible", value: 1000000000n }, // 1 DOT
                        },
                        weight_limit: { type: "Unlimited", value: undefined },
                    },
                },
                {
                    type: "DepositReserveAsset",
                    value: {
                        assets: { type: "Wild", value: { type: "All", value: undefined } },
                        dest: {
                            parents: 1,
                            interior: { type: "X1", value: { type: "Parachain", value: 2004 } },
                        },
                        xcm: innerXcm,
                    },
                },
            ],
        };

        // ═══════════════════════════════════════════════════
        //  DRY RUN 1: Asset Hub — PolkadotXcm.execute
        // ═══════════════════════════════════════════════════
        console.log("──────────────────────────────────────────");
        console.log("  DRY RUN 1: Asset Hub (PolkadotXcm.execute)");
        console.log("──────────────────────────────────────────");

        const ahExecuteTx = ahApi.tx.PolkadotXcm.execute({
            message: outerMsg,
            max_weight: { ref_time: 100000000000n, proof_size: 5000000n },
        });

        // dry_run_call needs: origin (RuntimeOrigin enum), call (decoded), result_xcms_version
        const ahResult = await ahApi.apis.DryRunApi.dry_run_call(
            { type: "system", value: { type: "Signed", value: SENDER_SS58 } },
            ahExecuteTx.decodedCall,
            5, // result_xcms_version = V5
        );

        console.log("\nAsset Hub dry_run_call result:");
        console.log(JSON.stringify(ahResult, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

        // ═══════════════════════════════════════════════════
        //  DRY RUN 2: Moonbeam — incoming XCM
        // ═══════════════════════════════════════════════════
        console.log("\n──────────────────────────────────────────");
        console.log("  DRY RUN 2: Moonbeam (incoming XCM)");
        console.log("──────────────────────────────────────────");

        // Origin: Asset Hub parachain (from relay → para 1000)
        const assetHubOrigin = {
            type: "V5",
            value: {
                parents: 1,
                interior: { type: "X1", value: { type: "Parachain", value: 1000 } },
            },
        };

        // The XCM that Moonbeam would receive includes ReserveAssetDeposited + innerXcm
        const moonbeamIncomingXcm = {
            type: "V5",
            value: [
                {
                    type: "ReserveAssetDeposited",
                    value: [{
                        id: { parents: 1, interior: { type: "Here", value: undefined } },
                        fun: { type: "Fungible", value: 600000000n }, // approx after AH fees
                    }],
                },
                ...innerXcm,
            ],
        };

        const mbResult = await mbApi.apis.DryRunApi.dry_run_xcm(
            assetHubOrigin,
            moonbeamIncomingXcm,
        );

        console.log("\nMoonbeam dry_run_xcm result:");
        console.log(JSON.stringify(mbResult, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        mbClient.destroy();
        ahClient.destroy();
    }
}

main();
