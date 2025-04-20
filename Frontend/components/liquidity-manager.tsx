"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import CoinSelector from "@/components/coin-selector"
import CoinSelectorSingle from "@/components/coin-selector-single"
import RangeSlider from "@/components/range-slider"
import InvestmentDecisions from "@/components/investment-decisions"
import { Wallet } from "lucide-react"
import Image from "next/image"
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useSimulateContract } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { toast } from 'sonner'
import { parseUnits, formatUnits } from 'viem'
import { xcmProxyAbi, erc20Abi } from '../lib/abis'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Contract addresses - replace with your actual addresses
const XCM_PROXY_ADDRESS = "0x..."; // Your XCMProxy address on Moonbeam

// Define types for investment decisions
interface Token {
  symbol: string
  address: string
}

interface InvestmentDecision {
  poolId: string
  pairName: string
  token0: Token
  token1: Token
  approximateAPR: number
  totalValueLockedUSD: number
  stopLoss: number
  takeProfit: number
  proportion: number
}

export default function LiquidityManager() {
  const [showAllCoins, setShowAllCoins] = useState(false)
  const [aprValue, setAprValue] = useState("500")
  const [marketCapValue, setMarketCapValue] = useState([5000000])
  const [slTpRange, setSlTpRange] = useState([-10, 25])
  const [riskStrategy, setRiskStrategy] = useState("market-cap")
  const [maxAllocation, setMaxAllocation] = useState("20")
  const [depositAmount, setDepositAmount] = useState("")
  const [selectedDepositCoin, setSelectedDepositCoin] = useState<string | null>(null)
  const [selectedCoins, setSelectedCoins] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [investmentDecisions, setInvestmentDecisions] = useState<InvestmentDecision[]>([])
  const [showDecisions, setShowDecisions] = useState(false)
  const [activeTab, setActiveTab] = useState<"strategy" | "direct-deposit">("strategy")
  
  // Direct deposit state (from contract.tsx)
  const [tokenAddress, setTokenAddress] = useState('')
  const [directDepositAmount, setDirectDepositAmount] = useState('')
  const [formattedAmount, setFormattedAmount] = useState('0')
  const [decimals, setDecimals] = useState(18)
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const [isDirectDepositLoading, setIsDirectDepositLoading] = useState(false)
  
  // Wagmi hooks
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  
  // This ensures wallet-related rendering only happens client-side
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Check if backend is running
  useEffect(() => {
    if (mounted) {
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
    }
  }, [mounted]);
  
  // Convert direct deposit input to token units with decimals
  useEffect(() => {
    try {
      if (directDepositAmount && !isNaN(Number(directDepositAmount))) {
        setFormattedAmount(parseUnits(directDepositAmount, decimals).toString());
      }
    } catch (error) {
      console.error("Error formatting amount:", error);
    }
  }, [directDepositAmount, decimals]);

  // Update tokenAddress when selected token changes
  useEffect(() => {
    if (selectedToken) {
      // This would typically come from a mapping of token symbols to addresses
      // For now, we'll just use a placeholder
      setTokenAddress('0x...');
    }
  }, [selectedToken]);
  
  // Prepare approval for direct deposit
  const { data: approveData, error: simulateApproveError } = useSimulateContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'approve',
    args: [XCM_PROXY_ADDRESS, BigInt(formattedAmount)],
    query: {
      enabled: !!tokenAddress && !!formattedAmount && formattedAmount !== '0',
    }
  });
  
  // Execute approval for direct deposit
  const { 
    writeContract: approveToken, 
    isPending: isApprovingToken,
    isSuccess: isApproveSuccess,
    error: approveError 
  } = useWriteContract();
  
  // Prepare deposit for direct deposit
  const { data: depositData, error: simulateDepositError } = useSimulateContract({
    address: XCM_PROXY_ADDRESS as `0x${string}`,
    abi: xcmProxyAbi,
    functionName: 'deposit',
    args: [tokenAddress as `0x${string}`, BigInt(formattedAmount)],
    query: {
      enabled: !!tokenAddress && !!formattedAmount && formattedAmount !== '0',
    }
  });
  
  // Execute deposit for direct deposit
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
  
  const formatAddress = (addr: string | undefined) => {
    if (!addr) return ''
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  }

  const handleAprChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow any input temporarily
    setAprValue(value)
  }

  const validateApr = () => {
    const numValue = Number(aprValue)
    if (isNaN(numValue) || numValue < 10) {
      setAprValue("10")
    } else if (numValue > 1000) {
      setAprValue("1000")
    } else {
      setAprValue(String(Math.floor(numValue)))
    }
  }

  const handleMaxAllocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Limit input to numbers between 1 and 100
    const value = e.target.value
    if (value === "" || (/^\d+$/.test(value) && Number.parseInt(value) >= 1 && Number.parseInt(value) <= 100)) {
      setMaxAllocation(value)
    }
  }

  const handleDepositAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setDepositAmount(value)
    }
  }
  
  const handleDirectDepositAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setDirectDepositAmount(value)
    }
  }
  
  const handleConnectWallet = async () => {
    try {
      connect({ connector: injected() })
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  const resetForm = () => {
    setDepositAmount("");
    setSelectedDepositCoin(null);
    setShowDecisions(false);
  };

  const handleDepositToVault = async () => {
    if (!address || !selectedDepositCoin || !depositAmount) {
      toast.error("Please connect your wallet and fill in all required fields");
      return;
    }
    
    if (backendStatus === 'offline') {
      toast.error("Backend server is not running. Please start the backend server at http://localhost:3001");
      return;
    }

    // Clear previous investment decisions
    setInvestmentDecisions([]);
    setShowDecisions(false);
    setIsLoading(true);

    try {
      // Create the request payload
      const payload = {
        coinLimit: parseInt(maxAllocation, 10),
        minRequiredApr: parseInt(aprValue, 10),
        minMarketCap: marketCapValue[0],
        stopLossLevel: Math.abs(slTpRange[0]),  // Convert negative to positive value
        takeProfitLevel: slTpRange[1],
        riskStrategy: riskStrategy === "market-cap" ? "highestMarketCap" : "highestApr",
        userAddress: address,
        // When "All Coins" is selected (showAllCoins is true), use an empty array for allowedCoins
        allowedCoins: showAllCoins 
          ? [] 
          : (selectedCoins.length > 0 
              ? selectedCoins.map(coin => {
                  // For tokens with 'xc' prefix, ensure 'xc' is lowercase and the rest is uppercase
                  if (coin.toLowerCase().startsWith('xc')) {
                    return 'xc' + coin.substring(2).toUpperCase();
                  }
                  return coin.toUpperCase();
                }) 
              : ["WGLMR", "xcDOT", "xcUSDT", "xcUSDC", "USDC", "xcMANTA", "STELLA"])  // Default allowed coins
      };

      console.log("Sending request to backend:", payload);

      // Send the POST request to the backend
      const response = await fetch("http://localhost:3001/api/investmentDecisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        // Add a timeout to the fetch request
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Successfully deposited into the vault!");
        console.log("Investment decisions:", data);
        // Store the investment decisions from the API response
        if (data.data && data.data.decisions) {
          setInvestmentDecisions(data.data.decisions);
          setShowDecisions(true);
        }
      } else {
        toast.error(`Failed to deposit: ${data.error || data.message || "Unknown error"}`);
        console.error("API Error:", data);
      }
    } catch (error) {
      console.error("Failed to deposit to vault:", error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error("Failed to connect to the backend. Please ensure the backend server is running at http://localhost:3001");
      } else {
        toast.error("An unexpected error occurred. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Direct deposit logic (from contract.tsx)
  const handleDirectDepositProcess = async () => {
    if (!address || !selectedToken || !directDepositAmount) {
      toast.error("Please connect your wallet and fill in all required fields");
      return;
    }
    
    if (backendStatus === 'offline') {
      toast.error("Backend server is not running");
      return;
    }
    
    // First check if approval is needed
    if (currentAllowance && BigInt(formattedAmount) > (currentAllowance as bigint)) {
      setIsDirectDepositLoading(true);
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
        setIsDirectDepositLoading(false);
        return;
      }
    } else {
      // If no approval needed, proceed with deposit
      initiateDirectDeposit();
    }
  };

  const initiateDirectDeposit = async () => {
    setIsDirectDepositLoading(true);
    try {
      if (depositData) {
        depositToken(depositData.request);
        toast.success("Deposit initiated!");
      }
    } catch (error) {
      console.error("Deposit error:", error);
      toast.error("Failed to deposit token");
    } finally {
      setIsDirectDepositLoading(false);
    }
  };
  
  // Call initiateDirectDeposit when approval is successful
  useEffect(() => {
    if (isApproveSuccess) {
      initiateDirectDeposit();
    }
  }, [isApproveSuccess]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      <Card className="border-2 border-gray-200 shadow-lg">
        <CardHeader className="border-b border-gray-200 pb-4">
          <div className="flex items-center">
            <div className="w-10 h-10 relative mr-3">
              <Image src="/images/logo.png" alt="LiquiDOT Logo" fill className="object-contain" />
            </div>
            <CardTitle className="text-2xl text-violet-700">Pool Manager</CardTitle>
          </div>
          <CardDescription className="text-gray-500">Configure your liquidity pool strategy</CardDescription>
        </CardHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "strategy" | "direct-deposit")}>
          <TabsList className="w-full mb-6">
            <TabsTrigger value="strategy" className="flex-1">Strategy Settings</TabsTrigger>
            <TabsTrigger value="direct-deposit" className="flex-1">Direct Deposit</TabsTrigger>
          </TabsList>
          
          <TabsContent value="strategy" className="mt-0">
            <CardContent className="space-y-5 pt-5">
              {/* Coin Selection Toggle */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Coin Selection</h3>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="show-all-coins" className="text-gray-300">
                    All Coins
                  </Label>
                  <Switch id="show-all-coins" checked={showAllCoins} onCheckedChange={setShowAllCoins} />
                </div>
              </div>

              {/* Coin Selector (only shown when All Coins is not selected) */}
              {!showAllCoins && (
                <div className="space-y-4">
                  <CoinSelector showAllCoins={false} onSelectCoins={setSelectedCoins} />
                </div>
              )}

              {/* APR Text Field */}
              <div className="space-y-3">
                <Label htmlFor="min-apr" className="text-lg font-medium text-white">
                  Minimum Required APR (For Pool Entry)
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="min-apr"
                    type="text"
                    value={aprValue}
                    onChange={handleAprChange}
                    onBlur={validateApr}
                    className="max-w-[120px] border-gray-200 focus:border-violet-400 focus:ring-violet-400"
                  />
                  <span className="text-gray-300">%</span>
                </div>
                <p className="text-sm text-gray-300">Enter a value between 10% and 1000%</p>
              </div>

              {/* Maximum Allocation Field */}
              <div className="space-y-3">
                <Label htmlFor="max-allocation" className="text-lg font-medium text-white">
                  Maximum Allocation Per Liquidity Pool
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="max-allocation"
                    type="text"
                    value={maxAllocation}
                    onChange={handleMaxAllocationChange}
                    className="max-w-[120px] border-gray-200 focus:border-violet-400 focus:ring-violet-400"
                  />
                  <span className="text-gray-300">%</span>
                </div>
                <p className="text-sm text-gray-300">Maximum percentage of your deposit allocated to a single pool</p>
              </div>

              {/* Market Cap Slider (conditional) */}
              {showAllCoins && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">Minimum Market Cap</h3>
                    <span className="font-medium text-violet-400">
                      {marketCapValue[0] < 1000000
                        ? `${(marketCapValue[0] / 1000).toFixed(0)}K`
                        : `${(marketCapValue[0] / 1000000).toFixed(1)}M`}
                    </span>
                  </div>
                  <Slider
                    value={marketCapValue}
                    onValueChange={setMarketCapValue}
                    min={100000}
                    max={10000000}
                    step={10000}
                    className="py-1"
                  />
                </div>
              )}

              {/* Stop Loss / Take Profit Range Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">Stop Loss / Take Profit</h3>
                  <span className="font-medium text-violet-400">
                    SL: {slTpRange[0]}% / TP: {slTpRange[1]}%
                  </span>
                </div>
                <RangeSlider
                  value={slTpRange}
                  onValueChange={setSlTpRange}
                  min={-100}
                  max={100}
                  step={1}
                  className="py-1"
                />
                <p className="text-sm text-gray-300">
                  Set Stop Loss (negative %) and Take Profit (positive %) levels for your positions
                </p>
              </div>

              {/* Risk Strategy (only shown when All Coins is selected) */}
              {showAllCoins && (
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-white">Risk Strategy</h3>
                  <RadioGroup value={riskStrategy} onValueChange={setRiskStrategy} className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="market-cap" id="market-cap" className="text-violet-500 border-gray-300" />
                      <Label htmlFor="market-cap" className="text-gray-300">
                        Prefer highest market cap coins (lower risk)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="apr" id="apr" className="text-violet-500 border-gray-300" />
                      <Label htmlFor="apr" className="text-gray-300">
                        Prefer highest APR (higher risk)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </TabsContent>
          
          <TabsContent value="direct-deposit" className="mt-0 space-y-5 px-6 py-5">
            <div className="space-y-5">
              <div>
                <label className="block text-lg font-medium text-white mb-2">
                  Deposit Amount
                </label>
                <Input
                  type="text"
                  value={directDepositAmount}
                  onChange={handleDirectDepositAmountChange}
                  placeholder="0.0"
                  className="w-full border-gray-200 focus:border-violet-400 focus:ring-violet-400"
                />
              </div>
              
              <div>
                <label className="block text-lg font-medium text-white mb-2">
                  Select Coin
                </label>
                <CoinSelectorSingle 
                  onSelectCoin={(coin) => setSelectedToken(coin)} 
                  selectedCoin={selectedToken}
                  showAllCoins={true}
                />
              </div>
              
              <div className="mt-8">
                <h3 className="block text-lg font-medium text-white mb-4">
                  Deposit Tokens
                </h3>
                
                <Button
                  onClick={handleDirectDepositProcess}
                  disabled={!address || !selectedToken || !directDepositAmount || isDirectDepositLoading || isApprovingToken || isDepositingToken}
                  className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0"
                >
                  {isDirectDepositLoading ? 'Processing...' : 'Deposit'}
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
          </TabsContent>
        </Tabs>

        <CardFooter className="flex flex-col space-y-4 w-full border-t border-gray-200 pt-5">
          {!mounted ? (
            // Show a placeholder until the component is mounted
            <Button
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0"
              size="lg"
              disabled
            >
              Loading...
            </Button>
          ) : !isConnected ? (
            <Button
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0"
              size="lg"
              onClick={handleConnectWallet}
            >
              <Wallet className="mr-2 h-4 w-4" /> Connect Wallet
            </Button>
          ) : activeTab === "strategy" ? (
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-center bg-gray-800 px-4 py-3 rounded-lg">
                <span className="text-violet-400 mr-2">Connected:</span>
                <span className="text-white font-mono">{formatAddress(address)}</span>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="deposit-amount" className="text-lg font-medium text-white">
                  Deposit Amount
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="deposit-amount"
                    type="text"
                    value={depositAmount}
                    onChange={handleDepositAmountChange}
                    placeholder="0.0"
                    className="w-full border-gray-200 focus:border-violet-400 focus:ring-violet-400"
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-lg font-medium text-white">
                  Select Coin
                </Label>
                <CoinSelectorSingle 
                  showAllCoins={false} 
                  selectedCoin={selectedDepositCoin}
                  onSelectCoin={setSelectedDepositCoin}
                />
              </div>
              
              <Button
                className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0"
                size="lg"
                variant="default"
                disabled={!selectedDepositCoin || !depositAmount || isLoading || backendStatus === 'offline'}
                onClick={handleDepositToVault}
              >
                {isLoading ? "Processing..." : 
                 backendStatus === 'checking' ? "Checking backend..." :
                 backendStatus === 'offline' ? "Backend offline" :
                 "Deposit into the Vault"}
              </Button>
            </div>
          ) : null}
        </CardFooter>
      </Card>

      {showDecisions && investmentDecisions.length > 0 && (
        <InvestmentDecisions 
          decisions={investmentDecisions} 
          depositAmount={depositAmount} 
          onClose={resetForm}
        />
      )}
    </motion.div>
  )
}
