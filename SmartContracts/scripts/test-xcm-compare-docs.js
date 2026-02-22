const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");
require("dotenv").config();

const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const ASSET_HUB_RPC = "https://eth-rpc.polkadot.io/";

async function main() {
    console.log("=== Compare: Official Docs Example vs Our Message ===\n");

    const wsProvider = new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const api = await ApiPromise.create({ provider: wsProvider });
    const ethProvider = new ethers.JsonRpcProvider(ASSET_HUB_RPC);
    const wallet = new ethers.Wallet(process.env.ASSET_PK, ethProvider);
    console.log("Caller:", wallet.address);

    const iface = new ethers.Interface([
        "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
        "function execute(bytes calldata message, tuple(uint64 refTime, uint64 proofSize) weight) external"
    ]);

    // --- Official Docs Example (from docs.polkadot.com/smart-contracts/precompiles/xcm/) ---
    // WithdrawAsset + BuyExecution + DepositAsset (V5)
    const DOCS_HEX = "0x050c000401000003008c86471301000003008c8647000d010101000000010100368e8759910dab756d344995f1d3c79374ca8f70066d3a709e48029f6bf0ee7e";

    console.log("--- Decode Official Docs Example ---");
    try {
        const decoded = api.createType("XcmVersionedXcm", DOCS_HEX);
        console.log("Docs Example Decoded:");
        console.log(JSON.stringify(decoded.toHuman(), null, 2));
    } catch (e) {
        console.log("Decode error:", e.message.substring(0, 200));
    }

    console.log("\n--- Test Official Docs Example ---");
    await testMessage("Docs Example", DOCS_HEX, iface, ethProvider, wallet);

    // --- Our WithdrawAsset + BuyExecution + DepositAsset (same structure, different amounts/beneficiary) ---
    console.log("\n--- Our Message: Withdraw + BuyExecution + Deposit (matching docs structure) ---");
    const ourMsg = api.createType("XcmVersionedXcm", {
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
                        fun: { Fungible: "100000000" }
                    },
                    weight_limit: { Unlimited: null }
                }
            },
            {
                DepositAsset: {
                    assets: { Wild: { AllCounted: 1 } },
                    beneficiary: {
                        parents: 0,
                        interior: { X1: [{ AccountKey20: { network: null, key: wallet.address } }] }
                    }
                }
            }
        ]
    });

    console.log("Our Message Hex:", ourMsg.toHex().substring(0, 40), "...");
    console.log("Our Message Decoded:");
    console.log(JSON.stringify(ourMsg.toHuman(), null, 2));
    await testMessage("Our Matching", ourMsg.toHex(), iface, ethProvider, wallet);

    // --- Same as docs but with our beneficiary ---
    console.log("\n--- Docs Structure but AccountKey20 beneficiary ---");
    const docsWithKey20 = api.createType("XcmVersionedXcm", {
        V5: [
            {
                WithdrawAsset: [{
                    id: { parents: 1, interior: { Here: null } },
                    fun: { Fungible: "100000000" }
                }]
            },
            {
                BuyExecution: {
                    fees: {
                        id: { parents: 1, interior: { Here: null } },
                        fun: { Fungible: "100000000" }
                    },
                    weight_limit: { Unlimited: null }
                }
            },
            {
                DepositAsset: {
                    assets: { Wild: "All" },
                    beneficiary: {
                        parents: 0,
                        interior: { X1: [{ AccountKey20: { network: null, key: wallet.address } }] }
                    }
                }
            }
        ]
    });
    await testMessage("Docs+Key20", docsWithKey20.toHex(), iface, ethProvider, wallet);

    // --- Same as docs but with AccountId32 beneficiary (what the docs use) ---
    console.log("\n--- Docs Structure with AccountId32 beneficiary (exact match) ---");
    // The docs use AccountId32 - let's derive our mapped substrate account
    const evmBytes = ethers.getBytes(wallet.address);
    const padding = new Uint8Array(12).fill(0xEE);
    const mappedId32 = new Uint8Array(32);
    mappedId32.set(evmBytes, 0);
    mappedId32.set(padding, 20);
    const mappedHex = "0x" + Buffer.from(mappedId32).toString("hex");

    const docsWithId32 = api.createType("XcmVersionedXcm", {
        V5: [
            {
                WithdrawAsset: [{
                    id: { parents: 1, interior: { Here: null } },
                    fun: { Fungible: "100000000" }
                }]
            },
            {
                BuyExecution: {
                    fees: {
                        id: { parents: 1, interior: { Here: null } },
                        fun: { Fungible: "100000000" }
                    },
                    weight_limit: { Unlimited: null }
                }
            },
            {
                DepositAsset: {
                    assets: { Wild: "All" },
                    beneficiary: {
                        parents: 0,
                        interior: { X1: [{ AccountId32: { network: null, id: mappedHex } }] }
                    }
                }
            }
        ]
    });
    console.log("Mapped AccountId32:", mappedHex);
    await testMessage("Docs+Id32", docsWithId32.toHex(), iface, ethProvider, wallet);

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
            console.log(`  ✅ weighMessage: refTime=${refTime}, proofSize=${proofSize}`);

            const weight = {
                refTime: refTime * 110n / 100n,
                proofSize: proofSize * 110n / 100n
            };

            const execData = iface.encodeFunctionData("execute", [hex, weight]);
            try {
                const result = await wallet.call({ to: XCM_PRECOMPILE, data: execData });
                console.log(`  ✅ execute: SUCCESS`);
            } catch (e) {
                const reason = e.reason || e.message.substring(0, 100);
                console.log(`  ❌ execute: ${reason}`);
            }
        } else {
            console.log(`  ❌ weighMessage: empty`);
        }
    } catch (e) {
        const reason = e.reason || e.message.substring(0, 100);
        console.log(`  ❌ ${label}: ${reason}`);
    }
}

main().catch(console.error);
