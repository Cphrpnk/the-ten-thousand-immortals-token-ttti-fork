import { ArrowRight } from "lucide-react";
import { useBuyFunnel } from "../../hooks/useBuyFunnel";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export type BuyTttiButtonSize = "sm" | "default" | "lg";
export type BuyTttiButtonVariant = "primary" | "outline";

export interface BuyTttiButtonProps {
  size?: BuyTttiButtonSize;
  variant?: BuyTttiButtonVariant;
  className?: string;
  /** Visible label; defaults to "Buy TTTI-T (Test)". */
  label?: string;
  /** Show the trailing arrow icon. */
  showIcon?: boolean;
  /** data-ocid marker; defaults to "buy_ttti.primary_button". */
  ocid?: string;
  /** Extra side effect run before the funnel starts (e.g. close a menu). */
  onClick?: () => void;
}

const variantClass: Record<BuyTttiButtonVariant, string> = {
  primary:
    "border border-gold-strong bg-gradient-primary text-primary-foreground shadow-gold hover:shadow-gold-lg hover:brightness-110",
  outline:
    "border border-gold bg-transparent text-foreground hover:border-gold-strong hover:bg-primary/10 hover:text-foreground",
};

const sizeClass: Record<BuyTttiButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  default: "h-11 px-6 text-sm",
  lg: "h-12 px-8 text-base",
};

export function BuyTttiButton({
  size = "default",
  variant = "primary",
  className,
  label = "Buy TTTI-T (Test)",
  showIcon = false,
  ocid = "buy_ttti.primary_button",
  onClick,
}: BuyTttiButtonProps) {
  const { startBuy } = useBuyFunnel();

  return (
    <Button
      type="button"
      onClick={() => {
        onClick?.();
        startBuy();
      }}
      className={cn(
        "group gap-2 rounded-md font-semibold tracking-wide transition-smooth active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      data-ocid={ocid}
    >
      <span>{label}</span>
      {showIcon && (
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      )}
    </Button>
  );
}
