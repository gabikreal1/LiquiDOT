/**
 * AssetHubVault Testnet Emergency Functions Tests
 * 
 * Tests emergency and admin functions on deployed contract
 * CAUTION: Some tests may pause the contract - run carefully
 * 
 * Covers TEST-AHV-029 to TEST-AHV-033
 * 
 * Usage:
 *   npx hardhat test test/AssetHubVault/testnet/5.emergency.test.js --network passethub
 * 
 * Requirements:
 *   - ASSET_PK in .env must have PAS tokens
 *   - ASSETHUB_CONTRACT must point to deployed vault
 *   - Account must be admin or emergency address
 *   - WARNING: Tests may pause the contract temporarily
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault Testnet - Emergency Functions", function () {
  let vault;
  let admin;
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;

  // Test parameters
  const MOONBASE_CHAIN_ID = 1287;
  const TEST_POOL_ID = "0x1234567890abcdef1234567890abcdef12345678"; // address format
  const WETH_ADDRESS = "0x1436aE0dF0A8663F18c0Ec51d7e2E46591730715";
  
  // XCM parameters (mock)
  const MOCK_XCM_DESTINATION = "0x010100a10f";
  const MOCK_XCM_MESSAGE = "0x";

  before(async function () {
    if (!VAULT_ADDRESS || VAULT_ADDRESS === ethers.ZeroAddress) {
      throw new Error("Set ASSETHUB_CONTRACT environment variable");
    }

    [admin] = await ethers.getSigners();

    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    vault = AssetHubVault.attach(VAULT_ADDRESS);

    console.log(`\n✅ Connected to vault at: ${VAULT_ADDRESS}`);
    console.log(`✅ Network: ${network.name}`);
    console.log(`✅ Admin/Emergency: ${admin.address}`);
    
    const isAdmin = await vault.admin();
    const isEmergency = await vault.emergency();
    
    console.log(`   Contract admin: ${isAdmin}`);
    console.log(`   Contract emergency: ${isEmergency}`);
    
    if (isAdmin !== admin.address && isEmergency !== admin.address) {
      console.log(`\n   ⚠️  WARNING: Test account is not admin or emergency`);
      console.log(`   Some tests will be skipped\n`);
    } else {
      console.log(`   ✅ Test account has admin/emergency privileges\n`);
    }
  });

  describe("Emergency Liquidation", function () {
    it("should allow emergency to force liquidate position (TEST-AHV-029)", async function () {
      const emergencyAddress = await vault.emergency();
      
      if (emergencyAddress.toLowerCase() !== admin.address.toLowerCase()) {
        this.skip(); // Skip if not emergency address
      }

      // Create a test position
      await vault.connect(admin).deposit({ value: ethers.parseEther("0.5") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const tx = await vault.connect(admin).dispatchInvestment(
        admin.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.3"),
        -50,
        50,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position ID from event
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const parsed = vault.interface.parseLog(event);
      const positionId = parsed.args[0];

      // Confirm execution to make it Active
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("emergency-test-pos-1"));
      await vault.connect(admin).confirmExecution(positionId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Emergency liquidate (can send funds with it)
      const emergencyProceeds = ethers.parseEther("0.2");
      const userBalanceBefore = await vault.getUserBalance(admin.address);

      const emergencyTx = await vault.connect(admin).emergencyLiquidatePosition(
        MOONBASE_CHAIN_ID,
        positionId,
        { value: emergencyProceeds }
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Verify position liquidated using getPosition
      const position = await vault.getPosition(positionId);
      expect(position.status).to.equal(2); // Status = Liquidated

      // Verify user balance increased if funds were sent
      const userBalanceAfter = await vault.getUserBalance(admin.address);
      expect(userBalanceAfter).to.equal(userBalanceBefore + emergencyProceeds);

      // Verify event
      const emergencyReceipt = await emergencyTx.wait();
      const liquidatedEvent = emergencyReceipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "PositionLiquidated";
        } catch {
          return false;
        }
      });
      expect(liquidatedEvent).to.not.be.undefined;

      console.log(`   ✓ Emergency liquidation successful`);
      console.log(`   ✓ Funds credited: ${ethers.formatEther(emergencyProceeds)} ETH`);
    });

    it("should validate chainId on emergency liquidation (TEST-AHV-030)", async function () {
      this.timeout(180000); // 3 minutes timeout
      
      const emergencyAddress = await vault.emergency();
      
      if (emergencyAddress.toLowerCase() !== admin.address.toLowerCase()) {
        this.skip();
      }

      // Create a position on Moonbase (chainId 1287)
      await vault.connect(admin).deposit({ value: ethers.parseEther("0.3") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const tx = await vault.connect(admin).dispatchInvestment(
        admin.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.1"),
        -50,
        50,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position ID
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const parsed = vault.interface.parseLog(event);
      const positionId = parsed.args[0];

      // Confirm execution to activate
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("emergency-test-pos-2"));
      await vault.connect(admin).confirmExecution(positionId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Try to liquidate with wrong chainId
      const wrongChainId = 2004; // Moonbeam instead of Moonbase

      await expect(
        vault.connect(admin).emergencyLiquidatePosition(
          wrongChainId,
          positionId
        )
      ).to.be.revertedWithCustomError(vault, "ChainIdMismatch");

      console.log(`   ✓ Rejects emergency liquidation with wrong chainId`);
    });

    it("should only work on non-liquidated positions (TEST-AHV-031)", async function () {
      const emergencyAddress = await vault.emergency();
      
      if (emergencyAddress.toLowerCase() !== admin.address.toLowerCase()) {
        this.skip();
      }

      // Create and settle a position
      await vault.connect(admin).deposit({ value: ethers.parseEther("0.3") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const tx = await vault.connect(admin).dispatchInvestment(
        admin.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.1"),
        -50,
        50,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Get position ID
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      const parsed = vault.interface.parseLog(event);
      const positionId = parsed.args[0];

      // Confirm and settle it
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("emergency-test-pos-3"));
      await vault.connect(admin).confirmExecution(positionId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      await vault.connect(admin).settleLiquidation(positionId, ethers.parseEther("0.15"));
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Try to emergency liquidate already-liquidated position
      // Note: Contract uses custom error, not string message
      await expect(
        vault.connect(admin).emergencyLiquidatePosition(
          MOONBASE_CHAIN_ID,
          positionId
        )
      ).to.be.reverted; // Works with custom errors

      console.log(`   ✓ Cannot emergency liquidate already-liquidated position (TEST-AHV-031)`);
    });
  });

  describe("Pause/Unpause Functions", function () {
    it("should allow admin to pause contract (TEST-AHV-032)", async function () {
      const adminAddress = await vault.admin();
      
      if (adminAddress !== admin.address) {
        this.skip(); // Skip if not admin
      }

      const pausedBefore = await vault.paused();
      
      if (!pausedBefore) {
        // Pause the contract
        await vault.connect(admin).pause();
        await new Promise(resolve => setTimeout(resolve, 6000));

        const pausedAfter = await vault.paused();
        expect(pausedAfter).to.be.true;

        console.log(`   ✓ Contract paused successfully`);
        
        // IMPORTANT: Unpause immediately for other tests
        await vault.connect(admin).unpause();
        await new Promise(resolve => setTimeout(resolve, 6000));

        const unpaused = await vault.paused();
        expect(unpaused).to.be.false;

        console.log(`   ✓ Contract unpaused successfully`);
      } else {
        console.log(`   ⚠️  Contract already paused - unpausing...`);
        
        await vault.connect(admin).unpause();
        await new Promise(resolve => setTimeout(resolve, 6000));

        console.log(`   ✓ Contract unpaused`);
      }
    });

    it("should block operations when paused (TEST-AHV-033)", async function () {
      const adminAddress = await vault.admin();
      
      if (adminAddress.toLowerCase() !== admin.address.toLowerCase()) {
        this.skip();
      }

      // Pause contract
      await vault.connect(admin).pause();
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Try to dispatch investment - should fail
      await expect(
        vault.connect(admin).dispatchInvestment(
          admin.address,
          MOONBASE_CHAIN_ID,
          TEST_POOL_ID,
          WETH_ADDRESS,
          ethers.parseEther("0.1"),
          -50,
          50,
          MOCK_XCM_DESTINATION,
          MOCK_XCM_MESSAGE
        )
      ).to.be.revertedWithCustomError(vault, "Paused");

      console.log(`   ✓ dispatchInvestment blocked while paused`);

      // CRITICAL: Unpause the contract
      await vault.connect(admin).unpause();
      await new Promise(resolve => setTimeout(resolve, 6000));

      const isPaused = await vault.paused();
      expect(isPaused).to.be.false;

      console.log(`   ✓ Contract unpaused - normal operations restored`);
    });

    it("should verify pause state changes", async function () {
      const adminAddress = await vault.admin();
      
      if (adminAddress.toLowerCase() !== admin.address.toLowerCase()) {
        this.skip();
      }

      // Check initial state
      let isPaused = await vault.paused();
      console.log(`   Initial paused state: ${isPaused}`);

      // Pause
      await vault.connect(admin).pause();
      await new Promise(resolve => setTimeout(resolve, 6000));

      isPaused = await vault.paused();
      expect(isPaused).to.be.true;
      console.log(`   ✓ Contract paused - paused state: ${isPaused}`);

      // Unpause
      await vault.connect(admin).unpause();
      await new Promise(resolve => setTimeout(resolve, 6000));

      isPaused = await vault.paused();
      expect(isPaused).to.be.false;
      console.log(`   ✓ Contract unpaused - paused state: ${isPaused}`);
    });
  });

  describe("Emergency Summary", function () {
    it("should display emergency capabilities and current state", async function () {
      const adminAddress = await vault.admin();
      const emergencyAddress = await vault.emergency();
      const isPaused = await vault.paused();
      const testMode = await vault.testMode();
      
      // Use stats function for efficient counting
      const stats = await vault.getUserPositionStats(admin.address);

      console.log(`\n   📊 Emergency Functions Summary`);
      console.log(`   ==========================================`);
      console.log(`   Admin Address: ${adminAddress}`);
      console.log(`   Emergency Address: ${emergencyAddress}`);
      console.log(`   Test Account: ${admin.address}`);
      console.log(`   Has Admin Rights: ${adminAddress.toLowerCase() === admin.address.toLowerCase() ? 'YES' : 'NO'}`);
      console.log(`   Has Emergency Rights: ${emergencyAddress.toLowerCase() === admin.address.toLowerCase() ? 'YES' : 'NO'}`);
      console.log(`   ==========================================`);
      console.log(`   Contract State:`);
      console.log(`   - Paused: ${isPaused ? 'YES ⚠️' : 'NO ✅'}`);
      console.log(`   - Test Mode: ${testMode ? 'YES ✅' : 'NO'}`);
      console.log(`   - Total Positions: ${stats.total}`);
      console.log(`   - Pending Positions: ${stats.pending}`);
      console.log(`   - Active Positions: ${stats.active}`);
      console.log(`   - Liquidated Positions: ${stats.liquidated}`);
      console.log(`   ==========================================\n`);

      expect(isPaused).to.be.false; // Ensure contract is not paused after tests
    });
  });

  after(async function () {
    // Final safety check - ensure contract is not paused
    const isPaused = await vault.paused();
    
    if (isPaused) {
      console.log(`\n⚠️  WARNING: Contract is still paused!`);
      console.log(`   Attempting to unpause...`);
      
      try {
        await vault.connect(admin).unpause();
        await new Promise(resolve => setTimeout(resolve, 6000));
        console.log(`   ✅ Contract unpaused successfully\n`);
      } catch (error) {
        console.log(`   ❌ Failed to unpause: ${error.message}`);
        console.log(`   Manual intervention required!\n`);
      }
    }
  });
});
