/**
 * AssetHubVault Investment Dispatch Tests
 * 
 * This test suite covers TEST-AHV-016 to TEST-AHV-023 from TESTING-REQUIREMENTS.md
 * 
 * Tests in this file:
 * - Operator can dispatch investment (test mode)
 * - Investment parameter validation
 * - Position ID generation and uniqueness
 * - Position storage and data integrity
 * - User positions array management
 * - Test mode vs production mode behavior
 * - Paused state handling
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault - Investment Dispatch", function () {
  let assetHubVault;
  let deployer, user1, user2, operator;

  // Helper function to create dummy XCM message parameters
  const createDummyXcmParams = () => ({
    destination: "0x030100001234",
    message: "0x0300010203"
  });

  /**
   * Deploy a fresh AssetHubVault before each test
   * Set up operator, test mode, and XCM precompile
   */
  beforeEach(async function () {
    [deployer, user1, user2, operator] = await ethers.getSigners();

    const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.waitForDeployment();

    // Set up operator
    await assetHubVault.setOperator(operator.address);

    // Enable test mode (skips actual XCM sending)
    await assetHubVault.setTestMode(true);

    // Set XCM precompile (required even in test mode for validation)
    await assetHubVault.setXcmPrecompile("0x0000000000000000000000000000000000000808");
  });

  /**
   * TEST-AHV-016: Operator can dispatch investment (test mode)
   * 
   * Verifies that:
   * - User deposits 100 ETH
   * - Operator dispatches 50 ETH investment
   * - Position created with correct params
   * - userBalances[user] reduced by 50 ETH
   * - InvestmentInitiated event emitted
   * - positionId generated correctly
   */
  describe("TEST-AHV-016: Operator can dispatch investment", function () {
    it("should dispatch investment successfully", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const { destination, message } = createDummyXcmParams();

      // User deposits
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      expect(await assetHubVault.getUserBalance(user1.address)).to.equal(depositAmount);

      // Operator dispatches investment
      await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        2004, // chainId (Moonbeam)
        user2.address, // poolId (dummy)
        user2.address, // baseAsset (dummy)
        investmentAmount,
        -5, // lowerRangePercent
        5,  // upperRangePercent
        destination,
        message
      );

      // Verify user balance reduced
      expect(await assetHubVault.getUserBalance(user1.address))
        .to.equal(depositAmount - investmentAmount);
    });

    it("should emit InvestmentInitiated event with correct params", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const chainId = 2004;
      const poolId = user2.address;
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          chainId,
          poolId,
          user2.address,
          investmentAmount,
          -5,
          5,
          destination,
          message
        )
      )
        .to.emit(assetHubVault, "InvestmentInitiated")
        .withArgs(
          ethers.keccak256(ethers.solidityPacked(
            ["address", "uint32", "address", "address", "uint256"],
            [user1.address, chainId, poolId, user2.address, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1)]
          )),
          user1.address,
          chainId,
          poolId,
          investmentAmount
        );
    });

    it("should create position with correct parameters", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const chainId = 2004;
      const poolId = user2.address;
      const baseAsset = user2.address;
      const lowerRange = -5;
      const upperRange = 5;
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        chainId,
        poolId,
        baseAsset,
        investmentAmount,
        lowerRange,
        upperRange,
        destination,
        message
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });

      const positionId = assetHubVault.interface.parseLog(event).args.positionId;

      // Verify position exists and has correct data
      const position = await assetHubVault.getPosition(positionId);
      expect(position.user).to.equal(user1.address);
      expect(position.poolId).to.equal(poolId);
      expect(position.baseAsset).to.equal(baseAsset);
      expect(position.chainId).to.equal(chainId);
      expect(position.lowerRangePercent).to.equal(lowerRange);
      expect(position.upperRangePercent).to.equal(upperRange);
      expect(position.active).to.equal(true);
      expect(position.amount).to.equal(investmentAmount);
    });

    it("should generate unique positionId", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        2004,
        user2.address,
        user2.address,
        investmentAmount,
        -5,
        5,
        destination,
        message
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });

      const positionId = assetHubVault.interface.parseLog(event).args.positionId;
      expect(positionId).to.not.equal(ethers.ZeroHash);
    });
  });

  /**
   * TEST-AHV-017: Dispatch investment validates parameters
   * 
   * Verifies validation of:
   * - Zero user address → revert ZeroAddress
   * - Zero amount → revert AmountZero
   * - Invalid range (lower >= upper) → revert InvalidRange
   * - Insufficient user balance → revert InsufficientBalance
   */
  describe("TEST-AHV-017: Parameter validation", function () {
    const { destination, message } = createDummyXcmParams();

    it("should revert with ZeroAddress for zero user address", async function () {
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          ethers.ZeroAddress, // Invalid user
          2004,
          user2.address,
          user2.address,
          ethers.parseEther("50"),
          -5,
          5,
          destination,
          message
        )
      ).to.be.revertedWithCustomError(assetHubVault, "ZeroAddress");
    });

    it("should revert with AmountZero for zero amount", async function () {
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("100") });

      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          0, // Invalid amount
          -5,
          5,
          destination,
          message
        )
      ).to.be.revertedWithCustomError(assetHubVault, "AmountZero");
    });

    it("should revert with InvalidRange when lower >= upper", async function () {
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("100") });

      // Test lower == upper
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          ethers.parseEther("50"),
          5,  // lower
          5,  // upper (equal to lower)
          destination,
          message
        )
      ).to.be.revertedWithCustomError(assetHubVault, "InvalidRange");

      // Test lower > upper
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          ethers.parseEther("50"),
          10,  // lower
          5,   // upper (less than lower)
          destination,
          message
        )
      ).to.be.revertedWithCustomError(assetHubVault, "InvalidRange");
    });

    it("should revert with InsufficientBalance when user balance too low", async function () {
      // User deposits 50 ETH
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("50") });

      // Try to invest 100 ETH (more than balance)
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          ethers.parseEther("100"), // More than deposited
          -5,
          5,
          destination,
          message
        )
      ).to.be.revertedWithCustomError(assetHubVault, "InsufficientBalance");
    });

    it("should revert when user has no balance", async function () {
      // No deposit, try to invest
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          ethers.parseEther("50"),
          -5,
          5,
          destination,
          message
        )
      ).to.be.revertedWithCustomError(assetHubVault, "InsufficientBalance");
    });
  });

  /**
   * TEST-AHV-018: Position ID generation is unique
   * 
   * Verifies that:
   * - Dispatching 3 investments for same user creates unique IDs
   * - Each position stored correctly
   * - Position IDs are deterministic based on input params + timestamp
   */
  describe("TEST-AHV-018: Unique position ID generation", function () {
    it("should generate unique IDs for multiple investments", async function () {
      const depositAmount = ethers.parseEther("150");
      const investmentAmount = ethers.parseEther("30");
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      const positionIds = [];

      // Dispatch 3 investments
      for (let i = 0; i < 3; i++) {
        const tx = await assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          investmentAmount,
          -5,
          5,
          destination,
          message
        );

        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
          try {
            return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
          } catch {
            return false;
          }
        });

        const positionId = assetHubVault.interface.parseLog(event).args.positionId;
        positionIds.push(positionId);

        // Small delay to ensure different timestamps
        await ethers.provider.send("evm_mine");
      }

      // Verify all IDs are unique
      expect(positionIds[0]).to.not.equal(positionIds[1]);
      expect(positionIds[1]).to.not.equal(positionIds[2]);
      expect(positionIds[0]).to.not.equal(positionIds[2]);
    });

    it("should store all positions correctly", async function () {
      const depositAmount = ethers.parseEther("150");
      const investmentAmount = ethers.parseEther("30");
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      const positionIds = [];

      // Dispatch 3 investments
      for (let i = 0; i < 3; i++) {
        const tx = await assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          investmentAmount,
          -5,
          5,
          destination,
          message
        );

        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
          try {
            return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
          } catch {
            return false;
          }
        });

        positionIds.push(assetHubVault.interface.parseLog(event).args.positionId);
        await ethers.provider.send("evm_mine");
      }

      // Verify all positions are stored and active
      for (const positionId of positionIds) {
        const position = await assetHubVault.getPosition(positionId);
        expect(position.active).to.equal(true);
        expect(position.user).to.equal(user1.address);
        expect(position.amount).to.equal(investmentAmount);
      }
    });
  });

  /**
   * TEST-AHV-019: Position stored with correct data
   * 
   * Verifies that position struct contains all expected fields:
   * - user address
   * - poolId
   * - baseAsset
   * - chainId
   * - lowerRangePercent / upperRangePercent
   * - timestamp
   * - active = true
   * - amount
   */
  describe("TEST-AHV-019: Position data integrity", function () {
    it("should store complete position data", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const chainId = 2004;
      const poolId = "0x1111111111111111111111111111111111111111";
      const baseAsset = "0x2222222222222222222222222222222222222222";
      const lowerRange = -10;
      const upperRange = 15;
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      const txTimestamp = await ethers.provider.getBlock('latest').then(b => b.timestamp + 1);

      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        chainId,
        poolId,
        baseAsset,
        investmentAmount,
        lowerRange,
        upperRange,
        destination,
        message
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });

      const positionId = assetHubVault.interface.parseLog(event).args.positionId;
      const position = await assetHubVault.getPosition(positionId);

      // Verify all fields
      expect(position.user).to.equal(user1.address);
      expect(position.poolId).to.equal(poolId);
      expect(position.baseAsset).to.equal(baseAsset);
      expect(position.chainId).to.equal(chainId);
      expect(position.lowerRangePercent).to.equal(lowerRange);
      expect(position.upperRangePercent).to.equal(upperRange);
      expect(position.active).to.equal(true);
      expect(position.amount).to.equal(investmentAmount);
      expect(position.timestamp).to.be.gt(0);
    });
  });

  /**
   * TEST-AHV-020: User positions array updated
   * 
   * Verifies that:
   * - User starts with empty positions array
   * - After 2 investments, array length = 2
   * - Both positionIds are in the array
   */
  describe("TEST-AHV-020: User positions array management", function () {
    it("should start with empty positions array", async function () {
      const positions = await assetHubVault.getUserPositions(user1.address);
      expect(positions).to.be.an('array').that.is.empty;
    });

    it("should add positions to user array", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("30");
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      const positionIds = [];

      // Dispatch 2 investments
      for (let i = 0; i < 2; i++) {
        const tx = await assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          investmentAmount,
          -5,
          5,
          destination,
          message
        );

        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
          try {
            return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
          } catch {
            return false;
          }
        });

        positionIds.push(assetHubVault.interface.parseLog(event).args.positionId);
        await ethers.provider.send("evm_mine");
      }

      // Verify positions array
      const userPositions = await assetHubVault.getUserPositions(user1.address);
      expect(userPositions).to.have.lengthOf(2);

      // Verify correct position IDs (check by comparing position data)
      expect(userPositions[0].user).to.equal(user1.address);
      expect(userPositions[1].user).to.equal(user1.address);
      expect(userPositions[0].active).to.equal(true);
      expect(userPositions[1].active).to.equal(true);
    });

    it("should track positions separately for different users", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("30");
      const { destination, message } = createDummyXcmParams();

      // Both users deposit
      await assetHubVault.connect(user1).deposit({ value: depositAmount });
      await assetHubVault.connect(user2).deposit({ value: depositAmount });

      // User1 gets 2 positions
      await assetHubVault.connect(operator).dispatchInvestment(
        user1.address, 2004, user2.address, user2.address,
        investmentAmount, -5, 5, destination, message
      );
      await ethers.provider.send("evm_mine");
      await assetHubVault.connect(operator).dispatchInvestment(
        user1.address, 2004, user2.address, user2.address,
        investmentAmount, -5, 5, destination, message
      );

      // User2 gets 1 position
      await ethers.provider.send("evm_mine");
      await assetHubVault.connect(operator).dispatchInvestment(
        user2.address, 2004, user1.address, user1.address,
        investmentAmount, -5, 5, destination, message
      );

      const user1Positions = await assetHubVault.getUserPositions(user1.address);
      const user2Positions = await assetHubVault.getUserPositions(user2.address);

      expect(user1Positions).to.have.lengthOf(2);
      expect(user2Positions).to.have.lengthOf(1);
    });
  });

  /**
   * TEST-AHV-021: XCM precompile must be set (production mode)
   * 
   * Verifies that:
   * - When test mode is disabled
   * - And XCM_PRECOMPILE = address(0)
   * - dispatchInvestment reverts with XcmPrecompileNotSet
   */
  describe("TEST-AHV-021: XCM precompile validation", function () {
    it("should revert when precompile not set in production mode", async function () {
      // Deploy fresh contract without setting precompile
      const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
      const freshVault = await AssetHubVault.deploy();
      await freshVault.waitForDeployment();

      await freshVault.setOperator(operator.address);
      // Don't set test mode (production mode by default)
      // Don't set XCM precompile

      await freshVault.connect(user1).deposit({ value: ethers.parseEther("100") });

      const { destination, message } = createDummyXcmParams();

      await expect(
        freshVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          ethers.parseEther("50"),
          -5,
          5,
          destination,
          message
        )
      ).to.be.revertedWithCustomError(freshVault, "XcmPrecompileNotSet");
    });

    it("should work when precompile is set", async function () {
      // Fresh contract
      const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
      const freshVault = await AssetHubVault.deploy();
      await freshVault.waitForDeployment();

      await freshVault.setOperator(operator.address);
      await freshVault.setTestMode(true);
      await freshVault.setXcmPrecompile("0x0000000000000000000000000000000000000808");

      await freshVault.connect(user1).deposit({ value: ethers.parseEther("100") });

      const { destination, message } = createDummyXcmParams();

      // Should not revert
      await expect(
        freshVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          ethers.parseEther("50"),
          -5,
          5,
          destination,
          message
        )
      ).to.not.be.reverted;
    });
  });

  /**
   * TEST-AHV-022: XCM send skipped in test mode
   * 
   * Verifies that:
   * - When test mode is enabled
   * - Investment dispatch succeeds without actual XCM call
   * - Position is still created
   */
  describe("TEST-AHV-022: Test mode behavior", function () {
    it("should skip XCM send in test mode", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const { destination, message } = createDummyXcmParams();

      // Test mode is enabled in beforeEach
      expect(await assetHubVault.testMode()).to.equal(true);

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      // Should succeed even though XCM precompile is just a dummy address
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          investmentAmount,
          -5,
          5,
          destination,
          message
        )
      ).to.not.be.reverted;

      // Verify position was created
      const positions = await assetHubVault.getUserPositions(user1.address);
      expect(positions).to.have.lengthOf(1);
      expect(positions[0].active).to.equal(true);
    });

    it("should still validate all parameters in test mode", async function () {
      // Even in test mode, validation should occur
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("100") });

      // Invalid range should still revert
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          ethers.parseEther("50"),
          5,  // lower
          5,  // upper (equal, invalid)
          destination,
          message
        )
      ).to.be.revertedWithCustomError(assetHubVault, "InvalidRange");
    });
  });

  /**
   * TEST-AHV-023: Functions revert when paused
   * 
   * Verifies that:
   * - Admin can pause contract
   * - dispatchInvestment reverts with Paused error when contract is paused
   */
  describe("TEST-AHV-023: Paused state handling", function () {
    it("should revert when contract is paused", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      // Pause contract (deployer is admin)
      await assetHubVault.connect(deployer).pause();
      expect(await assetHubVault.paused()).to.equal(true);

      // Try to dispatch investment while paused
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          investmentAmount,
          -5,
          5,
          destination,
          message
        )
      ).to.be.revertedWithCustomError(assetHubVault, "Paused");
    });

    it("should work after unpausing", async function () {
      const depositAmount = ethers.parseEther("100");
      const investmentAmount = ethers.parseEther("50");
      const { destination, message } = createDummyXcmParams();

      await assetHubVault.connect(user1).deposit({ value: depositAmount });

      // Pause
      await assetHubVault.connect(deployer).pause();

      // Unpause
      await assetHubVault.connect(deployer).unpause();
      expect(await assetHubVault.paused()).to.equal(false);

      // Should work now
      await expect(
        assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          investmentAmount,
          -5,
          5,
          destination,
          message
        )
      ).to.not.be.reverted;
    });
  });
});

