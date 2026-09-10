import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Apple pill buttons. `default` is the only place electric blue is allowed;
 * `secondary` is the App Store "GET" pill (cool-wash fill, blue label);
 * `outline` is a hairline ghost pill; `link` is an inline text link.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.01em] transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        outline: "glass-btn",
        secondary: "bg-secondary text-primary hover:bg-secondary-hover",
        ghost: "text-foreground hover:bg-secondary",
        link: "h-auto rounded-none px-0 text-link underline-offset-[3px] hover:underline active:scale-100",
      },
      size: {
        default: "h-9 px-4 text-[14px]",
        sm: "h-8 px-3.5 text-[13px]",
        lg: "h-11 px-6 text-[15px]",
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
