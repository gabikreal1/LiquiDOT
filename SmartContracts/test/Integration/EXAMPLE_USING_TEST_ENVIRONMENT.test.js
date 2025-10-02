/**
 * Example Test Using Test Environment Setup
 * 
 * This demonstrates how to use the test environment setup module
 * for integration tests that need the complete LiquiDOT stack.
 * 
 * Use this approach when you need:
 * - Algebra DEX contracts (factory, router, quoter, NFPM)
 * - Deployed tokens with liquidity
 * - XCMProxy configured and ready
 * - AssetHubVault connected
 * 
 * For unit tests that only test a single contract, deploy fresh
 * in each test (see AssetHubVault.deployment.test.js for example)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupTestEnvironment } = require("./setup/test-environment");

describe("Example: Using Test Environment", function () {
  let env;
  
  // Setup timeout - environment setup can take a while
  this.timeout(60000); // 60 seconds

  /**
   * Set up the complete test environment once before all tests
   * 
   * This includes:
   * - Algebra Protocol deployment
   * - Test tokens deployment
   * - Pool creation and initialization
   * - XCMProxy deployment and configuration
   * - AssetHubVault connection (uses ASSETHUB_CONTRACT env var)
   * - Initial liquidity provision
   */
  before(async function () {
    console.log("\n🔧 Setting up test environment...");
    
    // IMPORTANT: Set the AssetHubVault address before running tests
    // Either set ASSETHUB_CONTRACT env var or pass vaultAddress option
    
    env = await setupTestEnvironment({
      tokenCount: 2,              // Deploy 2 test tokens
      liquidityAmount: "1000",    // Add 1000 of each token as liquidity
      skipLiquidity: false,       // Don't skip liquidity addition
      testMode: true,             // Enable test mode (bypasses XCM)
      verbose: true,              // Show detailed logs
      configureVault: false,      // Don't try to configure vault (may not have permission)
    });
    
    console.log("✅ Test environment ready!\n");
  });

  /**
   * Example: Access contracts from environment
   */
  describe("Environment Components", function () {
    it("should have deployed XCMProxy", async function () {
      expect(env.xcmProxy).to.exist;
      expect(await env.xcmProxy.getAddress()).to.be.properAddress;
    });

    it("should have connected to AssetHubVault", async function () {
      expect(env.assetHubVault).to.exist;
      expect(await env.assetHubVault.getAddress()).to.be.properAddress;
    });

    it("should have deployed Algebra contracts", async function () {
      expect(env.algebraFactory).to.exist;
      expect(env.algebraRouter).to.exist;
      expect(env.algebraQuoter).to.exist;
      expect(env.algebraNFPM).to.exist;
    });

    it("should have created a pool with liquidity", async function () {
      expect(env.pool).to.exist;
      const poolAddress = await env.pool.getAddress();
      expect(poolAddress).to.be.properAddress;
      
      // Pool should have liquidity
      const liquidity = await env.pool.liquidity();
      expect(liquidity).to.be.gt(0);
    });

    it("should have test tokens deployed", async function () {
      expect(env.token0).to.exist;
      expect(env.token1).to.exist;
      
      const token0Address = await env.token0.getAddress();
      const token1Address = await env.token1.getAddress();
      
      expect(token0Address).to.be.properAddress;
      expect(token1Address).to.be.properAddress;
    });

    it("should provide test signers", async function () {
      expect(env.deployer).to.exist;
      expect(env.user1).to.exist;
      expect(env.user2).to.exist;
      expect(env.operator).to.exist;
      expect(env.emergency).to.exist;
    });
  });

  /**
   * Example: Using the environment for integration tests
   */
  describe("Integration Test Example", function () {
    it("should allow user to deposit to AssetHubVault", async function () {
      const depositAmount = ethers.parseEther("10");
      
      // User1 deposits to vault
      await env.assetHubVault
        .connect(env.user1)
        .deposit({ value: depositAmount });
      
      // Check balance
      const balance = await env.assetHubVault.getUserBalance(env.user1.address);
      expect(balance).to.equal(depositAmount);
    });

    it("should allow minting test tokens", async function () {
      const mintAmount = ethers.parseEther("100");
      
      // Use helper function from environment
      await env.helpers.mintTokens(env.token0, env.user1.address, mintAmount);
      
      // Check balance
      const balance = await env.token0.balanceOf(env.user1.address);
      expect(balance).to.equal(mintAmount);
    });

    it("should have XCMProxy configured with supported tokens", async function () {
      // Token0 should be supported
      const token0Supported = await env.xcmProxy.supportedTokens(
        await env.token0.getAddress()
      );
      expect(token0Supported).to.be.true;
      
      // Token1 should be supported
      const token1Supported = await env.xcmProxy.supportedTokens(
        await env.token1.getAddress()
      );
      expect(token1Supported).to.be.true;
    });

    it("should have correct operator set on XCMProxy", async function () {
      const operator = await env.xcmProxy.operator();
      expect(operator).to.equal(env.operator.address);
    });
  });

  /**
   * Example: Testing swaps (requires liquidity)
   */
  describe("Swap Example", function () {
    it("should be able to quote a swap", async function () {
      // Skip if quoter not configured
      if (!env.algebraQuoter) {
        this.skip();
      }

      const token0Address = await env.token0.getAddress();
      const token1Address = await env.token1.getAddress();
      const amountIn = ethers.parseEther("1");

      // Get quote from Algebra quoter
      // Note: This is a direct call to quoter, not through XCMProxy
      const quote = await env.algebraQuoter.quoteExactInputSingle.staticCall({
        tokenIn: token0Address,
        tokenOut: token1Address,
        amountIn: amountIn,
        sqrtPriceLimitX96: 0,
      });

      console.log(`    Quote: ${ethers.formatEther(quote.amountOut)} token1 for 1 token0`);
      expect(quote.amountOut).to.be.gt(0);
    });
  });

  /**
   * Example: Accessing addresses
   */
  describe("Address Reference", function () {
    it("should provide all contract addresses", async function () {
      console.log("\n    📋 Contract Addresses:");
      console.log(`    AssetHubVault: ${env.addresses.assetHubVault}`);
      console.log(`    XCMProxy:      ${env.addresses.xcmProxy}`);
      console.log(`    Factory:       ${env.addresses.factory}`);
      console.log(`    Router:        ${env.addresses.router}`);
      console.log(`    Quoter:        ${env.addresses.quoter}`);
      console.log(`    NFPM:          ${env.addresses.nfpm}`);
      console.log(`    Pool:          ${env.addresses.pool}`);
      console.log(`    Token0:        ${env.addresses.token0}`);
      console.log(`    Token1:        ${env.addresses.token1}\n`);
      
      // All addresses should be valid
      for (const [name, address] of Object.entries(env.addresses)) {
        expect(address, `${name} address should be valid`).to.be.properAddress;
      }
    });
  });
});

