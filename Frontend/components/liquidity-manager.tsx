"use client"

import type React from "react"

import { useState } from "react"
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
import { Wallet } from "lucide-react"
import Image from "next/image"
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'

export default function LiquidityManager() {
  const [showAllCoins, setShowAllCoins] = useState(false)
  const [aprValue, setAprValue] = useState("500")
  const [marketCapValue, setMarketCapValue] = useState([5000000])
  const [slTpRange, setSlTpRange] = useState([-10, 25])
  const [riskStrategy, setRiskStrategy] = useState("market-cap")
  const [maxAllocation, setMaxAllocation] = useState("20")
  const [depositAmount, setDepositAmount] = useState("")
  const [selectedDepositCoin, setSelectedDepositCoin] = useState<string | null>(null)
  
  // Wagmi hooks
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  
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
  
  const handleConnectWallet = async () => {
    try {
      connect({ connector: injected() })
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

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
            <CardTitle className="text-2xl text-violet-700">Pool Manager</CardTitle>
          </div>
          <CardDescription className="text-gray-500">Configure your liquidity pool strategy</CardDescription>
        </CardHeader>
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
              <CoinSelector showAllCoins={false} />
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

        <CardFooter className="flex flex-col space-y-4 w-full border-t border-gray-200 pt-5">
          {!isConnected ? (
            <Button
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0"
              size="lg"
              onClick={handleConnectWallet}
            >
              <Wallet className="mr-2 h-4 w-4" /> Connect Wallet
            </Button>
          ) : (
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
                disabled={!selectedDepositCoin || !depositAmount}
              >
                Deposit into the Vault
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  )
}
