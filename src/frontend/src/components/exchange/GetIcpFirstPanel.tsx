import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Coins, Copy, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { formatIcp } from "../../lib/token";
import { Button } from "../ui/button";

interface GetIcpFirstPanelProps {
  /** Principal ID of the connected wallet that receives ICP. */
  principal: string;
  walletName: string;
  /** Current ICP balance in e8s. */
  balanceE8s: bigint;
  /** ICP (e8s) needed for the chosen purchase, when known. */
  requiredE8s?: bigint;
}

/** Shown when the connected wallet holds no ICP or too little for the purchase. */
export function GetIcpFirstPanel({
  principal,
  walletName,
  balanceE8s,
  requiredE8s,
}: GetIcpFirstPanelProps) {
  const [copied, setCopied] = useState(false);
  const empty = balanceE8s === 0n;
  const shortfall =
    requiredE8s !== undefined && requiredE8s > balanceE8s
      ? requiredE8s - balanceE8s
      : null;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(principal);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      aria-labelledby="get-icp-first-title"
      aria-live="polite"
      className="relative overflow-hidden rounded-xl border border-gold-strong bg-gradient-surface p-5 shadow-gold"
      data-ocid="exchange.get_icp.panel"
    >
      <div
        aria-hidden="true"
        className="glow-crest pointer-events-none absolute -right-16 -top-16 h-48 w-48 opacity-80"
      />
      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold bg-primary/10">
            <Coins className="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2
              id="get-icp-first-title"
              className="text-imperial text-gradient-gold text-lg font-semibold"
            >
              Get ICP first
            </h2>
            <p className="text-sm text-muted-foreground">
              {empty
                ? `TTTI is bought with ICP, and your ${walletName} wallet holds none yet. Acquire ICP, then return here to complete your purchase.`
                : "Your ICP balance is too low for this purchase. Top up with ICP, then return here to complete it."}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your balance
            </dt>
            <dd
              className="font-mono tabular-nums font-semibold"
              data-ocid="exchange.get_icp.balance"
            >
              {formatIcp(balanceE8s)} ICP
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {shortfall !== null ? "Still needed" : "Needed"}
            </dt>
            <dd className="font-mono tabular-nums font-semibold text-primary">
              {shortfall !== null ? `${formatIcp(shortfall)} ICP` : "Any ICP"}
            </dd>
          </div>
        </dl>

        <Button
          asChild
          className="min-h-11 w-full gap-2 rounded-lg border border-gold-strong bg-gradient-primary font-semibold text-primary-foreground shadow-gold transition-smooth hover:shadow-gold-lg hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]"
        >
          <Link to="/buy-icp" data-ocid="exchange.get_icp.primary_button">
            Get ICP
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>

        <div className="divider-gold" />

        <div className="space-y-2" data-ocid="exchange.get_icp.receive_note">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Send className="h-4 w-4 text-primary" aria-hidden="true" />
            Already have ICP elsewhere? Send it to your connected wallet
          </p>
          <p className="text-xs text-muted-foreground">
            Your {walletName} wallet can receive ICP at this Principal ID. Send
            from an exchange or another wallet, then return to buy TTTI.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-gold bg-background/60 p-2 pl-3">
            <code
              className="min-w-0 flex-1 break-all font-mono text-xs"
              data-ocid="exchange.get_icp.principal"
            >
              {principal}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 rounded-md border-gold bg-transparent text-xs transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-primary"
              onClick={() => void handleCopy()}
              aria-label="Copy wallet Principal ID"
              data-ocid="exchange.get_icp.copy_button"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
