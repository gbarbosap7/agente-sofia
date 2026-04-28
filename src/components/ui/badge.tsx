import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide border",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground border-border",
        accent: "bg-accent/15 text-accent border-accent/30",
        warn: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        danger: "bg-destructive/15 text-destructive border-destructive/30",
        outline: "bg-transparent border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...p }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
