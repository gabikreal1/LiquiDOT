"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Check, AlertCircle, TrendingUp, Percent, X } from "lucide-react"
import { Button } from "@/components/ui/button"

// Define the types for investment decisions
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

interface InvestmentDecisionsProps {
  decisions: InvestmentDecision[]
  depositAmount: string
  onClose?: () => void
}

export default function InvestmentDecisions({ decisions, depositAmount, onClose }: InvestmentDecisionsProps) {
  // If there are no decisions, don't render anything
  if (!decisions || decisions.length === 0) return null
  
  // Calculate total deposit amount
  const totalDepositAmount = parseFloat(depositAmount) || 0
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-4"
    >
      <Card className="border-2 border-green-200 shadow-lg bg-gradient-to-r from-green-50 to-teal-50">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              <CardTitle className="text-xl text-green-700">Investment Strategy Deployed</CardTitle>
            </div>
            {onClose && (
              <button 
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <CardDescription className="text-gray-800">
            Your deposit of {totalDepositAmount.toFixed(2)} has been allocated to {decisions.length} liquidity pools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-3">
              {decisions.map((decision, index) => {
                const allocationAmount = (totalDepositAmount * decision.proportion / 100).toFixed(2)
                return (
                  <div key={decision.poolId} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-violet-700">{index + 1}.</span>
                        <span className="font-medium text-black">{decision.pairName}</span>
                        <Badge variant="outline" className="bg-violet-50 text-violet-600 border-violet-200">
                          {decision.proportion.toFixed(1)}%
                        </Badge>
                      </div>
                      <Badge className={`${
                        (decision.approximateAPR / 1000) > 10 ? "bg-amber-100 text-amber-800" : 
                        (decision.approximateAPR / 1000) > 5 ? "bg-green-100 text-green-800" : 
                        "bg-blue-100 text-blue-800"
                      }`}>
                        <TrendingUp className="w-3 h-3 mr-1" />
                        APR: {(decision.approximateAPR / 1000).toFixed(1)}%
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Allocation:</span>
                        <span className="font-medium text-black">{allocationAmount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">TVL:</span>
                        <span className="font-medium text-black">${decision.totalValueLockedUSD.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Stop Loss:</span>
                        <span className="font-medium text-red-600">-{decision.stopLoss}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Take Profit:</span>
                        <span className="font-medium text-green-600">+{decision.takeProfit}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="pt-3 pb-4">
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 text-white"
          >
            Make Another Deposit
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
} 