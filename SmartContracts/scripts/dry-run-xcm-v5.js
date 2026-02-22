/**
 * XCM V5 Dry-Run — Two-Phase Investment Pipeline
 *
 * Phase 1: Transfer DOT from Asset Hub → Moonbeam via DepositReserveAsset
 *   - Deposits xcDOT to XCMProxy contract on Moonbeam
 *   - No Transact (ClearOrigin is always injected by DepositReserveAsset,
 *     making Transact impossible — BadOrigin)
 *
 * Phase 2: Backend EVM call to receiveAssets() on Moonbeam
 *   - Simulated here via eth_call to Moonbeam RPC
 *   - In production: relayer calls the contract directly
 *
 * Why two phases?
 *   - DepositReserveAsset injects ClearOrigin → Transact fails (BadOrigin)
 *   - InitiateTransfer(preserve_origin:false) → same ClearOrigin issue
 *   - InitiateTransfer(preserve_origin:true) → AliasOrigin (Moonbeam doesn't support)
 *   - Single-message XCM with asset transfer + Transact is impossible on Moonbeam
 *
 * Steps:
 *   1. Build XCM V5: WithdrawAsset → BuyExecution → DepositReserveAsset
 *   2. Dry-run on Asset Hub (DryRunApi.dry_run_call)
 *   3. Dry-run forwarded XCM on Moonbeam (DryRunApi.dry_run_xcm)
 *   4. Weigh via XCM precompile (eth_call weighMessage)
 *   5. Execute via XCM precompile (eth_call execute)
 *   6. Simulate Phase 2 EVM call on Moonbeam (eth_call receiveAssets)
 *
 * Usage:
 *   node scripts/dry-run-xcm-v5.js
 *   DRY_RUN_AMOUNT=10000000000 node scripts/dry-run-xcm-v5.js  # 1 DOT
 */

const { dotah, moonbeam } = require("@polkadot-api/descriptors");
const { createClient, Binary, FixedSizeBinary } = require("polkadot-api");
const { getWsProvider } = require("@polkadot-api/ws-provider/node");
const { ethers } = require("ethers");
require("dotenv").config();

// ─── Configuration ───────────────────────────────────────────
const XCMPROXY = process.env.MOONBEAM_XCM_PROXY_ADDRESS || "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
const xcDOT = process.env.MOONBEAM_XCDOT_ADDRESS || "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";
const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const ASSET_HUB_RPC = process.env.ASSET_HUB_RPC || "https://eth-rpc.polkadot.io/";
const MOONBEAM_RPC = process.env.MOONBEAM_RPC_URL || "https://rpc.api.moonbeam.network";
const MOONBEAM_WSS = process.env.MOONBEAM_PAPI_ENDPOINT || "wss://wss.api.moonbeam.network";
const AH_WSS = process.env.ASSET_HUB_PAPI_ENDPOINT || "wss://polkadot-asset-hub-rpc.polkadot.io";

// How much DOT to test with (in planck). 1 DOT = 10_000_000_000 planck
const TEST_AMOUNT = BigInt(process.env.DRY_RUN_AMOUNT || "10000000000"); // 1 DOT default
// Moonbeam BuyExecution fee (inner XCM). Actual ~0.016 DOT, use 0.04 DOT for safety.
const MB_FEE = BigInt(process.env.DRY_RUN_MB_FEE || "400000000"); // 0.04 DOT

const DOT_LOCATION = { parents: 1, interior: { type: "Here", value: undefined } };

// ─── Helpers ─────────────────────────────────────────────────

function fmtJson(obj) {
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

function fmtDot(planck) {
  return (Number(planck) / 1e10).toFixed(6) + " DOT";
}

/** Calculate SCALE compact encoding length for a bigint value */
function compactEncodingLength(val) {
  if (val < 64n) return 1;
  if (val < 16384n) return 2;
  if (val < 1073741824n) return 4;
  let bytes = 0;
  let v = val;
  while (v > 0n) { v >>= 8n; bytes++; }
  return 1 + bytes;
}

async function main() {
  console.log("══════════════════════════════════════════════════════");
  console.log("  XCM V5 DRY-RUN — Two-Phase Investment Pipeline");
  console.log("══════════════════════════════════════════════════════\n");

  // ─── 1. Setup ──────────────────────────────────────────────
  if (!process.env.ASSET_PK) {
    console.error("Missing ASSET_PK in .env — needed for dry-run sender identity");
    process.exit(1);
  }

  const ethProvider = new ethers.JsonRpcProvider(ASSET_HUB_RPC);
  const wallet = new ethers.Wallet(process.env.ASSET_PK, ethProvider);

  console.log("Caller (AH EVM):", wallet.address);
  const bal = await ethProvider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(bal), "DOT");
  console.log("Test amount:", fmtDot(TEST_AMOUNT));
  console.log("Moonbeam fee:", fmtDot(MB_FEE));
  console.log("\nXCMProxy:", XCMPROXY);
  console.log("xcDOT:", xcDOT);
  console.log("AH WSS:", AH_WSS);
  console.log("MB WSS:", MOONBEAM_WSS);
  console.log();

  // ─── 2. Connect PAPI ──────────────────────────────────────
  console.log("Connecting to chains...");
  const mbClient = createClient(getWsProvider(MOONBEAM_WSS));
  const mbApi = mbClient.getTypedApi(moonbeam);
  const ahClient = createClient(getWsProvider(AH_WSS));
  const ahApi = ahClient.getTypedApi(dotah);
  console.log("  Asset Hub ✓");
  console.log("  Moonbeam ✓\n");

  let exitCode = 0;
  try {
    // ═══════════════════════════════════════════════════════════
    //  PHASE 1: XCM Asset Transfer (DepositReserveAsset)
    // ═══════════════════════════════════════════════════════════
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  PHASE 1: XCM Asset Transfer");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // ─── Build XCM V5 message ────────────────────────────────
    console.log("── Step 1: Build XCM V5 (DepositReserveAsset) ──");

    // Inner XCM (executes on Moonbeam after ClearOrigin)
    const innerXcm = [
      {
        type: "BuyExecution",
        value: {
          fees: { id: DOT_LOCATION, fun: { type: "Fungible", value: MB_FEE } },
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
    ];

    // Outer XCM (executes on Asset Hub)
    const msg = {
      type: "V5",
      value: [
        // 1. Withdraw DOT into holding
        {
          type: "WithdrawAsset",
          value: [{ id: DOT_LOCATION, fun: { type: "Fungible", value: TEST_AMOUNT } }],
        },
        // 2. BuyExecution: pay AH fees from holding (only uses what's needed, rest stays)
        {
          type: "BuyExecution",
          value: {
            fees: { id: DOT_LOCATION, fun: { type: "Fungible", value: TEST_AMOUNT } },
            weight_limit: { type: "Unlimited", value: undefined },
          },
        },
        // 3. DepositReserveAsset: send remaining holding to Moonbeam
        //    Auto-injects: ReserveAssetDeposited, ClearOrigin, [innerXcm]
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

    console.log("  XCM V5 message assembled ✓");
    console.log("  Outer: WithdrawAsset, BuyExecution, DepositReserveAsset");
    console.log("  Inner: BuyExecution, DepositAsset(XCMProxy)");
    console.log("  Forwarded will be: ReserveAssetDeposited, ClearOrigin, BuyExecution, DepositAsset\n");

    // ─── Asset Hub dry-run ───────────────────────────────────
    console.log("── Step 2: Asset Hub dry-run (DryRunApi) ──");
    const SENDER_SS58 = process.env.SENDER_SS58 || "13dEYKDJZwY7nxXj3Y5FXJYp8zktsmQikpbGe2otP5u52BKY";

    const ahExecuteTx = ahApi.tx.PolkadotXcm.execute({
      message: msg,
      max_weight: { ref_time: 100000000000n, proof_size: 5000000n },
    });

    let ahDryRunPassed = false;
    let forwardedXcm = null;

    try {
      const ahResult = await ahApi.apis.DryRunApi.dry_run_call(
        { type: "system", value: { type: "Signed", value: SENDER_SS58 } },
        ahExecuteTx.decodedCall,
        5,
      );

      if (!ahResult.success) {
        console.log("  ❌ AH dry-run API error:", fmtJson(ahResult).substring(0, 500));
        exitCode = 1;
      } else {
        const ahExec = ahResult.value.execution_result;

        // Handle PAPI result formats
        if (ahExec.success === true) {
          const weight = ahExec.value?.actual_weight || ahExec.value;
          console.log("  ✅ Asset Hub: SUCCESS");
          if (weight?.ref_time) console.log("     ref_time=" + weight.ref_time);
          ahDryRunPassed = true;
        } else if (ahExec.success === false) {
          const err = ahExec.value?.error;
          console.log("  ❌ Asset Hub execution failed:");
          console.log("     " + fmtJson(err).substring(0, 500));
          exitCode = 1;
        } else if (ahExec.type === "Complete") {
          console.log("  ✅ Asset Hub: Complete (ref_time=" + ahExec.value?.used?.ref_time + ")");
          ahDryRunPassed = true;
        } else if (ahExec.type === "Incomplete") {
          console.log("  ⚠️  Asset Hub: Incomplete — error:", ahExec.value?.error?.error?.type || "unknown");
          console.log("     " + fmtJson(ahExec).substring(0, 500));
          exitCode = 1;
        } else {
          console.log("  AH execution_result (raw):", fmtJson(ahExec).substring(0, 500));
        }

        // Extract forwarded XCMs
        const fwdXcms = ahResult.value.forwarded_xcms;
        if (fwdXcms && fwdXcms.length > 0) {
          for (let fi = 0; fi < fwdXcms.length; fi++) {
            const [destLocation, xcmMessages] = fwdXcms[fi];
            console.log(`  Forwarded[${fi}] to:`, fmtJson(destLocation).substring(0, 200));
            if (xcmMessages && xcmMessages.length > 0) {
              forwardedXcm = xcmMessages[0];
              const instrTypes = forwardedXcm.value.map((i) => i.type).join(", ");
              console.log(`  Forwarded[${fi}] instructions:`, instrTypes);

              // Log amounts
              for (const instr of forwardedXcm.value) {
                if (instr.type === "ReserveAssetDeposited" && instr.value?.[0]?.fun?.value) {
                  console.log(`  Forwarded amount: ${fmtDot(instr.value[0].fun.value)}`);
                }
              }
            }
          }
        } else {
          console.log("  ⚠️  No forwarded XCMs");
        }

        // Log emitted events (summarized)
        const events = ahResult.value.emitted_events || [];
        const xcmpSent = events.some(e => e.type === "XcmpQueue" && e.value?.type === "XcmpMessageSent");
        const attempted = events.find(e => e.type === "PolkadotXcm" && e.value?.type === "Attempted");
        if (xcmpSent) console.log("  XCMP message sent ✓");
        if (attempted) {
          const outcome = attempted.value?.value?.outcome;
          if (outcome?.type === "Complete") {
            console.log("  XCM outcome: Complete (ref_time=" + outcome.value?.used?.ref_time + ")");
          }
        }

        // Log fee burn
        const burns = events.filter(e => e.type === "Balances" && e.value?.type === "Burned");
        const mints = events.filter(e => e.type === "Balances" && e.value?.type === "Minted");
        for (const b of burns) console.log("  Burned:", fmtDot(b.value?.value?.amount));
        for (const m of mints) console.log("  Minted:", fmtDot(m.value?.value?.amount), "to", m.value?.value?.who?.substring(0, 16) + "...");
      }
    } catch (e) {
      console.log("  ❌ AH dry-run exception:", e.message?.substring(0, 500));
      exitCode = 1;
    }
    console.log();

    // ─── Moonbeam dry-run ────────────────────────────────────
    if (forwardedXcm) {
      console.log("── Step 3: Moonbeam dry-run (forwarded XCM) ──");
      try {
        const mbResult = await mbApi.apis.DryRunApi.dry_run_xcm(
          {
            type: "V5",
            value: {
              parents: 1,
              interior: { type: "X1", value: { type: "Parachain", value: 1000 } },
            },
          },
          forwardedXcm,
        );

        if (mbResult.success) {
          const mbExec = mbResult.value.execution_result;
          if (mbExec.type === "Complete") {
            console.log("  ✅ Moonbeam: Complete (ref_time=" + mbExec.value.used.ref_time + ")");
          } else if (mbExec.type === "Incomplete") {
            const errType = mbExec.value?.error?.error?.type || mbExec.value?.error?.type || "unknown";
            console.log("  ⚠️  Moonbeam: Incomplete — error:", errType);
            exitCode = 1;
          } else {
            console.log("  ❌ Moonbeam:", mbExec.type, fmtJson(mbExec.value).substring(0, 300));
            exitCode = 1;
          }

          // Log Moonbeam events
          const mbEvents = mbResult.value.emitted_events || [];
          for (const e of mbEvents.slice(0, 8)) {
            console.log("    Event:", e.type + "." + (e.value?.type || ""));
          }
        } else {
          console.log("  ❌ Moonbeam dry-run API error:", fmtJson(mbResult).substring(0, 500));
          exitCode = 1;
        }
      } catch (e) {
        console.log("  ❌ Moonbeam dry-run exception:", e.message?.substring(0, 300));
        exitCode = 1;
      }
      console.log();
    }

    // ─── XCM precompile weighMessage ─────────────────────────
    if (ahDryRunPassed) {
      console.log("── Step 4: XCM precompile weight check (eth_call) ──");
      try {
        const fullCallData = await ahExecuteTx.getEncodedData();
        const fullHex = fullCallData.asHex();

        // Strip call index (2 bytes = 4 hex after "0x")
        const withoutCallIndex = fullHex.slice(6);

        // Strip trailing max_weight { compact(ref_time), compact(proof_size) }
        const maxWeight = { ref_time: 100000000000n, proof_size: 5000000n };
        const refTimeLen = compactEncodingLength(maxWeight.ref_time);
        const proofSizeLen = compactEncodingLength(maxWeight.proof_size);
        const weightHexChars = (refTimeLen + proofSizeLen) * 2;

        const xcmHex = "0x" + withoutCallIndex.slice(0, -weightHexChars);
        console.log("  XCM bytes:", xcmHex.length / 2, "bytes");
        console.log("  Version byte:", xcmHex.substring(2, 4), "(0x05 = V5)");

        const precompileIface = new ethers.Interface([
          "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
          "function execute(bytes calldata message, tuple(uint64 refTime, uint64 proofSize) weight) external",
        ]);

        const weighData = precompileIface.encodeFunctionData("weighMessage", [xcmHex]);
        const weighResult = await ethProvider.call({ to: XCM_PRECOMPILE, data: weighData });
        const decoded = precompileIface.decodeFunctionResult("weighMessage", weighResult);
        const weight = {
          refTime: decoded[0].refTime * 110n / 100n,  // 10% buffer
          proofSize: decoded[0].proofSize * 110n / 100n,
        };
        console.log(`  ✅ Weight: refTime=${weight.refTime}, proofSize=${weight.proofSize}`);

        // eth_call dry-run of execute()
        console.log("\n── Step 5: eth_call dry-run of execute() ──");
        const execData = precompileIface.encodeFunctionData("execute", [xcmHex, weight]);
        try {
          await wallet.call({ to: XCM_PRECOMPILE, data: execData });
          console.log("  ✅ eth_call execute: SUCCESS");
        } catch (e) {
          console.log("  ❌ eth_call execute FAILED:", e.reason || e.message?.substring(0, 200));
          exitCode = 1;
        }
      } catch (e) {
        console.log("  ❌ Weight check error:", e.message?.substring(0, 300));
        exitCode = 1;
      }
      console.log();
    }

    // ═══════════════════════════════════════════════════════════
    //  PHASE 2: Simulate EVM Call (Backend Relayer)
    // ═══════════════════════════════════════════════════════════
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  PHASE 2: Simulate Backend EVM Call");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("── Step 6: Simulate receiveAssets() on Moonbeam ──");
    console.log("  In production, the backend relayer calls this after detecting");
    console.log("  the xcDOT transfer to XCMProxy on Moonbeam.\n");

    try {
      const mbEthProvider = new ethers.JsonRpcProvider(MOONBEAM_RPC);

      // Build the same EVM calldata as before
      const REMOTE_ID = ethers.hexlify(ethers.randomBytes(32));
      const iface = new ethers.Interface([
        "function receiveAssets(bytes32, address, address, uint256, bytes)",
      ]);
      const paramsType = ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"];
      const paramsVal = [
        "0x0000000000000000000000000000000000000001", // poolId placeholder
        xcDOT,
        [0, 0],
        -800000,
        800000,
        wallet.address,
        500,
      ];
      const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(paramsType, paramsVal);
      const evmInput = iface.encodeFunctionData("receiveAssets", [
        REMOTE_ID, xcDOT, wallet.address, TEST_AMOUNT.toString(), encodedParams,
      ]);

      console.log("  positionId:", REMOTE_ID);
      console.log("  EVM calldata:", evmInput.length / 2 - 1, "bytes");

      // Simulate the call from the relayer
      const RELAYER = process.env.RELAYER_ADDRESS || wallet.address;
      console.log("  Simulating call from relayer:", RELAYER);

      try {
        const result = await mbEthProvider.call({
          from: RELAYER,
          to: XCMPROXY,
          data: evmInput,
          gasLimit: 500000,
        });
        console.log("  ✅ receiveAssets() eth_call: SUCCESS");
        console.log("  Return data:", result.substring(0, 66) + (result.length > 66 ? "..." : ""));
      } catch (e) {
        const reason = e.reason || e.message?.substring(0, 200) || "unknown";
        console.log("  ⚠️  receiveAssets() eth_call:", reason);
        console.log("  (This may fail in simulation if the contract checks caller/balances)");
        // Don't set exitCode — Phase 2 simulation failure is expected without real state
      }
    } catch (e) {
      console.log("  ⚠️  Moonbeam EVM simulation error:", e.message?.substring(0, 200));
    }

    // ═══════════════════════════════════════════════════════════
    //  Fee Summary
    // ═══════════════════════════════════════════════════════════
    console.log("\n── Fee Summary ──");
    console.log("  Asset Hub: BuyExecution uses ~0.034 DOT (rest forwarded to Moonbeam)");
    console.log("  Moonbeam: BuyExecution uses ~0.016 DOT for xcDOT deposit");
    console.log("  Moonbeam: ~0.01 GLMR gas for receiveAssets() EVM call (Phase 2)");
    console.log("  Total overhead: ~0.05 DOT + ~0.01 GLMR");

  } catch (e) {
    console.error("\n❌ Fatal error:", e.message?.substring(0, 500) || e);
    exitCode = 1;
  } finally {
    console.log("\nDisconnecting...");
    mbClient.destroy();
    ahClient.destroy();
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log(exitCode === 0 ? "  ✅ DRY-RUN PASSED" : "  ❌ DRY-RUN HAD FAILURES");
  console.log("══════════════════════════════════════════════════════\n");
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
