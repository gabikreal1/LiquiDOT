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
  { value: "btc", label: "Bitcoin (BTC)", marketCap: "1.15T", apr: "5.2%" },
  { value: "eth", label: "Ethereum (ETH)", marketCap: "352.1B", apr: "4.8%" },
  { value: "bnb", label: "Binance Coin (BNB)", marketCap: "62.8B", apr: "7.5%" },
  { value: "sol", label: "Solana (SOL)", marketCap: "58.2B", apr: "9.2%" },
  { value: "xrp", label: "XRP (XRP)", marketCap: "34.5B", apr: "3.9%" },
  { value: "ada", label: "Cardano (ADA)", marketCap: "15.2B", apr: "5.7%" },
  { value: "avax", label: "Avalanche (AVAX)", marketCap: "14.8B", apr: "11.3%" },
  { value: "doge", label: "Dogecoin (DOGE)", marketCap: "14.1B", apr: "2.8%" },
  { value: "dot", label: "Polkadot (DOT)", marketCap: "9.8B", apr: "8.4%" },
  { value: "link", label: "Chainlink (LINK)", marketCap: "9.2B", apr: "6.1%" },
  { value: "matic", label: "Polygon (MATIC)", marketCap: "8.7B", apr: "10.5%" },
  { value: "uni", label: "Uniswap (UNI)", marketCap: "5.9B", apr: "12.7%" },
  { value: "atom", label: "Cosmos (ATOM)", marketCap: "3.8B", apr: "15.2%" },
  { value: "aave", label: "Aave (AAVE)", marketCap: "1.9B", apr: "8.9%" },
  { value: "mkr", label: "Maker (MKR)", marketCap: "1.7B", apr: "7.3%" },
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
  const coins = showAllCoins ? allCoins : topCoins
  
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