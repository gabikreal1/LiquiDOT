"use client"

import React, { useRef, useState, useEffect } from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

interface RangeSliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  className?: string
}

const RangeSlider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, RangeSliderProps>(
  ({ className, ...props }, ref) => {
    const rangeRef = useRef<HTMLSpanElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [rangeWidth, setRangeWidth] = useState("0%")
    const [rangeLeft, setRangeLeft] = useState("0%")

    useEffect(() => {
      if (props.value && props.value.length >= 2 && props.max !== undefined && props.min !== undefined) {
        const min = props.min
        const max = props.max
        const range = max - min

        // Calculate percentage positions for the range
        const leftPercent = ((props.value[0] - min) / range) * 100
        const rightPercent = ((props.value[1] - min) / range) * 100

        setRangeLeft(`${leftPercent}%`)
        setRangeWidth(`${rightPercent - leftPercent}%`)
      }
    }, [props.value, props.min, props.max])

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        onPointerDown={() => setIsDragging(true)}
        onPointerUp={() => setIsDragging(false)}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-gray-800">
          {/* Center line for zero point */}
          {props.min !== undefined && props.min < 0 && props.max !== undefined && props.max > 0 && (
            <span
              className="absolute top-0 bottom-0 w-[2px] bg-gray-600 z-10"
              style={{
                left: `${(Math.abs(props.min) / (props.max - props.min)) * 100}%`,
              }}
            />
          )}
          <span
            ref={rangeRef}
            className="absolute h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
            style={{ left: rangeLeft, width: rangeWidth }}
          />
        </SliderPrimitive.Track>

        {props.value?.map((_, index) => (
          <SliderPrimitive.Thumb
            key={index}
            className={cn(
              "block h-6 w-6 rounded-full border-2 border-violet-500 bg-background shadow-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              isDragging && "scale-110 shadow-lg border-fuchsia-500 hover:border-fuchsia-500",
              !isDragging && "hover:border-fuchsia-500"
            )}
          />
        ))}
      </SliderPrimitive.Root>
    )
  },
)

RangeSlider.displayName = "RangeSlider"

export default RangeSlider
