import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import hre from "hardhat";
const { ethers } = hre;

const AlgebraPoolDeployerArtifact = "@cryptoalgebra/integral-core/contracts/AlgebraPoolDeployer.sol:AlgebraPoolDeployer";
const AlgebraFactoryArtifact = "@cryptoalgebra/integral-core/contracts/AlgebraFactory.sol:AlgebraFactory";
const SwapRouterArtifact = "@cryptoalgebra/integral-periphery/contracts/SwapRouter.sol:SwapRouter";
const NFPMArtifact = "@cryptoalgebra/integral-periphery/contracts/NonfungiblePositionManager.sol:NonfungiblePositionManager";

describe("Liquidate, swap to base, attempt XCM return", function () {
  it("liquidates and emits XcmTransferAttempt", async function () {
    const [deployer] = await ethers.getSigners();

    // Deploy tokens
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const token0 = await TestERC20.deploy("USDC", "USDC", 6, ethers.parseUnits("1000000", 6));
    const token1 = await TestERC20.deploy("USDT", "USDT", 6, ethers.parseUnits("1000000", 6));
    await token0.waitForDeployment();
    await token1.waitForDeployment();

    // Deploy Algebra suite
    const PoolDeployerFactory = await ethers.getContractFactory(AlgebraPoolDeployerArtifact);
    const poolDeployer = await PoolDeployerFactory.deploy();
    await poolDeployer.waitForDeployment();
    const FactoryFactory = await ethers.getContractFactory(AlgebraFactoryArtifact);
    const factory = await FactoryFactory.deploy(await poolDeployer.getAddress(), deployer.address);
    await factory.waitForDeployment();
    const RouterFactory = await ethers.getContractFactory(SwapRouterArtifact);
    const router = await RouterFactory.deploy(await factory.getAddress(), ethers.ZeroAddress);
    await router.waitForDeployment();
    const NFPMFactory = await ethers.getContractFactory(NFPMArtifact);
    const nfpm = await NFPMFactory.deploy(await factory.getAddress(), ethers.ZeroAddress);
    await nfpm.waitForDeployment();

    // Create pool, mint through proxy (reuse from previous test style)
    const t0 = await token0.getAddress();
    const t1 = await token1.getAddress();
    await (await factory.createPool(t0, t1)).wait();
    const poolAddr = await factory.poolByPair(t0, t1);

    const XCMProxy = await ethers.getContractFactory("XCMProxy");
    const proxy = await XCMProxy.deploy(await deployer.getAddress());
    await proxy.waitForDeployment();
    await (await proxy.setIntegrations(ethers.ZeroAddress, await router.getAddress())).wait();
    await (await proxy.setNFPM(await nfpm.getAddress())).wait();
    await (await proxy.addSupportedToken(t0)).wait();
    await (await proxy.addSupportedToken(t1)).wait();

    await (await token0.transfer(await proxy.getAddress(), ethers.parseUnits("5000", 6))).wait();
    await (await token1.transfer(await proxy.getAddress(), ethers.parseUnits("5000", 6))).wait();

    const owner = await deployer.getAddress();
    const lower = -100 as any; const upper = 100 as any; const slipBps = 100;
    const amts = [ethers.parseUnits("100", 6), ethers.parseUnits("100", 6)];
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode([
      "address","address","uint256[]","int24","int24","address","uint16"
    ], [poolAddr, t0, amts, lower, upper, owner, slipBps]);
    await (await proxy.receiveAssets(t0, owner, amts[0], encoded)).wait();

    // Liquidate and return to AssetHub via XCM (recipient=address(0))
    // Set precompile and paraId to pass guards, it will still try/catch and emit attempt
    await (await proxy.setXTokensPrecompile("0x0000000000000000000000000000000000000804")).wait();
    await (await proxy.setAssetHubParaId(1000)).wait();
    await (await proxy.addSupportedToken(t0)).wait();

    const actives = await proxy.getActivePositions();
    const positionId = actives[0].tokenId > 0 ? 1 : 1; // first position

    await expect(
      proxy.liquidateSwapAndReturn(positionId, t0, ethers.ZeroAddress, 0, 0, 0)
    ).to.emit(proxy, "XcmTransferAttempt");
  });
});


