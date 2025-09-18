import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import hre from "hardhat";
const { ethers } = hre;


const AlgebraPoolDeployerArtifact = "@cryptoalgebra/integral-core/contracts/AlgebraPoolDeployer.sol:AlgebraPoolDeployer";
const AlgebraFactoryArtifact = "@cryptoalgebra/integral-core/contracts/AlgebraFactory.sol:AlgebraFactory";
const NFPMArtifact = "@cryptoalgebra/integral-periphery/contracts/NonfungiblePositionManager.sol:NonfungiblePositionManager";

describe("XCMProxy.receiveAssets → NFPM mint (real)", function () {
  it("mints a position using NFPM with slippage mins", async function () {
    const [deployer] = await ethers.getSigners();

    // Deploy tokens
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const token0 = await TestERC20.deploy("USDC", "USDC", 6, ethers.parseUnits("1000000", 6));
    const token1 = await TestERC20.deploy("USDT", "USDT", 6, ethers.parseUnits("1000000", 6));
    await token0.waitForDeployment();
    await token1.waitForDeployment();

    // Deploy Algebra core
    const PoolDeployerFactory = await ethers.getContractFactory(AlgebraPoolDeployerArtifact);
    const poolDeployer = await PoolDeployerFactory.deploy();
    await poolDeployer.waitForDeployment();

    const FactoryFactory = await ethers.getContractFactory(AlgebraFactoryArtifact);
    const factory = await FactoryFactory.deploy(await poolDeployer.getAddress(), deployer.address);
    await factory.waitForDeployment();

    // NFPM depends on factory
    const NFPMFactory = await ethers.getContractFactory(NFPMArtifact);
    const nfpm = await NFPMFactory.deploy(await factory.getAddress(), ethers.ZeroAddress);
    await nfpm.waitForDeployment();

    // Create pool and init
    const t0 = await token0.getAddress();
    const t1 = await token1.getAddress();
    await (await factory.createPool(t0, t1)).wait();
    const poolAddr = await factory.poolByPair(t0, t1);

    // Deploy XCMProxy and wire
    const XCMProxy = await ethers.getContractFactory("XCMProxy");
    const proxy = await XCMProxy.deploy(await deployer.getAddress());
    await proxy.waitForDeployment();
    await (await proxy.setNFPM(await nfpm.getAddress())).wait();
    await (await proxy.addSupportedToken(t0)).wait();
    await (await proxy.addSupportedToken(t1)).wait();

    // Fund proxy with tokens used for mint
    await (await token0.transfer(await proxy.getAddress(), ethers.parseUnits("10000", 6))).wait();
    await (await token1.transfer(await proxy.getAddress(), ethers.parseUnits("10000", 6))).wait();

    // Build investment params (V2)
    const lower = -100 as any; // -1%
    const upper = 100 as any;  // +1%
    const positionOwner = await deployer.getAddress();
    const slipBps = 100; // 1%
    const amounts = [ethers.parseUnits("100", 6), ethers.parseUnits("100", 6)];

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "address", "address", "uint256[]", "int24", "int24", "address", "uint16"
      ],
      [
        poolAddr, t0, amounts, lower, upper, positionOwner, slipBps
      ]
    );

    // Simulate receiveAssets as if from XCM
    await expect(
      proxy.receiveAssets(t0, positionOwner, amounts[0], encoded)
    ).to.emit(proxy, "PositionCreated");

    const actives = await proxy.getActivePositions();
    expect(actives.length).to.eq(1);
  });
});


