import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

const Sheet: React.FC<SheetProps> = ({ open, onOpenChange, children }) => {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => onOpenChange?.(false)}
        />
      )}
      {children}
    </>
  )
}

const SheetTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => {
  // For simplicity, we just render a button - asChild would require more complex composition
  return (
    <button ref={ref} {...props}>
      {children}
    </button>
  )
})
SheetTrigger.displayName = "SheetTrigger"

export interface SheetContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right"
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, side = "right", children, ...props }, ref) => {
    const sideClasses = {
      top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
      bottom:
        "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
      right:
        "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          sideClasses[side],
          className
        )}
        {...props}
      >
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={() => {
            const closeButton = document.querySelector("[data-sheet-close]")
            if (closeButton instanceof HTMLElement) {
              closeButton.click()
            }
          }}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    )
  }
)
SheetContent.displayName = "SheetContent"

const SheetHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h2
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
)
SheetTitle.displayName = "SheetTitle"

const SheetDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => (
  <p
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
)
SheetDescription.displayName = "SheetDescription"

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
}
