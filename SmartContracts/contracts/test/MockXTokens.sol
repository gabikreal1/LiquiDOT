// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title MockXTokens
 * @dev Mock implementation of Moonbeam's XTokens precompile for testing
 * @notice Only used for local testing - real precompile exists on Moonbeam
 */
contract MockXTokens {
    
    event Transfer(
        address indexed token,
        uint256 amount,
        bytes dest,
        uint64 weight
    );
    
    // Track calls for testing
    uint256 public transferCallCount;
    
    mapping(uint256 => TransferCall) public transfers;
    
    struct TransferCall {
        address token;
        uint256 amount;
        bytes dest;
        uint64 weight;
        uint256 timestamp;
    }
    
    /**
     * @dev Mock implementation of XTokens transfer function
     * @param token The token address to transfer
     * @param amount The amount to transfer
     * @param dest SCALE-encoded XCM destination (multilocation)
     * @param destWeight Weight for destination execution
     */
    function transfer(
        address token,
        uint256 amount,
        bytes calldata dest,
        uint64 destWeight
    ) external {
        transferCallCount++;
        
        transfers[transferCallCount] = TransferCall({
            token: token,
            amount: amount,
            dest: dest,
            weight: destWeight,
            timestamp: block.timestamp
        });
        
        emit Transfer(token, amount, dest, destWeight);
        
        // Note: In real XTokens, this would:
        // 1. Lock/burn tokens on Moonbeam
        // 2. Send XCM message to destination
        // 3. Mint/unlock tokens on destination
        // For testing, we just emit event
    }
    
    /**
     * @dev Get details of a specific transfer
     */
    function getTransfer(uint256 transferIndex) external view returns (
        address token,
        uint256 amount,
        bytes memory dest,
        uint64 weight,
        uint256 timestamp
    ) {
        TransferCall memory t = transfers[transferIndex];
        return (t.token, t.amount, t.dest, t.weight, t.timestamp);
    }
    
    /**
     * @dev Get the last transfer details
     */
    function getLastTransfer() external view returns (
        address token,
        uint256 amount,
        bytes memory dest,
        uint64 weight
    ) {
        require(transferCallCount > 0, "No transfers");
        TransferCall memory t = transfers[transferCallCount];
        return (t.token, t.amount, t.dest, t.weight);
    }
    
    /**
     * @dev Reset mock state (useful between tests)
     */
    function reset() external {
        transferCallCount = 0;
    }
}

