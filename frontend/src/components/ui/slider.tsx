import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps {
  min?: number
  max?: number
  step?: number
  value: number[]
  onValueChange: (values: number[]) => void
  className?: string
}

const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  value,
  onValueChange,
  className,
}) => {
  const percentage = ((value[0] - min) / (max - min)) * 100
  const percentage2 = ((value[1] - min) / (max - min)) * 100

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="absolute h-full bg-primary"
          style={{
            left: `${percentage}%`,
            right: `${100 - percentage2}%`,
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange([Number(e.target.value), value[1]])}
        className="absolute top-0 h-2 w-full cursor-pointer appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:appearance-none"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[1]}
        onChange={(e) => onValueChange([value[0], Number(e.target.value)])}
        className="absolute top-0 h-2 w-full cursor-pointer appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:appearance-none"
      />
    </div>
  )
}

export { Slider }
