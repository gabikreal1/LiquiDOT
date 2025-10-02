// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title MockXcmPrecompile
 * @dev Mock implementation of Asset Hub's XCM precompile for testing
 * @notice Only used for local testing - real precompile exists on Asset Hub
 */
contract MockXcmPrecompile {
    
    event XcmSent(bytes destination, bytes message);
    
    // Track calls for testing
    uint256 public sendCallCount;
    bytes public lastDestination;
    bytes public lastMessage;
    
    mapping(uint256 => Call) public calls;
    
    struct Call {
        bytes destination;
        bytes message;
        uint256 timestamp;
    }
    
    /**
     * @dev Mock implementation of XCM send function
     * @param destination SCALE-encoded XCM destination (multilocation)
     * @param message SCALE-encoded XCM message
     */
    function send(bytes calldata destination, bytes calldata message) external {
        sendCallCount++;
        lastDestination = destination;
        lastMessage = message;
        
        calls[sendCallCount] = Call({
            destination: destination,
            message: message,
            timestamp: block.timestamp
        });
        
        emit XcmSent(destination, message);
    }
    
    /**
     * @dev Get details of a specific call
     */
    function getCall(uint256 callIndex) external view returns (
        bytes memory destination,
        bytes memory message,
        uint256 timestamp
    ) {
        Call memory call = calls[callIndex];
        return (call.destination, call.message, call.timestamp);
    }
    
    /**
     * @dev Reset mock state (useful between tests)
     */
    function reset() external {
        sendCallCount = 0;
        delete lastDestination;
        delete lastMessage;
    }
}

