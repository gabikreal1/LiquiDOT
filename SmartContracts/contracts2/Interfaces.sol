// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

/**
 * @title IXCMTransactor
 * @dev Interface for the XCM Transactor precompile on Polkadot
 */
interface IXCMTransactor {
    function transactThroughDerivative(
        uint32 destination,
        uint16 feeLocation,
        uint64 transactRequiredWeightAtMost,
        bytes memory call,
        uint256 feeAmount,
        uint64 overallWeight
    ) external;
}

/**
 * @title AssetTransferInterface
 * @dev Interface for Asset XCM transfer on Asset Hub
 */
interface AssetTransferInterface {
    function transferToParachain(
        uint32 paraId,
        address assetId,
        uint256 amount,
        address recipient,
        uint64 weight
    ) external;
}

/**
 * @title IERC20
 * @dev Minimal ERC20 interface for AssetHub tokens
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
} 