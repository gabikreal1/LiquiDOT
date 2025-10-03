// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/V1(Current)/AssetHubVault.sol";
import "../../../contracts/V1(Current)/XCMProxy.sol";

/**
 * @title TestSetup
 * @notice Base test contract with common setup and utilities for Foundry tests
 */
contract TestSetup is Test {
    // Test accounts
    address public deployer;
    address public admin;
    address public operator;
    address public emergency;
    address public user1;
    address public user2;
    address public user3;

    // Constants
    uint256 public constant INITIAL_BALANCE = 100 ether;
    uint256 public constant CHAIN_ID = 2004; // Moonbeam parachain ID
    address public constant POOL_ID = address(0x1234567890123456789012345678901234567890);
    address public constant BASE_ASSET = address(0); // Native token

    /**
     * @notice Set up test accounts with initial balances
     */
    function setupAccounts() internal {
        deployer = makeAddr("deployer");
        admin = makeAddr("admin");
        operator = makeAddr("operator");
        emergency = makeAddr("emergency");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");

        // Fund accounts
        vm.deal(deployer, INITIAL_BALANCE);
        vm.deal(admin, INITIAL_BALANCE);
        vm.deal(operator, INITIAL_BALANCE);
        vm.deal(emergency, INITIAL_BALANCE);
        vm.deal(user1, INITIAL_BALANCE);
        vm.deal(user2, INITIAL_BALANCE);
        vm.deal(user3, INITIAL_BALANCE);
    }

    /**
     * @notice Deploy AssetHubVault contract
     */
    function deployVault() internal returns (AssetHubVault) {
        vm.startPrank(deployer);
        AssetHubVault vault = new AssetHubVault();
        vm.stopPrank();
        return vault;
    }

    /**
     * @notice Deploy and configure AssetHubVault with roles
     */
    function deployAndConfigureVault() internal returns (AssetHubVault) {
        vm.startPrank(deployer);
        AssetHubVault vault = new AssetHubVault();
        
        // Set roles
        vault.setOperator(operator);
        vault.setEmergency(emergency);
        vault.setTestMode(true); // Enable test mode to skip XCM send
        
        vm.stopPrank();
        return vault;
    }

    /**
     * @notice Deploy XCMProxy contract (mock addresses for testing)
     */
    function deployProxy() internal returns (XCMProxy) {
        address mockQuoter = makeAddr("mockQuoter");
        address mockRouter = makeAddr("mockRouter");
        
        vm.startPrank(deployer);
        XCMProxy proxy = new XCMProxy(mockQuoter, mockRouter);
        vm.stopPrank();
        return proxy;
    }

    /**
     * @notice Deploy and configure XCMProxy with roles
     */
    function deployAndConfigureProxy() internal returns (XCMProxy) {
        address mockQuoter = makeAddr("mockQuoter");
        address mockRouter = makeAddr("mockRouter");
        address mockNFPM = makeAddr("mockNFPM");
        
        vm.startPrank(deployer);
        XCMProxy proxy = new XCMProxy(mockQuoter, mockRouter);
        
        // Set roles and configuration
        proxy.setOperator(operator);
        proxy.setNFPM(mockNFPM);
        proxy.setTestMode(true);
        
        vm.stopPrank();
        return proxy;
    }

    /**
     * @notice Helper to generate minimal valid SCALE-encoded destination
     */
    function generateDestination() internal pure returns (bytes memory) {
        return hex"030100001234"; // Minimal valid SCALE bytes
    }

    /**
     * @notice Helper to generate minimal valid XCM message
     */
    function generateXCMMessage() internal pure returns (bytes memory) {
        return hex"0300010203"; // Minimal valid SCALE bytes
    }

    /**
     * @notice Helper to create a position ID
     */
    function createPositionId(address user, uint256 timestamp) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(user, timestamp, block.timestamp));
    }

    /**
     * @notice Assert balance equals expected value
     */
    function assertBalance(address account, uint256 expected) internal {
        assertEq(account.balance, expected, "Balance mismatch");
    }

    /**
     * @notice Assert contract balance equals expected value
     */
    function assertContractBalance(address contractAddr, uint256 expected) internal {
        assertEq(contractAddr.balance, expected, "Contract balance mismatch");
    }
}

