// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

/**
 * @title IReactive
 * @dev Interface for contracts that work with the Reactive Network
 */
interface IReactive {
    /**
     * @dev Called by the Reactive Network when relevant events are detected
     * @param logData Encoded event data from the Reactive Network
     */
    function react(bytes calldata logData) external;
} 