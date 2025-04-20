"use client"

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useSimulateContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { xcmProxyAbi, erc20Abi } from '../lib/abis';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CoinSelectorSingle from "@/components/coin-selector-single";
import { toast } from 'sonner';
import { motion } from "framer-motion";

// Contract addresses - replace with your actual addresses
const XCM_PROXY_ADDRESS = "0x..."; // Your XCMProxy address on Moonbeam

export default function TokenManagement() {
  const { address, isConnected } = useAccount();
  const [tokenAddress, setTokenAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [formattedAmount, setFormattedAmount] = useState('0');
  const [decimals, setDecimals] = useState(18);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  // Check backend status (similar to how it's done in liquidity-manager)
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/health', {
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        if (response.ok) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch (error) {
        console.error('Backend health check failed:', error);
        setBackendStatus('offline');
      }
    };
    
    checkBackendStatus();
  }, []);
  
  // Convert user input to token units with decimals
  useEffect(() => {
    try {
      if (amount && !isNaN(Number(amount))) {
        setFormattedAmount(parseUnits(amount, decimals).toString());
      }
    } catch (error) {
      console.error("Error formatting amount:", error);
    }
  }, [amount, decimals]);

  // Update tokenAddress when selected token changes
  useEffect(() => {
    if (selectedToken) {
      // This would typically come from a mapping of token symbols to addresses
      // For now, we'll just use a placeholder
      setTokenAddress('0x...');
    }
  }, [selectedToken]);

  // Prepare approval
  const { data: approveData, error: simulateApproveError } = useSimulateContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'approve',
    args: [XCM_PROXY_ADDRESS, BigInt(formattedAmount)],
    query: {
      enabled: !!tokenAddress && !!formattedAmount && formattedAmount !== '0',
    }
  });
  
  // Execute approval
  const { 
    writeContract: approveToken, 
    isPending: isApprovingToken,
    isSuccess: isApproveSuccess,
    error: approveError 
  } = useWriteContract();
  
  // Prepare deposit
  const { data: depositData, error: simulateDepositError } = useSimulateContract({
    address: XCM_PROXY_ADDRESS as `0x${string}`,
    abi: xcmProxyAbi,
    functionName: 'deposit',
    args: [tokenAddress as `0x${string}`, BigInt(formattedAmount)],
    query: {
      enabled: !!tokenAddress && !!formattedAmount && formattedAmount !== '0',
    }
  });
  
  // Execute deposit
  const { 
    writeContract: depositToken,
    isPending: isDepositingToken,
    isSuccess: isDepositSuccess,
    error: depositError
  } = useWriteContract();
  
  // Read user's wallet balance
  const { data: walletBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
    query: {
      enabled: !!address && !!tokenAddress,
    }
  });
  
  // Check current allowance
  const { data: currentAllowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address, XCM_PROXY_ADDRESS as `0x${string}`],
    query: {
      enabled: !!address && !!tokenAddress,
    }
  });

  const handleDepositProcess = async () => {
    if (!address || !selectedToken || !amount) {
      toast.error("Please connect your wallet and fill in all required fields");
      return;
    }
    
    if (backendStatus === 'offline') {
      toast.error("Backend server is not running");
      return;
    }
    
    // First check if approval is needed
    if (currentAllowance && BigInt(formattedAmount) > (currentAllowance as bigint)) {
      setIsLoading(true);
      try {
        if (approveData) {
          approveToken(approveData.request);
          toast.success("Approving token transfer...");
          // Note: In a production app, we would wait for the approval transaction to complete
          // before initiating the deposit
        }
      } catch (error) {
        console.error("Approval error:", error);
        toast.error("Failed to approve token");
        setIsLoading(false);
        return;
      }
    } else {
      // If no approval needed, proceed with deposit
      initiateDeposit();
    }
  };

  const initiateDeposit = async () => {
    setIsLoading(true);
    try {
      if (depositData) {
        depositToken(depositData.request);
        toast.success("Deposit initiated!");
      }
    } catch (error) {
      console.error("Deposit error:", error);
      toast.error("Failed to deposit token");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Call initiateDeposit when approval is successful
  useEffect(() => {
    if (isApproveSuccess) {
      initiateDeposit();
    }
  }, [isApproveSuccess]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="bg-[#0e1219] p-8 rounded-lg">
        {isConnected && (
          <div className="mb-6 text-center text-violet-300">
            Connected: {address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : ''}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-white text-xl font-medium mb-2">
              Deposit Amount
            </label>
            <Input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-[#1a202c] border-0 text-white h-14 text-lg"
            />
          </div>
          
          <div>
            <label className="block text-white text-xl font-medium mb-2">
              Select Coin
            </label>
            <CoinSelectorSingle 
              onSelectCoin={(coin) => setSelectedToken(coin)} 
              selectedCoin={selectedToken}
              showAllCoins={true}
            />
          </div>
          
          <div className="mt-8">
            <h3 className="block text-white text-xl font-medium mb-4">
              Deposit Tokens
            </h3>
            
            <Button
              onClick={handleDepositProcess}
              disabled={!address || !selectedToken || !amount || isLoading || isApprovingToken || isDepositingToken}
              className="w-full bg-purple-700 hover:bg-purple-800 text-white py-6 rounded-md text-lg"
            >
              {isLoading ? 'Processing...' : 'Deposit'}
            </Button>
          </div>
          
          {backendStatus === 'offline' && (
            <div className="w-full p-4 bg-purple-700 text-white text-center rounded-md">
              Backend offline
            </div>
          )}
          
          {(approveError || depositError || simulateDepositError) && (
            <div className="p-4 bg-red-900/50 text-red-300 rounded-md">
              {approveError?.message || depositError?.message || simulateDepositError?.message}
            </div>
          )}
          
          {isDepositSuccess && (
            <div className="p-4 bg-green-900/50 text-green-300 rounded-md">
              Deposit successful!
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}