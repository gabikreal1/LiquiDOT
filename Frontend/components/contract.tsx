"use client"

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useSimulateContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { xcmProxyAbi, erc20Abi } from '../lib/abis';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import CoinSelectorSingle from "@/components/coin-selector-single";
import { toast } from 'sonner';
import { motion } from "framer-motion";
import Image from "next/image";

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
  
  // Prepare withdraw
  const { data: withdrawData, error: simulateWithdrawError } = useSimulateContract({
    address: XCM_PROXY_ADDRESS as `0x${string}`,
    abi: xcmProxyAbi,
    functionName: 'withdraw',
    args: [tokenAddress as `0x${string}`, BigInt(formattedAmount)],
    query: {
      enabled: !!tokenAddress && !!formattedAmount && formattedAmount !== '0',
    }
  });
  
  // Execute withdraw
  const {
    writeContract: withdrawToken,
    isPending: isWithdrawingToken,
    isSuccess: isWithdrawSuccess,
    error: withdrawError
  } = useWriteContract();
  
  // Read user's token balance in the proxy
  const { data: proxyBalance } = useReadContract({
    address: XCM_PROXY_ADDRESS as `0x${string}`,
    abi: xcmProxyAbi,
    functionName: 'getUserTokenBalance',
    args: [address, tokenAddress as `0x${string}`],
    query: {
      enabled: !!address && !!tokenAddress,
    }
  });
  
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

  const handleApprove = async () => {
    if (!address || !selectedToken || !amount) {
      toast.error("Please connect your wallet and fill in all required fields");
      return;
    }
    
    setIsLoading(true);
    try {
      if (approveData) {
        approveToken(approveData.request);
        toast.success("Token approval initiated!");
      }
    } catch (error) {
      console.error("Approval error:", error);
      toast.error("Failed to approve token");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!address || !selectedToken || !amount) {
      toast.error("Please connect your wallet and fill in all required fields");
      return;
    }
    
    // Check if allowance is sufficient
    if (currentAllowance && BigInt(formattedAmount) > (currentAllowance as bigint)) {
      toast.error("Please approve tokens first");
      return;
    }
    
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

  const handleWithdraw = async () => {
    if (!address || !selectedToken || !amount) {
      toast.error("Please connect your wallet and fill in all required fields");
      return;
    }
    
    setIsLoading(true);
    try {
      if (withdrawData) {
        withdrawToken(withdrawData.request);
        toast.success("Withdrawal initiated!");
      }
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast.error("Failed to withdraw token");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl mx-auto"
    >
      <Card className="border-2 border-gray-200 shadow-lg">
        <CardHeader className="border-b border-gray-200 pb-4">
          <div className="flex items-center">
            <div className="w-10 h-10 relative mr-3">
              <Image src="/images/logo.png" alt="LiquiDOT Logo" fill className="object-contain" />
            </div>
            <CardTitle className="text-2xl text-gray-700">Token Management</CardTitle>
          </div>
          <CardDescription className="text-gray-500">Deposit and withdraw tokens from the XCM proxy</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-5 pt-5">
          <div className="space-y-4">
            <div>
              <Label htmlFor="token-selector" className="text-base font-medium mb-2 block">Select Token</Label>
              <CoinSelectorSingle 
                onSelectCoin={(coin) => setSelectedToken(coin)} 
                selectedCoin={selectedToken}
                showAllCoins={true}
              />
            </div>
            
            <div>
              <Label htmlFor="amount" className="text-base font-medium mb-2 block">Amount</Label>
              <Input
                id="amount"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full"
              />
            </div>
            
            <div className="flex flex-col md:flex-row md:space-x-4 md:items-center space-y-2 md:space-y-0 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm text-gray-500">Wallet Balance</p>
                <p className="font-medium">{walletBalance ? formatUnits(walletBalance as bigint, decimals) : '0'}</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">XCM Proxy Balance</p>
                <p className="font-medium">{proxyBalance ? formatUnits(proxyBalance as bigint, decimals) : '0'}</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Current Allowance</p>
                <p className="font-medium">{currentAllowance ? formatUnits(currentAllowance as bigint, decimals) : '0'}</p>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="border-t border-gray-200 pt-4 flex flex-wrap gap-2">
          <Button 
            onClick={handleApprove} 
            disabled={!approveData || isApprovingToken || isLoading}
            variant="outline"
            className="flex-1"
          >
            {isApprovingToken ? 'Approving...' : 'Approve'}
          </Button>
          
          <Button 
            onClick={handleDeposit} 
            disabled={!depositData || isDepositingToken || isLoading || (currentAllowance && BigInt(formattedAmount) > (currentAllowance as bigint)) as boolean}
            variant="default"
            className="flex-1 bg-gray-600 hover:bg-gray-700"
          >
            {isDepositingToken ? 'Depositing...' : 'Deposit'}
          </Button>
          
          <Button 
            onClick={handleWithdraw} 
            disabled={!withdrawData || isWithdrawingToken || isLoading}
            variant="destructive"
            className="flex-1"
          >
            {isWithdrawingToken ? 'Withdrawing...' : 'Withdraw'}
          </Button>
        </CardFooter>
        
        {(approveError || depositError || withdrawError || simulateDepositError || simulateWithdrawError) && (
          <div className="p-4 bg-red-50 text-red-700 rounded-b-lg">
            {approveError?.message || depositError?.message || withdrawError?.message || 
             simulateDepositError?.message || simulateWithdrawError?.message}
          </div>
        )}
        
        {(isApproveSuccess || isDepositSuccess || isWithdrawSuccess) && (
          <div className="p-4 bg-green-50 text-green-700 rounded-b-lg">
            Transaction successful!
          </div>
        )}
      </Card>
    </motion.div>
  );
}