const {ethers} = require("hardhat");

async function main() {
  console.log("Deploying XCMProxy to Moonbeam Mainnet...");

  // Get the contract factory
  const XCMProxy = await ethers.getContractFactory("XCMProxy");

  // For initial deployment, we'll set a placeholder owner that will be updated later
  // This is temporary and will be updated to the Asset Hub contract's address after it's deployed
  const [deployer] = await ethers.getSigners();
  const placeholderOwner = deployer.address;
  console.log(`Using placeholder owner: ${placeholderOwner}`);
  
  // Algebra contract addresses on Moonbeam mainnet
  // Note: These are testnet addresses and need to be replaced with mainnet addresses!
  const QUOTER_ADDRESS = '0xCF6fb88ac742aB896595705816079c360c590DE5';
  const SWAP_ROUTER_ADDRESS = '0xe6d0ED3759709b743707DcfeCAe39BC180C981fe';
  
  console.log(`Using Quoter contract: ${QUOTER_ADDRESS}`);
  console.log(`Using SwapRouter contract: ${SWAP_ROUTER_ADDRESS}`);

  // Deploy the contract with new parameters
  const proxy = await XCMProxy.deploy(placeholderOwner, QUOTER_ADDRESS, SWAP_ROUTER_ADDRESS);
  await proxy.deployed();

  console.log(`XCMProxy deployed to Moonbeam Mainnet at: ${proxy.address}`);
  console.log("IMPORTANT: After deploying AILiquidityProvider to Asset Hub, you'll need to update the owner of this proxy.");
  console.log(`Run this command to save the proxy address to your .env file:`);
  console.log(`echo "MOONBEAM_PROXY_ADDRESS=${proxy.address}" >> .env`);
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 