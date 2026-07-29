import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        pass: "border-green-200 bg-green-50 text-status-pass",
        fail: "border-red-200 bg-red-50 text-status-fail",
        warning: "border-amber-200 bg-amber-50 text-status-warning",
        manual: "border-blue-200 bg-blue-50 text-status-manual",
        unknown: "border-slate-200 bg-slate-50 text-status-unknown",
        error: "border-rose-200 bg-rose-50 text-status-error",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
