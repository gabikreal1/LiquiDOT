const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");

async function main() {
    const provider = new WsProvider("wss://polkadot-asset-hub-rpc.polkadot.io");
    const api = await ApiPromise.create({ provider });

    // Constants
    const XCMPROXY_ADDRESS = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
    const MOONBEAM_PARA_ID = 2004;
    const AMOUNT_DOT = "4000000000"; // 0.4 DOT (user's balance)
    const FEE_DOT = "1000000000";    // 0.1 DOT Fees
    const NET_AMOUNT = "3000000000"; // 0.3 DOT Net after fees

    // Generate a random ID for the Moonbeam side (since we can't sync with AssetHub block.timestamp)
    // This will be the 'remotePositionId' effectively.
    const REMOTE_ID = ethers.hexlify(ethers.randomBytes(32));
    console.log("Generated Remote ID:", REMOTE_ID);

    // Encode receiveAssets Call Data (EVM)
    // function receiveAssets(bytes32 id, address token, address user, uint256 amount, bytes params)
    const iface = new ethers.Interface([
        "function receiveAssets(bytes32, address, address, uint256, bytes)"
    ]);

    const xcDOT = "0xffffffff1fcacbd218edc0eba20fc2308c778080"; // xcDOT on Moonbeam
    const user = "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58"; // Gabik

    // Investment Params (Encoded)
    // (address poolId, address baseAsset, uint256[] amounts, int24 lower, int24 upper, address owner, uint16 slippage)
    const paramsType = ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"];
    const paramsVal = [
        "0x0000000000000000000000000000000000000001", // Placeholder Pool
        xcDOT, // Base Asset
        [0, 0], // Amounts
        -800000, 800000, // Range
        user, // Owner
        500 // Slippage
    ];
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(paramsType, paramsVal);

    const callData = iface.encodeFunctionData("receiveAssets", [
        REMOTE_ID,
        xcDOT,
        user,
        NET_AMOUNT,
        encodedParams
    ]);

    console.log("Call Data:", callData);

    // XCM V5 Message Construction (required by Asset Hub precompile)
    // 1. WithdrawAsset (Local) - DOT from relay
    // 2. DepositReserveAsset (Remote) - Move to Moonbeam

    const message = api.createType("XcmVersionedXcm", {
        V5: [
            {
                WithdrawAsset: [
                    {
                        id: { parents: 1, interior: { Here: null } },
                        fun: { Fungible: AMOUNT_DOT }
                    }
                ]
            },
            {
                // BuyExecution is required on Asset Hub before any asset-manipulating instructions
                BuyExecution: {
                    fees: {
                        id: { parents: 1, interior: { Here: null } },
                        fun: { Fungible: AMOUNT_DOT } // Use full amount to buy execution
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
                                    // AccountKey20 is correct for Moonbeam (EVM chain)
                                    interior: { X1: [{ AccountKey20: { network: null, key: XCMPROXY_ADDRESS } }] }
                                }
                            }
                        },
                        {
                            Transact: {
                                origin_kind: "SovereignAccount",
                                require_weight_at_most: { refTime: 5000000000, proofSize: 250000 },
                                call: {
                                    encoded: callData
                                }
                            }
                        }
                    ]
                }
            }
        ]
    });

    console.log("\n------------------------------------------");
    console.log("Hex Message:", message.toHex());
    console.log("------------------------------------------");
    process.exit(0);
}

main().catch(console.error);
