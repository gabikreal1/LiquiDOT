/**
 * Live XCM Dispatch — Using InitiateTransfer with preserve_origin: true
 * 
 * Fix for: DepositReserveAsset injects ClearOrigin → Transact gets BadOrigin
 * Solution: XCM V5 InitiateTransfer preserves the origin so Transact can dispatch
 * 
 * Message structure:
 *   WithdrawAsset(1 DOT)
 *   BuyExecution(1 DOT - AH fees)
 *   InitiateTransfer {
 *     destination: Moonbeam,
 *     remote_fees: ReserveDeposit(DOT),  // fees for Moonbeam execution
 *     preserve_origin: true,             // KEY FIX: keeps origin for Transact
 *     assets: [],                        // remaining DOT transferred as part of remote_fees
 *     remote_xcm: [
 *       DepositAsset → XCMProxy,
 *       Transact → EthereumXcm.transact(receiveAssets)
 *     ]
 *   }
 */
const { dotah, moonbeam } = require("@polkadot-api/descriptors");
const { createClient, Binary, FixedSizeBinary } = require("polkadot-api");
const { getWsProvider } = require("@polkadot-api/ws-provider/node");
const { ethers } = require("ethers");
require("dotenv").config();

function bigintToU256(val) {
    const mask = (1n << 64n) - 1n;
    return [val & mask, (val >> 64n) & mask, (val >> 128n) & mask, (val >> 192n) & mask];
}

const XCMPROXY = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
const xcDOT = "0xffffffff1fcacbd218edc0eba20fc2308c778080";
const USER_ADDR = "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58";
const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const ASSET_HUB_RPC = "https://eth-rpc.polkadot.io/";

async function main() {
    console.log("══════════════════════════════════════════════════");
    console.log("  LIVE XCM — InitiateTransfer + preserve_origin");
    console.log("══════════════════════════════════════════════════\n");

    // ─── 1. Connect ──────────────────────────────────
    const mbClient = createClient(getWsProvider("wss://wss.api.moonbeam.network"));
    const mbApi = mbClient.getTypedApi(moonbeam);
    const ahClient = createClient(getWsProvider("wss://polkadot-asset-hub-rpc.polkadot.io"));
    const ahApi = ahClient.getTypedApi(dotah);

    const ethProvider = new ethers.JsonRpcProvider(ASSET_HUB_RPC);
    const wallet = new ethers.Wallet(process.env.ASSET_PK, ethProvider);
    console.log("Caller:", wallet.address);
    const bal = await ethProvider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(bal), "DOT\n");

    try {
        // ─── 2. Build EVM calldata ──────────────────────
        const REMOTE_ID = ethers.hexlify(ethers.randomBytes(32));
        console.log("Remote ID:", REMOTE_ID);

        const iface = new ethers.Interface(["function receiveAssets(bytes32, address, address, uint256, bytes)"]);
        const paramsType = ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"];
        const paramsVal = ["0x0000000000000000000000000000000000000001", xcDOT, [0, 0], -800000, 800000, USER_ADDR, 500];
        const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(paramsType, paramsVal);
        const evmInput = iface.encodeFunctionData("receiveAssets", [REMOTE_ID, xcDOT, USER_ADDR, "3000000000", encodedParams]);

        // ─── 3. Encode EthereumXcm.transact ─────────────
        const mbTx = mbApi.tx.EthereumXcm.transact({
            xcm_transaction: {
                type: "V2",
                value: {
                    gas_limit: bigintToU256(300000n),
                    action: { type: "Call", value: FixedSizeBinary.fromHex(XCMPROXY.toLowerCase()) },
                    value: bigintToU256(0n),
                    input: Binary.fromHex(evmInput),
                    access_list: undefined,
                }
            }
        });
        const encodedCallHex = (await mbTx.getEncodedData()).asHex();
        console.log("EthereumXcm.transact:", encodedCallHex.length / 2, "bytes ✓");

        // ─── 4. Build XCM V5 with InitiateTransfer ──────
        const DOT_LOCATION = { parents: 1, interior: { type: "Here", value: undefined } };

        const msg = {
            type: "V5",
            value: [
                // 1. Withdraw DOT from caller's AH account
                {
                    type: "WithdrawAsset",
                    value: [{
                        id: DOT_LOCATION,
                        fun: { type: "Fungible", value: 1000000000n }  // 1 DOT
                    }]
                },
                // 2. Pay AH execution fees
                {
                    type: "BuyExecution",
                    value: {
                        fees: { id: DOT_LOCATION, fun: { type: "Fungible", value: 1000000000n } },
                        weight_limit: { type: "Unlimited", value: undefined }
                    }
                },
                // 3. InitiateTransfer: sends remaining DOT to Moonbeam, preserves origin
                {
                    type: "InitiateTransfer",
                    value: {
                        destination: {
                            parents: 1,
                            interior: { type: "X1", value: { type: "Parachain", value: 2004 } }
                        },
                        // remote_fees: specify DOT as fee asset via reserve deposit
                        remote_fees: {
                            type: "ReserveDeposit",
                            value: {
                                type: "Wild",
                                value: { type: "All", value: undefined }
                            }
                        },
                        // KEY: preserve the origin so Transact can dispatch
                        preserve_origin: true,
                        // No additional assets beyond what's in remote_fees
                        assets: [],
                        // Remote XCM: deposit DOT to proxy, then transact
                        remote_xcm: [
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
                                                value: { network: undefined, key: FixedSizeBinary.fromHex(XCMPROXY.toLowerCase()) }
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

        // ─── 5. Dry-run on Asset Hub first ──────────────
        console.log("\n── Step 1: Asset Hub dry-run ──");
        const SENDER_SS58 = process.env.SENDER_SS58 || "13dEYKDJZwY7nxXj3Y5FXJYp8zktsmQikpbGe2otP5u52BKY";

        const ahExecuteTx = ahApi.tx.PolkadotXcm.execute({
            message: msg,
            max_weight: { ref_time: 100000000000n, proof_size: 5000000n }
        });

        const ahResult = await ahApi.apis.DryRunApi.dry_run_call(
            { type: "system", value: { type: "Signed", value: SENDER_SS58 } },
            ahExecuteTx.decodedCall,
            5,
        );

        if (!ahResult.success) {
            console.log("  ❌ AH dry-run failed:", JSON.stringify(ahResult, (_, v) => typeof v === 'bigint' ? v.toString() : v).substring(0, 300));
            throw new Error("AH dry-run failed");
        }

        const ahExec = ahResult.value.execution_result;
        console.log("  AH execution:", ahExec.type);
        if (ahExec.type === "Incomplete") {
            console.log("  Error:", ahExec.value.error.error.type);
        }

        // Extract forwarded XCMs
        const fwdXcms = ahResult.value.forwarded_xcms;
        if (fwdXcms && fwdXcms.length > 0) {
            const [destLocation, xcmMessages] = fwdXcms[0];
            console.log("  Forwarded to:", JSON.stringify(destLocation, (_, v) => typeof v === 'bigint' ? v.toString() : v));

            if (xcmMessages && xcmMessages.length > 0) {
                const fwdMsg = xcmMessages[0];
                console.log("  Instructions:", fwdMsg.value.map(i => i.type).join(", "));

                // ─── 6. Moonbeam dry-run with forwarded XCM ──
                console.log("\n── Step 2: Moonbeam dry-run (exact forwarded XCM) ──");
                const mbResult = await mbApi.apis.DryRunApi.dry_run_xcm(
                    { type: "V5", value: { parents: 1, interior: { type: "X1", value: { type: "Parachain", value: 1000 } } } },
                    fwdMsg,
                );

                if (mbResult.success) {
                    const mbExec = mbResult.value.execution_result;
                    if (mbExec.type === "Complete") {
                        console.log("  ✅ Moonbeam: Complete (ref_time=" + mbExec.value.used.ref_time + ")");
                    } else if (mbExec.type === "Incomplete") {
                        console.log("  ❌ Moonbeam: Incomplete — error=" + mbExec.value.error.error.type);
                        // Print events for more info
                        const events = mbResult.value.emitted_events || [];
                        for (const e of events) {
                            console.log("     Event:", e.type + "." + (e.value?.type || ""));
                        }
                        throw new Error("Moonbeam dry-run incomplete: " + mbExec.value.error.error.type);
                    }
                } else {
                    console.log("  ❌ Moonbeam API error:", JSON.stringify(mbResult).substring(0, 300));
                    throw new Error("Moonbeam dry-run API error");
                }
            }
        } else {
            console.log("  ⚠️ No forwarded XCMs from AH dry-run");
        }

        // ─── 7. Encode XCM for precompile ──────────────
        console.log("\n── Step 3: Encode XCM & weighMessage ──");
        const fullCallData = await ahExecuteTx.getEncodedData();
        const fullHex = fullCallData.asHex();
        const withoutCallIndex = fullHex.slice(6);
        const xcmHex = "0x" + withoutCallIndex.slice(0, -4);

        console.log("  XCM:", xcmHex.length / 2, "bytes");

        const precompileIface = new ethers.Interface([
            "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
            "function execute(bytes calldata message, tuple(uint64 refTime, uint64 proofSize) weight) external"
        ]);

        const weighData = precompileIface.encodeFunctionData("weighMessage", [xcmHex]);
        const weighResult = await ethProvider.call({ to: XCM_PRECOMPILE, data: weighData });
        const decoded = precompileIface.decodeFunctionResult("weighMessage", weighResult);
        const weight = {
            refTime: decoded[0].refTime * 110n / 100n,
            proofSize: decoded[0].proofSize * 110n / 100n
        };
        console.log(`  Weight: RefTime=${weight.refTime}, ProofSize=${weight.proofSize}`);

        // ─── 8. Ethers dry-run ──────────────────────────
        console.log("\n── Step 4: eth_call dry-run ──");
        const execData = precompileIface.encodeFunctionData("execute", [xcmHex, weight]);
        try {
            await wallet.call({ to: XCM_PRECOMPILE, data: execData });
            console.log("  ✅ Dry-run: SUCCESS");
        } catch (e) {
            console.log(`  ❌ Dry-run FAILED: ${e.reason || e.message}`);
            throw e;
        }

        // ─── 9. LIVE DISPATCH ───────────────────────────
        console.log("\n── Step 5: LIVE DISPATCH ──");
        console.log("  ⚠️ Spending ~1 DOT!\n");

        const feeData = await ethProvider.getFeeData();
        const gasEstimate = await ethProvider.estimateGas({ from: wallet.address, to: XCM_PRECOMPILE, data: execData });

        const tx = await wallet.sendTransaction({
            to: XCM_PRECOMPILE,
            data: execData,
            type: 0,
            gasLimit: gasEstimate * 2n,
            gasPrice: feeData.gasPrice,
        });

        console.log("  📤 TX Hash:", tx.hash);
        console.log("  ⏳ Waiting...\n");

        const receipt = await tx.wait();
        console.log("  ✅ Block:", receipt.blockNumber, "Gas:", receipt.gasUsed.toString(),
            "Status:", receipt.status === 1 ? "SUCCESS" : "REVERT");

    } catch (e) {
        console.error("\nError:", e.message?.substring(0, 500) || e);
    } finally {
        mbClient.destroy();
        ahClient.destroy();
    }

    console.log("\n═══ Done ═══");
    process.exit(0);
}

main().catch(console.error);
