import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import hre from "hardhat";
const { ethers } = hre;

const AlgebraPoolDeployerArtifact = "@cryptoalgebra/integral-core/contracts/AlgebraPoolDeployer.sol:AlgebraPoolDeployer";
const AlgebraFactoryArtifact = "@cryptoalgebra/integral-core/contracts/AlgebraFactory.sol:AlgebraFactory";
const AlgebraPoolArtifact = "@cryptoalgebra/integral-core/contracts/AlgebraPool.sol:AlgebraPool";

describe("Tokens and Pool setup (real Algebra)", function () {
  it("deploys TestERC20s and creates/initializes an Algebra pool", async function () {
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

    // Create pool
    const t0 = await token0.getAddress();
    const t1 = await token1.getAddress();
    // Token ordering must match factory expectations
    const tx = await factory.createPool(t0, t1);
    const receipt = await tx.wait();
    expect(receipt?.status).to.eq(1);

    // Resolve pool address; Algebra factory usually exposes poolByPair mapping
    const poolAddress = await factory.poolByPair(t0, t1);
    expect(poolAddress).to.properAddress;

    // Initialize price on pool
    const pool = await ethers.getContractAt(AlgebraPoolArtifact, poolAddress);
    const initPrice = BigInt("79228162514264337593543950336"); // ~1.0 in Q64.96
    const initTx = await pool.initialize(initPrice);
    await initTx.wait();

    const global = await pool.globalState();
    // global structure: check tick is set (not critical exact value)
    expect(global[1]).to.be.a("number");
  });
});


