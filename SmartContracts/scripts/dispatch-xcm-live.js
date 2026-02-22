/**
 * Live XCM Execute Dispatch on Polkadot Asset Hub
 * 
 * Flow (per docs.polkadot.com/smart-contracts/precompiles/xcm/):
 *   1. Build XCM V5 message
 *   2. Call weighMessage() to get required weight
 *   3. Send actual execute() transaction with that weight
 * 
 * Fee model:
 *   - The Weight (refTime + proofSize) is the EVM gas budget for the precompile call
 *   - BuyExecution/PayFees inside the XCM pays the on-chain XCM fee from withdrawn DOT
 */

const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");
require("dotenv").config();

const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const ASSET_HUB_RPC = "https://eth-rpc.polkadot.io/";

// XCM Proxy on Moonbeam
const XCMPROXY_ADDRESS = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
const MOONBEAM_PARA_ID = 2004;

// Amounts
const AMOUNT_DOT = "4000000000";  // 0.4 DOT total withdraw
const FEE_DOT = "1000000000";  // 0.1 DOT for Moonbeam execution fees
const NET_AMOUNT = "3000000000";  // 0.3 DOT net to deposit

async function main() {
    console.log("=== Live XCM Execute on Asset Hub ===\n");

    // 1. Connect
    const wsProvider = new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const api = await ApiPromise.create({ provider: wsProvider });
    const ethProvider = new ethers.JsonRpcProvider(ASSET_HUB_RPC);
    const wallet = new ethers.Wallet(process.env.ASSET_PK, ethProvider);

    console.log("Caller:", wallet.address);
    const balance = await ethProvider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "DOT");
    console.log("Withdraw:", (Number(AMOUNT_DOT) / 1e10).toFixed(1), "DOT");
    console.log("Moonbeam fees:", (Number(FEE_DOT) / 1e10).toFixed(1), "DOT");
    console.log("Net deposit:", (Number(NET_AMOUNT) / 1e10).toFixed(1), "DOT\n");

    // 2. Build XCM V5 message
    const REMOTE_ID = ethers.hexlify(ethers.randomBytes(32));
    console.log("Remote ID:", REMOTE_ID);

    // Encode the Moonbeam call data
    const proxyIface = new ethers.Interface([
        "function receiveAssets(bytes32, address, address, uint256, bytes)"
    ]);
    const xcDOT = "0xffffffff1fcacbd218edc0eba20fc2308c778080";
    const user = wallet.address;

    const paramsType = ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"];
    const paramsVal = [
        "0x0000000000000000000000000000000000000001",
        xcDOT, [0, 0], -800000, 800000, user, 500
    ];
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(paramsType, paramsVal);
    const callData = proxyIface.encodeFunctionData("receiveAssets", [
        REMOTE_ID, xcDOT, user, NET_AMOUNT, encodedParams
    ]);

    // Build V5 message: WithdrawAsset + BuyExecution (local) + DepositReserveAsset (to Moonbeam)
    const message = api.createType("XcmVersionedXcm", {
        V5: [
            {
                WithdrawAsset: [{
                    id: { parents: 1, interior: { Here: null } },
                    fun: { Fungible: AMOUNT_DOT }
                }]
            },
            {
                BuyExecution: {
                    fees: {
                        id: { parents: 1, interior: { Here: null } },
                        fun: { Fungible: AMOUNT_DOT }
                    },
                    weight_limit: { Unlimited: null }
                }
            },
            {
                DepositReserveAsset: {
                    assets: { Wild: { All: null } },
                    dest: { parents: 1, interior: { X1: [{ Parachain: MOONBEAM_PARA_ID }] } },
                    xcm: [
                        {
                            BuyExecution: {
                                fees: {
                                    id: { parents: 1, interior: { Here: null } },
                                    fun: { Fungible: FEE_DOT }
                                },
                                weight_limit: { Unlimited: null }
                            }
                        },
                        {
                            DepositAsset: {
                                assets: { Wild: { AllCounted: 1 } },
                                beneficiary: {
                                    parents: 0,
                                    interior: { X1: [{ AccountKey20: { network: null, key: XCMPROXY_ADDRESS } }] }
                                }
                            }
                        },
                        {
                            Transact: {
                                origin_kind: "SovereignAccount",
                                require_weight_at_most: { refTime: 10000000000n, proofSize: 250000n },
                                call: {
                                    // Encoded Moonbeam 'evm.call' intrinsic (Module 51, Call 1)
                                    // Wraps the 'receiveAssets' EVM call
                                    // Generated via script/calc-moonbeam-call.js
                                    encoded: "0x33011c9f4139d3f895bf6e742066631eab658d142c5d0cfb7ce7d66c7cdae5827074c5f5a62223a0c23011083e4fba3675a0d0554472f2e287c2cb2fb6d2e4e9236f4c98fe921dd99538192c6223ea79000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c778080000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000b2d05e0000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ffffffff1fcacbd218edc0eba20fc2308c77808000000000000000000000000000000000000000000000000000000000000000e0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff3cb0000000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000741ae17d47d479e878adfb3c78b02db583c63d5800000000000000000000000000000000000000000000000000000000000001f40000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000404b4c000000000000e8764817000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000"
                                }
                            }
                        }
                    ]
                }
            }
        ]
    });

    const xcmHex = message.toHex();
    console.log("XCM Hex (first 60):", xcmHex.substring(0, 60), "...");
    console.log("XCM Length:", xcmHex.length / 2, "bytes\n");

    // 3. Weigh the message
    const iface = new ethers.Interface([
        "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
        "function execute(bytes calldata message, tuple(uint64 refTime, uint64 proofSize) weight) external"
    ]);

    console.log("--- Step 1: weighMessage ---");
    const weighData = iface.encodeFunctionData("weighMessage", [xcmHex]);
    const weighResult = await ethProvider.call({ to: XCM_PRECOMPILE, data: weighData });
    const decoded = iface.decodeFunctionResult("weighMessage", weighResult);
    const refTime = decoded[0].refTime;
    const proofSize = decoded[0].proofSize;
    console.log(`  RefTime:   ${refTime}`);
    console.log(`  ProofSize: ${proofSize}`);

    // Add 10% safety margin
    const weight = {
        refTime: refTime * 110n / 100n,
        proofSize: proofSize * 110n / 100n
    };
    console.log(`  Buffered:  RefTime=${weight.refTime}, ProofSize=${weight.proofSize}\n`);

    // 4. Dry-run first
    console.log("--- Step 2: Dry-run execute ---");
    const execData = iface.encodeFunctionData("execute", [xcmHex, weight]);
    try {
        const dryResult = await wallet.call({ to: XCM_PRECOMPILE, data: execData });
        console.log("  ✅ Dry-run: SUCCESS\n");
    } catch (e) {
        console.log(`  ❌ Dry-run FAILED: ${e.reason || e.message}`);
        console.log("  Aborting live dispatch. Fix the message first.");
        await api.disconnect();
        process.exit(1);
    }

    // 5. LIVE DISPATCH
    console.log("--- Step 3: LIVE DISPATCH ---");
    console.log("⚠️  This will spend real DOT!");
    console.log("    Sending execute() transaction...\n");

    try {
        // Get gas params — Asset Hub uses high baseFee, must use legacy (type 0) tx
        const feeData = await ethProvider.getFeeData();
        const gasEstimate = await ethProvider.estimateGas({
            from: wallet.address,
            to: XCM_PRECOMPILE,
            data: execData,
        });
        console.log("  Gas estimate:", gasEstimate.toString());
        console.log("  Gas price:", feeData.gasPrice?.toString());

        const tx = await wallet.sendTransaction({
            to: XCM_PRECOMPILE,
            data: execData,
            type: 0,  // Legacy tx — required for Asset Hub pallet-revive
            gasLimit: gasEstimate * 2n,  // 2x buffer
            gasPrice: feeData.gasPrice,
        });

        console.log("  📤 TX Hash:", tx.hash);
        console.log("  ⏳ Waiting for confirmation...\n");

        const receipt = await tx.wait();
        console.log("  ✅ TX Confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas Used:", receipt.gasUsed.toString());
        console.log("  Status:", receipt.status === 1 ? "SUCCESS" : "REVERT");

        if (receipt.logs.length > 0) {
            console.log("  Logs:", receipt.logs.length);
            for (const log of receipt.logs) {
                console.log("    -", log.address, log.topics[0]?.substring(0, 10));
            }
        }
    } catch (e) {
        console.log("  ❌ TX Failed:", e.message.substring(0, 300));
        if (e.receipt) {
            console.log("  Block:", e.receipt.blockNumber);
            console.log("  Status:", e.receipt.status);
        }
    }

    await api.disconnect();
    console.log("\n=== Done ===");
    process.exit(0);
}

main().catch(console.error);
