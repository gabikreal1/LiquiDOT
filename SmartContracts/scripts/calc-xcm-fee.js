/**
 * Calculate actual XCM execution fees on Asset Hub & Moonbeam
 *
 * Uses PAPI runtime APIs:
 *   - XcmPaymentApi.query_xcm_weight(xcm_message) → Weight
 *   - XcmPaymentApi.query_weight_to_asset_fee(weight, asset) → planck
 *   - TransactionPaymentApi.query_weight_to_fee(weight) → planck
 *
 * Also builds the exact XCM V5 message from the dry-run script
 * to get precise weight and fee estimates.
 */

const { dotah, moonbeam } = require("@polkadot-api/descriptors");
const { createClient, Binary, FixedSizeBinary } = require("polkadot-api");
const { getWsProvider } = require("@polkadot-api/ws-provider/node");
const { ethers } = require("ethers");
require("dotenv").config();

const AH_WSS = process.env.ASSET_HUB_PAPI_ENDPOINT || "wss://polkadot-asset-hub-rpc.polkadot.io";
const MB_WSS = process.env.MOONBEAM_PAPI_ENDPOINT || "wss://wss.api.moonbeam.network";
const XCMPROXY = process.env.MOONBEAM_XCM_PROXY_ADDRESS || "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";
const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const AH_ETH_RPC = "https://eth-rpc.polkadot.io/";

function bigintToU256(val) {
  const mask = (1n << 64n) - 1n;
  return [val & mask, (val >> 64n) & mask, (val >> 128n) & mask, (val >> 192n) & mask];
}

function fmtDot(planck) {
  return (Number(planck) / 1e10).toFixed(6) + " DOT";
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  XCM Fee Calculator — Asset Hub & Moonbeam");
  console.log("═══════════════════════════════════════════════════════\n");

  const ahClient = createClient(getWsProvider(AH_WSS));
  const ahApi = ahClient.getTypedApi(dotah);
  const mbClient = createClient(getWsProvider(MB_WSS));
  const mbApi = mbClient.getTypedApi(moonbeam);

  const DOT_LOCATION = { parents: 1, interior: { type: "Here", value: undefined } };
  const TEST_AMOUNT = 10000000000n; // 1 DOT

  try {
    // ══════════════════════════════════════════════════════════
    //  1. Build the exact XCM message (same as dry-run script)
    // ══════════════════════════════════════════════════════════
    console.log("── Building XCM V5 message (1 DOT) ──\n");

    // Build EVM calldata
    const iface = new ethers.Interface(["function receiveAssets(bytes32, address, address, uint256, bytes)"]);
    const paramsType = ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"];
    const paramsVal = ["0x0000000000000000000000000000000000000001", xcDOT, [0, 0], -800000, 800000,
      "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58", 500];
    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(paramsType, paramsVal);
    const evmInput = iface.encodeFunctionData("receiveAssets", [
      ethers.hexlify(ethers.randomBytes(32)), xcDOT,
      "0x741Ae17d47D479E878ADFB3c78b02DB583c63d58", TEST_AMOUNT.toString(), encodedParams,
    ]);

    // Encode EthereumXcm.transact via Moonbeam
    const mbTx = mbApi.tx.EthereumXcm.transact({
      xcm_transaction: {
        type: "V2",
        value: {
          gas_limit: bigintToU256(300000n),
          action: { type: "Call", value: FixedSizeBinary.fromHex(XCMPROXY.toLowerCase()) },
          value: bigintToU256(0n),
          input: Binary.fromHex(evmInput),
          access_list: undefined,
        },
      },
    });
    const encodedCallHex = (await mbTx.getEncodedData()).asHex();

    // Build XCM V5 with DepositReserveAsset (known working on AH)
    const innerXcm = [
      {
        type: "BuyExecution",
        value: {
          fees: { id: DOT_LOCATION, fun: { type: "Fungible", value: 400000000n } },
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

    const outerMsg = {
      type: "V5",
      value: [
        { type: "WithdrawAsset", value: [{ id: DOT_LOCATION, fun: { type: "Fungible", value: TEST_AMOUNT } }] },
        {
          type: "BuyExecution",
          value: {
            fees: { id: DOT_LOCATION, fun: { type: "Fungible", value: TEST_AMOUNT } },
            weight_limit: { type: "Unlimited", value: undefined },
          },
        },
        {
          type: "DepositReserveAsset",
          value: {
            assets: { type: "Wild", value: { type: "All", value: undefined } },
            dest: { parents: 1, interior: { type: "X1", value: { type: "Parachain", value: 2004 } } },
            xcm: innerXcm,
          },
        },
      ],
    };

    console.log("  XCM V5 message built ✓\n");

    // ══════════════════════════════════════════════════════════
    //  2. Asset Hub: query XCM weight and fee
    // ══════════════════════════════════════════════════════════
    console.log("── Asset Hub Fee Calculation ──\n");

    // Method A: query_xcm_weight via XcmPaymentApi
    let ahWeight = null;
    try {
      const weightResult = await ahApi.apis.XcmPaymentApi.query_xcm_weight(outerMsg);
      if (weightResult.success) {
        ahWeight = weightResult.value;
        console.log("  XcmPaymentApi.query_xcm_weight:");
        console.log(`    ref_time   = ${ahWeight.ref_time}`);
        console.log(`    proof_size = ${ahWeight.proof_size}`);
      } else {
        console.log("  query_xcm_weight error:", JSON.stringify(weightResult, (_, v) => typeof v === "bigint" ? v.toString() : v));
      }
    } catch (e) {
      console.log("  query_xcm_weight not available:", e.message?.substring(0, 150));
    }

    // Method B: query_weight_to_asset_fee
    if (ahWeight) {
      try {
        const dotAssetId = { type: "V4", value: DOT_LOCATION };
        const feeResult = await ahApi.apis.XcmPaymentApi.query_weight_to_asset_fee(ahWeight, dotAssetId);
        if (feeResult.success) {
          const feePlanck = feeResult.value;
          console.log(`\n  XcmPaymentApi.query_weight_to_asset_fee:`);
          console.log(`    Fee = ${feePlanck} planck = ${fmtDot(feePlanck)}`);
        } else {
          console.log("  query_weight_to_asset_fee error:", JSON.stringify(feeResult));
        }
      } catch (e) {
        console.log("  query_weight_to_asset_fee error:", e.message?.substring(0, 150));
      }
    }

    // Method C: TransactionPaymentApi
    const testWeights = [
      { label: "AH dry-run (from DryRunApi)", w: { ref_time: 48674139000n, proof_size: 628353n } },
      { label: "XCM precompile weighMessage", w: { ref_time: 53508021600n, proof_size: 689554n } },
    ];

    console.log("\n  TransactionPaymentApi.query_weight_to_fee:");
    for (const tw of testWeights) {
      try {
        const fee = await ahApi.apis.TransactionPaymentApi.query_weight_to_fee(tw.w, 0n);
        console.log(`    ${tw.label}:`);
        console.log(`      weight: ref_time=${tw.w.ref_time}, proof_size=${tw.w.proof_size}`);
        console.log(`      fee: ${fee} planck = ${fmtDot(fee)}`);
      } catch (e) {
        console.log(`    ${tw.label}: error (${e.message?.substring(0, 100)})`);
      }
    }

    // Method D: XCM precompile weighMessage via eth_call
    console.log("\n  XCM precompile (eth_call weighMessage):");
    try {
      const ethProvider = new ethers.JsonRpcProvider(AH_ETH_RPC);
      const ahExecuteTx = ahApi.tx.PolkadotXcm.execute({
        message: outerMsg,
        max_weight: { ref_time: 100000000000n, proof_size: 5000000n },
      });
      const fullHex = (await ahExecuteTx.getEncodedData()).asHex();

      // Extract XCM bytes
      const withoutCallIndex = fullHex.slice(6);
      function compactLen(val) {
        if (val < 64n) return 1;
        if (val < 16384n) return 2;
        if (val < 1073741824n) return 4;
        let b = 0; let v = val;
        while (v > 0n) { v >>= 8n; b++; }
        return 1 + b;
      }
      const weightBytes = (compactLen(100000000000n) + compactLen(5000000n)) * 2;
      const xcmHex = "0x" + withoutCallIndex.slice(0, -weightBytes);

      const preIface = new ethers.Interface([
        "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
      ]);
      const weighData = preIface.encodeFunctionData("weighMessage", [xcmHex]);
      const weighResult = await ethProvider.call({ to: XCM_PRECOMPILE, data: weighData });
      const decoded = preIface.decodeFunctionResult("weighMessage", weighResult);
      console.log(`    ref_time   = ${decoded[0].refTime}`);
      console.log(`    proof_size = ${decoded[0].proofSize}`);

      // Now query the fee for this weight
      const precompileWeight = { ref_time: decoded[0].refTime, proof_size: decoded[0].proofSize };
      try {
        const fee = await ahApi.apis.TransactionPaymentApi.query_weight_to_fee(precompileWeight, 0n);
        console.log(`    fee: ${fee} planck = ${fmtDot(fee)}`);
      } catch (e) {}

      // Also query XcmPaymentApi for this weight
      try {
        const dotAssetId = { type: "V4", value: DOT_LOCATION };
        const feeResult = await ahApi.apis.XcmPaymentApi.query_weight_to_asset_fee(precompileWeight, dotAssetId);
        if (feeResult.success) {
          console.log(`    XCM fee (DOT): ${feeResult.value} planck = ${fmtDot(feeResult.value)}`);
        }
      } catch (e) {}
    } catch (e) {
      console.log("    Error:", e.message?.substring(0, 200));
    }

    // ══════════════════════════════════════════════════════════
    //  3. Moonbeam: query XCM weight and fee
    // ══════════════════════════════════════════════════════════
    console.log("\n── Moonbeam Fee Calculation ──\n");

    // Build the Moonbeam incoming XCM (what it would receive)
    const mbIncomingXcm = {
      type: "V5",
      value: [
        {
          type: "ReserveAssetDeposited",
          value: [{ id: DOT_LOCATION, fun: { type: "Fungible", value: 600000000n } }],
        },
        ...innerXcm,
      ],
    };

    try {
      const mbWeightResult = await mbApi.apis.XcmPaymentApi.query_xcm_weight(mbIncomingXcm);
      if (mbWeightResult.success) {
        const mbWeight = mbWeightResult.value;
        console.log("  XcmPaymentApi.query_xcm_weight:");
        console.log(`    ref_time   = ${mbWeight.ref_time}`);
        console.log(`    proof_size = ${mbWeight.proof_size}`);

        // Query fee in GLMR (native)
        try {
          const mbFee = await mbApi.apis.TransactionPaymentApi.query_weight_to_fee(mbWeight, 0n);
          console.log(`\n  TransactionPaymentApi (GLMR):`);
          console.log(`    fee: ${mbFee} wei = ${(Number(mbFee) / 1e18).toFixed(10)} GLMR`);
        } catch (e) {}

        // Query fee in DOT (XCM fee asset)
        try {
          const dotAssetId = { type: "V4", value: DOT_LOCATION };
          const mbDotFee = await mbApi.apis.XcmPaymentApi.query_weight_to_asset_fee(mbWeight, dotAssetId);
          if (mbDotFee.success) {
            console.log(`\n  XcmPaymentApi (DOT/xcDOT):`);
            console.log(`    fee: ${mbDotFee.value} planck = ${fmtDot(mbDotFee.value)}`);
          } else {
            console.log("  query_weight_to_asset_fee (DOT):", JSON.stringify(mbDotFee));
          }
        } catch (e) {
          console.log("  DOT fee query error:", e.message?.substring(0, 150));
        }
      } else {
        console.log("  query_xcm_weight error:", JSON.stringify(mbWeightResult, (_, v) => typeof v === "bigint" ? v.toString() : v));
      }
    } catch (e) {
      console.log("  query_xcm_weight not available:", e.message?.substring(0, 150));
    }

    // ══════════════════════════════════════════════════════════
    //  4. Summary
    // ══════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  Use these values for PayFees amounts in the dry-run script:");
    console.log("  AH_FEE = (result from above)");
    console.log("  MB_FEE = BuyExecution amount in inner XCM");
    console.log("══════════════════════════════════════════════════════════\n");

  } catch (e) {
    console.error("Error:", e.message || e);
  } finally {
    ahClient.destroy();
    mbClient.destroy();
  }

  process.exit(0);
}

main().catch(console.error);
