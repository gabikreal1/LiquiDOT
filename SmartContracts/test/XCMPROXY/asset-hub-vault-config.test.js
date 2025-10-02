const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault configuration script", function () {
  it("applies role updates and freezes XCM precompile", async function () {
    const [deployer, admin, operator, emergency] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    const vault = await Vault.deploy();
    await vault.waitForDeployment();

    await vault.connect(deployer).transferAdmin(admin.address);
    await vault.connect(admin).setOperator(operator.address);
    await vault.connect(admin).setEmergency(emergency.address);
    await vault.connect(admin).setXcmPrecompile(admin.address);
    await vault.connect(admin).freezeXcmPrecompile();

    expect(await vault.admin()).to.equal(admin.address);
    expect(await vault.operator()).to.equal(operator.address);
    expect(await vault.emergency()).to.equal(emergency.address);
    expect(await vault.XCM_PRECOMPILE()).to.equal(admin.address);
    expect(await vault.xcmPrecompileFrozen()).to.equal(true);
  });
});


