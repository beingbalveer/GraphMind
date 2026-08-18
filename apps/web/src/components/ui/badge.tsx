import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-sky-600 text-white shadow-xs",
        secondary: "border-slate-200 bg-slate-100 text-slate-700",
        outline: "border-slate-300 text-slate-700 bg-white",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        destructive: "border-rose-200 bg-rose-50 text-rose-700",
        mono: "border-slate-200 bg-slate-100 text-slate-600 font-mono",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
