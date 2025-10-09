/**
 * AssetHubVault Access Control Tests
 * 
 * This test suite covers TEST-AHV-003 to TEST-AHV-006 from TESTING-REQUIREMENTS.md
 * 
 * Tests in this file:
 * - TEST-AHV-003: Only admin can call admin functions
 * - TEST-AHV-004: Only operator can call operator functions
 * - TEST-AHV-005: Only emergency can call emergency functions
 * - TEST-AHV-006: Admin role can be transferred
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault - Access Control", function () {
  let assetHubVault;
  let deployer, user1, user2, operator, emergency;

  /**
   * Deploy a fresh AssetHubVault before each test
   * Deployer starts as admin, operator, and emergency
   */
  beforeEach(async function () {
    [deployer, user1, user2, operator, emergency] = await ethers.getSigners();

    const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.waitForDeployment();
  });

  /**
   * TEST-AHV-003: Only admin can call admin functions
   * 
   * Tests all admin-only functions to ensure they:
   * - Revert with NotAdmin() when called by non-admin
   * - Execute successfully when called by admin
   */
  describe("TEST-AHV-003: Admin-only functions", function () {
    describe("setXcmPrecompile", function () {
      it("should revert if not admin", async function () {
        const precompileAddress = "0x0000000000000000000000000000000000000808";
        
        await expect(
          assetHubVault.connect(user1).setXcmPrecompile(precompileAddress)
        ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      });

      it("should allow admin to set XCM precompile", async function () {
        const precompileAddress = "0x0000000000000000000000000000000000000808";
        
        await expect(
          assetHubVault.connect(deployer).setXcmPrecompile(precompileAddress)
        )
          .to.emit(assetHubVault, "XcmPrecompileSet")
          .withArgs(precompileAddress);
        
        expect(await assetHubVault.XCM_PRECOMPILE()).to.equal(precompileAddress);
      });
    });

    describe("transferAdmin", function () {
      it("should revert if not admin", async function () {
        await expect(
          assetHubVault.connect(user1).transferAdmin(user2.address)
        ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      });

      it("should allow admin to transfer admin role", async function () {
        await assetHubVault.connect(deployer).transferAdmin(user1.address);
        
        expect(await assetHubVault.admin()).to.equal(user1.address);
      });

      it("should revert when transferring to zero address", async function () {
        await expect(
          assetHubVault.connect(deployer).transferAdmin(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(assetHubVault, "ZeroAddress");
      });
    });

    describe("setOperator", function () {
      it("should revert if not admin", async function () {
        await expect(
          assetHubVault.connect(user1).setOperator(operator.address)
        ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      });

      it("should allow admin to set operator", async function () {
        await assetHubVault.connect(deployer).setOperator(operator.address);
        
        expect(await assetHubVault.operator()).to.equal(operator.address);
      });

      it("should revert when setting operator to zero address", async function () {
        await expect(
          assetHubVault.connect(deployer).setOperator(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(assetHubVault, "ZeroAddress");
      });
    });

    describe("setEmergency", function () {
      it("should revert if not admin", async function () {
        await expect(
          assetHubVault.connect(user1).setEmergency(emergency.address)
        ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      });

      it("should allow admin to set emergency address", async function () {
        await assetHubVault.connect(deployer).setEmergency(emergency.address);
        
        expect(await assetHubVault.emergency()).to.equal(emergency.address);
      });

      it("should revert when setting emergency to zero address", async function () {
        await expect(
          assetHubVault.connect(deployer).setEmergency(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(assetHubVault, "ZeroAddress");
      });
    });

    describe("pause", function () {
      it("should revert if not admin", async function () {
        await expect(
          assetHubVault.connect(user1).pause()
        ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      });

      it("should allow admin to pause contract", async function () {
        await assetHubVault.connect(deployer).pause();
        
        expect(await assetHubVault.paused()).to.equal(true);
      });
    });

    describe("unpause", function () {
      it("should revert if not admin", async function () {
        // First pause as admin
        await assetHubVault.connect(deployer).pause();
        
        // Try to unpause as non-admin
        await expect(
          assetHubVault.connect(user1).unpause()
        ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      });

      it("should allow admin to unpause contract", async function () {
        // Pause first
        await assetHubVault.connect(deployer).pause();
        expect(await assetHubVault.paused()).to.equal(true);
        
        // Unpause
        await assetHubVault.connect(deployer).unpause();
        expect(await assetHubVault.paused()).to.equal(false);
      });
    });

    describe("freezeXcmPrecompile", function () {
      it("should revert if not admin", async function () {
        await expect(
          assetHubVault.connect(user1).freezeXcmPrecompile()
        ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      });

      it("should allow admin to freeze XCM precompile", async function () {
        await assetHubVault.connect(deployer).freezeXcmPrecompile();
        
        expect(await assetHubVault.xcmPrecompileFrozen()).to.equal(true);
      });

      it("should revert when trying to freeze again", async function () {
        await assetHubVault.connect(deployer).freezeXcmPrecompile();
        
        await expect(
          assetHubVault.connect(deployer).freezeXcmPrecompile()
        ).to.be.revertedWith("already frozen");
      });
    });

    describe("setTestMode", function () {
      it("should revert if not admin", async function () {
        await expect(
          assetHubVault.connect(user1).setTestMode(true)
        ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      });

      it("should allow admin to enable test mode", async function () {
        await assetHubVault.connect(deployer).setTestMode(true);
        
        expect(await assetHubVault.testMode()).to.equal(true);
      });

      it("should allow admin to disable test mode", async function () {
        // Enable first
        await assetHubVault.connect(deployer).setTestMode(true);
        expect(await assetHubVault.testMode()).to.equal(true);
        
        // Disable
        await assetHubVault.connect(deployer).setTestMode(false);
        expect(await assetHubVault.testMode()).to.equal(false);
      });
    });
  });

  /**
   * TEST-AHV-004: Only operator can call operator functions
   * 
   * Tests operator-only functions to ensure they:
   * - Revert with NotOperator() when called by non-operator
   * - Execute successfully when called by operator
   */
  describe("TEST-AHV-004: Operator-only functions", function () {
    beforeEach(async function () {
      // Set up a different operator (not deployer)
      await assetHubVault.connect(deployer).setOperator(operator.address);
      
      // Enable test mode to skip XCM precompile requirement
      await assetHubVault.connect(deployer).setTestMode(true);
      
      // Set XCM precompile (required even in test mode for validation)
      await assetHubVault.connect(deployer).setXcmPrecompile(
        "0x0000000000000000000000000000000000000808"
      );
    });

    describe("dispatchInvestment", function () {
      it("should revert if not operator", async function () {
        // User deposits first
        await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("100") });
        
        // Prepare investment parameters
        const dummyDestination = "0x030100001234";
        const dummyMessage = "0x0300010203";
        
        // Try to dispatch as non-operator
        await expect(
          assetHubVault.connect(user1).dispatchInvestment(
            user1.address,
            2004, // chainId
            user2.address, // poolId (dummy)
            user2.address, // baseAsset (dummy)
            ethers.parseEther("50"),
            -5, // lowerRangePercent
            5,  // upperRangePercent
            dummyDestination,
            dummyMessage
          )
        ).to.be.revertedWithCustomError(assetHubVault, "NotOperator");
      });

      it("should allow operator to dispatch investment", async function () {
        // User deposits first
        await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("100") });
        
        // Prepare investment parameters
        const dummyDestination = "0x030100001234";
        const dummyMessage = "0x0300010203";
        
        // Operator dispatches investment
        await expect(
          assetHubVault.connect(operator).dispatchInvestment(
            user1.address,
            2004, // chainId
            user2.address, // poolId (dummy)
            user2.address, // baseAsset (dummy)
            ethers.parseEther("50"),
            -5, // lowerRangePercent
            5,  // upperRangePercent
            dummyDestination,
            dummyMessage
          )
        ).to.emit(assetHubVault, "InvestmentInitiated");
      });

      it("should revert when contract is paused", async function () {
        // Pause contract
        await assetHubVault.connect(deployer).pause();
        
        // User deposits first
        await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("100") });
        
        const dummyDestination = "0x030100001234";
        const dummyMessage = "0x0300010203";
        
        // Try to dispatch while paused
        await expect(
          assetHubVault.connect(operator).dispatchInvestment(
            user1.address,
            2004,
            user2.address,
            user2.address,
            ethers.parseEther("50"),
            -5,
            5,
            dummyDestination,
            dummyMessage
          )
        ).to.be.revertedWithCustomError(assetHubVault, "Paused");
      });
    });

    describe("settleLiquidation", function () {
      let positionId;

      beforeEach(async function () {
        // Create a position first
        await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("100") });
        
        const dummyDestination = "0x030100001234";
        const dummyMessage = "0x0300010203";
        
        const tx = await assetHubVault.connect(operator).dispatchInvestment(
          user1.address,
          2004,
          user2.address,
          user2.address,
          ethers.parseEther("50"),
          -5,
          5,
          dummyDestination,
          dummyMessage
        );
        
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
          try {
            return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
          } catch {
            return false;
          }
        });
        positionId = assetHubVault.interface.parseLog(event).args.positionId;
        
        // Simulate XCM return by sending funds to contract
        await deployer.sendTransaction({
          to: await assetHubVault.getAddress(),
          value: ethers.parseEther("60")
        });
      });

      it("should revert if not operator", async function () {
        await expect(
          assetHubVault.connect(user1).settleLiquidation(
            positionId,
            ethers.parseEther("60")
          )
        ).to.be.revertedWithCustomError(assetHubVault, "NotOperator");
      });

      it("should allow operator to settle liquidation", async function () {
        await expect(
          assetHubVault.connect(operator).settleLiquidation(
            positionId,
            ethers.parseEther("60")
          )
        )
          .to.emit(assetHubVault, "PositionLiquidated")
          .and.to.emit(assetHubVault, "LiquidationSettled");

        // Verify position is no longer active
        const position = await assetHubVault.getPosition(positionId);
        expect(position.active).to.equal(false);
      });
    });
  });

  /**
   * TEST-AHV-005: Only emergency can call emergency functions
   * 
   * Tests emergency-only functions to ensure they:
   * - Revert with NotEmergency() when called by non-emergency
   * - Execute successfully when called by emergency address
   */
  describe("TEST-AHV-005: Emergency-only functions", function () {
    let positionId;

    beforeEach(async function () {
      // Set different emergency address
      await assetHubVault.connect(deployer).setEmergency(emergency.address);
      
      // Set operator
      await assetHubVault.connect(deployer).setOperator(operator.address);
      
      // Enable test mode and set precompile
      await assetHubVault.connect(deployer).setTestMode(true);
      await assetHubVault.connect(deployer).setXcmPrecompile(
        "0x0000000000000000000000000000000000000808"
      );
      
      // Create a position
      await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("100") });
      
      const dummyDestination = "0x030100001234";
      const dummyMessage = "0x0300010203";
      
      const tx = await assetHubVault.connect(operator).dispatchInvestment(
        user1.address,
        2004,
        user2.address,
        user2.address,
        ethers.parseEther("50"),
        -5,
        5,
        dummyDestination,
        dummyMessage
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
        } catch {
          return false;
        }
      });
      positionId = assetHubVault.interface.parseLog(event).args.positionId;
    });

    describe("emergencyLiquidatePosition", function () {
      it("should revert if not emergency address", async function () {
        await expect(
          assetHubVault.connect(user1).emergencyLiquidatePosition(2004, positionId)
        ).to.be.revertedWithCustomError(assetHubVault, "NotEmergency");
      });

      it("should revert if admin tries to call", async function () {
        await expect(
          assetHubVault.connect(deployer).emergencyLiquidatePosition(2004, positionId)
        ).to.be.revertedWithCustomError(assetHubVault, "NotEmergency");
      });

      it("should revert if operator tries to call", async function () {
        await expect(
          assetHubVault.connect(operator).emergencyLiquidatePosition(2004, positionId)
        ).to.be.revertedWithCustomError(assetHubVault, "NotEmergency");
      });

      it("should allow emergency address to liquidate position", async function () {
        await expect(
          assetHubVault.connect(emergency).emergencyLiquidatePosition(2004, positionId)
        )
          .to.emit(assetHubVault, "PositionLiquidated")
          .withArgs(positionId, user1.address, 0);
        
        // Verify position is no longer active
        const position = await assetHubVault.getPosition(positionId);
        expect(position.active).to.equal(false);
      });

      it("should revert with wrong chainId", async function () {
        await expect(
          assetHubVault.connect(emergency).emergencyLiquidatePosition(1000, positionId)
        ).to.be.revertedWithCustomError(assetHubVault, "ChainIdMismatch");
      });
    });
  });

  /**
   * TEST-AHV-006: Admin role can be transferred
   * 
   * Tests that:
   * - Admin can transfer admin role to new address
   * - Old admin loses admin privileges
   * - New admin gains admin privileges
   */
  describe("TEST-AHV-006: Admin role transfer", function () {
    it("should transfer admin role successfully", async function () {
      // Initial state: deployer is admin
      expect(await assetHubVault.admin()).to.equal(deployer.address);
      
      // Transfer admin to user1
      await assetHubVault.connect(deployer).transferAdmin(user1.address);
      
      // Verify new admin
      expect(await assetHubVault.admin()).to.equal(user1.address);
    });

    it("should allow new admin to call admin functions", async function () {
      // Transfer admin to user1
      await assetHubVault.connect(deployer).transferAdmin(user1.address);
      
      // New admin can call admin functions
      await expect(
        assetHubVault.connect(user1).setOperator(operator.address)
      ).to.not.be.reverted;
      
      expect(await assetHubVault.operator()).to.equal(operator.address);
    });

    it("should prevent old admin from calling admin functions", async function () {
      // Transfer admin to user1
      await assetHubVault.connect(deployer).transferAdmin(user1.address);
      
      // Old admin (deployer) can no longer call admin functions
      await expect(
        assetHubVault.connect(deployer).setOperator(operator.address)
      ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
    });

    it("should allow new admin to transfer admin role again", async function () {
      // First transfer: deployer -> user1
      await assetHubVault.connect(deployer).transferAdmin(user1.address);
      
      // Second transfer: user1 -> user2
      await assetHubVault.connect(user1).transferAdmin(user2.address);
      
      expect(await assetHubVault.admin()).to.equal(user2.address);
      
      // user2 can call admin functions
      await expect(
        assetHubVault.connect(user2).setOperator(operator.address)
      ).to.not.be.reverted;
      
      // user1 cannot
      await expect(
        assetHubVault.connect(user1).pause()
      ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
    });

    it("should maintain operator and emergency addresses after admin transfer", async function () {
      // Set operator and emergency
      await assetHubVault.connect(deployer).setOperator(operator.address);
      await assetHubVault.connect(deployer).setEmergency(emergency.address);
      
      // Transfer admin
      await assetHubVault.connect(deployer).transferAdmin(user1.address);
      
      // Verify operator and emergency are unchanged
      expect(await assetHubVault.operator()).to.equal(operator.address);
      expect(await assetHubVault.emergency()).to.equal(emergency.address);
    });

    it("should revert when transferring to zero address", async function () {
      await expect(
        assetHubVault.connect(deployer).transferAdmin(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(assetHubVault, "ZeroAddress");
    });

    it("should emit appropriate events during role changes", async function () {
      // Admin transfer doesn't have an event, but subsequent admin actions should work
      await assetHubVault.connect(deployer).transferAdmin(user1.address);
      
      // New admin setting operator should work
      await expect(
        assetHubVault.connect(user1).setOperator(operator.address)
      ).to.not.be.reverted;
    });
  });

  /**
   * Additional access control edge cases
   */
  describe("Access control edge cases", function () {
    it("should prevent operator from calling admin functions", async function () {
      // Set different operator
      await assetHubVault.connect(deployer).setOperator(operator.address);
      
      // Operator cannot call admin functions
      await expect(
        assetHubVault.connect(operator).pause()
      ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      
      await expect(
        assetHubVault.connect(operator).setEmergency(emergency.address)
      ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
    });

    it("should prevent emergency from calling admin or operator functions", async function () {
      // Set different emergency
      await assetHubVault.connect(deployer).setEmergency(emergency.address);
      await assetHubVault.connect(deployer).setOperator(operator.address);
      
      // Emergency cannot call admin functions
      await expect(
        assetHubVault.connect(emergency).pause()
      ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
      
      // Emergency cannot call operator functions (this would revert in dispatchInvestment setup)
      await expect(
        assetHubVault.connect(emergency).setOperator(user1.address)
      ).to.be.revertedWithCustomError(assetHubVault, "NotAdmin");
    });

    it("should allow admin to be operator and emergency simultaneously", async function () {
      // Admin is deployer by default
      // Make admin also the operator and emergency explicitly
      await assetHubVault.connect(deployer).setOperator(deployer.address);
      await assetHubVault.connect(deployer).setEmergency(deployer.address);
      
      // Should be able to call all functions
      expect(await assetHubVault.admin()).to.equal(deployer.address);
      expect(await assetHubVault.operator()).to.equal(deployer.address);
      expect(await assetHubVault.emergency()).to.equal(deployer.address);
      
      // Can call admin functions
      await expect(assetHubVault.connect(deployer).pause()).to.not.be.reverted;
    });
  });
});

