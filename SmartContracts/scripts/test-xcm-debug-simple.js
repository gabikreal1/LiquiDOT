const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");
require("dotenv").config();

const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const ASSET_HUB_RPC = "https://eth-rpc.polkadot.io/";

async function main() {
    console.log("=== XCM Execute Debug: Testing Simple Messages ===\n");

    // Connect to Asset Hub for encoding
    const wsProvider = new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const api = await ApiPromise.create({ provider: wsProvider });

    const ethProvider = new ethers.JsonRpcProvider(ASSET_HUB_RPC);
    const wallet = new ethers.Wallet(process.env.ASSET_PK, ethProvider);
    console.log("Caller:", wallet.address);

    const iface = new ethers.Interface([
        "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
        "function execute(bytes calldata message, tuple(uint64 refTime, uint64 proofSize) weight) external"
    ]);

    // Test 1: Minimal XCM - just WithdrawAsset + DepositAsset (local, no cross-chain)
    // DOT on Asset Hub is parents:1, interior:Here (it's a foreign asset from relay)
    console.log("\n--- Test 1: WithdrawAsset(parents:1) + DepositAsset back to self ---");
    const msg1 = api.createType("XcmVersionedXcm", {
        V5: [
            {
                WithdrawAsset: [{
                    id: { parents: 1, interior: { Here: null } },
                    fun: { Fungible: "100000000" } // 0.01 DOT
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
    await testMessage("Test1 (parents:1 withdraw+deposit)", msg1.toHex(), iface, ethProvider, wallet);

    // Test 2: DOT as native token (parents:0, Here)
    console.log("\n--- Test 2: WithdrawAsset(parents:0) + DepositAsset back to self ---");
    const msg2 = api.createType("XcmVersionedXcm", {
        V5: [
            {
                WithdrawAsset: [{
                    id: { parents: 0, interior: { Here: null } },
                    fun: { Fungible: "100000000" } // 0.01 DOT
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
    await testMessage("Test2 (parents:0 withdraw+deposit)", msg2.toHex(), iface, ethProvider, wallet);

    // Test 3: Absolute minimal - just ClearOrigin (should always succeed)
    console.log("\n--- Test 3: ClearOrigin only (should always succeed) ---");
    const msg3 = api.createType("XcmVersionedXcm", {
        V5: [{ ClearOrigin: null }]
    });
    await testMessage("Test3 (ClearOrigin)", msg3.toHex(), iface, ethProvider, wallet);

    // Test 4: WithdrawAsset(parents:1) + BuyExecution + DepositAsset
    console.log("\n--- Test 4: Withdraw + BuyExecution + DepositAsset ---");
    const msg4 = api.createType("XcmVersionedXcm", {
        V5: [
            {
                WithdrawAsset: [{
                    id: { parents: 1, interior: { Here: null } },
                    fun: { Fungible: "100000000" } // 0.01 DOT
                }]
            },
            {
                BuyExecution: {
                    fees: {
                        id: { parents: 1, interior: { Here: null } },
                        fun: { Fungible: "50000000" } // 0.005 DOT
                    },
                    weight_limit: { Unlimited: null }
                }
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
    await testMessage("Test4 (withdraw+buy+deposit)", msg4.toHex(), iface, ethProvider, wallet);

    await api.disconnect();
    process.exit(0);
}

async function testMessage(label, hex, iface, provider, wallet) {
    try {
        // weighMessage
        const weighData = iface.encodeFunctionData("weighMessage", [hex]);
        const weighResult = await provider.call({ to: XCM_PRECOMPILE, data: weighData });

        if (weighResult && weighResult !== "0x") {
            const decoded = iface.decodeFunctionResult("weighMessage", weighResult);
            const refTime = decoded[0].refTime;
            const proofSize = decoded[0].proofSize;
            console.log(`  ✅ weighMessage: refTime=${refTime}, proofSize=${proofSize}`);

            // Try execute dry-run with 10% buffer
            const weight = {
                refTime: refTime * 110n / 100n,
                proofSize: proofSize * 110n / 100n
            };

            const execData = iface.encodeFunctionData("execute", [hex, weight]);
            try {
                const result = await wallet.call({ to: XCM_PRECOMPILE, data: execData });
                console.log(`  ✅ execute dry-run: SUCCESS (result=${result || "empty"})`);
            } catch (e) {
                const reason = e.reason || e.message.substring(0, 120);
                console.log(`  ❌ execute dry-run: ${reason}`);
            }
        } else {
            console.log(`  ❌ weighMessage: empty result`);
        }
    } catch (e) {
        const reason = e.reason || e.message.substring(0, 120);
        console.log(`  ❌ ${label}: ${reason}`);
    }
}

main().catch(console.error);
