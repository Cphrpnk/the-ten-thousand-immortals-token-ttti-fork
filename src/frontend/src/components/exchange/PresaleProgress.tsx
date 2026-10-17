import { CheckCircle2, PauseCircle, Target } from "lucide-react";
import type { PresaleStatus } from "../../backend";
import {
  TTTI_SYMBOL,
  formatTtti,
  formatUsdE8,
  tttiToUsdE8,
} from "../../lib/token";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { Skeleton } from "../ui/skeleton";

interface PresaleProgressProps {
  status: PresaleStatus | undefined;
  isLoading: boolean;
}

const CARD_CLASS =
  "rounded-xl border border-gold bg-gradient-surface shadow-elevated transition-smooth";

export function PresaleProgress({ status, isLoading }: PresaleProgressProps) {
  if (isLoading || !status) {
    return (
      <Card className={CARD_CLASS} data-ocid="presale.loading_state">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { allocation, sold, remaining, reserved, complete, salesPaused } =
    status;
  const percent =
    allocation > 0n ? Number((sold * 10_000n) / allocation) / 100 : 0;
  const stats = [
    { label: "Allocation", value: allocation },
    { label: "Sold", value: sold },
    { label: "Remaining", value: remaining },
  ];

  return (
    <Card
      className={cn(CARD_CLASS, complete && "border-gold-strong shadow-gold")}
      data-ocid="presale.card"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-imperial flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-primary" />
            Presale progress
          </CardTitle>
          {complete ? (
            <Badge
              className="rounded-full border-gold-strong bg-gradient-primary text-primary-foreground"
              data-ocid="presale.complete_badge"
            >
              Complete
            </Badge>
          ) : salesPaused ? (
            <Badge
              variant="destructive"
              className="rounded-full"
              data-ocid="presale.paused_badge"
            >
              Paused
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-gold bg-primary/10 text-primary"
              data-ocid="presale.live_badge"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse"
              />
              Live
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {complete && (
          <div
            className="flex items-start gap-3 rounded-lg border border-gold-strong bg-primary/10 p-4"
            aria-live="polite"
            data-ocid="presale.complete_state"
          >
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="text-imperial text-gradient-gold text-lg font-bold">
                Presale complete
              </p>
              <p className="text-sm text-muted-foreground">
                The full {formatTtti(allocation)} {TTTI_SYMBOL} allocation has
                been sold. Purchases are closed.
              </p>
            </div>
          </div>
        )}
        {!complete && salesPaused && (
          <div
            className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
            aria-live="polite"
            data-ocid="presale.paused_state"
          >
            <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold">Sales are paused</p>
              <p className="text-sm text-muted-foreground">
                Purchases are temporarily disabled. Please check back soon.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono tabular-nums text-primary">
              {percent.toFixed(2)}% sold
            </span>
            <span className="font-mono tabular-nums">
              {formatTtti(sold)} / {formatTtti(allocation)} {TTTI_SYMBOL}
            </span>
          </div>
          <Progress
            value={Math.min(percent, 100)}
            className="h-2.5 border border-gold bg-background/60 [&>div]:bg-gradient-primary"
            aria-label={`Presale ${percent.toFixed(2)}% sold`}
            data-ocid="presale.progress"
          />
        </div>

        <dl className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="min-w-0 rounded-lg border border-border bg-background/60 p-2.5 transition-smooth hover:border-gold"
            >
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="truncate font-mono text-sm font-semibold tabular-nums">
                {formatTtti(stat.value)}
              </dd>
              <dd className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatUsdE8(tttiToUsdE8(stat.value), 2)}
              </dd>
            </div>
          ))}
        </dl>
        {reserved > 0n && (
          <p className="text-xs text-muted-foreground">
            {formatTtti(reserved)} {TTTI_SYMBOL} is reserved by purchases in
            progress.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
