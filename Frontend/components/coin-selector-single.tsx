"use client"

import type React from "react"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Sample top coins data
const topCoins = [
  { value: "wglmr", label: "Wrapped GLMR (WGLMR)", marketCap: "267.5M", apr: "11.2%" },
  { value: "xcdot", label: "xcDOT (xcDOT)", marketCap: "158.3M", apr: "8.4%" },
  { value: "xcusdt", label: "xcUSDT (xcUSDT)", marketCap: "98.7M", apr: "5.6%" },
  { value: "xcusdc", label: "xcUSDC (xcUSDC)", marketCap: "87.2M", apr: "5.3%" },
  { value: "usdc", label: "USDC (USDC)", marketCap: "103.5M", apr: "5.1%" },
  { value: "xcmanta", label: "xcMANTA (xcMANTA)", marketCap: "42.1M", apr: "9.7%" },
  { value: "stella", label: "STELLA (STELLA)", marketCap: "35.6M", apr: "12.5%" },
]

// Coins for deposit - only stable coins
const depositCoins = [
  { value: "xcdot", label: "xcDOT (xcDOT)", marketCap: "158.3M", apr: "8.4%" },
  { value: "xcusdt", label: "xcUSDT (xcUSDT)", marketCap: "98.7M", apr: "5.6%" },
  { value: "xcusdc", label: "xcUSDC (xcUSDC)", marketCap: "87.2M", apr: "5.3%" },
]

// Sample all coins data (would be fetched from CoinGecko API in a real app)
const allCoins = [...topCoins]

interface CoinSelectorSingleProps {
  showAllCoins: boolean;
  selectedCoin: string | null;
  onSelectCoin: (value: string) => void;
}

export default function CoinSelectorSingle({ showAllCoins, selectedCoin, onSelectCoin }: CoinSelectorSingleProps) {
  const [open, setOpen] = useState(false)
  const coins = showAllCoins ? allCoins : depositCoins
  
  const selectedCoinData = selectedCoin ? coins.find((c) => c.value === selectedCoin) : null

  return (
    <div className="space-y-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 py-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-violet-700"
          >
            {selectedCoin ? (
              <div className="flex items-center">
                <span className="font-medium">{selectedCoinData?.label}</span>
              </div>
            ) : (
              <span className="text-gray-500">Select a coin...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command className="border-gray-200">
            <CommandInput placeholder="Search coins..." className="text-gray-700" />
            <CommandList>
              <CommandEmpty>No coin found.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {coins.map((coin) => (
                  <CommandItem
                    key={coin.value}
                    value={coin.value}
                    onSelect={() => {
                      onSelectCoin(coin.value)
                      setOpen(false)
                    }}
                    className="text-gray-700 hover:bg-violet-50 aria-selected:bg-violet-100"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 text-violet-500",
                        selectedCoin === coin.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex justify-between w-full">
                      <span>{coin.label}</span>
                      <div className="text-xs text-gray-500">
                        <span className="mr-2">MC: {coin.marketCap}</span>
                        <span>APR: {coin.apr}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
} 