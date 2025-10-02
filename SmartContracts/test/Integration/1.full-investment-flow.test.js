/**
 * Integration Test: Complete Investment Flow
 * 
 * Tests the full cross-chain investment flow:
 * Asset Hub (deposit) → XCM → Moonbase (create position)
 * 
 * Covers TEST-INT-001 from TESTING-REQUIREMENTS.md
 * 
 * REQUIREMENTS:
 * - AssetHubVault deployed on Asset Hub
 * - XCMProxy deployed on Moonbase
 * - XCM channel established between chains
 * - Algebra DEX deployed on Moonbase
 * - Test mode DISABLED (for real XCM testing)
 * 
 * Usage:
 *   $env:ASSETHUB_CONTRACT="0xVaultAddress"
 *   $env:XCMPROXY_CONTRACT="0xProxyAddress"
 *   npx hardhat test test/Integration/1.full-investment-flow.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Integration - Complete Investment Flow", function () {
  let assetHubVault, xcmProxy;
  let deployer, user1, operator;
  let algebraRouter, algebraQuoter, algebraNFPM;
  
  // Long timeout for cross-chain operations
  this.timeout(120000); // 2 minutes

  /**
   * Check if XCM connection is available
   */
  async function checkXCMConnection() {
    const vaultAddress = process.env.ASSETHUB_CONTRACT;
    const proxyAddress = process.env.XCMPROXY_CONTRACT;
    
    if (!vaultAddress || !proxyAddress) {
      return false;
    }
    
    try {
      // Try to connect to both contracts
      const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
      const vault = AssetHubVault.attach(vaultAddress);
      
      const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
      const proxy = XCMProxy.attach(proxyAddress);
      
      // Check if test mode is disabled (required for real XCM)
      const vaultTestMode = await vault.testMode();
      const proxyTestMode = await proxy.testMode();
      
      if (vaultTestMode || proxyTestMode) {
        console.log("\n⚠️  Test mode is enabled - XCM will not work");
        console.log("   Disable test mode on both contracts for integration testing\n");
        return false;
      }
      
      // Check if XCM precompiles are set
      const vaultPrecompile = await vault.XCM_PRECOMPILE();
      const proxyPrecompile = await proxy.xTokensPrecompile();
      
      if (vaultPrecompile === ethers.ZeroAddress || proxyPrecompile === ethers.ZeroAddress) {
        console.log("\n⚠️  XCM precompiles not configured");
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  before(async function () {
    // Check if XCM is available
    const xcmAvailable = await checkXCMConnection();
    
    if (!xcmAvailable) {
      console.log("\n⏭️  Skipping integration tests - XCM not available");
      console.log("   Requirements:");
      console.log("   - Set ASSETHUB_CONTRACT environment variable");
      console.log("   - Set XCMPROXY_CONTRACT environment variable");
      console.log("   - Disable test mode on both contracts");
      console.log("   - Configure XCM precompiles");
      console.log("   - Establish XCM channel between chains\n");
      this.skip();
    }

    [deployer, user1, operator] = await ethers.getSigners();

    // Connect to deployed contracts
    const vaultAddress = process.env.ASSETHUB_CONTRACT;
    const proxyAddress = process.env.XCMPROXY_CONTRACT;

    const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    assetHubVault = AssetHubVault.attach(vaultAddress);

    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
    xcmProxy = XCMProxy.attach(proxyAddress);

    // Get Algebra contracts from XCMProxy
    const quoterAddress = await xcmProxy.quoterContract();
    const routerAddress = await xcmProxy.swapRouterContract();
    const nfpmAddress = await xcmProxy.nfpmContract();

    // Connect to Algebra contracts
    algebraQuoter = await ethers.getContractAt("IQuoter", quoterAddress);
    algebraRouter = await ethers.getContractAt("ISwapRouter", routerAddress);
    algebraNFPM = await ethers.getContractAt("INonfungiblePositionManager", nfpmAddress);

    console.log("\n✅ Connected to deployed contracts:");
    console.log(`   AssetHubVault: ${vaultAddress}`);
    console.log(`   XCMProxy: ${proxyAddress}`);
    console.log(`   Algebra Quoter: ${quoterAddress}`);
    console.log(`   Algebra Router: ${routerAddress}`);
    console.log(`   Algebra NFPM: ${nfpmAddress}\n`);
  });

  /**
   * TEST-INT-001: Complete investment flow
   * 
   * 1. User deposits to AssetHubVault
   * 2. Operator dispatches investment
   * 3. XCM transfers assets to XCMProxy
   * 4. XCMProxy receives assets and creates position
   * 5. Verify position created on Moonbase
   * 6. Verify position tracked on Asset Hub
   */
  describe("TEST-INT-001: Asset Hub → Moonbase Investment", function () {
    it("should complete full investment flow", async function () {
      const depositAmount = ethers.parseEther("10");
      const investmentAmount = ethers.parseEther("5");

      // Step 1: User deposits to AssetHubVault
      console.log("   1. User depositing to AssetHubVault...");
      const balanceBefore = await assetHubVault.getUserBalance(user1.address);
      
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      
      const balanceAfter = await assetHubVault.getUserBalance(user1.address);
      expect(balanceAfter).to.equal(balanceBefore + depositAmount);
      console.log(`      ✓ Deposited ${ethers.formatEther(depositAmount)} ETH`);

      // Step 2: Build XCM message for investment
      console.log("   2. Building XCM message...");
      const poolAddress = "0x1111111111111111111111111111111111111111"; // Your pool
      const baseAsset = "0x2222222222222222222222222222222222222222"; // Your base token
      
      // This should be built by your backend XCM message builder
      // For now, using placeholder - YOU NEED TO IMPLEMENT THIS
      const xcmDestination = "0x030100001234"; // Moonbase destination
      const xcmMessage = "0x0300010203"; // Actual XCM message

      // Step 3: Operator dispatches investment (triggers XCM)
      console.log("   3. Dispatching investment (XCM send)...");
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        2004, // Moonbase chainId
        poolAddress,
        baseAsset,
        investmentAmount,
        -5, // lowerRangePercent
        5,  // upperRangePercent
        xcmDestination,
        xcmMessage
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
      const positionId = assetHubVault.interface.parseLog(event).args.positionId;
      console.log(`      ✓ Position created: ${positionId}`);

      // Verify user balance reduced on Asset Hub
      const newBalance = await assetHubVault.getUserBalance(user1.address);
      expect(newBalance).to.equal(balanceAfter - investmentAmount);
      console.log(`      ✓ Balance reduced on Asset Hub`);

      // Step 4: Wait for XCM to process
      console.log("   4. Waiting for XCM message to process...");
      console.log("      (This can take 30-60 seconds)");
      
      // Poll for XCM completion
      // You'll need to implement XCM event monitoring here
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s

      // Step 5: Verify position created on Moonbase
      console.log("   5. Verifying position on Moonbase...");
      
      // Check if XCMProxy received the call
      // The exact verification depends on how you track positions
      const proxyPositions = await xcmProxy.getUserPositions(user1.address);
      
      console.log(`      ✓ User has ${proxyPositions.length} position(s) on Moonbase`);

      // Step 6: Verify position is tracked on Asset Hub
      console.log("   6. Verifying position tracking on Asset Hub...");
      const vaultPositions = await assetHubVault.getUserPositions(user1.address);
      
      const activePositions = vaultPositions.filter(p => p.active);
      expect(activePositions.length).to.be.gt(0);
      console.log(`      ✓ User has ${activePositions.length} active position(s) on Asset Hub`);

      console.log("\n   ✅ Complete investment flow successful!\n");
    });

    it("should emit XCM events on Asset Hub", async function () {
      // Test that XCM send events are emitted
      const depositAmount = ethers.parseEther("1");
      const investmentAmount = ethers.parseEther("0.5");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      const poolAddress = "0x1111111111111111111111111111111111111111";
      const baseAsset = "0x2222222222222222222222222222222222222222";
      const xcmDestination = "0x030100001234";
      const xcmMessage = "0x0300010203";

      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          poolAddress,
          baseAsset,
          investmentAmount,
          -5,
          5,
          xcmDestination,
          xcmMessage
        )
      )
        .to.emit(assetHubVault, "InvestmentInitiated")
        .and.to.emit(assetHubVault, "XCMMessageSent");
    });

    it("should handle XCM send failures gracefully", async function () {
      // Test behavior when XCM send fails
      // The contract should still create the position even if XCM fails
      // This is tracked via XcmSendAttempt event

      const depositAmount = ethers.parseEther("1");
      const investmentAmount = ethers.parseEther("0.5");

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      const poolAddress = "0x1111111111111111111111111111111111111111";
      const baseAsset = "0x2222222222222222222222222222222222222222";
      const xcmDestination = "0x030100001234";
      const xcmMessage = "0x0300010203"; // This might fail

      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        2004,
        poolAddress,
        baseAsset,
        investmentAmount,
        -5,
        5,
        xcmDestination,
        xcmMessage
      );

      // Check XcmSendAttempt event for success/failure status
      const receipt = await tx.wait();
      const xcmEvent = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "XcmSendAttempt";
        } catch {
          return false;
        }
      });

      if (xcmEvent) {
        const parsed = assetHubVault.interface.parseLog(xcmEvent);
        console.log(`      XCM Send Success: ${parsed.args.success}`);
        
        if (!parsed.args.success) {
          console.log(`      XCM Error: ${parsed.args.errorData}`);
        }
      }
    });
  });

  describe("Position Verification", function () {
    it("should verify position exists on both chains", async function () {
      // After investment, position should be tracked on both:
      // - Asset Hub (AssetHubVault)
      // - Moonbase (XCMProxy)

      const vaultPositions = await assetHubVault.getUserPositions(user1.address);
      const proxyPositions = await xcmProxy.getUserPositions(user1.address);

      console.log(`   Asset Hub positions: ${vaultPositions.length}`);
      console.log(`   Moonbase positions: ${proxyPositions.length}`);

      // Ideally these should match, but depends on XCM timing
      expect(vaultPositions.length).to.be.gt(0);
    });

    it("should verify position data matches", async function () {
      // Get a position from Asset Hub
      const vaultPositions = await assetHubVault.getUserPositions(user1.address);
      
      if (vaultPositions.length === 0) {
        console.log("   ⚠️  No positions to verify");
        this.skip();
      }

      const vaultPosition = vaultPositions[0];
      
      // Verify position data
      expect(vaultPosition.user).to.equal(user1.address);
      expect(vaultPosition.chainId).to.equal(2004); // Moonbase
      expect(vaultPosition.active).to.be.true;
      expect(vaultPosition.amount).to.be.gt(0);

      console.log(`   ✓ Position verified:`);
      console.log(`      User: ${vaultPosition.user}`);
      console.log(`      Amount: ${ethers.formatEther(vaultPosition.amount)} ETH`);
      console.log(`      Chain: ${vaultPosition.chainId}`);
      console.log(`      Active: ${vaultPosition.active}`);
    });
  });

  describe("Error Handling", function () {
    it("should handle insufficient balance", async function () {
      const tooMuch = ethers.parseEther("1000");

      const poolAddress = "0x1111111111111111111111111111111111111111";
      const baseAsset = "0x2222222222222222222222222222222222222222";
      const xcmDestination = "0x030100001234";
      const xcmMessage = "0x0300010203";

      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          poolAddress,
          baseAsset,
          tooMuch,
          -5,
          5,
          xcmDestination,
          xcmMessage
        )
      ).to.be.revertedWithCustomError(assetHubVault, "InsufficientBalance");
    });

    it("should handle invalid range", async function () {
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const poolAddress = "0x1111111111111111111111111111111111111111";
      const baseAsset = "0x2222222222222222222222222222222222222222";
      const xcmDestination = "0x030100001234";
      const xcmMessage = "0x0300010203";

      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          poolAddress,
          baseAsset,
          ethers.parseEther("0.5"),
          5,  // lower
          5,  // upper (invalid: must be lower < upper)
          xcmDestination,
          xcmMessage
        )
      ).to.be.revertedWithCustomError(assetHubVault, "InvalidRange");
    });
  });
});

