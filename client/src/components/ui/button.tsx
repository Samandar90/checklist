import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-tight transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(16,24,40,0.12),0_8px_20px_-6px_rgba(45,108,179,0.5),inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-[1.08] hover:shadow-[0_2px_5px_rgba(16,24,40,0.14),0_14px_30px_-6px_rgba(45,108,179,0.55),inset_0_1px_0_rgba(255,255,255,0.3)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_1px_2px_rgba(16,24,40,0.12),0_8px_20px_-6px_rgba(212,24,61,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] hover:brightness-[1.06] hover:shadow-[0_2px_5px_rgba(16,24,40,0.14),0_14px_30px_-6px_rgba(212,24,61,0.55)]",
        outline: "glass-btn",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-foreground/[0.05]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
