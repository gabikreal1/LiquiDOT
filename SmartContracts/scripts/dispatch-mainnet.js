/**
 * Mainnet Dispatch — Full Two-Phase Investment Pipeline
 *
 * Phase 1: Execute XCM on Asset Hub → transfers DOT to Moonbeam as xcDOT at XCMProxy
 * Phase 2: Call receiveAssets() on Moonbeam XCMProxy from relayer wallet
 *
 * Usage:
 *   node scripts/dispatch-mainnet.js
 *   DISPATCH_AMOUNT=2000000000 node scripts/dispatch-mainnet.js   # 0.2 DOT
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
const AH_RPC = process.env.ASSET_HUB_RPC || "https://eth-rpc.polkadot.io/";
const MB_RPC = process.env.MOONBEAM_RPC_URL || "https://rpc.api.moonbeam.network";
const MB_WSS = process.env.MOONBEAM_PAPI_ENDPOINT || "wss://wss.api.moonbeam.network";
const AH_WSS = process.env.ASSET_HUB_PAPI_ENDPOINT || "wss://polkadot-asset-hub-rpc.polkadot.io";

// Amount in planck (1 DOT = 10_000_000_000)
const DISPATCH_AMOUNT = BigInt(process.env.DISPATCH_AMOUNT || "1000000000"); // 0.1 DOT default
const MB_FEE = 400000000n; // 0.04 DOT BuyExecution on Moonbeam

const DOT_LOCATION = { parents: 1, interior: { type: "Here", value: undefined } };

// ─── Helpers ─────────────────────────────────────────────────
function fmtDot(planck) {
  return (Number(planck) / 1e10).toFixed(6) + " DOT";
}

function compactEncodingLength(val) {
  if (val < 64n) return 1;
  if (val < 16384n) return 2;
  if (val < 1073741824n) return 4;
  let bytes = 0;
  let v = val;
  while (v > 0n) { v >>= 8n; bytes++; }
  return 1 + bytes;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("══════════════════════════════════════════════════════");
  console.log("  MAINNET DISPATCH — Two-Phase Investment Pipeline");
  console.log("══════════════════════════════════════════════════════\n");

  // ─── Validate keys ────────────────────────────────────────
  if (!process.env.ASSET_PK) {
    console.error("❌ Missing ASSET_PK in .env");
    process.exit(1);
  }
  if (!process.env.MOON_PK) {
    console.error("❌ Missing MOON_PK in .env");
    process.exit(1);
  }

  // ─── Setup providers & wallets ─────────────────────────────
  const ahProvider = new ethers.JsonRpcProvider(AH_RPC);
  const ahWallet = new ethers.Wallet(process.env.ASSET_PK, ahProvider);

  const mbProvider = new ethers.JsonRpcProvider(MB_RPC);
  const mbWallet = new ethers.Wallet(process.env.MOON_PK, mbProvider);

  console.log("AH Wallet:", ahWallet.address);
  console.log("MB Wallet:", mbWallet.address);
  console.log("Amount:", fmtDot(DISPATCH_AMOUNT));
  console.log("XCMProxy:", XCMPROXY);
  console.log();

  // ─── Pre-flight checks ────────────────────────────────────
  console.log("── Pre-flight checks ──");

  const ahBal = await ahProvider.getBalance(ahWallet.address);
  console.log("  AH balance:", ethers.formatEther(ahBal), "DOT");
  if (ahBal < DISPATCH_AMOUNT) {
    console.error("❌ Insufficient AH balance");
    process.exit(1);
  }

  const mbBal = await mbProvider.getBalance(mbWallet.address);
  console.log("  MB balance:", ethers.formatEther(mbBal), "GLMR");
  if (mbBal < ethers.parseEther("0.1")) {
    console.error("❌ Insufficient GLMR for Phase 2 gas");
    process.exit(1);
  }

  // Check xcDOT balance at XCMProxy before
  const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
  const xcDotContract = new ethers.Contract(xcDOT, erc20Abi, mbProvider);
  const xcDotBefore = await xcDotContract.balanceOf(XCMPROXY);
  console.log("  XCMProxy xcDOT before:", ethers.formatUnits(xcDotBefore, 10), "DOT");
  console.log("  ✅ Pre-flight passed\n");

  // ═══════════════════════════════════════════════════════════
  //  PHASE 1: XCM Asset Transfer
  // ═══════════════════════════════════════════════════════════
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PHASE 1: XCM Transfer (Asset Hub → Moonbeam)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Connect PAPI (only needed for building the XCM message encoding)
  console.log("Connecting PAPI to build XCM...");
  const ahPapiClient = createClient(getWsProvider(AH_WSS));
  const ahApi = ahPapiClient.getTypedApi(dotah);

  // Build XCM V5 message
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

  const msg = {
    type: "V5",
    value: [
      {
        type: "WithdrawAsset",
        value: [{ id: DOT_LOCATION, fun: { type: "Fungible", value: DISPATCH_AMOUNT } }],
      },
      {
        type: "BuyExecution",
        value: {
          fees: { id: DOT_LOCATION, fun: { type: "Fungible", value: DISPATCH_AMOUNT } },
          weight_limit: { type: "Unlimited", value: undefined },
        },
      },
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

  const maxWeight = { ref_time: 100000000000n, proof_size: 5000000n };
  const ahExecuteTx = ahApi.tx.PolkadotXcm.execute({ message: msg, max_weight: maxWeight });
  const fullCallData = await ahExecuteTx.getEncodedData();
  const fullHex = fullCallData.asHex();

  // Extract XCM bytes
  const withoutCallIndex = fullHex.slice(6);
  const refTimeLen = compactEncodingLength(maxWeight.ref_time);
  const proofSizeLen = compactEncodingLength(maxWeight.proof_size);
  const weightHexChars = (refTimeLen + proofSizeLen) * 2;
  const xcmHex = "0x" + withoutCallIndex.slice(0, -weightHexChars);

  console.log("  XCM message:", xcmHex.length / 2, "bytes");

  // Disconnect PAPI (no longer needed)
  ahPapiClient.destroy();
  console.log("  PAPI disconnected\n");

  // Weigh via precompile
  console.log("── Weighing XCM via precompile ──");
  const precompileIface = new ethers.Interface([
    "function weighMessage(bytes calldata message) external view returns (tuple(uint64 refTime, uint64 proofSize))",
    "function execute(bytes calldata message, tuple(uint64 refTime, uint64 proofSize) weight) external",
  ]);

  const weighData = precompileIface.encodeFunctionData("weighMessage", [xcmHex]);
  const weighResult = await ahProvider.call({ to: XCM_PRECOMPILE, data: weighData });
  const decoded = precompileIface.decodeFunctionResult("weighMessage", weighResult);
  const weight = {
    refTime: decoded[0].refTime * 125n / 100n,   // 25% safety buffer for real tx
    proofSize: decoded[0].proofSize * 125n / 100n,
  };
  console.log(`  Weight: refTime=${weight.refTime}, proofSize=${weight.proofSize}`);

  // Execute XCM via precompile (REAL TRANSACTION)
  console.log("\n── Executing XCM (REAL TRANSACTION) ──");
  const execData = precompileIface.encodeFunctionData("execute", [xcmHex, weight]);

  // Estimate gas
  const gasEstimate = await ahProvider.estimateGas({
    from: ahWallet.address,
    to: XCM_PRECOMPILE,
    data: execData,
  });
  console.log("  Gas estimate:", gasEstimate.toString());

  // Send transaction
  console.log("  Sending transaction...");
  const tx = await ahWallet.sendTransaction({
    to: XCM_PRECOMPILE,
    data: execData,
    gasLimit: gasEstimate * 150n / 100n, // 50% gas buffer
  });
  console.log("  TX hash:", tx.hash);
  console.log("  Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("  ✅ Phase 1 confirmed!");
  console.log("     Block:", receipt.blockNumber);
  console.log("     Gas used:", receipt.gasUsed.toString());
  console.log("     Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");

  if (receipt.status !== 1) {
    console.error("❌ Transaction reverted!");
    process.exit(1);
  }

  // ─── Wait for XCM relay ────────────────────────────────────
  console.log("\n── Waiting for XCM relay to Moonbeam ──");
  const POLL_INTERVAL = 10000; // 10 seconds
  const MAX_WAIT = 120000;     // 2 minutes
  let elapsed = 0;
  let xcDotAfter = xcDotBefore;

  while (elapsed < MAX_WAIT) {
    await sleep(POLL_INTERVAL);
    elapsed += POLL_INTERVAL;
    xcDotAfter = await xcDotContract.balanceOf(XCMPROXY);
    const delta = xcDotAfter - xcDotBefore;
    console.log(`  [${elapsed / 1000}s] XCMProxy xcDOT: ${ethers.formatUnits(xcDotAfter, 10)} DOT (delta: ${ethers.formatUnits(delta, 10)})`);

    if (delta > 0n) {
      console.log("  ✅ xcDOT arrived at XCMProxy!");
      break;
    }
  }

  const xcDotDelta = xcDotAfter - xcDotBefore;
  if (xcDotDelta <= 0n) {
    console.log("  ⚠️  xcDOT not detected after 2 minutes. It may still be in transit.");
    console.log("  Check manually: xcDOT.balanceOf(XCMProxy) on Moonbeam");
    console.log("  Proceeding to Phase 2 anyway...\n");
  } else {
    console.log(`  Received: ${ethers.formatUnits(xcDotDelta, 10)} DOT as xcDOT\n`);
  }

  // ═══════════════════════════════════════════════════════════
  //  PHASE 2: Backend EVM Call on Moonbeam
  // ═══════════════════════════════════════════════════════════
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PHASE 2: receiveAssets() on Moonbeam");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Build receiveAssets calldata
  const POSITION_ID = ethers.hexlify(ethers.randomBytes(32));
  console.log("  positionId:", POSITION_ID);

  const iface = new ethers.Interface([
    "function receiveAssets(bytes32, address, address, uint256, bytes)",
  ]);
  const paramsType = ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"];
  const paramsVal = [
    "0x0000000000000000000000000000000000000001", // poolId placeholder
    xcDOT,
    [0, 0],       // tickRange placeholder
    -800000,
    800000,
    ahWallet.address, // user
    500,              // slippageBps 5%
  ];
  const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(paramsType, paramsVal);
  const evmInput = iface.encodeFunctionData("receiveAssets", [
    POSITION_ID, xcDOT, ahWallet.address, DISPATCH_AMOUNT.toString(), encodedParams,
  ]);

  console.log("  EVM calldata:", evmInput.length / 2 - 1, "bytes");

  // First simulate via eth_call
  console.log("  Simulating via eth_call...");
  try {
    await mbProvider.call({
      from: mbWallet.address,
      to: XCMPROXY,
      data: evmInput,
    });
    console.log("  ✅ Simulation passed");
  } catch (e) {
    console.log("  ⚠️  Simulation failed:", e.reason || e.message?.substring(0, 200));
    console.log("  Attempting real tx anyway...");
  }

  // Send real transaction on Moonbeam
  console.log("  Sending receiveAssets() transaction...");
  try {
    const mbTx = await mbWallet.sendTransaction({
      to: XCMPROXY,
      data: evmInput,
      gasLimit: 500000n,
    });
    console.log("  TX hash:", mbTx.hash);
    console.log("  Waiting for confirmation...");

    const mbReceipt = await mbTx.wait();
    console.log("  Block:", mbReceipt.blockNumber);
    console.log("  Gas used:", mbReceipt.gasUsed.toString());
    console.log("  Status:", mbReceipt.status === 1 ? "✅ SUCCESS" : "❌ REVERTED");

    // Log events
    if (mbReceipt.logs.length > 0) {
      console.log("  Events:");
      for (const log of mbReceipt.logs) {
        console.log(`    ${log.address} topic0=${log.topics[0]?.substring(0, 18)}...`);
      }
    }
  } catch (e) {
    console.log("  ❌ Phase 2 failed:", e.reason || e.message?.substring(0, 300));
    console.log("  xcDOT is safely at XCMProxy. Can retry Phase 2 later.");
  }

  // ─── Final Summary ─────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  DISPATCH SUMMARY");
  console.log("══════════════════════════════════════════════════════");

  const ahBalAfter = await ahProvider.getBalance(ahWallet.address);
  const xcDotFinal = await xcDotContract.balanceOf(XCMPROXY);
  console.log(`  AH balance: ${ethers.formatEther(ahBal)} → ${ethers.formatEther(ahBalAfter)} DOT`);
  console.log(`  AH spent: ${ethers.formatEther(ahBal - ahBalAfter)} DOT`);
  console.log(`  XCMProxy xcDOT: ${ethers.formatUnits(xcDotBefore, 10)} → ${ethers.formatUnits(xcDotFinal, 10)} DOT`);
  console.log(`  Net xcDOT received: ${ethers.formatUnits(xcDotFinal - xcDotBefore, 10)} DOT`);
  console.log("══════════════════════════════════════════════════════\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌ Fatal:", e.message || e);
  process.exit(1);
});
