/**
 * XCMProxy Testnet Asset Reception Tests
 *
 * Exercises receiveAssets against a Moonbase deployment bootstrapped via
 * scripts/bootstrap-moonbase-infra.js. Addresses are sourced from
 * deployments/moonbase_bootstrap.json through testnet/config.js.
 *
 * Usage:
 *   npx hardhat test test/XCMProxy/testnet/2.receive-assets.test.js --network moonbase
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getMoonbaseTestConfig } = require("./config");

describe("XCMProxy Testnet - Receive Assets", function () {
	let proxy;
	let operator;

	const moonbase = getMoonbaseTestConfig();
	const PROXY_ADDRESS = moonbase.proxyAddress;
	const SUPPORTED_TOKEN = moonbase.baseToken;
	const TEST_POOL_ID = moonbase.poolAddress || ethers.ZeroAddress;

	before(async function () {
		if (!SUPPORTED_TOKEN) {
			throw new Error(
				"MOONBASE_BASE_TOKEN not set. Run scripts/bootstrap-moonbase-infra.js or export MOONBASE_BASE_TOKEN manually."
			);
		}

		[operator] = await ethers.getSigners();

		const XCMProxy = await ethers.getContractFactory(
			"contracts/V1(Current)/XCMProxy.sol:XCMProxy"
		);
		proxy = XCMProxy.attach(PROXY_ADDRESS);

		const contractOwner = await proxy.owner();
		const testMode = await proxy.testMode();

		if (!testMode) {
			if (contractOwner.toLowerCase() === operator.address.toLowerCase()) {
				console.log("\n⚠️  Test mode disabled - enabling for test run...");
				const tx = await proxy.setTestMode(true);
				await tx.wait();
				console.log("   ✅ Test mode enabled\n");
			} else {
				throw new Error("Test mode must be enabled (setTestMode(true)) before running receive-assets tests");
			}
		}

		console.log(`\n✅ Connected to XCMProxy at: ${PROXY_ADDRESS}`);
		console.log(`✅ Network: ${network.name}`);
		console.log(`✅ Operator: ${operator.address}`);
		console.log(`✅ Supported Token: ${SUPPORTED_TOKEN}`);
		if (TEST_POOL_ID && TEST_POOL_ID !== ethers.ZeroAddress) {
			console.log(`✅ Pool ID: ${TEST_POOL_ID}`);
		}
		console.log();
	});

	describe("Asset Reception - Basic Flow", function () {
		it("should receive assets and create pending position", async function () {
			const assetHubPositionId = ethers.keccak256(
				ethers.toUtf8Bytes(`test-pos-${Date.now()}`)
			);

			const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
				["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
				[
					TEST_POOL_ID,
					SUPPORTED_TOKEN,
					[ethers.parseEther("0.5"), ethers.parseEther("0.5")],
					-50,
					50,
					operator.address,
					100
				]
			);

			const amount = ethers.parseEther("1.0");

			const tx = await proxy.receiveAssets(
				assetHubPositionId,
				SUPPORTED_TOKEN,
				operator.address,
				amount,
				investmentParams
			);

			const receipt = await tx.wait();
			const assetsReceivedEvent = receipt.logs.find((log) => {
				try {
					const parsed = proxy.interface.parseLog(log);
					return parsed && parsed.name === "AssetsReceived";
				} catch {
					return false;
				}
			});

			const pendingCreatedEvent = receipt.logs.find((log) => {
				try {
					const parsed = proxy.interface.parseLog(log);
					return parsed && parsed.name === "PendingPositionCreated";
				} catch {
					return false;
				}
			});

			expect(assetsReceivedEvent).to.not.be.undefined;
			expect(pendingCreatedEvent).to.not.be.undefined;

			const pendingPosition = await proxy.pendingPositions(assetHubPositionId);
			expect(pendingPosition.exists).to.be.true;
			expect(pendingPosition.token.toLowerCase()).to.equal(SUPPORTED_TOKEN.toLowerCase());
			expect(pendingPosition.user).to.equal(operator.address);
			expect(pendingPosition.amount).to.equal(amount);
			expect(pendingPosition.poolId.toLowerCase()).to.equal(TEST_POOL_ID.toLowerCase());
		});

		it("should reject unsupported tokens", async function () {
			const assetHubPositionId = ethers.keccak256(
				ethers.toUtf8Bytes(`test-pos-unsupported-${Date.now()}`)
			);

			const UNSUPPORTED_TOKEN = "0x0000000000000000000000000000000000000001";

			const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
				["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
				[TEST_POOL_ID, SUPPORTED_TOKEN, [], -50, 50, operator.address, 100]
			);

			await expect(
				proxy.receiveAssets(
					assetHubPositionId,
					UNSUPPORTED_TOKEN,
					operator.address,
					ethers.parseEther("1.0"),
					investmentParams
				)
			).to.be.revertedWith("Token not supported");
		});

		it("should reject zero amount", async function () {
			const assetHubPositionId = ethers.keccak256(
				ethers.toUtf8Bytes(`test-pos-zero-${Date.now()}`)
			);

			const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
				["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
				[TEST_POOL_ID, SUPPORTED_TOKEN, [], -50, 50, operator.address, 100]
			);

			await expect(
				proxy.receiveAssets(
					assetHubPositionId,
					SUPPORTED_TOKEN,
					operator.address,
					0,
					investmentParams
				)
			).to.be.revertedWith("Amount must be greater than 0");
		});

		it("should reject zero user address", async function () {
			const assetHubPositionId = ethers.keccak256(
				ethers.toUtf8Bytes(`test-pos-zeroaddr-${Date.now()}`)
			);

			const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
				["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
				[TEST_POOL_ID, SUPPORTED_TOKEN, [], -50, 50, operator.address, 100]
			);

			await expect(
				proxy.receiveAssets(
					assetHubPositionId,
					SUPPORTED_TOKEN,
					ethers.ZeroAddress,
					ethers.parseEther("1.0"),
					investmentParams
				)
			).to.be.revertedWith("Invalid user address");
		});

		it("should reject duplicate position IDs", async function () {
			const assetHubPositionId = ethers.keccak256(
				ethers.toUtf8Bytes(`test-pos-duplicate-${Date.now()}`)
			);

			const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
				["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
				[TEST_POOL_ID, SUPPORTED_TOKEN, [], -50, 50, operator.address, 100]
			);

			const tx1 = await proxy.receiveAssets(
				assetHubPositionId,
				SUPPORTED_TOKEN,
				operator.address,
				ethers.parseEther("1.0"),
				investmentParams
			);
			await tx1.wait();

			await expect(
				proxy.receiveAssets(
					assetHubPositionId,
					SUPPORTED_TOKEN,
					operator.address,
					ethers.parseEther("1.0"),
					investmentParams
				)
			).to.be.revertedWith("Position already pending");
		});
	});

	describe("Pending Position Management", function () {
		it("should store all investment parameters correctly", async function () {
			const assetHubPositionId = ethers.keccak256(
				ethers.toUtf8Bytes(`test-pos-params-${Date.now()}`)
			);

			const amounts = [ethers.parseEther("0.6"), ethers.parseEther("0.4")];
			const lowerRange = -100;
			const upperRange = 200;
			const slippage = 150;

			const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
				["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
				[TEST_POOL_ID, SUPPORTED_TOKEN, amounts, lowerRange, upperRange, operator.address, slippage]
			);

			const tx = await proxy.receiveAssets(
				assetHubPositionId,
				SUPPORTED_TOKEN,
				operator.address,
				ethers.parseEther("1.0"),
				investmentParams
			);
			await tx.wait();

			const pending = await proxy.pendingPositions(assetHubPositionId);
			expect(pending.exists).to.be.true;
			expect(pending.lowerRangePercent).to.equal(lowerRange);
			expect(pending.upperRangePercent).to.equal(upperRange);
			expect(pending.slippageBps).to.equal(slippage);
			expect(pending.baseAsset.toLowerCase()).to.equal(SUPPORTED_TOKEN.toLowerCase());
			expect(pending.poolId.toLowerCase()).to.equal(TEST_POOL_ID.toLowerCase());
		});
	});

	describe("XCM Caller Authorization (Test Mode)", function () {
		it("should allow calls in test mode regardless of caller", async function () {
			const assetHubPositionId = ethers.keccak256(
				ethers.toUtf8Bytes(`test-pos-testmode-${Date.now()}`)
			);

			const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
				["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
				[TEST_POOL_ID, SUPPORTED_TOKEN, [], -50, 50, operator.address, 100]
			);

			const tx = await proxy.receiveAssets(
				assetHubPositionId,
				SUPPORTED_TOKEN,
				operator.address,
				ethers.parseEther("1.0"),
				investmentParams
			);
			const receipt = await tx.wait();

			expect(receipt.status).to.equal(1);
		});
	});
});

