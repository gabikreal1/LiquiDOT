const { ApiPromise, WsProvider } = require("@polkadot/api");
const { ethers } = require("ethers");

/**
 * Build an XCM message that sends assets + calls receiveAssets on Moonbeam
 * @param {string} assetHubRpc - Asset Hub RPC endpoint
 * @param {object} params - Message parameters
 * @returns {object} { destination, message } both SCALE-encoded
 */
async function buildInvestmentXcmMessage(assetHubRpc, params) {
    const {
        moonbeamParaId,      // e.g., 2004 for Moonbeam, 1000 for Moonbase dev
        xcmProxyAddress,     // XCMProxy contract address on Moonbeam
        tokenAddress,        // Token address (e.g., xc-DOT on Moonbeam)
        amount,              // Amount to send
        user,                // User address
        investmentParams     // ABI-encoded investment parameters
    } = params;
    
    console.log("Building XCM message with params:", {
        moonbeamParaId,
        xcmProxyAddress,
        tokenAddress,
        amount: amount.toString(),
        user
    });
    
    // Connect to Asset Hub
    const provider = new WsProvider(assetHubRpc);
    const api = await ApiPromise.create({ provider });
    
    // 1. Build destination multilocation (points to Moonbeam parachain)
    const destination = {
        V3: {
            parents: 1,
            interior: {
                X1: {
                    Parachain: moonbeamParaId
                }
            }
        }
    };
    
    // 2. Encode the receiveAssets function call
    const XCMProxyInterface = new ethers.Interface([
        "function receiveAssets(address token, address user, uint256 amount, bytes memory investmentParams)"
    ]);
    
    const callData = XCMProxyInterface.encodeFunctionData("receiveAssets", [
        tokenAddress,
        user,
        amount,
        investmentParams
    ]);
    
    console.log("EVM call data:", callData);
    
    // 3. Build XCM message instructions
    const message = {
        V3: [
            // Withdraw asset from Asset Hub sovereign account
            {
                WithdrawAsset: [{
                    id: {
                        Concrete: {
                            parents: 0,
                            interior: { Here: null }
                        }
                    },
                    fun: {
                        Fungible: amount.toString()
                    }
                }]
            },
            
            // Buy execution on Moonbeam
            {
                BuyExecution: {
                    fees: {
                        id: {
                            Concrete: {
                                parents: 0,
                                interior: { Here: null }
                            }
                        },
                        fun: { Fungible: "1000000000000000000" } // 1 DOT for fees
                    },
                    weightLimit: {
                        Limited: {
                            refTime: "4000000000",
                            proofSize: "200000"
                        }
                    }
                }
            },
            
            // Deposit asset to XCMProxy contract (as ERC20)
            {
                DepositAsset: {
                    assets: {
                        Wild: {
                            AllCounted: 1
                        }
                    },
                    beneficiary: {
                        parents: 0,
                        interior: {
                            X1: {
                                AccountKey20: {
                                    network: null,
                                    key: xcmProxyAddress // XCMProxy address
                                }
                            }
                        }
                    }
                }
            },
            
            // Execute EVM call to receiveAssets
            {
                Transact: {
                    originKind: "SovereignAccount",
                    requireWeightAtMost: {
                        refTime: "3000000000",
                        proofSize: "150000"
                    },
                    call: {
                        encoded: callData
                    }
                }
            }
        ]
    };
    
    // 4. SCALE encode both destination and message
    const encodedDestination = api.createType("XcmVersionedMultiLocation", destination).toU8a();
    const encodedMessage = api.createType("XcmVersionedXcm", message).toU8a();
    
    await api.disconnect();
    
    const result = {
        destination: ethers.hexlify(encodedDestination),
        message: ethers.hexlify(encodedMessage),
        decoded: { destination, message } // For debugging
    };
    
    console.log("XCM message built successfully");
    console.log("Destination (hex):", result.destination);
    console.log("Message (hex):", result.message.substring(0, 100) + "...");
    
    return result;
}

/**
 * Build a simplified dummy XCM message for testing (when test mode is enabled)
 * @returns {object} { destination, message }
 */
function buildDummyXcmMessage() {
    // Minimal valid SCALE-encoded bytes for testing
    const dummyDestination = "0x030100001234"; // V3 multilocation to parachain 1234
    const dummyMessage = "0x0300010203";       // V3 XCM with minimal instructions
    
    return {
        destination: dummyDestination,
        message: dummyMessage
    };
}

/**
 * Example: Build investment XCM message
 */
async function example() {
    const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
            "0xPoolAddress",
            "0xBaseAsset",
            [ethers.parseEther("50"), ethers.parseEther("50")],
            -5,  // lowerRangePercent
            5,   // upperRangePercent
            "0xUserAddress",
            100  // slippageBps
        ]
    );
    
    const xcmMessage = await buildInvestmentXcmMessage(
        "wss://paseo-asset-hub-rpc.polkadot.io",
        {
            moonbeamParaId: 2004,
            xcmProxyAddress: "0xYourXCMProxyAddress",
            tokenAddress: "0xTokenAddress",
            amount: ethers.parseEther("100"),
            user: "0xUserAddress",
            investmentParams
        }
    );
    
    console.log("\n=== Example XCM Message ===");
    console.log("Destination (hex):", xcmMessage.destination);
    console.log("Message (hex):", xcmMessage.message);
    console.log("\nDecoded structure:");
    console.log(JSON.stringify(xcmMessage.decoded, null, 2));
    
    return xcmMessage;
}

// Run example if called directly
if (require.main === module) {
    example()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    buildInvestmentXcmMessage,
    buildDummyXcmMessage,
    example
};

