const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Full-qualified artifact names to load real Algebra contracts from node_modules
const ART = {
  PoolDeployer: "@cryptoalgebra/integral-core/contracts/AlgebraPoolDeployer.sol:AlgebraPoolDeployer",
  Factory: "@cryptoalgebra/integral-core/contracts/AlgebraFactory.sol:AlgebraFactory",
  Router: "@cryptoalgebra/integral-periphery/contracts/SwapRouter.sol:SwapRouter",
  Quoter: "@cryptoalgebra/integral-periphery/contracts/Quoter.sol:Quoter",
  NFPM: "@cryptoalgebra/integral-periphery/contracts/NonfungiblePositionManager.sol:NonfungiblePositionManager",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`Deploying Algebra suite on ${network.name}(${network.chainId}) as ${deployer.address}`);

  // Deploy core
  const PoolDeployer = await ethers.getContractFactory(ART.PoolDeployer);
  const poolDeployer = await PoolDeployer.deploy();
  await poolDeployer.waitForDeployment();
  console.log("PoolDeployer:", await poolDeployer.getAddress());

  const Factory = await ethers.getContractFactory(ART.Factory);
  // constructor(address _poolDeployer, address _communityVault)
  const factory = await Factory.deploy(await poolDeployer.getAddress(), deployer.address);
  await factory.waitForDeployment();
  console.log("Factory:", await factory.getAddress());

  // Periphery
  const Router = await ethers.getContractFactory(ART.Router);
  // constructor(address _factory, address _WNative)
  const router = await Router.deploy(await factory.getAddress(), ethers.ZeroAddress);
  await router.waitForDeployment();
  console.log("Router:", await router.getAddress());

  const Quoter = await ethers.getContractFactory(ART.Quoter);
  const quoter = await Quoter.deploy(await factory.getAddress());
  await quoter.waitForDeployment();
  console.log("Quoter:", await quoter.getAddress());

  const NFPM = await ethers.getContractFactory(ART.NFPM);
  // constructor(address _factory, address _WNativeToken)
  const nfpm = await NFPM.deploy(await factory.getAddress(), ethers.ZeroAddress);
  await nfpm.waitForDeployment();
  console.log("NFPM:", await nfpm.getAddress());

  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outfile = path.join(outDir, `${ethers.provider.network.name}_algebra.json`);
  fs.writeFileSync(
    outfile,
    JSON.stringify(
      {
        chainId: Number(network.chainId),
        deployer: deployer.address,
        poolDeployer: await poolDeployer.getAddress(),
        factory: await factory.getAddress(),
        router: await router.getAddress(),
        quoter: await quoter.getAddress(),
        nfpm: await nfpm.getAddress(),
      },
      null,
      2
    )
  );
  console.log("Saved:", outfile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

