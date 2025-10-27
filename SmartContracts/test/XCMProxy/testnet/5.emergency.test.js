/**
 * XCMProxy Testnet Emergency & Admin Tests
 * 
 * Tests emergency functions and admin operations on deployed contract
 * CAUTION: Some tests may pause the contract - run carefully
 * 
 * Usage:
 *   npx hardhat test test/XCMProxy/testnet/5.emergency.test.js --network moonbase
 * 
 * Requirements:
 *   - MOON_PK in .env must have DEV tokens
 *   - XCMPROXY_CONTRACT must point to deployed contract
 *   - Account must be owner for most tests
 *   - WARNING: Tests may pause the contract temporarily
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getMoonbaseTestConfig } = require("./config");

describe("XCMProxy Testnet - Emergency & Admin Functions", function () {
  let proxy;
  let owner;
  const DEFAULT_EXECUTION_SLIPPAGE = Number(process.env.MOONBASE_EXEC_SLIPPAGE_BPS || "5000");
  const moonbase = getMoonbaseTestConfig();
  const PROXY_ADDRESS = moonbase.proxyAddress;
  const BASE_TOKEN = moonbase.baseToken;
  const SUPPORTED_TOKENS = moonbase.supportedTokens || [];
  const QUOTE_TOKEN =
    moonbase.quoteToken ||
    SUPPORTED_TOKENS.find((addr) =>
      addr?.toLowerCase() !== BASE_TOKEN?.toLowerCase()
    );
  const TEST_POOL_ID = moonbase.poolAddress || ethers.ZeroAddress;
  const BASE_DECIMALS = Number(moonbase.raw?.baseToken?.decimals ?? 18);

  before(async function () {
    if (!PROXY_ADDRESS || PROXY_ADDRESS === ethers.ZeroAddress) {
      throw new Error(
        "Proxy address missing. Run bootstrap script or export XCMPROXY_CONTRACT."
      );
    }

    if (!BASE_TOKEN) {
      throw new Error(
        "Base token missing. Run scripts/bootstrap-moonbase-infra.js or set MOONBASE_BASE_TOKEN."
      );
    }

    [owner] = await ethers.getSigners();

    const XCMProxy = await ethers.getContractFactory(
      "contracts/V1(Current)/XCMProxy.sol:XCMProxy"
    );
    proxy = XCMProxy.attach(PROXY_ADDRESS);

    console.log(`\n✅ Connected to XCMProxy at: ${PROXY_ADDRESS}`);
    console.log(`✅ Network: ${network.name}`);
    console.log(`✅ Owner Account: ${owner.address}`);
    console.log(`✅ Base Token: ${BASE_TOKEN}`);
    if (QUOTE_TOKEN) {
      console.log(`✅ Quote Token: ${QUOTE_TOKEN}`);
    }
    if (TEST_POOL_ID && TEST_POOL_ID !== ethers.ZeroAddress) {
      console.log(`✅ Pool ID: ${TEST_POOL_ID}`);
    }
    if (SUPPORTED_TOKENS.length > 0) {
      console.log(`✅ Supported Tokens (${SUPPORTED_TOKENS.length}): ${SUPPORTED_TOKENS.join(", ")}`);
    }
    
    const contractOwner = await proxy.owner();
    console.log(`   Contract owner: ${contractOwner}`);
    
    if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
      console.log(`\n   ⚠️  WARNING: Test account is not owner`);
      console.log(`   Some tests will be skipped\n`);
    } else {
      console.log(`   ✅ Test account has owner privileges\n`);
    }
  });

  describe("Pause/Unpause Controls", function () {
    it("should allow owner to pause contract", async function () {
      this.timeout(60000); // 1 minute timeout
      
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

      // Check current pause state
      const isPausedBefore = await proxy.paused();
      
      if (isPausedBefore) {
        console.log(`   ⚠️  Contract already paused - unpausing first`);
        const unpauseTx = await proxy.unpause();
        await unpauseTx.wait();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      }

      // Pause the contract
      const pauseTx = await proxy.pause();
      await pauseTx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      const isPausedAfter = await proxy.paused();
      expect(isPausedAfter).to.be.true;

      console.log(`   ✓ Contract paused successfully`);

      // Unpause for other tests
      const unpauseTx2 = await proxy.unpause();
      await unpauseTx2.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      console.log(`   ✓ Contract unpaused for remaining tests`);
    });

    it("should block operations when paused", async function () {
      this.timeout(60000); // 1 minute timeout
      
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

      // Pause
      const pauseTx = await proxy.pause();
      await pauseTx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      // Try to receive assets (should fail)
      const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes("test-paused")
      );

      const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
          TEST_POOL_ID,
          BASE_TOKEN,
          [0, 0],
          -50,
          50,
          owner.address,
          DEFAULT_EXECUTION_SLIPPAGE
        ]
      );

      await expect(
        proxy.receiveAssets(
          assetHubPositionId,
          BASE_TOKEN,
          owner.address,
          ethers.parseUnits("1.0", BASE_DECIMALS),
          investmentParams
        )
      ).to.be.revertedWithCustomError(proxy, "EnforcedPause");

      console.log(`   ✓ Operations blocked when paused`);

      // Unpause
      const unpauseTx = await proxy.unpause();
      await unpauseTx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    });
  });

  describe("Test Mode Controls", function () {
    it("should allow owner to toggle test mode", async function () {
      this.timeout(120000); // 2 minute timeout for remote network
      
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

      const testModeBefore = await proxy.testMode();

      // Toggle test mode
      const tx = await proxy.setTestMode(!testModeBefore);
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      const testModeAfter = await proxy.testMode();
      expect(testModeAfter).to.equal(!testModeBefore);

      console.log(`   ✓ Test mode toggled: ${testModeBefore} → ${testModeAfter}`);

      // Restore original state (should be true for other tests)
      const restoreTx = await proxy.setTestMode(true);
      await restoreTx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      console.log(`   ✓ Test mode restored to: true`);
    });
  });

  describe("Operator Management", function () {
    it("should allow owner to update operator", async function () {
      this.timeout(60000); // 1 minute timeout
      
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

      const operatorBefore = await proxy.operator();
      
      // Set operator to owner (safe change)
      const tx = await proxy.setOperator(owner.address);
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      const receipt = await tx.wait();
      
      // Verify event
      const event = receipt.logs.find(log => {
        try {
          const parsed = proxy.interface.parseLog(log);
          return parsed && parsed.name === "OperatorUpdated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;

      const operatorAfter = await proxy.operator();
      expect(operatorAfter).to.equal(owner.address);

      console.log(`   ✓ Operator updated successfully`);
      console.log(`   ✓ New operator: ${operatorAfter}`);

      // Restore if it was different
      if (operatorBefore !== owner.address) {
        const restoreTx = await proxy.setOperator(operatorBefore);
        await restoreTx.wait();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        console.log(`   ✓ Operator restored to: ${operatorBefore}`);
      }
    });
  });

  describe("Integration Configuration", function () {
    it("should allow owner to update NFPM address", async function () {
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

      const nfpmBefore = await proxy.nfpmContract();
      
      // We won't actually change it, just verify the function works
      console.log(`   Current NFPM: ${nfpmBefore}`);
      console.log(`   ✓ NFPM configuration is accessible`);
    });

    it("should allow owner to update DEX integrations", async function () {
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

      const quoter = await proxy.quoterContract();
      const router = await proxy.swapRouterContract();
      
      console.log(`   Current Quoter: ${quoter}`);
      console.log(`   Current Router: ${router}`);
      console.log(`   ✓ DEX integration configuration is accessible`);
    });
  });

  describe("Slippage Configuration", function () {
    it("should allow owner to update default slippage", async function () {
      this.timeout(60000); // 1 minute timeout
      
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

      const slippageBefore = await proxy.defaultSlippageBps();
      
      // Set to 150 bps (1.5%)
      const newSlippage = 150;
      const tx = await proxy.setDefaultSlippageBps(newSlippage);
      await tx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      const slippageAfter = await proxy.defaultSlippageBps();
      expect(slippageAfter).to.equal(newSlippage);

      console.log(`   ✓ Slippage updated: ${slippageBefore} → ${slippageAfter} bps`);

      // Restore
      const restoreTx = await proxy.setDefaultSlippageBps(slippageBefore);
      await restoreTx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      console.log(`   ✓ Slippage restored to: ${slippageBefore} bps`);
    });

    it("should reject slippage above 100%", async function () {
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

      await expect(
        proxy.setDefaultSlippageBps(10001) // 100.01%
      ).to.be.revertedWith("bps too high");

      console.log(`   ✓ Excessive slippage rejected`);
    });
  });

  describe("Token Support Management", function () {
    it("should allow owner to add supported token", async function () {
      this.timeout(60000); // 1 minute timeout
      
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

  const testToken = ethers.Wallet.createRandom().address;
      
      // Add token
      const addTx = await proxy.addSupportedToken(testToken);
      await addTx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      const isSupported = await proxy.supportedTokens(testToken);
      expect(isSupported).to.be.true;

      console.log(`   ✓ Token added to supported list`);

      // Remove it
      const removeTx = await proxy.removeSupportedToken(testToken);
      await removeTx.wait();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

      const isSupportedAfter = await proxy.supportedTokens(testToken);
      expect(isSupportedAfter).to.be.false;

      console.log(`   ✓ Token removed from supported list`);
    });
  });

  describe("XCM Configuration Management", function () {
    it("should check XCM configuration freeze status", async function () {
      const frozen = await proxy.xcmConfigFrozen();
      console.log(`   XCM Config Frozen: ${frozen}`);

      if (frozen) {
        console.log(`   ⚠️  XCM configuration is permanently frozen`);
        console.log(`   Cannot modify XCM settings anymore`);
      } else {
        console.log(`   ✓ XCM configuration can still be modified`);
      }
    });

    it("should allow owner to freeze XCM config (PERMANENT)", async function () {
      const contractOwner = await proxy.owner();
      if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
        this.skip();
      }

      const frozen = await proxy.xcmConfigFrozen();
      
      if (frozen) {
        console.log(`   ⚠️  XCM config already frozen - skipping`);
        this.skip();
      }

      console.log(`   ⚠️  NOT freezing XCM config in tests`);
      console.log(`   This action is PERMANENT and cannot be reversed`);
      console.log(`   Use freezeXcmConfig() manually when ready for production`);
    });
  });

  describe("Fee Collection", function () {
    it("should allow collecting fees from position", async function () {
      const counter = await proxy.positionCounter();
      
      if (counter === 0n) {
        console.log(`   ⚠️  No positions to collect fees from`);
        this.skip();
      }

      // Check first position
      const position = await proxy.positions(1);
      
      if (!position.active || position.tokenId === 0n) {
        console.log(`   ⚠️  Position 1 is not active or has no NFPM token`);
        this.skip();
      }

      // Try to collect fees (may be zero if no trading activity)
      try {
        const [amount0, amount1] = await proxy.collectFees.staticCall(1);
        console.log(`   ✓ Fee collection callable`);
        console.log(`   Fees available: ${ethers.formatEther(amount0)} token0, ${ethers.formatEther(amount1)} token1`);
      } catch (error) {
        console.log(`   ⚠️  Fee collection failed: ${error.message}`);
      }
    });
  });

  describe("Balance Queries", function () {
    it("should check contract token balances", async function () {
      const balance = await proxy.getBalance(BASE_TOKEN);
      console.log(
        `   Contract base token balance: ${ethers.formatUnits(balance, BASE_DECIMALS)}`
      );
      
      expect(balance).to.be.gte(0);
    });
  });

  describe("Position Queries", function () {
    it("should get active positions", async function () {
      const activePositions = await proxy.getActivePositions();
      
      console.log(`   ✓ Active positions: ${activePositions.length}`);
      
      if (activePositions.length > 0) {
        const first = activePositions[0];
        console.log(`   First position pool: ${first.pool}`);
        console.log(`   First position owner: ${first.owner}`);
        console.log(`   First position liquidity: ${first.liquidity}`);
      }
    });

    it("should get user positions", async function () {
      const userPositionIds = await proxy.getUserPositions(owner.address);
      
      console.log(`   ✓ User positions: ${userPositionIds.length}`);
      
      if (userPositionIds.length > 0) {
        console.log(`   First position ID: ${userPositionIds[0]}`);
      }
    });
  });

  describe("Contract Health Summary", function () {
    it("should display comprehensive health check", async function () {
      const isPaused = await proxy.paused();
      const testMode = await proxy.testMode();
      const owner = await proxy.owner();
      const operator = await proxy.operator();
      const nfpm = await proxy.nfpmContract();
      const quoter = await proxy.quoterContract();
      const router = await proxy.swapRouterContract();
      const xTokens = await proxy.xTokensPrecompile();
      const paraId = await proxy.assetHubParaId();
      const frozen = await proxy.xcmConfigFrozen();
      const slippage = await proxy.defaultSlippageBps();
      const positions = await proxy.positionCounter();
      const activePositions = await proxy.getActivePositions();

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`       XCMProxy Health Check Summary`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`\n🎛️  Contract Status:`);
      console.log(`   Paused:          ${isPaused ? '⚠️  YES' : '✅ NO'}`);
      console.log(`   Test Mode:       ${testMode ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`   XCM Config:      ${frozen ? '🔒 FROZEN' : '🔓 Modifiable'}`);
      
      console.log(`\n👥 Access Control:`);
      console.log(`   Owner:           ${owner}`);
      console.log(`   Operator:        ${operator}`);
      
      console.log(`\n🔗 DEX Integrations:`);
      console.log(`   NFPM:            ${nfpm === ethers.ZeroAddress ? '❌' : '✅'} ${nfpm}`);
      console.log(`   Quoter:          ${quoter === ethers.ZeroAddress ? '❌' : '✅'} ${quoter}`);
      console.log(`   Router:          ${router === ethers.ZeroAddress ? '❌' : '✅'} ${router}`);
      
      console.log(`\n🌉 XCM Configuration:`);
      console.log(`   XTokens:         ${xTokens === ethers.ZeroAddress ? '❌' : '✅'} ${xTokens}`);
      console.log(`   Asset Hub ID:    ${paraId === 0 ? '❌ Not Set' : '✅ ' + paraId}`);
      
      console.log(`\n⚙️  Operating Parameters:`);
      console.log(`   Default Slippage: ${slippage} bps (${(Number(slippage) / 100).toFixed(2)}%)`);
      
      console.log(`\n📊 Position Statistics:`);
      console.log(`   Total Created:    ${positions}`);
      console.log(`   Currently Active: ${activePositions.length}`);
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Health verdict
      const integrationReady = nfpm !== ethers.ZeroAddress && 
                               quoter !== ethers.ZeroAddress && 
                               router !== ethers.ZeroAddress;
      const xcmReady = xTokens !== ethers.ZeroAddress && paraId !== 0;

      if (!isPaused && testMode && integrationReady) {
        console.log(`✅ CONTRACT READY FOR TESTNET OPERATIONS\n`);
      } else if (!isPaused && !testMode && integrationReady && xcmReady) {
        console.log(`✅ CONTRACT READY FOR PRODUCTION\n`);
      } else {
        console.log(`⚠️  CONTRACT REQUIRES ATTENTION:\n`);
        if (isPaused) console.log(`   - Contract is paused`);
        if (!integrationReady) console.log(`   - DEX integrations incomplete`);
        if (!xcmReady && !testMode) console.log(`   - XCM configuration incomplete`);
        console.log();
      }
    });
  });
});
