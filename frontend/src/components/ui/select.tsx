import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (value: string) => void
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, onValueChange, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
            className
          )}
          ref={ref}
          onChange={(e) => onValueChange?.(e.target.value)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none opacity-50" />
      </div>
    )
  }
)
Select.displayName = "Select"

export interface SelectTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, asChild, children, ...props }, ref) => {
    return (
      <button
        type="button"
        ref={ref}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

export interface SelectContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end"
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, align = "start", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "end" && "right-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SelectContent.displayName = "SelectContent"

export interface SelectItemProps
  extends React.HTMLAttributes<HTMLOptionElement> {
  value: string
}

const SelectItem = React.forwardRef<HTMLOptionElement, SelectItemProps>(
  ({ className, children, value, ...props }, ref) => {
    return (
      <option
        ref={ref}
        value={value}
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </option>
    )
  }
)
SelectItem.displayName = "SelectItem"

const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  return <span className="text-muted-foreground">{placeholder}</span>
}

export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
}
