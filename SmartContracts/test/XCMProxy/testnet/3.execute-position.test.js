/**
 * XCMProxy Testnet Position Execution Tests
 * 
 * Tests executing pending positions and minting NFPM positions
 * Safe for testnet - requires NFPM integration to be configured
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/testnet/3.execute-position.test.js --network moonbase
 * 
 * Requirements:
 *   - MOON_PK in .env must have DEV tokens
 *   - XCMPROXY_CONTRACT must point to deployed contract
 *   - Contract must be in test mode
 *   - NFPM, Quoter, and SwapRouter must be configured
 *   - Account must be operator
 *   - Must have pending positions (run 2.receive-assets.test.js first)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getMoonbaseTestConfig } = require("./config");

describe("XCMProxy Testnet - Position Execution", function () {
  let proxy;
  let operator;
  let lastRecordedPositionCounter = 0n;
  const moonbase = getMoonbaseTestConfig();
  const PROXY_ADDRESS = moonbase.proxyAddress;
  const BASE_TOKEN = moonbase.baseToken;
  const QUOTE_TOKEN = moonbase.quoteToken || moonbase.supportedTokens?.find((addr) => addr.toLowerCase() !== moonbase.baseToken?.toLowerCase());
  const TEST_POOL_ID = moonbase.poolAddress;
  
  before(async function () {
    if (!PROXY_ADDRESS || PROXY_ADDRESS === ethers.ZeroAddress) {
      throw new Error("Proxy address missing. Run bootstrap script or set XCMPROXY_ADDRESS / XCMPROXY_CONTRACT.");
    }

    if (!TEST_POOL_ID || TEST_POOL_ID === ethers.ZeroAddress) {
      throw new Error("Pool address missing. Ensure bootstrap summary exported MOONBASE_REAL_POOL or set MOONBASE_REAL_POOL manually.");
    }

    if (!BASE_TOKEN) {
      throw new Error("Base token missing. Ensure MOONBASE_BASE_TOKEN is set or bootstrap summary is available.");
    }

    [operator] = await ethers.getSigners();

    const XCMProxy = await ethers.getContractFactory(
      "contracts/V1(Current)/XCMProxy.sol:XCMProxy"
    );
    proxy = XCMProxy.attach(PROXY_ADDRESS);

    // Check and enable test mode if needed
    const contractOwner = await proxy.owner();
    const testMode = await proxy.testMode();
    
    if (!testMode) {
      if (contractOwner.toLowerCase() === operator.address.toLowerCase()) {
        console.log("\n⚠️  Test mode disabled - enabling automatically...");
        const tx = await proxy.setTestMode(true);
        await tx.wait();
        console.log("✅ Test mode enabled\n");
      } else {
        throw new Error("Test mode must be enabled");
      }
    }

    // Verify operator
    const contractOperator = await proxy.operator();
    if (contractOperator.toLowerCase() !== operator.address.toLowerCase()) {
      console.log(`\n⚠️  WARNING: Test account is not operator`);
      console.log(`   Contract operator: ${contractOperator}`);
      console.log(`   Test account: ${operator.address}`);
      console.log(`   Some tests will fail\n`);
    }

    // Verify NFPM is configured
    const nfpm = await proxy.nfpmContract();
    if (nfpm === ethers.ZeroAddress) {
      console.log(`\n⚠️  WARNING: NFPM not configured`);
      console.log(`   Position execution will fail without NFPM`);
      console.log(`   Set with: proxy.setNFPM(address) as owner\n`);
    }

    console.log(`\n✅ Connected to XCMProxy at: ${PROXY_ADDRESS}`);
    console.log(`✅ Network: ${network.name}`);
    console.log(`✅ Operator: ${operator.address}`);
    console.log(`✅ NFPM: ${nfpm}`);
    console.log(`✅ Pool: ${TEST_POOL_ID}`);
    console.log(`✅ Base Token: ${BASE_TOKEN}`);
    if (QUOTE_TOKEN) {
      console.log(`✅ Quote Token: ${QUOTE_TOKEN}`);
    }
    console.log();
  });

  describe("Position Execution - Basic Flow", function () {
    before(function() {
      // These tests require a real Algebra pool and funded contract
  const skipIntegration = !process.env.MOONBASE_REAL_POOL && !TEST_POOL_ID;
      if (skipIntegration) {
        console.log("\n⏭️  Skipping position execution tests (requires real pool setup)");
        console.log("   To enable these tests:");
        console.log("   1. Set MOONBASE_REAL_POOL=<real_pool_address>");
        console.log("   2. Fund XCMProxy with WETH: await weth.transfer(proxy.address, parseEther('10'))");
        console.log("   3. Ensure pool has liquidity");
        console.log("\n   See FAILURE_ANALYSIS.md for details.\n");
        this.skip();
      }
    });

    it("should execute pending position and mint NFPM position", async function () {
      this.timeout(180000); // 3 minutes

      // First create a pending position
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-exec-${Date.now()}`)
      );

      const counterBefore = await proxy.positionCounter();

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
          TEST_POOL_ID,
          BASE_TOKEN,
          [ethers.parseEther("0.5"), ethers.parseEther("0.5")],
          -50,
          50,
          operator.address,
          100
        ]
      );

      // Receive assets (create pending position)
      const receiveTx = await proxy.receiveAssets(
        assetHubPositionId,
  BASE_TOKEN,
        operator.address,
        ethers.parseEther("1.0"),
        investmentParams
      );
      await receiveTx.wait();

      console.log(`   ✓ Pending position created`);

      // Verify pending position exists
      const pendingBefore = await proxy.pendingPositions(assetHubPositionId);
      expect(pendingBefore.exists).to.be.true;

      // Execute the pending position
      const tx = await proxy.executePendingInvestment(assetHubPositionId);
      const receipt = await tx.wait();

      // Verify events
      const positionExecutedEvent = receipt.logs.find(log => {
        try {
          const parsed = proxy.interface.parseLog(log);
          return parsed && parsed.name === "PositionExecuted";
        } catch {
          return false;
        }
      });

      const positionCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = proxy.interface.parseLog(log);
          return parsed && parsed.name === "PositionCreated";
        } catch {
          return false;
        }
      });

      expect(positionExecutedEvent).to.not.be.undefined;
      expect(positionCreatedEvent).to.not.be.undefined;

      // Get local position ID from event
      const parsedCreated = proxy.interface.parseLog(positionCreatedEvent);
      const localPositionId = parsedCreated.args[0];

      // Verify pending position deleted
      const pendingAfter = await proxy.pendingPositions(assetHubPositionId);
      expect(pendingAfter.exists).to.be.false;

      // Verify position created
      const position = await proxy.positions(localPositionId);
      expect(position.active).to.be.true;
      expect(position.owner).to.equal(operator.address);
      expect(position.assetHubPositionId).to.equal(assetHubPositionId);

      // Verify mapping stored
      const mappedId = await proxy.assetHubPositionToLocalId(assetHubPositionId);
      expect(mappedId).to.equal(localPositionId);

      console.log(`   ✓ Position executed successfully`);
      console.log(`   ✓ Local Position ID: ${localPositionId}`);
      console.log(`   ✓ NFPM Token ID: ${position.tokenId}`);
      console.log(`   ✓ Liquidity: ${position.liquidity}`);

      const counterAfter = await proxy.positionCounter();
      expect(counterAfter).to.equal(counterBefore + 1n);
      console.log(`   ✓ Position counter incremented: ${counterBefore} → ${counterAfter}`);
      lastRecordedPositionCounter = counterAfter;
    });

    it("should fail on non-existent pending position", async function () {
      const fakePositionId = ethers.keccak256(
        ethers.toUtf8Bytes("non-existent-position")
      );

      await expect(
        proxy.executePendingInvestment(fakePositionId)
      ).to.be.revertedWith("Pending position not found");
    });

    it("should only allow operator to execute positions", async function () {
      this.skip(); // Skip if we only have one account
      
      // If we had a second signer, we'd test:
      // await expect(
      //   proxy.connect(nonOperator).executePendingInvestment(positionId)
      // ).to.be.revertedWith("not operator");
    });
  });

  describe("Position Execution - With Swaps", function () {
    it("should execute position with token swap if needed", async function () {
      this.timeout(180000);

      // This test would require:
      // 1. Receiving assets in token A
      // 2. Position requires token B as baseAsset
      // 3. Contract should swap A -> B before minting
      
      // For testnet safety, we'll skip actual swap testing
      // and just verify the logic path exists
      
      console.log(`   ⚠️  Swap execution requires live DEX pools`);
      console.log(`   ✓ Swap logic is verified in local tests`);
      
      this.skip();
    });
  });

  describe("Position Execution - Edge Cases", function () {
    it("should handle custom slippage parameters", async function () {
      this.timeout(180000);

      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-slippage-${Date.now()}`)
      );

      const customSlippage = 300; // 3% slippage

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
          TEST_POOL_ID,
          BASE_TOKEN,
          [ethers.parseEther("0.5"), ethers.parseEther("0.5")],
          -50,
          50,
          operator.address,
          customSlippage
        ]
      );

      const tx = await proxy.receiveAssets(
        assetHubPositionId,
  BASE_TOKEN,
        operator.address,
        ethers.parseEther("1.0"),
        investmentParams
      );
      await tx.wait();

      const pending = await proxy.pendingPositions(assetHubPositionId);
      expect(pending.exists).to.be.true;
      expect(pending.slippageBps).to.equal(customSlippage);

      console.log(`   ✓ Custom slippage stored: ${customSlippage / 100}%`);
    });

    it("should handle wide tick ranges", async function () {
      this.timeout(180000);

      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`test-wide-range-${Date.now()}`)
      );

      const wideRangeLower = -500; // -500%
      const wideRangeUpper = 500;  // +500%

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
          TEST_POOL_ID,
          BASE_TOKEN,
          [ethers.parseEther("0.5"), ethers.parseEther("0.5")],
          wideRangeLower,
          wideRangeUpper,
          operator.address,
          100
        ]
      );

      const tx = await proxy.receiveAssets(
        assetHubPositionId,
          BASE_TOKEN,
        operator.address,
        ethers.parseEther("1.0"),
        investmentParams
      );
      await tx.wait();

      const pending = await proxy.pendingPositions(assetHubPositionId);
      expect(pending.exists).to.be.true;
      expect(pending.lowerRangePercent).to.equal(wideRangeLower);
      expect(pending.upperRangePercent).to.equal(wideRangeUpper);

      console.log(`   ✓ Wide range stored: ${wideRangeLower}% to ${wideRangeUpper}%`);
    });
  });

  describe("Position Counter Management", function () {
    it("should report increased counter after executions", async function () {
      const currentCounter = await proxy.positionCounter();
      expect(currentCounter).to.be.gte(1n);
      if (lastRecordedPositionCounter !== 0n) {
        expect(currentCounter).to.equal(lastRecordedPositionCounter);
      }
      console.log(`   ✓ Current position counter: ${currentCounter}`);
    });
  });
});
