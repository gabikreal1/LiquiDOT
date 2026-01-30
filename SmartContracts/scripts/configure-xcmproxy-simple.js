const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Configuring XCMProxy with account:", deployer.address);

    const bootstrapPath = path.join(__dirname, "../deployments/moonbase_bootstrap.json");
    const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, "utf8"));

    const PROXY_ADDRESS = bootstrap.xcmProxy.address;
    const ALGEBRA = bootstrap.algebra;
    const TOKENS = bootstrap.tokens;

    console.log("Proxy Address:", PROXY_ADDRESS);

    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
    const proxy = XCMProxy.attach(PROXY_ADDRESS);

    // 1. Set DEX Integrations
    console.log("Setting DEX integrations...");
    await (await proxy.setNFPM(ALGEBRA.nfpm)).wait();
    await (await proxy.setIntegrations(ALGEBRA.quoter, ALGEBRA.router)).wait();
    console.log("✓ DEX integrations set");

    // 2. Set XCM Config
    console.log("Setting XCM config...");
    // Precompiles on Moonbeam
    const XTOKENS = "0x0000000000000000000000000000000000000804";
    const XCM_TRANSACTOR = "0x0000000000000000000000000000000000000806";
    
    await (await proxy.setXTokensPrecompile(XTOKENS)).wait();
    await (await proxy.setXcmTransactorPrecompile(XCM_TRANSACTOR)).wait();
    await (await proxy.setAssetHubParaId(bootstrap.xcmProxy.assetHubParaId)).wait();
    await (await proxy.setDefaultDestWeight(bootstrap.xcmProxy.defaultDestWeight)).wait();
    console.log("✓ XCM config set");

    // 3. Add Supported Tokens
    console.log("Adding supported tokens...");
    for (const token of TOKENS) {
        const isSupported = await proxy.supportedTokens(token.address);
        if (!isSupported) {
            await (await proxy.addSupportedToken(token.address)).wait();
            console.log(`✓ Added ${token.symbol}: ${token.address}`);
        } else {
            console.log(`- ${token.symbol} already supported`);
        }
    }

    // 4. Set Test Mode
    console.log("Setting test mode...");
    await (await proxy.setTestMode(true)).wait();
    console.log("✓ Test mode enabled");

    console.log("Configuration complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
