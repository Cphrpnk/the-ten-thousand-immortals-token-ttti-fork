import { CheckCircle2, PauseCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useGetIcpPrice, useGetPresaleStatus } from "../../hooks/useQueries";
import {
  TOKEN_PRICE_USD,
  TTTI_DIVISOR,
  TTTI_SYMBOL,
  formatIcp,
  formatTtti,
  formatUsdE8,
  icpForTtti,
  tttiToUsdE8,
} from "../../lib/token";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Skeleton } from "../ui/skeleton";

const skeletonIds = ["price", "sold", "remaining", "minimum"];

function Stat({
  label,
  value,
  unit,
  note,
  ocid,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  ocid: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 border-t border-border/70 pt-5" data-ocid={ocid}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 font-display text-2xl text-foreground md:text-3xl">
        <span className="min-w-0 break-all tabular-nums">{value}</span>
        {unit && (
          <span className="text-xs uppercase tracking-wider text-primary">
            {unit}
          </span>
        )}
      </p>
      {note && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}
      {children}
    </div>
  );
}

export function PresaleSnapshot() {
  return (
    <section
      aria-label="Presale snapshot"
      className="bg-card/40 section-breathing"
      data-ocid="landing.snapshot.section"
    >
      <div className="container mx-auto px-4">
        <div
          className="relative rounded-lg border border-gold bg-card px-6 pb-8 pt-8 shadow-none md:px-10 md:pb-10 md:pt-10"
          data-ocid="landing.snapshot.panel"
        >
          <div className="mb-10 pr-24 sm:pr-32">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              The offering
            </p>
            <h2 className="mt-3 font-display text-3xl text-foreground md:text-4xl">
              TTTI Presale
            </h2>
          </div>
          <span
            className="absolute right-5 top-5 flex h-20 w-20 items-center justify-center rounded-full border border-gold-strong bg-primary/10 p-1 text-center font-mono text-[10px] font-semibold uppercase leading-tight tracking-wide text-primary shadow-gold sm:right-9 sm:top-9 sm:h-24 sm:w-24"
            aria-label="100% on-chain"
            data-ocid="landing.snapshot.onchain.seal"
          >
            <span aria-hidden="true">
              100%
              <br />
              on-chain
            </span>
          </span>
          <SnapshotBody />
        </div>
      </div>
    </section>
  );
}

function SnapshotBody() {
  const { data: status, isLoading, isError, refetch } = useGetPresaleStatus();
  const { data: icpPrice } = useGetIcpPrice();
  const usdE8 = icpPrice && icpPrice.usdE8 > 0n ? icpPrice.usdE8 : null;

  if (isLoading) {
    return (
      <div
        className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4"
        data-ocid="landing.snapshot.loading_state"
      >
        {skeletonIds.map((id) => (
          <div key={id} className="border-t border-border/70 pt-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div
        className="flex flex-col items-start gap-4 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between"
        data-ocid="landing.snapshot.error_state"
      >
        <div>
          <p className="font-display text-lg text-foreground">
            Live presale figures are unavailable right now
          </p>
          <p className="text-sm text-muted-foreground">
            The reference price stays fixed at{" "}
            {TOKEN_PRICE_USD.toLocaleString("en-US")} USD per {TTTI_SYMBOL}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-gold hover:bg-primary/10"
          onClick={() => void refetch()}
          data-ocid="landing.snapshot.retry_button"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  const { allocation, sold, remaining, minPurchase, complete, salesPaused } =
    status;
  const percent =
    allocation > 0n ? Number((sold * 10_000n) / allocation) / 100 : 0;
  const priceIcp = usdE8 ? icpForTtti(TTTI_DIVISOR, usdE8) : null;
  const minIcp = usdE8 ? icpForTtti(minPurchase, usdE8) : null;

  return (
    <div className="space-y-8">
      {(complete || salesPaused) && (
        <div
          className={`flex items-center gap-3 border-l-2 py-2 pl-4 text-sm ${complete ? "border-primary" : "border-warning"}`}
          aria-live="polite"
          data-ocid={
            complete
              ? "landing.snapshot.complete_state"
              : "landing.snapshot.paused_state"
          }
        >
          {complete ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
          ) : (
            <PauseCircle className="h-5 w-5 shrink-0 text-warning" />
          )}
          <p className="text-foreground">
            {complete
              ? `Presale complete — the full ${formatTtti(allocation)} ${TTTI_SYMBOL} allocation has found its holders.`
              : "Sales are paused for a moment. The ranks will reopen shortly."}
          </p>
        </div>
      )}
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={`Price per ${TTTI_SYMBOL}`}
          value={TOKEN_PRICE_USD.toLocaleString("en-US")}
          unit="USD"
          note={
            priceIcp
              ? `≈ ${formatIcp(priceIcp)} ICP at live rate`
              : "Fixed reference price"
          }
          ocid="landing.snapshot.price_card"
        />
        <Stat
          label="Sold"
          value={formatTtti(sold)}
          unit={TTTI_SYMBOL}
          ocid="landing.snapshot.sold_card"
        >
          <div className="mt-4 space-y-2">
            <Progress
              value={Math.min(percent, 100)}
              className="h-1 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
              aria-label={`Presale ${percent.toFixed(2)}% sold`}
              data-ocid="landing.snapshot.progress"
            />
            <p className="text-xs tabular-nums text-muted-foreground">
              {percent.toFixed(2)}% of {formatTtti(allocation)} {TTTI_SYMBOL}
            </p>
          </div>
        </Stat>
        <Stat
          label="Remaining"
          value={formatTtti(remaining)}
          unit={TTTI_SYMBOL}
          note={`≈ ${formatUsdE8(tttiToUsdE8(remaining), 2)} at reference price`}
          ocid="landing.snapshot.remaining_card"
        />
        <Stat
          label="Minimum purchase"
          value={formatUsdE8(tttiToUsdE8(minPurchase), 2).replace("$", "")}
          unit="USD"
          note={
            minIcp
              ? `≈ ${formatIcp(minIcp)} ICP · ${formatTtti(minPurchase)} ${TTTI_SYMBOL}`
              : `${formatTtti(minPurchase)} ${TTTI_SYMBOL}`
          }
          ocid="landing.snapshot.minimum_card"
        />
      </div>
    </div>
  );
}
