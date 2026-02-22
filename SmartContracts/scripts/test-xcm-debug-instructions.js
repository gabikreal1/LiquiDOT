const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");
require("dotenv").config();

const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const ASSET_HUB_RPC = "https://eth-rpc.polkadot.io/";

async function main() {
    console.log("=== XCM Execute Debug: Testing More Instructions ===\n");

    const wsProvider = new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const api = await ApiPromise.create({ provider: wsProvider });

    const ethProvider = new ethers.JsonRpcProvider(ASSET_HUB_RPC);
    const wallet = new ethers.Wallet(process.env.ASSET_PK, ethProvider);
    console.log("Caller:", wallet.address);

    const iface = new ethers.Interface([
        "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
        "function execute(bytes calldata message, tuple(uint64 refTime, uint64 proofSize) weight) external"
    ]);

    // Test 5: TransferAsset (moves assets directly without withdraw)
    console.log("\n--- Test 5: TransferAsset (local, parents:1) ---");
    try {
        const msg5 = api.createType("XcmVersionedXcm", {
            V5: [
                {
                    TransferAsset: {
                        assets: [{
                            id: { parents: 1, interior: { Here: null } },
                            fun: { Fungible: "100000000" }
                        }],
                        beneficiary: {
                            parents: 0,
                            interior: { X1: [{ AccountKey20: { network: null, key: wallet.address } }] }
                        }
                    }
                }
            ]
        });
        await testMessage("Test5", msg5.toHex(), iface, ethProvider, wallet);
    } catch (e) {
        console.log("  ❌ Encoding error:", e.message.substring(0, 100));
    }

    // Test 6: TransferAsset (local, parents:0)
    console.log("\n--- Test 6: TransferAsset (local, parents:0) ---");
    try {
        const msg6 = api.createType("XcmVersionedXcm", {
            V5: [
                {
                    TransferAsset: {
                        assets: [{
                            id: { parents: 0, interior: { Here: null } },
                            fun: { Fungible: "100000000" }
                        }],
                        beneficiary: {
                            parents: 0,
                            interior: { X1: [{ AccountKey20: { network: null, key: wallet.address } }] }
                        }
                    }
                }
            ]
        });
        await testMessage("Test6", msg6.toHex(), iface, ethProvider, wallet);
    } catch (e) {
        console.log("  ❌ Encoding error:", e.message.substring(0, 100));
    }

    // Test 7: InitiateTransfer (V5 new instruction for cross-chain)
    console.log("\n--- Test 7: InitiateTransfer to Moonbeam ---");
    try {
        const msg7 = api.createType("XcmVersionedXcm", {
            V5: [
                {
                    InitiateTransfer: {
                        destination: { parents: 1, interior: { X1: [{ Parachain: 2004 }] } },
                        remote_fees: {
                            Teleport: {
                                id: { parents: 1, interior: { Here: null } },
                                fun: { Fungible: "50000000" }
                            }
                        },
                        assets: [{
                            ReserveDeposit: [{
                                id: { parents: 1, interior: { Here: null } },
                                fun: { Fungible: "100000000" }
                            }]
                        }],
                        preserve_origin: false,
                        xcm: []
                    }
                }
            ]
        });
        await testMessage("Test7", msg7.toHex(), iface, ethProvider, wallet);
    } catch (e) {
        console.log("  ❌ Encoding error:", e.message.substring(0, 200));
    }

    // Test 8: Check what the XCM filter allows - try SetFeesMode
    console.log("\n--- Test 8: SetFeesMode (should succeed if no filter) ---");
    try {
        const msg8 = api.createType("XcmVersionedXcm", {
            V5: [
                { SetFeesMode: { jitWithdraw: true } }
            ]
        });
        await testMessage("Test8 (SetFeesMode)", msg8.toHex(), iface, ethProvider, wallet);
    } catch (e) {
        console.log("  ❌ Encoding error:", e.message.substring(0, 100));
    }

    // Test 9: WithdrawAsset with tiny amount (1 planck)
    console.log("\n--- Test 9: WithdrawAsset 1 planck (parents:1) ---");
    try {
        const msg9 = api.createType("XcmVersionedXcm", {
            V5: [
                {
                    WithdrawAsset: [{
                        id: { parents: 1, interior: { Here: null } },
                        fun: { Fungible: "1" }
                    }]
                },
                {
                    DepositAsset: {
                        assets: { Wild: { All: null } },
                        beneficiary: {
                            parents: 0,
                            interior: { X1: [{ AccountKey20: { network: null, key: wallet.address } }] }
                        }
                    }
                }
            ]
        });
        await testMessage("Test9 (1 planck)", msg9.toHex(), iface, ethProvider, wallet);
    } catch (e) {
        console.log("  ❌ Encoding error:", e.message.substring(0, 100));
    }

    await api.disconnect();
    process.exit(0);
}

async function testMessage(label, hex, iface, provider, wallet) {
    try {
        const weighData = iface.encodeFunctionData("weighMessage", [hex]);
        const weighResult = await provider.call({ to: XCM_PRECOMPILE, data: weighData });

        if (weighResult && weighResult !== "0x") {
            const decoded = iface.decodeFunctionResult("weighMessage", weighResult);
            const refTime = decoded[0].refTime;
            const proofSize = decoded[0].proofSize;
            console.log(`  ✅ weighMessage OK: refTime=${refTime}, proofSize=${proofSize}`);

            const weight = {
                refTime: refTime * 110n / 100n,
                proofSize: proofSize * 110n / 100n
            };

            const execData = iface.encodeFunctionData("execute", [hex, weight]);
            try {
                const result = await wallet.call({ to: XCM_PRECOMPILE, data: execData });
                console.log(`  ✅ execute dry-run: SUCCESS`);
            } catch (e) {
                const reason = e.reason || e.message.substring(0, 120);
                console.log(`  ❌ execute dry-run: ${reason}`);
            }
        } else {
            console.log(`  ❌ weighMessage: empty`);
        }
    } catch (e) {
        const reason = e.reason || e.message.substring(0, 150);
        console.log(`  ❌ ${label}: ${reason}`);
    }
}

main().catch(console.error);
