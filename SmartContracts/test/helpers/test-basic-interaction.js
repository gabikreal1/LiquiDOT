const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Testing Basic Contract Interactions on Moonbase...");

    // Connect to Moonbase
    const provider = new ethers.JsonRpcProvider("https://rpc.api.moonbase.moonbeam.network");

    // XCMProxy contract address from deployment
    const XCMPROXY_ADDRESS = "0x286839fc38DBF9E82DC910a8d422200946EB6673";

    // Get the contract
    const xcmProxy = await ethers.getContractAt("XCMProxy", XCMPROXY_ADDRESS, provider);

    console.log(`✅ Connected to XCMProxy at: ${XCMPROXY_ADDRESS}`);

    // Test basic view functions (should work without permissions)
    try {
        const owner = await xcmProxy.owner();
        console.log(`👑 Owner: ${owner}`);

        const operator = await xcmProxy.operator();
        console.log(`🔧 Operator: ${operator}`);

        const quoter = await xcmProxy.quoterContract();
        console.log(`📊 Quoter: ${quoter}`);

        const router = await xcmProxy.routerContract();
        console.log(`🔄 Router: ${router}`);

        const nfpm = await xcmProxy.nfpmContract();
        console.log(`🏦 NFPM: ${nfpm}`);

        const paused = await xcmProxy.paused();
        console.log(`⏸️  Paused: ${paused}`);

        console.log("✅ Basic configuration verified!");

    } catch (error) {
        console.error("❌ Error reading contract:", error);
    }
}

main().catch(console.error);


