const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying XCMProxy with account:", deployer.address);

    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
    console.log("Deploying...");
    const proxy = await XCMProxy.deploy(deployer.address, { gasLimit: 15000000 });
    await proxy.waitForDeployment();
    console.log("XCMProxy deployed to:", await proxy.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });