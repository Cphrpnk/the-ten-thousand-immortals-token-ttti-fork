import { RefreshCw } from "lucide-react";
import { useGetPresaleStatus } from "../../hooks/useQueries";
import { TOKEN_PRICE_USD, TTTI_SYMBOL, formatTtti } from "../../lib/token";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Skeleton } from "../ui/skeleton";

export function PresaleSection() {
  const { data: status, isLoading, isError, refetch } = useGetPresaleStatus();
  const percent =
    status && status.allocation > 0n
      ? Number((status.sold * 10_000n) / status.allocation) / 100
      : 0;

  return (
    <section
      aria-labelledby="test-offering-title"
      className="bg-card/40 section-breathing"
      data-ocid="landing.snapshot.section"
    >
      <div className="container mx-auto px-4">
        <div className="rounded-lg border border-border bg-card px-6 py-8 md:px-10 md:py-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.23em] text-muted-foreground">
              Current test offering
            </p>
            <h2
              id="test-offering-title"
              className="mt-3 font-display text-3xl text-foreground md:text-4xl"
            >
              TTTI-T <span className="text-muted-foreground">(Test)</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              This Test identity refers to the existing token ledger. Its actual
              on-chain symbol is still{" "}
              <strong className="text-foreground">{TTTI_SYMBOL}</strong>.
              Earlier balances and transactions have not been renamed or reset.
              Purchases and wallet records therefore continue to show the ledger
              symbol where accuracy matters.
            </p>
          </div>

          {isLoading ? (
            <div
              className="mt-9 grid gap-6 border-t border-border pt-7 sm:grid-cols-3"
              data-ocid="landing.snapshot.loading_state"
            >
              {(["price", "sold", "remaining"] as const).map((id) => (
                <Skeleton key={id} className="h-16 w-full" />
              ))}
            </div>
          ) : isError || !status ? (
            <div
              className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-7"
              data-ocid="landing.snapshot.error_state"
            >
              <p className="text-sm text-muted-foreground">
                Live allocation figures are temporarily unavailable. The ledger
                identity remains unchanged.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refetch()}
                data-ocid="landing.snapshot.retry_button"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : (
            <div
              className="mt-9 border-t border-border pt-7"
              data-ocid="landing.snapshot.panel"
            >
              <p className="mb-6 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {status.complete
                  ? "Allocation complete"
                  : status.salesPaused
                    ? "Purchases paused"
                    : "Current allocation"}
              </p>
              <dl className="grid gap-8 sm:grid-cols-3">
                <div data-ocid="landing.snapshot.price_card">
                  <dt className="text-xs text-muted-foreground">
                    Reference price per TTTI-T (Test)
                  </dt>
                  <dd className="mt-2 font-display text-2xl tabular-nums text-foreground">
                    {TOKEN_PRICE_USD.toLocaleString("en-US")}{" "}
                    <span className="font-body text-xs">USD</span>
                  </dd>
                </div>
                <div data-ocid="landing.snapshot.sold_card">
                  <dt className="text-xs text-muted-foreground">Allocated</dt>
                  <dd className="mt-2 font-display text-2xl tabular-nums text-foreground">
                    {formatTtti(status.sold)}{" "}
                    <span className="font-body text-xs">{TTTI_SYMBOL}</span>
                  </dd>
                </div>
                <div data-ocid="landing.snapshot.remaining_card">
                  <dt className="text-xs text-muted-foreground">Remaining</dt>
                  <dd className="mt-2 font-display text-2xl tabular-nums text-foreground">
                    {formatTtti(status.remaining)}{" "}
                    <span className="font-body text-xs">{TTTI_SYMBOL}</span>
                  </dd>
                </div>
              </dl>
              <div className="mt-8 max-w-xl">
                <Progress
                  value={Math.min(percent, 100)}
                  aria-label={`${percent.toFixed(2)}% of the current allocation distributed`}
                  className="h-1 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
                  data-ocid="landing.snapshot.progress"
                />
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                  {percent.toFixed(2)}% of {formatTtti(status.allocation)}{" "}
                  {TTTI_SYMBOL}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
