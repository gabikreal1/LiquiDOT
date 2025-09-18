import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import hre from "hardhat";
const { ethers } = hre;

// Artifact names with full path to ensure Hardhat loads node_modules contracts
const AlgebraPoolDeployerArtifact = "@cryptoalgebra/integral-core/contracts/AlgebraPoolDeployer.sol:AlgebraPoolDeployer";
const AlgebraFactoryArtifact = "@cryptoalgebra/integral-core/contracts/AlgebraFactory.sol:AlgebraFactory";
const SwapRouterArtifact = "@cryptoalgebra/integral-periphery/contracts/SwapRouter.sol:SwapRouter";
const NonfungiblePositionManagerArtifact = "@cryptoalgebra/integral-periphery/contracts/NonfungiblePositionManager.sol:NonfungiblePositionManager";
const QuoterArtifact = "@cryptoalgebra/integral-periphery/contracts/Quoter.sol:Quoter";

describe("Deploy Algebra suite and XCMProxy", function () {
  it("deploys Algebra core + periphery and wires XCMProxy", async function () {
    const [deployer] = await ethers.getSigners();

    // Deploy Algebra core
    const PoolDeployerFactory = await ethers.getContractFactory(AlgebraPoolDeployerArtifact);
    const poolDeployer = await PoolDeployerFactory.deploy();
    await poolDeployer.waitForDeployment();

    const FactoryFactory = await ethers.getContractFactory(AlgebraFactoryArtifact);
    const algebraFactory = await FactoryFactory.deploy(await poolDeployer.getAddress(), deployer.address);
    await algebraFactory.waitForDeployment();

    // Deploy periphery
    const RouterFactory = await ethers.getContractFactory(SwapRouterArtifact);
    const router = await RouterFactory.deploy(await algebraFactory.getAddress(), ethers.ZeroAddress);
    await router.waitForDeployment();

    const QuoterFactory = await ethers.getContractFactory(QuoterArtifact);
    const quoter = await QuoterFactory.deploy(await algebraFactory.getAddress());
    await quoter.waitForDeployment();

    const NFPMFactory = await ethers.getContractFactory(NonfungiblePositionManagerArtifact);
    const nfpm = await NFPMFactory.deploy(await algebraFactory.getAddress(), ethers.ZeroAddress);
    await nfpm.waitForDeployment();

    // Deploy our contracts
    const XCMProxyFactory = await ethers.getContractFactory("XCMProxy");
    const proxy = await XCMProxyFactory.deploy(await deployer.getAddress());
    await proxy.waitForDeployment();

    // Wire integrations
    await (await proxy.setIntegrations(await quoter.getAddress(), await router.getAddress())).wait();
    await (await proxy.setNFPM(await nfpm.getAddress())).wait();

    // Basic assertions
    expect(await proxy.nfpmContract()).to.eq(await nfpm.getAddress());
    expect(await proxy.swapRouterContract()).to.eq(await router.getAddress());
    expect(await proxy.quoterContract()).to.eq(await quoter.getAddress());
  });
});


