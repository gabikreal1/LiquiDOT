const { ethers } = require("hardhat");

async function main() {
    const SimpleTest = await ethers.getContractFactory("SimpleTest");
    console.log("Deploying SimpleTest...");
    const simple = await SimpleTest.deploy();
    await simple.waitForDeployment();
    console.log("SimpleTest deployed to:", await simple.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });