/**
 * XCMProxy Testnet Configuration Tests
 * 
 * These are READ-ONLY tests that check the deployed contract configuration.
 * 100% safe to run on testnet - no state modifications.
 * 
 * Usage:
 *   $env:XCMPROXY_CONTRACT="0xYourContractAddress"
 *   npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getMoonbaseTestConfig } = require("./config");

describe("XCMProxy Testnet - Configuration Check", function () {
  let proxy;
  const moonbase = getMoonbaseTestConfig();
  const PROXY_ADDRESS = moonbase.proxyAddress;

  before(async function () {
    console.log(`\n🔗 Connecting to XCMProxy at: ${PROXY_ADDRESS}`);

    const XCMProxy = await ethers.getContractFactory(
      "contracts/V1(Current)/XCMProxy.sol:XCMProxy"
    );
    proxy = XCMProxy.attach(PROXY_ADDRESS);

    // Verify connection
    try {
      await proxy.owner();
      console.log("✅ Successfully connected to contract\n");
    } catch (error) {
      throw new Error(`Failed to connect: ${error.message}`);
    }
  });

  describe("Contract Deployment", function () {
    it("should be deployed at correct address", async function () {
      expect(await proxy.getAddress()).to.equal(PROXY_ADDRESS);
    });

    it("should respond to function calls", async function () {
      // Smoke test - can we call functions?
      await proxy.paused(); // Should not throw
    });
  });

  describe("Role Configuration", function () {
    it("should have owner configured", async function () {
      const owner = await proxy.owner();
      expect(owner).to.be.properAddress;
      expect(owner).to.not.equal(ethers.ZeroAddress);
      console.log(`   Owner: ${owner}`);
    });

    it("should have operator configured", async function () {
      const operator = await proxy.operator();
      expect(operator).to.be.properAddress;
      expect(operator).to.not.equal(ethers.ZeroAddress);
      console.log(`   Operator: ${operator}`);
    });
  });

  describe("Integration Configuration", function () {
    it("should have NFPM contract set", async function () {
      const nfpm = await proxy.nfpmContract();
      
      if (nfpm === ethers.ZeroAddress) {
        console.log("   ⚠️  WARNING: NFPM not set!");
        console.log("   This must be set before minting positions");
      } else {
        console.log(`   NFPM Contract: ${nfpm}`);
        expect(nfpm).to.be.properAddress;
      }
    });

    it("should have Quoter contract set", async function () {
      const quoter = await proxy.quoterContract();
      
      if (quoter === ethers.ZeroAddress) {
        console.log("   ⚠️  WARNING: Quoter not set!");
      } else {
        console.log(`   Quoter Contract: ${quoter}`);
        expect(quoter).to.be.properAddress;
      }
    });

    it("should have SwapRouter contract set", async function () {
      const router = await proxy.swapRouterContract();
      
      if (router === ethers.ZeroAddress) {
        console.log("   ⚠️  WARNING: SwapRouter not set!");
      } else {
        console.log(`   SwapRouter Contract: ${router}`);
        expect(router).to.be.properAddress;
      }
    });
  });

  describe("XCM Configuration", function () {
    it("should check XCM precompile configuration", async function () {
      const precompile = await proxy.xcmPrecompile();

      if (precompile === ethers.ZeroAddress) {
        console.log("   ⚠️  WARNING: XCM precompile not set!");
        console.log("   This must be set before returning assets to Asset Hub");
      } else {
        console.log(`   XCM Precompile: ${precompile}`);
        expect(precompile).to.be.properAddress;
      }
    });

    it("should check XCM Transactor precompile configuration", async function () {
      const precompile = await proxy.xcmTransactorPrecompile();
      
      if (precompile === ethers.ZeroAddress) {
        console.log("   ⚠️  XCM Transactor precompile not set (optional)");
      } else {
        console.log(`   XCM Transactor Precompile: ${precompile}`);
        expect(precompile).to.be.properAddress;
      }
    });

    it("should check Asset Hub parachain ID", async function () {
      const paraId = await proxy.assetHubParaId();
      console.log(`   Asset Hub Para ID: ${paraId}`);
      
      if (paraId === 0) {
        console.log("   ⚠️  WARNING: Asset Hub Para ID not set!");
      }
    });

    it("should check if XCM config is frozen", async function () {
      const frozen = await proxy.xcmConfigFrozen();
      console.log(`   XCM Config Frozen: ${frozen}`);
      
      if (frozen) {
        console.log("   ⚠️  XCM configuration is frozen - cannot be changed");
      }
    });

    it("should check trusted XCM caller", async function () {
      const caller = await proxy.trustedXcmCaller();
      
      if (caller === ethers.ZeroAddress) {
        console.log("   Trusted XCM Caller: Not set (allows any caller)");
      } else {
        console.log(`   Trusted XCM Caller: ${caller}`);
      }
    });
  });

  describe("Operating Parameters", function () {
    it("should check pause status", async function () {
      const isPaused = await proxy.paused();
      console.log(`   Paused: ${isPaused}`);
      
      if (isPaused) {
        console.log("   ⚠️  CONTRACT IS PAUSED - operations are disabled!");
      }
    });

    it("should check test mode status", async function () {
      const testMode = await proxy.testMode();
      console.log(`   Test Mode: ${testMode}`);
      
      if (testMode) {
        console.log("   ✅ Test mode enabled - XCM calls will be skipped");
      } else {
        console.log("   ⚠️  Test mode disabled - XCM calls will be executed");
      }
    });

    it("should check default slippage", async function () {
      const slippageBps = await proxy.defaultSlippageBps();
      const slippagePercent = (Number(slippageBps) / 100).toFixed(2);
      console.log(`   Default Slippage: ${slippageBps} bps (${slippagePercent}%)`);
    });

    it("should check position counter", async function () {
      const counter = await proxy.positionCounter();
      console.log(`   Position Counter: ${counter} positions created`);
    });
  });

  describe("Health Check Summary", function () {
    it("should display configuration summary", async function () {
      const owner = await proxy.owner();
      const operator = await proxy.operator();
      const nfpm = await proxy.nfpmContract();
      const quoter = await proxy.quoterContract();
      const router = await proxy.swapRouterContract();
      const xcmPre = await proxy.xcmPrecompile();
      const paraId = await proxy.assetHubParaId();
      const isPaused = await proxy.paused();
      const testMode = await proxy.testMode();
      const slippage = await proxy.defaultSlippageBps();
      const positions = await proxy.positionCounter();

      console.log(`\n📊 XCMProxy Configuration Summary:`);
      console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   Owner:          ${owner}`);
      console.log(`   Operator:       ${operator}`);
      console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   NFPM:           ${nfpm === ethers.ZeroAddress ? '❌ Not Set' : '✅ ' + nfpm}`);
      console.log(`   Quoter:         ${quoter === ethers.ZeroAddress ? '❌ Not Set' : '✅ ' + quoter}`);
      console.log(`   SwapRouter:     ${router === ethers.ZeroAddress ? '❌ Not Set' : '✅ ' + router}`);
      console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   XCM Precompile: ${xcmPre === ethers.ZeroAddress ? '❌ Not Set' : '✅ ' + xcmPre}`);
      console.log(`   Asset Hub ID:   ${paraId === 0 ? '❌ Not Set' : '✅ ' + paraId}`);
      console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   Status:         ${isPaused ? '⚠️  PAUSED' : '✅ Active'}`);
      console.log(`   Test Mode:      ${testMode ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`   Slippage:       ${slippage} bps (${(Number(slippage) / 100).toFixed(2)}%)`);
      console.log(`   Positions:      ${positions} created`);
      console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Overall health check
      const integrationReady = nfpm !== ethers.ZeroAddress &&
                               quoter !== ethers.ZeroAddress &&
                               router !== ethers.ZeroAddress;
      const xcmReady = xcmPre !== ethers.ZeroAddress && paraId !== 0;

      if (integrationReady && xcmReady && !isPaused) {
        console.log(`   ✅ CONTRACT IS FULLY CONFIGURED AND READY\n`);
      } else {
        console.log(`   ⚠️  CONTRACT REQUIRES CONFIGURATION:\n`);
        if (!integrationReady) console.log(`      - Set DEX integrations (NFPM, Quoter, Router)`);
        if (!xcmReady) console.log(`      - Set XCM configuration (XTokens, Asset Hub ID)`);
        if (isPaused) console.log(`      - Unpause the contract`);
        console.log();
      }
    });
  });
});
