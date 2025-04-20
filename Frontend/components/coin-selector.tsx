"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

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

// Sample all coins data (would be fetched from CoinGecko API in a real app)
const allCoins = [...topCoins]

interface CoinSelectorProps {
  showAllCoins: boolean;
  onSelectCoins?: (coins: string[]) => void;
}

export default function CoinSelector({ showAllCoins, onSelectCoins }: CoinSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedCoins, setSelectedCoins] = useState<string[]>([])
  const coins = showAllCoins ? allCoins : topCoins

  const toggleCoin = (value: string) => {
    const coin = coins.find(c => c.value === value);
    // Extract just the symbol part from label (e.g., "WGLMR" from "Wrapped GLMR (WGLMR)")
    let symbol = coin?.label.match(/\(([^)]+)\)/)?.[1] || value.toUpperCase();
    
    // Ensure 'xc' is lowercase if the symbol starts with 'XC'
    if (symbol.toUpperCase().startsWith('XC')) {
      symbol = 'xc' + symbol.substring(2);
    }
    
    setSelectedCoins((current) =>
      current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol],
    )
  }

  const removeCoin = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCoins((current) => current.filter((item) => item !== value))
  }
  
  // Update parent component when selected coins change
  useEffect(() => {
    if (onSelectCoins) {
      onSelectCoins(selectedCoins);
    }
  }, [selectedCoins, onSelectCoins]);

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
            {selectedCoins.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedCoins.map((coinSymbol) => {
                  // Find the coin that has this symbol in its label
                  const coinWithSymbol = coins.find((c) => c.label.includes(`(${coinSymbol})`));
                  return (
                    <Badge
                      key={coinSymbol}
                      variant="secondary"
                      className="mr-1 mb-1 bg-violet-100 text-violet-700 hover:bg-violet-200"
                    >
                      {coinSymbol}
                      <span
                        className="ml-1 rounded-full outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
                        onClick={(e) => removeCoin(coinSymbol, e)}
                      >
                        ×
                      </span>
                    </Badge>
                  )
                })}
              </div>
            ) : (
              <span className="text-gray-500">Select coins...</span>
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
                {coins.map((coin) => {
                  // Extract the symbol from the label (e.g., "WGLMR" from "Wrapped GLMR (WGLMR)")
                  const symbol = coin.label.match(/\(([^)]+)\)/)?.[1] || coin.value.toUpperCase();
                  
                  return (
                    <CommandItem
                      key={coin.value}
                      value={coin.value}
                      onSelect={() => toggleCoin(coin.value)}
                      className="text-gray-700 hover:bg-violet-50 aria-selected:bg-violet-100"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 text-violet-500",
                          selectedCoins.includes(symbol) ? "opacity-100" : "opacity-0",
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
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="text-sm text-white">
        {selectedCoins.length === 0 ? (
          <p>Select coins to include in your liquidity pool strategy</p>
        ) : (
          <p>{selectedCoins.length} coins selected</p>
        )}
      </div>
    </div>
  )
}
