/**
 * Testnet Integration Test: Guided Investment Flow
 * 
 * Tests investment on REAL CHAINS but with MANUAL settlement:
 * - AssetHubVault on Paseo Asset Hub (Chain ID: 420420422)
 * - XCMProxy on Moonbase Alpha (Chain ID: 1287)
 * - Test mode enabled (no actual XCM sent)
 * - Manually call cross-chain functions (simulating XCM)
 * 
 * Prerequisites:
 * 1. Both contracts deployed
 * 2. Contracts linked (addChain called, trusted caller set)
 * 3. Test mode enabled on both contracts
 * 4. Pool exists on Moonbase with liquidity
 * 
 * Usage:
 *   $env:ASSETHUB_CONTRACT="0xYourAssetHubAddress"
 *   $env:XCMPROXY_CONTRACT="0xYourXCMProxyAddress"
 *   $env:MOONBASE_POOL="0xYourPoolAddress"
 *   $env:MOONBASE_WETH="0xYourWETHAddress"
 *   
 *   npx hardhat test test/Integration/testnet/1.guided-investment-flow.test.js --network passethub
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Testnet Integration - Guided Investment Flow", function () {
  let assetHubVault;
  let user, operator;
  
  const ASSETHUB_ADDRESS = process.env.ASSETHUB_CONTRACT;
  const XCMPROXY_ADDRESS = process.env.XCMPROXY_CONTRACT;
  const POOL_ADDRESS = process.env.MOONBASE_POOL;
  const WETH_ADDRESS = process.env.MOONBASE_WETH;

  before(async function () {
    // Validate environment
    if (!ASSETHUB_ADDRESS || !XCMPROXY_ADDRESS) {
      throw new Error(
        "\n❌ Missing contract addresses!\n" +
        "   Set both:\n" +
        "   $env:ASSETHUB_CONTRACT=\"0xYourAssetHubAddress\"\n" +
        "   $env:XCMPROXY_CONTRACT=\"0xYourXCMProxyAddress\"\n"
      );
    }

    if (!POOL_ADDRESS || !WETH_ADDRESS) {
      console.log("\n⚠️  Pool/WETH addresses not set - using defaults");
      console.log("   To override, set:");
      console.log("   $env:MOONBASE_POOL=\"0xYourPoolAddress\"");
      console.log("   $env:MOONBASE_WETH=\"0xYourWETHAddress\"\n");
    }

    [user, operator] = await ethers.getSigners();

    // Attach to AssetHub
    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    assetHubVault = AssetHubVault.attach(ASSETHUB_ADDRESS);

    console.log("\n" + "=".repeat(70));
    console.log("  Testnet Integration Test - Guided Investment Flow");
    console.log("=".repeat(70));
    console.log(`   AssetHub: ${ASSETHUB_ADDRESS}`);
    console.log(`   XCMProxy: ${XCMPROXY_ADDRESS}`);
    console.log(`   Pool: ${POOL_ADDRESS || "Not set"}`);
    console.log(`   WETH: ${WETH_ADDRESS || "Not set"}`);
    console.log(`   Network: ${hre.network.name}`);
    console.log(`   User: ${user.address}`);
    console.log(`   Operator: ${operator.address}`);
    console.log("=".repeat(70) + "\n");

    // Verify test mode
    const testMode = await assetHubVault.testMode();
    console.log(`   AssetHub Test Mode: ${testMode}`);

    if (!testMode) {
      throw new Error(
        "\n❌ Test mode MUST be enabled on AssetHub!\n" +
        "   Call: assetHubVault.setTestMode(true)\n"
      );
    }

    console.log("   ✅ Test mode enabled - safe to proceed\n");

    // Verify contracts are linked
    const moonbaseChain = await assetHubVault.supportedChains(1287);
    if (!moonbaseChain.active) {
      throw new Error(
        "\n❌ Contracts not linked!\n" +
        "   Run: npx hardhat run scripts/link-contracts.js --network passethub\n"
      );
    }

    console.log("   ✅ Contracts are linked");
    console.log(`   Moonbase Proxy: ${moonbaseChain.proxyAddress}\n`);

    if (moonbaseChain.proxyAddress.toLowerCase() !== XCMPROXY_ADDRESS.toLowerCase()) {
      console.log(`   ⚠️  WARNING: Linked proxy (${moonbaseChain.proxyAddress})`);
      console.log(`               differs from env var (${XCMPROXY_ADDRESS})\n`);
    }
  });

  describe("Step-by-Step Guided Flow", function () {
    let positionId;
    let investAmount;

    it("Step 1: Deposit to AssetHub on Paseo", async function () {
      console.log("\n📥 STEP 1: Deposit to AssetHubVault");
      console.log("-".repeat(70));

      const depositAmount = ethers.parseEther("0.1");
      
      const balanceBefore = await assetHubVault.getUserBalance(user.address);
      console.log(`   Current balance: ${ethers.formatEther(balanceBefore)} ETH`);
      
      // Deposit
      console.log(`   Depositing ${ethers.formatEther(depositAmount)} ETH...`);
      const depositTx = await assetHubVault.connect(user).deposit({ 
        value: depositAmount 
      });
      const depositReceipt = await depositTx.wait();
      
      const balanceAfter = await assetHubVault.getUserBalance(user.address);
      console.log(`   ✅ Deposit confirmed in block ${depositReceipt.blockNumber}`);
      console.log(`   New balance: ${ethers.formatEther(balanceAfter)} ETH`);

      expect(balanceAfter).to.equal(balanceBefore + depositAmount);
      console.log("   ✅ Balance updated correctly\n");
    });

    it("Step 2: Dispatch Investment (Test Mode - No XCM)", async function () {
      console.log("\n🚀 STEP 2: Dispatch Investment");
      console.log("-".repeat(70));
      
      const poolAddress = POOL_ADDRESS || ethers.ZeroAddress;
      const wethAddress = WETH_ADDRESS || ethers.ZeroAddress;
      
      if (poolAddress === ethers.ZeroAddress) {
        console.log("   ⚠️  No pool address set - using placeholder");
        console.log("      This will create the position data but won't execute on Moonbase");
      }

      investAmount = ethers.parseEther("0.05");
      const userAddress = user.address;

      console.log(`   User: ${userAddress}`);
      console.log(`   Amount: ${ethers.formatEther(investAmount)} ETH`);
      console.log(`   Pool: ${poolAddress}`);
      console.log(`   Base Asset: ${wethAddress}`);
      console.log(`   Tick Range: -1 to +1`);

      const balanceBefore = await assetHubVault.getUserBalance(userAddress);
      console.log(`   Balance before: ${ethers.formatEther(balanceBefore)} ETH`);

      // Dispatch investment
      console.log("\n   Dispatching investment...");
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        userAddress,
        1287, // Moonbase chainId
        poolAddress,
        wethAddress,
        investAmount,
        -1, // tick lower (-1%)
        1,  // tick upper (+1%)
        "0x030100001234", // dummy XCM destination (ignored in test mode)
        "0x0300010203"    // dummy XCM message (ignored in test mode)
      );

      const receipt = await tx.wait();
      console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);
      
      // Extract position ID from event
      const event = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });

      positionId = assetHubVault.interface.parseLog(event).args.positionId;
      console.log(`   📋 Position ID: ${positionId}`);
      
      // Verify user balance reduced
      const balanceAfter = await assetHubVault.getUserBalance(userAddress);
      expect(balanceAfter).to.equal(balanceBefore - investAmount);
      console.log(`   ✅ Balance reduced to: ${ethers.formatEther(balanceAfter)} ETH`);

      // Verify position created with PENDING status
      const position = await assetHubVault.positions(positionId);
      console.log(`\n   Position Details:`);
      console.log(`   - User: ${position.user}`);
      console.log(`   - Amount: ${ethers.formatEther(position.amount)} ETH`);
      console.log(`   - Chain ID: ${position.chainId}`);
      console.log(`   - Pool: ${position.poolId}`);
      console.log(`   - Status: ${position.status} (0=PENDING)`);

      expect(position.status).to.equal(0); // PENDING
      expect(position.user).to.equal(userAddress);
      expect(position.amount).to.equal(investAmount);
      
      console.log("   ✅ Position created with PENDING status\n");
    });

    it("Step 3: MANUAL - Execute Investment on Moonbase", async function () {
      console.log("\n🌉 STEP 3: Execute Investment on Moonbase (MANUAL)");
      console.log("-".repeat(70));
      console.log("\n   ⚠️  THIS STEP REQUIRES MANUAL EXECUTION ON MOONBASE!\n");

      console.log("   Instructions:");
      console.log("   1. Switch your terminal/Hardhat to Moonbase network");
      console.log("   2. Attach to XCMProxy:");
      console.log(`      const proxy = await ethers.getContractAt("XCMProxy", "${XCMPROXY_ADDRESS}");`);
      console.log("\n   3. (Optional) Send ETH to XCMProxy to fund the position:");
      console.log(`      await signer.sendTransaction({`);
      console.log(`        to: "${XCMPROXY_ADDRESS}",`);
      console.log(`        value: ethers.parseEther("${ethers.formatEther(investAmount)}")`);
      console.log(`      });`);
      console.log("\n   4. Execute investment (simulating XCM arrival):");
      console.log(`      await proxy.executeInvestment(`);
      console.log(`        "${user.address}",           // user`);
      console.log(`        "${POOL_ADDRESS || '0x...'}",              // poolId`);
      console.log(`        "${WETH_ADDRESS || '0x...'}",   // baseAsset`);
      console.log(`        "${investAmount}",            // amount`);
      console.log(`        -1,                          // tickLower`);
      console.log(`        1,                           // tickUpper`);
      console.log(`        "${positionId}"              // positionId`);
      console.log(`      );`);

      console.log("\n   5. Verify position created:");
      console.log(`      const userPositions = await proxy.getUserPositionIds("${user.address}");`);
      console.log(`      console.log("Positions:", userPositions);`);

      console.log("\n   6. Once executed, return here and continue to next test\n");

      // This test just provides instructions - manual execution required
      expect(positionId).to.exist;
    });

    it("Step 4: Verify Position Status", async function () {
      console.log("\n✅ STEP 4: Verify Position on AssetHub");
      console.log("-".repeat(70));

      const position = await assetHubVault.positions(positionId);
      
      console.log(`   Position ID: ${positionId}`);
      console.log(`   User: ${position.user}`);
      console.log(`   Amount: ${ethers.formatEther(position.amount)} ETH`);
      console.log(`   Chain: ${position.chainId}`);
      console.log(`   Pool: ${position.poolId}`);
      console.log(`   Status: ${position.status}`);

      if (position.status === 0) {
        console.log("\n   ⚠️  Status is still PENDING (0)");
        console.log("      This is expected - status only updates when XCM confirms");
        console.log("      In test mode, status remains PENDING until manual settlement");
      } else if (position.status === 1) {
        console.log("\n   ✅ Status is ACTIVE (1)");
        console.log("      Position successfully created on Moonbase!");
      }

      console.log("\n   To check on Moonbase:");
      console.log(`   const proxy = await ethers.getContractAt("XCMProxy", "${XCMPROXY_ADDRESS}");`);
      console.log(`   const positions = await proxy.getUserPositionIds("${user.address}");`);
      console.log(`   const details = await proxy.positions("${user.address}", positions[0]);`);
      console.log("   console.log(details);\n");
    });

    it("Step 5: MANUAL - Liquidate Position on Moonbase", async function () {
      console.log("\n💧 STEP 5: Liquidate Position on Moonbase (MANUAL)");
      console.log("-".repeat(70));
      console.log("\n   ⚠️  THIS STEP REQUIRES MANUAL EXECUTION ON MOONBASE!\n");

      console.log("   Instructions:");
      console.log("   1. On Moonbase, get position NFT ID:");
      console.log(`      const proxy = await ethers.getContractAt("XCMProxy", "${XCMPROXY_ADDRESS}");`);
      console.log(`      const positionIds = await proxy.getUserPositionIds("${user.address}");`);
      console.log(`      const nftId = positionIds[0];  // First position`);

      console.log("\n   2. Liquidate the position:");
      console.log(`      const tx = await proxy.liquidatePosition(`);
      console.log(`        "${user.address}",`);
      console.log(`        nftId,`);
      console.log(`        0,  // amountOutMinimum (0 for test)`);
      console.log(`        "${positionId}"  // assetHubPositionId`);
      console.log(`      );`);
      console.log(`      const receipt = await tx.wait();`);

      console.log("\n   3. Extract proceeds from events:");
      console.log(`      const event = receipt.logs.find(log => {`);
      console.log(`        try {`);
      console.log(`          return proxy.interface.parseLog(log).name === "PositionLiquidated";`);
      console.log(`        } catch { return false; }`);
      console.log(`      });`);
      console.log(`      const proceeds = proxy.interface.parseLog(event).args.proceeds;`);
      console.log(`      console.log("Proceeds:", ethers.formatEther(proceeds), "ETH");`);

      console.log("\n   4. Note the proceeds amount - you'll need it for settlement\n");

      expect(positionId).to.exist;
    });

    it("Step 6: MANUAL - Settle Liquidation on AssetHub", async function () {
      console.log("\n💰 STEP 6: Settle Liquidation on AssetHub (MANUAL)");
      console.log("-".repeat(70));
      console.log("\n   ⚠️  THIS STEP CAN BE DONE HERE OR MANUALLY!\n");

      console.log("   Option A: Manual Settlement (Simulating XCM return)");
      console.log("   -----------------------------------------------------");
      console.log("   1. Get proceeds amount from Moonbase liquidation");
      console.log("   2. Call settleLiquidation on AssetHub:");
      console.log(`      await assetHubVault.settleLiquidation(`);
      console.log(`        "${positionId}",`);
      console.log(`        proceeds,  // amount from Moonbase`);
      console.log(`        true       // success`);
      console.log(`      );`);

      console.log("\n   Option B: Automated Settlement (if proceeds known)");
      console.log("   ---------------------------------------------------");
      console.log("   Uncomment the code below and set proceeds amount:\n");

      // Example automated settlement (commented out - user must provide proceeds)
      /*
      const proceeds = ethers.parseEther("0.048"); // Example - set actual proceeds
      
      const balanceBefore = await assetHubVault.getUserBalance(user.address);
      console.log(`   Balance before settlement: ${ethers.formatEther(balanceBefore)} ETH`);
      
      const tx = await assetHubVault.settleLiquidation(
        positionId,
        proceeds,
        true // success
      );
      
      await tx.wait();
      
      const balanceAfter = await assetHubVault.getUserBalance(user.address);
      console.log(`   ✅ Settlement complete`);
      console.log(`   Balance after: ${ethers.formatEther(balanceAfter)} ETH`);
      console.log(`   Profit/Loss: ${ethers.formatEther(balanceAfter - balanceBefore - proceeds)} ETH`);
      
      const position = await assetHubVault.positions(positionId);
      expect(position.status).to.equal(2); // CLOSED
      */

      console.log("\n   After settlement, position status should be CLOSED (2)\n");
      
      expect(positionId).to.exist;
    });

    it("Step 7: Verify Final State", async function () {
      console.log("\n📊 STEP 7: Verify Final State");
      console.log("-".repeat(70));

      const position = await assetHubVault.positions(positionId);
      const userBalance = await assetHubVault.getUserBalance(user.address);

      console.log(`\n   Position ${positionId}:`);
      console.log(`   - Status: ${position.status} (${getStatusName(position.status)})`);
      console.log(`   - User: ${position.user}`);
      console.log(`   - Amount: ${ethers.formatEther(position.amount)} ETH`);

      console.log(`\n   User Balance: ${ethers.formatEther(userBalance)} ETH`);

      if (position.status === 2) {
        console.log("\n   ✅ Position CLOSED - Full flow complete!");
      } else if (position.status === 1) {
        console.log("\n   ⚠️  Position still ACTIVE - liquidation not settled");
      } else {
        console.log("\n   ⚠️  Position still PENDING - investment not executed");
      }

      console.log("\n   To verify on Moonbase:");
      console.log(`   const proxy = await ethers.getContractAt("XCMProxy", "${XCMPROXY_ADDRESS}");`);
      console.log(`   const positions = await proxy.getUserPositionIds("${user.address}");`);
      console.log(`   console.log("Active positions:", positions.length);`);
      console.log();
    });
  });

  describe("Full Automated Mock Flow (Local Network Only)", function () {
    it("should provide instructions for local mock testing", async function () {
      console.log("\n💡 TIP: For fully automated testing, use mock XCM tests:");
      console.log("-".repeat(70));
      console.log("\n   These tests deploy both contracts locally and automate the entire flow:");
      console.log("\n   1. Mock Investment Flow:");
      console.log("      npx hardhat test test/Integration/mock-xcm/1.mock-investment-flow.test.js");
      console.log("\n   2. Mock Liquidation Flow:");
      console.log("      npx hardhat test test/Integration/mock-xcm/2.mock-liquidation-flow.test.js");
      console.log("\n   These verify the LOGIC without requiring real XCM or manual steps!\n");
    });
  });
});

function getStatusName(status) {
  const names = ["PENDING", "ACTIVE", "CLOSED"];
  return names[status] || "UNKNOWN";
}
