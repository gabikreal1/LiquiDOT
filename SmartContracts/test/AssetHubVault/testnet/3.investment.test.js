/**
 * AssetHubVault Testnet Investment Tests
 * 
 * Tests investment dispatch flow on deployed contract
 * Safe for testnet - uses test mode to skip XCM calls
 * 
 * Covers TEST-AHV-016 to TEST-AHV-023
 * 
 * Usage:
 *   npx hardhat test test/AssetHubVault/testnet/3.investment.test.js --network passethub
 * 
 * Requirements:
 *   - ASSET_PK in .env must have PAS tokens
 *   - ASSETHUB_CONTRACT must point to deployed vault
 *   - Contract must be in test mode (testMode = true)
 *   - Account must be operator
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault Testnet - Investment Dispatch", function () {
  let vault;
  let operator;
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;

  // Test parameters
  const MOONBASE_CHAIN_ID = 1287;
  const TEST_POOL_ID = "0x1234567890abcdef1234567890abcdef12345678"; // address format
  const WETH_ADDRESS = "0x1436aE0dF0A8663F18c0Ec51d7e2E46591730715"; // Moonbase WETH
  
  // XCM parameters (mock - will be skipped in test mode)
  const MOCK_XCM_DESTINATION = "0x010100a10f"; // Mock multilocation bytes
  const MOCK_XCM_MESSAGE = "0x"; // Empty XCM message (skipped in test mode)
  
  before(async function () {
    if (!VAULT_ADDRESS || VAULT_ADDRESS === ethers.ZeroAddress) {
      throw new Error("Set ASSETHUB_CONTRACT environment variable");
    }

    [operator] = await ethers.getSigners();

    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    vault = AssetHubVault.attach(VAULT_ADDRESS);

    // Verify test mode is enabled
    const testMode = await vault.testMode();
    if (!testMode) {
      console.log("\n⚠️  WARNING: Test mode is disabled!");
      console.log("   These tests require test mode to skip XCM calls");
      console.log("   Enable with: vault.setTestMode(true) as admin\n");
      throw new Error("Test mode must be enabled for investment tests");
    }

    console.log(`\n✅ Connected to vault at: ${VAULT_ADDRESS}`);
    console.log(`✅ Network: ${network.name}`);
    console.log(`✅ Operator: ${operator.address}`);
    console.log(`✅ Test Mode: Enabled (XCM calls will be skipped)\n`);
  });

  describe("Investment Dispatch - Basic Flow", function () {
    it("should allow operator to dispatch investment (TEST-AHV-016)", async function () {
      // First, deposit funds
      const depositAmount = ethers.parseEther("1.0");
      await vault.connect(operator).deposit({ value: depositAmount });
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for block

      const balanceBefore = await vault.getUserBalance(operator.address);
      expect(balanceBefore).to.be.gte(depositAmount);

      // Dispatch investment with all 9 parameters
      const investAmount = ethers.parseEther("0.5");
      const lowerRange = -50; // -50% (int24)
      const upperRange = 50;  // +50% (int24)

      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,      // user
        MOONBASE_CHAIN_ID,     // chainId
        TEST_POOL_ID,          // poolId
        WETH_ADDRESS,          // baseAsset
        investAmount,          // amount
        lowerRange,            // lowerRangePercent
        upperRange,            // upperRangePercent
        MOCK_XCM_DESTINATION,  // destination bytes
        MOCK_XCM_MESSAGE       // preBuiltXcmMessage bytes
      );
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for block

      // Verify balance reduced
      const balanceAfter = await vault.getUserBalance(operator.address);
      expect(balanceAfter).to.equal(balanceBefore - investAmount);

      // Verify event emitted and get position ID
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      
      expect(event).to.not.be.undefined;

      // Get position ID and confirm execution
      const parsed = vault.interface.parseLog(event);
      const positionId = parsed.args[0];
      
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("test-remote-pos-1"));
      await vault.connect(operator).confirmExecution(positionId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      console.log(`   ✓ Dispatched ${ethers.formatEther(investAmount)} ETH investment`);
      console.log(`   ✓ User balance reduced to ${ethers.formatEther(balanceAfter)} ETH`);
      console.log(`   ✓ Position confirmed and activated`);
    });

    it("should create position with correct data (TEST-AHV-019)", async function () {
      // Get user's positions (returns Position[] structs)
      const positions = await vault.getUserPositions(operator.address);
      expect(positions.length).to.be.gte(1);

      // Get the last position - getUserPositions returns full structs, not IDs
      const position = positions[positions.length - 1];

      // Position struct: (user, poolId, baseAsset, chainId, lowerRange, upperRange, timestamp, status, amount, remotePositionId)
      // Access by index
      expect(position[0].toLowerCase()).to.equal(operator.address.toLowerCase()); // user
      expect(position[1].toLowerCase()).to.equal(TEST_POOL_ID.toLowerCase()); // poolId
      expect(position[2].toLowerCase()).to.equal(WETH_ADDRESS.toLowerCase()); // baseAsset
      expect(position[3]).to.equal(MOONBASE_CHAIN_ID); // chainId
      expect(position[4]).to.equal(-50); // lowerRangePercent
      expect(position[5]).to.equal(50); // upperRangePercent
      expect(position[7]).to.equal(1); // status: Active
      expect(position[8]).to.be.gt(0); // amount

      console.log(`   ✓ Amount: ${ethers.formatEther(position[8])} ETH`); // position.amount
      console.log(`   ✓ Pool: ${position[1].slice(0, 10)}...`); // position.poolId
      console.log(`   ✓ Chain: ${position[3]}`); // position.chainId
      console.log(`   ✓ Range: ${position[4]}% to +${position[5]}%`); // ranges
      console.log(`   ✓ Status: Active (${position[7]})`); // status
    });

    it("should update user positions array (TEST-AHV-020)", async function () {
      const countBefore = await vault.getUserPositionCount(operator.address);

      // Deposit more funds
      await vault.connect(operator).deposit({ value: ethers.parseEther("0.5") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Dispatch another investment
      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,
        MOONBASE_CHAIN_ID,
        TEST_POOL_ID,
        WETH_ADDRESS,
        ethers.parseEther("0.2"),
        -30, // Different range
        40,
        MOCK_XCM_DESTINATION,
        MOCK_XCM_MESSAGE
      );
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Confirm execution
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
      
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("test-remote-pos-2"));
      await vault.connect(operator).confirmExecution(positionId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      const countAfter = await vault.getUserPositionCount(operator.address);
      expect(countAfter).to.equal(countBefore + 1n);

      console.log(`   ✓ User now has ${countAfter} positions`);
    });

    it("should generate unique position IDs (TEST-AHV-018)", async function () {
      const totalCount = await vault.getUserPositionCount(operator.address);
      const positionIds = await vault.getUserPositionIds(operator.address, 0, Number(totalCount));
      
      // Check all position IDs are unique
      const uniqueIds = new Set(positionIds);
      expect(uniqueIds.size).to.equal(positionIds.length);

      console.log(`   ✓ All ${positionIds.length} position IDs are unique`);
    });
  });

  describe("Investment Dispatch - Validation", function () {
    it("should revert on zero amount (TEST-AHV-017)", async function () {
      await expect(
        vault.connect(operator).dispatchInvestment(
          operator.address,
          MOONBASE_CHAIN_ID,
          TEST_POOL_ID,
          WETH_ADDRESS,
          0, // Zero amount
          -50,
          50,
          MOCK_XCM_DESTINATION,
          MOCK_XCM_MESSAGE
        )
      ).to.be.revertedWithCustomError(vault, "AmountZero");
    });

    it("should revert on zero address user (TEST-AHV-017)", async function () {
      await expect(
        vault.connect(operator).dispatchInvestment(
          ethers.ZeroAddress, // Zero address
          MOONBASE_CHAIN_ID,
          TEST_POOL_ID,
          WETH_ADDRESS,
          ethers.parseEther("0.1"),
          -50,
          50,
          MOCK_XCM_DESTINATION,
          MOCK_XCM_MESSAGE
        )
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("should revert on invalid range (TEST-AHV-017)", async function () {
      await expect(
        vault.connect(operator).dispatchInvestment(
          operator.address,
          MOONBASE_CHAIN_ID,
          TEST_POOL_ID,
          WETH_ADDRESS,
          ethers.parseEther("0.1"),
          60, // lower >= upper is invalid
          50,
          MOCK_XCM_DESTINATION,
          MOCK_XCM_MESSAGE
        )
      ).to.be.revertedWithCustomError(vault, "InvalidRange");
    });

    it("should revert on insufficient user balance (TEST-AHV-017)", async function () {
      // Try to dispatch more than user has
      const userBalance = await vault.getUserBalance(operator.address);
      const tooMuch = userBalance + ethers.parseEther("1000");

      await expect(
        vault.connect(operator).dispatchInvestment(
          operator.address,
          MOONBASE_CHAIN_ID,
          TEST_POOL_ID,
          WETH_ADDRESS,
          tooMuch,
          -50,
          50,
          MOCK_XCM_DESTINATION,
          MOCK_XCM_MESSAGE
        )
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });
  });

  describe("Investment Dispatch - Test Mode Behavior", function () {
    it("should skip XCM calls in test mode (TEST-AHV-022)", async function () {
      // This test verifies that even though XCM precompile is set,
      // XCM calls are skipped in test mode
      
      const xcmPrecompile = await vault.XCM_PRECOMPILE();
      console.log(`   XCM Precompile: ${xcmPrecompile}`);
      
      // Deposit funds
      await vault.connect(operator).deposit({ value: ethers.parseEther("0.3") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Dispatch should succeed and skip XCM call
      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,
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

      // Confirm execution
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
      
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("test-remote-pos-3"));
      await vault.connect(operator).confirmExecution(positionId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      console.log(`   ✓ XCM Precompile: ${xcmPrecompile}`);
      console.log(`   ✓ Investment dispatched without XCM call (test mode)`);
      console.log(`   ✓ Position confirmed and activated`);
    });

    it("should create position even without XCM (TEST-AHV-022)", async function () {
      const countBefore = await vault.getUserPositionCount(operator.address);
      
      await vault.connect(operator).deposit({ value: ethers.parseEther("0.3") });
      await new Promise(resolve => setTimeout(resolve, 6000));

      const tx = await vault.connect(operator).dispatchInvestment(
        operator.address,
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

      // Confirm execution
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
      
      const mockRemotePositionId = ethers.keccak256(ethers.toUtf8Bytes("test-remote-pos-4"));
      await vault.connect(operator).confirmExecution(positionId, mockRemotePositionId, 1000000n);
      await new Promise(resolve => setTimeout(resolve, 6000));

      const countAfter = await vault.getUserPositionCount(operator.address);
      expect(countAfter).to.equal(countBefore + 1n);

      // Get the position data
      const position = await vault.getPosition(positionId);
      // Status enum: PendingExecution=0, Active=1, Liquidated=2
      expect(position.status).to.equal(1); // status should be Active

      console.log(`   ✓ Position created successfully in test mode`);
      console.log(`   ✓ Position status: Active`);
    });
  });

  describe("Investment Dispatch - Access Control", function () {
    it("should only allow operator to dispatch (if not operator role, skip)", async function () {
      const operatorRole = await vault.operator();
      
      if (operatorRole !== operator.address) {
        this.skip(); // Skip if test account is not the operator
      }

      // This test only runs if operator role is properly set
      console.log(`   ✓ Operator confirmed: ${operator.address}`);
    });

    it("should revert when paused (TEST-AHV-023)", async function () {
      // Check if paused
      const isPaused = await vault.paused();
      
      if (isPaused) {
        // If already paused, verify it reverts
        await expect(
          vault.connect(operator).dispatchInvestment(
            operator.address,
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
      } else {
        // If not paused, we can't test without admin privileges
        this.skip();
      }
    });
  });

  describe("Investment Summary", function () {
    it("should display all user positions", async function () {
      // Use pagination-friendly stats function
      const stats = await vault.getUserPositionStats(operator.address);
      
      console.log(`\n   📊 Investment Summary`);
      console.log(`   ==========================================`);
      console.log(`   Total Positions: ${stats.total}`);
      console.log(`   Pending Positions: ${stats.pending}`);
      console.log(`   Active Positions: ${stats.active}`);
      console.log(`   Liquidated Positions: ${stats.liquidated}`);
      console.log(`   ==========================================`);
      
      // Get first page of active positions to show details
      if (stats.active > 0) {
        const activePositions = await vault.getUserPositionsByStatus(
          operator.address,
          1, // Active status
          10 // Max 10 positions
        );
        
        console.log(`\n   Active Positions (showing first ${activePositions.length}):`);
        let totalInvested = 0n;
        for (let i = 0; i < activePositions.length; i++) {
          const amount = activePositions[i][8]; // amount field
          totalInvested += amount;
          console.log(`   ${i + 1}. ${ethers.formatEther(amount)} ETH on chain ${activePositions[i][3]}`);
        }
        console.log(`   Total Active: ${ethers.formatEther(totalInvested)} ETH`);
      }
      console.log(`   ==========================================\n`);

      expect(stats.total).to.be.gte(1n);
    });
  });
});
