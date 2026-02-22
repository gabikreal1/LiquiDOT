/**
 * Combined approach: 
 * 
 * 1. Use PolkadotXcm.execute() with DepositReserveAsset to:
 *    a) Send DOT to XCMProxy on Moonbeam (the actual DOT transfer)
 *    b) In the same inner XCM, deposit some DOT to the AH sovereign for future Transact fees
 *    
 * 2. Use PolkadotXcm.send() to send the Transact message
 *    With DescendOrigin preserving origin, WithdrawAsset from sovereign for fees
 *
 * But actually, can we just use DepositReserveAsset to fund the sovereign FIRST,
 * then in a second batch call use send()?
 * 
 * OR: Put both DOT deposit + Transact in PolkadotXcm.execute():
 *   execute(
 *     WithdrawAsset(2 DOT)
 *     BuyExecution(2 DOT)
 *     DepositReserveAsset {         // 1st: fund AH sovereign on MB 
 *       assets: 1 DOT,
 *       dest: Moonbeam,
 *       xcm: [BuyExecution, DepositAsset → AH_sovereign]
 *     }
 *   )
 *   
 * Then separately:
 *   send(Moonbeam, [
 *     WithdrawAsset(0.5 DOT from sovereign)
 *     BuyExecution(0.5 DOT)
 *     DepositAsset(remaining → XCMProxy)
 *     Transact(EthereumXcm.transact)
 *   ])
 *
 * BUT WAIT — DepositReserveAsset deposits to AH sovereign?? 
 * No, DepositReserveAsset deposits to whoever the inner XCM says.
 * The ReserveAssetDeposited instruction credits DOT to the holding register.
 * DepositAsset then moves from holding to a specific account.
 * 
 * So if the inner xcm says DepositAsset → AH_sovereign_on_moonbeam,
 * the DOT will go to the sovereign account. 
 * 
 * But what IS the AH sovereign address on Moonbeam?
 * On Moonbeam (H160-based), the sovereign account of para 1000 is:
 * H160 hash of "sibl" + 1000_le_bytes 
 *
 * Actually for Moonbeam, the sovereign account address is:
 * AccountKey20 derived from the 32-byte account
 * The 32-byte account is: b"sibl" + paraId.to_le_bytes() + padding_zeros
 * Then on Moonbeam it's truncated/hashed to H160
 *
 * Hmm, this is getting complex. Let me try a MUCH simpler approach:
 *
 * Just use PolkadotXcm.send() with UnpaidExecution 
 * (if the barrier allows it for Sibling(1000))
 * 
 * We already tested: UnpaidExecution → Barrier rejection.
 * So the message needs BuyExecution, which needs DOT.
 *
 * What if we put ALL instructions in DepositReserveAsset's inner XCM,
 * but instead of using Transact, we could call a Moonbeam precompile
 * that doesn't need origin? Actually EthereumXcm needs origin.
 * 
 * OK let me try the SIMPLEST thing: just do a reserve transfer to 
 * the AH sovereign account on Moonbeam first.
 * The AH sovereign on Moonbeam H160 is known.
 */
const { dotah, moonbeam } = require("@polkadot-api/descriptors");
const { createClient, Binary, FixedSizeBinary } = require("polkadot-api");
const { getWsProvider } = require("@polkadot-api/ws-provider/node");
const { ethers } = require("ethers");
const { blake2AsU8a } = require("@polkadot/util-crypto");
require("dotenv").config();

function bigintToU256(val) {
    const mask = (1n << 64n) - 1n;
    return [val & mask, (val >> 64n) & mask, (val >> 128n) & mask, (val >> 192n) & mask];
}

const XCMPROXY = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";

async function main() {
    console.log("═══════════════════════════════════════════════");
    console.log("  Compute sovereign + test send()");
    console.log("═══════════════════════════════════════════════\n");

    const mbClient = createClient(getWsProvider("wss://wss.api.moonbeam.network"));
    const mbApi = mbClient.getTypedApi(moonbeam);
    const ahClient = createClient(getWsProvider("wss://polkadot-asset-hub-rpc.polkadot.io"));
    const ahApi = ahClient.getTypedApi(dotah);

    const origin_sibling1000 = {
        type: "V5",
        value: { parents: 1, interior: { type: "X1", value: { type: "Parachain", value: 1000 } } },
    };

    try {
        // ═══ Compute AH sovereign account on Moonbeam ═══
        // Formula: blake2_256(b"sibl" + para_id.to_le_bytes())
        const paraIdBuf = Buffer.alloc(4);
        paraIdBuf.writeUInt32LE(1000);
        const prefix = Buffer.from("sibl");
        const input = Buffer.concat([prefix, paraIdBuf]);
        const hash = blake2AsU8a(input, 256);
        const sovereignAccountId32 = "0x" + Buffer.from(hash).toString("hex");

        // On Moonbeam (H160), the AccountId32 maps to H160 by truncating first 20 bytes
        // Actually no, Moonbeam has a specific mapping: it looks up via HashedDescription
        // For sibling origins, Moonbeam uses HashedDescription<AccountId, DescribeFamily<DescribeAllTerminal>>
        // which hashes: (b"SiblingChain", 1000)
        // Let me compute this properly

        // Moonbeam's XCM origin → AccountId20 mapping:
        // For Sibling(1000): 
        // hash = blake2_256(b"SiblingChain" + scale_encode(1000u32))
        const sibPrefix = Buffer.from("SiblingChain");
        // SCALE encode u32(1000) = e8 03 00 00
        const sibInput = Buffer.concat([sibPrefix, paraIdBuf]);
        const sibHash = blake2AsU8a(sibInput, 256);
        const computedOriginH160 = "0x" + Buffer.from(sibHash).slice(0, 20).toString("hex");

        console.log("AH sovereign (AccountId32):", sovereignAccountId32);
        console.log("Computed origin H160:", computedOriginH160);

        // Check DOT balance on Moonbeam for this H160 
        const mbEthProvider = new ethers.JsonRpcProvider("https://rpc.api.moonbeam.network");
        const glmrBal = await mbEthProvider.getBalance(computedOriginH160);
        console.log("GLMR balance:", ethers.formatEther(glmrBal));

        // Check xcDOT balance
        const xcDOT_addr = "0xffffffff1fcacbd218edc0eba20fc2308c778080";
        const erc20 = new ethers.Contract(xcDOT_addr, ["function balanceOf(address) view returns (uint256)"], mbEthProvider);
        try {
            const dotBal = await erc20.balanceOf(computedOriginH160);
            console.log("xcDOT balance:", ethers.formatUnits(dotBal, 10), "DOT");
        } catch (e) {
            console.log("xcDOT balanceOf error:", e.message?.substring(0, 100));
        }

        // Also check the DescendOrigin mapping
        // When PolkadotXcm.send() injects DescendOrigin, it descends with the sender's junction
        // From AH, origin = (parents:1, X1(Parachain(1000)))
        // Then DescendOrigin adds the sender's account junction
        // The final origin on Moonbeam would be:
        // (parents:1, X2(Parachain(1000), AccountKey20(sender_address)))
        // which maps to a DIFFERENT computed origin than just Sibling(1000)

        const senderAddr = "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58";
        console.log("\nSender:", senderAddr);

        // Computed origin for (Sibling(1000), AccountKey20(sender)):
        // HashedDescription with DescribeFamily + DescribeAllTerminal:
        // hash = blake2_256(b"SiblingChain" + SCALE(1000) + b"AccountKey20" + bytes(sender))
        const accPrefix = Buffer.from("AccountKey20");
        const senderBytes = Buffer.from(senderAddr.slice(2), "hex");
        const fullInput = Buffer.concat([sibPrefix, paraIdBuf, accPrefix, senderBytes]);
        const fullHash = blake2AsU8a(fullInput, 256);
        const senderComputedOriginH160 = "0x" + Buffer.from(fullHash).slice(0, 20).toString("hex");

        console.log("Sender computed origin H160:", senderComputedOriginH160);
        const senderGlmrBal = await mbEthProvider.getBalance(senderComputedOriginH160);
        console.log("GLMR balance:", ethers.formatEther(senderGlmrBal));

        try {
            const senderDotBal = await erc20.balanceOf(senderComputedOriginH160);
            console.log("xcDOT balance:", ethers.formatUnits(senderDotBal, 10), "DOT");
        } catch (e) {
            console.log("xcDOT balance error:", e.message?.substring(0, 100));
        }

        // ═══ TEST: send() with DepositAsset to XCMProxy + Transact ═══
        // If sovereign has no DOT, the WithdrawAsset will fail.
        // We need to either pre-fund or include DOT in the same message.
        //
        // What if we send the DOT transfer AND the Transact in ONE DepositReserveAsset,
        // but deposit to the SOVEREIGN instead of XCMProxy?
        // Then the Transact would still fail because ClearOrigin.
        //
        // ALTERNATIVE: What if we put DepositAsset AFTER Transact?
        // ClearOrigin kills origin, but Transact needs origin.
        // So it doesn't matter which order.
        //
        // FINAL FINAL IDEA: DepositReserveAsset deposits DOT and forwards
        // a message that includes BuyExecution (from DOT). What if the inner
        // XCM only does BuyExecution + DepositAsset → XCMProxy, and we
        // put NOTHING about Transact in the reserve transfer message,
        // and instead put the Transact in a COMPLETELY SEPARATE send() message
        // that uses DescendOrigin + WithdrawAsset from sovereign?
        //
        // For this to work:
        // 1. We need to fund the derived account first
        // 2. Then send() the Transact
        //
        // Can we batch these on AH?

        console.log("\n──── TEST: Batch approach dry-run ────");

        // Step 1: DepositReserveAsset to fund the derived/sovereign account with DOT
        // We'll deposit DOT to the computedOriginH160 on Moonbeam
        // But wait — we should deposit to the account that DescendOrigin derives
        // When send() is used from AH, the origin after DescendOrigin is:
        // (parents:1, X2(Parachain(1000), AccountId32(sender_ss58)))
        // Or is it AccountKey20? Depends on how AH represents the sender.
        // AH uses AccountId32 (SS58).

        // Actually, let me check: what DescendOrigin junction does send() inject?
        // From the dry-run output earlier, the instructions were:
        // DescendOrigin, WithdrawAsset, BuyExecution, Transact, SetTopic
        // So DescendOrigin is the first instruction.
        // Let me check what DescendOrigin value it contains.

        // Actually I should just look at the forwarded_xcms more carefully.
        // Let me do a send() dry-run and print the DescendOrigin details.

        console.log("  Running send() dry-run to inspect DescendOrigin...");
        const SENDER_SS58 = process.env.SENDER_SS58 || "13dEYKDJZwY7nxXj3Y5FXJYp8zktsmQikpbGe2otP5u52BKY";

        // Simple test message
        const simpleMbTx = mbApi.tx.EthereumXcm.transact({
            xcm_transaction: {
                type: "V2",
                value: {
                    gas_limit: bigintToU256(21000n),
                    action: { type: "Call", value: FixedSizeBinary.fromHex(XCMPROXY.toLowerCase()) },
                    value: bigintToU256(0n),
                    input: Binary.fromHex("0x"),
                    access_list: undefined,
                }
            }
        });
        const simpleCallHex = (await simpleMbTx.getEncodedData()).asHex();

        const sendTx = ahApi.tx.PolkadotXcm.send({
            dest: {
                type: "V5",
                value: { parents: 1, interior: { type: "X1", value: { type: "Parachain", value: 2004 } } }
            },
            message: {
                type: "V5",
                value: [
                    {
                        type: "WithdrawAsset",
                        value: [{ id: { parents: 1, interior: { type: "Here", value: undefined } }, fun: { type: "Fungible", value: 500000000n } }],
                    },
                    {
                        type: "BuyExecution",
                        value: {
                            fees: { id: { parents: 1, interior: { type: "Here", value: undefined } }, fun: { type: "Fungible", value: 500000000n } },
                            weight_limit: { type: "Unlimited", value: undefined },
                        },
                    },
                    {
                        type: "Transact",
                        value: {
                            origin_kind: { type: "SovereignAccount", value: undefined },
                            fallback_max_weight: { ref_time: 8000000000n, proof_size: 200000n },
                            call: Binary.fromHex(simpleCallHex),
                        },
                    },
                ],
            },
        });

        const sendResult = await ahApi.apis.DryRunApi.dry_run_call(
            { type: "system", value: { type: "Signed", value: SENDER_SS58 } },
            sendTx.decodedCall,
            5,
        );

        if (sendResult.success) {
            const fwdXcms = sendResult.value.forwarded_xcms;
            if (fwdXcms && fwdXcms.length > 0) {
                const msg = fwdXcms[0][1][0];
                console.log("  Forwarded message instructions:");
                for (const instr of msg.value) {
                    console.log("    →", instr.type, ":", JSON.stringify(instr.value, (_, v) => typeof v === 'bigint' ? v.toString() : v).substring(0, 200));
                }
            }
        } else {
            console.log("  send() error:", JSON.stringify(sendResult, (_, v) => typeof v === 'bigint' ? v.toString() : v).substring(0, 200));
        }

    } catch (e) {
        console.error("\nError:", e.message?.substring(0, 500) || e);
        console.error(e.stack?.substring(0, 400));
    } finally {
        mbClient.destroy();
        ahClient.destroy();
    }
    process.exit(0);
}

main();
