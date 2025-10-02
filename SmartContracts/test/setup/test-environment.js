/**
 * Test Environment Setup
 * 
 * This file provides utilities to set up the testing environment with real contracts
 * instead of mocks for more realistic integration testing.
 */

const { ethers } = require("hardhat");

/**
 * Deploy real Algebra Protocol contracts for testing
 * Uses actual Algebra contracts instead of mocks
 */
async function deployAlgebraEnvironment() {
    const [deployer, user1, user2, operator] = await ethers.getSigners();
    
    console.log("Deploying Algebra test environment...");
    
    // Deploy WETH (needed for Algebra)
    const WETH = await ethers.getContractFactory("WETH9");
    const weth = await WETH.deploy();
    await weth.deployed();
    console.log("WETH deployed at:", weth.address);
    
    // Deploy AlgebraFactory
    const AlgebraFactory = await ethers.getContractFactory(
        "AlgebraFactory",
        { libraries: {} }
    );
    const factory = await AlgebraFactory.deploy(deployer.address);
    await factory.deployed();
    console.log("AlgebraFactory deployed at:", factory.address);
    
    // Deploy NonfungiblePositionManager
    const NFPM = await ethers.getContractFactory("NonfungiblePositionManager");
    const nfpm = await NFPM.deploy(factory.address, weth.address, deployer.address);
    await nfpm.deployed();
    console.log("NFPM deployed at:", nfpm.address);
    
    // Deploy SwapRouter
    const SwapRouter = await ethers.getContractFactory("SwapRouter");
    const router = await SwapRouter.deploy(factory.address, weth.address);
    await router.deployed();
    console.log("SwapRouter deployed at:", router.address);
    
    // Deploy Quoter
    const Quoter = await ethers.getContractFactory("Quoter");
    const quoter = await Quoter.deploy(factory.address, weth.address);
    await quoter.deployed();
    console.log("Quoter deployed at:", quoter.address);
    
    return {
        factory,
        nfpm,
        router,
        quoter,
        weth,
        deployer,
        user1,
        user2,
        operator
    };
}

/**
 * Deploy test tokens (real ERC20s with mint capability)
 */
async function deployTestTokens(count = 2) {
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const tokens = [];
    
    for (let i = 0; i < count; i++) {
        const token = await TestERC20.deploy(`Token${i}`, `TKN${i}`);
        await token.deployed();
        tokens.push(token);
        console.log(`Token${i} deployed at:`, token.address);
    }
    
    return tokens;
}

/**
 * Create and initialize an Algebra pool with real contracts
 */
async function createAndInitializePool(factory, token0Address, token1Address) {
    // Ensure token0 < token1 (Algebra requirement)
    let [t0, t1] = token0Address < token1Address 
        ? [token0Address, token1Address]
        : [token1Address, token0Address];
    
    // Create pool
    const tx = await factory.createPool(t0, t1);
    await tx.wait();
    
    // Get pool address
    const poolAddress = await factory.poolByPair(t0, t1);
    const pool = await ethers.getContractAt("IAlgebraPool", poolAddress);
    
    console.log("Pool created at:", poolAddress);
    
    // Initialize pool at 1:1 price (sqrtPriceX96 = sqrt(1) * 2^96)
    const sqrtPriceX96 = ethers.BigNumber.from("79228162514264337593543950336");
    await pool.initialize(sqrtPriceX96);
    
    console.log("Pool initialized with 1:1 price");
    
    return pool;
}

/**
 * Deploy mock XCM precompiles (only precompiles need mocks)
 */
async function deployMockXcmPrecompiles() {
    // Mock XCM precompile for Asset Hub
    const MockXcm = await ethers.getContractFactory("MockXcmPrecompile");
    const mockXcm = await MockXcm.deploy();
    await mockXcm.deployed();
    console.log("MockXcmPrecompile deployed at:", mockXcm.address);
    
    // Mock XTokens precompile for Moonbeam
    const MockXTokens = await ethers.getContractFactory("MockXTokens");
    const mockXTokens = await MockXTokens.deploy();
    await mockXTokens.deployed();
    console.log("MockXTokens deployed at:", mockXTokens.address);
    
    return { mockXcm, mockXTokens };
}

/**
 * Deploy LiquiDOT contracts
 */
async function deployLiquidotContracts() {
    const [deployer, operator] = await ethers.getSigners();
    
    // Deploy AssetHubVault
    const AssetHubVault = await ethers.getContractFactory("AssetHubVault");
    const assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.deployed();
    console.log("AssetHubVault deployed at:", assetHubVault.address);
    
    // Deploy XCMProxy
    const XCMProxy = await ethers.getContractFactory("XCMProxy");
    const xcmProxy = await XCMProxy.deploy(deployer.address);
    await xcmProxy.deployed();
    console.log("XCMProxy deployed at:", xcmProxy.address);
    
    // Set operator
    await assetHubVault.setOperator(operator.address);
    await xcmProxy.setOperator(operator.address);
    
    return { assetHubVault, xcmProxy };
}

/**
 * Complete test environment setup
 * Returns all contracts needed for integration testing
 */
async function setupTestEnvironment() {
    console.log("\n=== Setting up complete test environment ===\n");
    
    // 1. Deploy Algebra environment (real contracts)
    const algebraEnv = await deployAlgebraEnvironment();
    
    // 2. Deploy test tokens
    const tokens = await deployTestTokens(2);
    const [token0, token1] = tokens;
    
    // 3. Create and initialize pool
    const pool = await createAndInitializePool(
        algebraEnv.factory,
        token0.address,
        token1.address
    );
    
    // 4. Deploy mock XCM precompiles
    const { mockXcm, mockXTokens } = await deployMockXcmPrecompiles();
    
    // 5. Deploy LiquiDOT contracts
    const { assetHubVault, xcmProxy } = await deployLiquidotContracts();
    
    // 6. Configure contracts
    await assetHubVault.setXcmPrecompile(mockXcm.address);
    await assetHubVault.setTestMode(true);
    
    await xcmProxy.setIntegrations(algebraEnv.quoter.address, algebraEnv.router.address);
    await xcmProxy.setNFPM(algebraEnv.nfpm.address);
    await xcmProxy.addSupportedToken(token0.address);
    await xcmProxy.addSupportedToken(token1.address);
    await xcmProxy.setXTokensPrecompile(mockXTokens.address);
    await xcmProxy.setTestMode(true);
    
    console.log("\n=== Test environment ready ===\n");
    
    return {
        // LiquiDOT contracts
        assetHubVault,
        xcmProxy,
        
        // Algebra contracts (real)
        factory: algebraEnv.factory,
        nfpm: algebraEnv.nfpm,
        router: algebraEnv.router,
        quoter: algebraEnv.quoter,
        pool,
        
        // Tokens
        token0,
        token1,
        weth: algebraEnv.weth,
        
        // Mock precompiles
        mockXcm,
        mockXTokens,
        
        // Signers
        deployer: algebraEnv.deployer,
        user1: algebraEnv.user1,
        user2: algebraEnv.user2,
        operator: algebraEnv.operator
    };
}

/**
 * Helper: Mint tokens to an address
 */
async function mintTokens(token, to, amount) {
    await token.mint(to, amount);
}

/**
 * Helper: Approve tokens for spending
 */
async function approveTokens(token, owner, spender, amount) {
    await token.connect(owner).approve(spender, amount);
}

/**
 * Helper: Add liquidity to pool (for testing swaps)
 */
async function addLiquidityToPool(pool, nfpm, token0, token1, deployer, amount) {
    const amount0 = ethers.utils.parseEther(amount.toString());
    const amount1 = ethers.utils.parseEther(amount.toString());
    
    // Mint tokens
    await token0.mint(deployer.address, amount0);
    await token1.mint(deployer.address, amount1);
    
    // Approve NFPM
    await token0.connect(deployer).approve(nfpm.address, amount0);
    await token1.connect(deployer).approve(nfpm.address, amount1);
    
    // Mint position
    const tx = await nfpm.connect(deployer).mint({
        token0: token0.address,
        token1: token1.address,
        tickLower: -887220,
        tickUpper: 887220,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: 0,
        amount1Min: 0,
        recipient: deployer.address,
        deadline: Math.floor(Date.now() / 1000) + 3600
    });
    
    await tx.wait();
    console.log("Liquidity added to pool");
}

module.exports = {
    deployAlgebraEnvironment,
    deployTestTokens,
    createAndInitializePool,
    deployMockXcmPrecompiles,
    deployLiquidotContracts,
    setupTestEnvironment,
    mintTokens,
    approveTokens,
    addLiquidityToPool
};

