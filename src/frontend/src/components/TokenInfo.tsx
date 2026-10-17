import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { Account } from "../backend";
import { useGetFeeCollector, useTokenInfo } from "../hooks/useQueries";
import {
  PRICE_SCALE,
  TOKEN_NAME,
  TOKEN_PRICE_USD,
  TTTI_DECIMALS,
  TTTI_SYMBOL,
  encodeAccountText,
  formatTtti,
  formatUnits,
  tttiToUsdE8,
} from "../lib/token";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

const shellClass = "w-full rounded-lg border border-gold bg-card shadow-none";
const skeletonIds = ["maximum", "total", "price", "fee"];

export function TokenInfo() {
  const { data: tokenInfo, isLoading, isError } = useTokenInfo();
  const { data: feeCollector } = useGetFeeCollector();

  if (isLoading) {
    return (
      <Card className={shellClass} data-ocid="token.loading_state">
        <CardHeader>
          <Skeleton className="h-8 w-2/3" />
        </CardHeader>
        <CardContent className="grid gap-8 sm:grid-cols-2">
          {skeletonIds.map((id) => (
            <Skeleton key={id} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError || !tokenInfo) {
    return (
      <Card className={shellClass} data-ocid="token.error_state">
        <CardHeader>
          <CardTitle className="font-display text-xl text-foreground">
            Token details are unavailable
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            The ledger could not be reached just now. Please try again in a
            moment.
          </p>
        </CardHeader>
      </Card>
    );
  }

  const decimals = tokenInfo.decimals || TTTI_DECIMALS;
  const symbol = tokenInfo.symbol || TTTI_SYMBOL;
  const feeUsd = Number(tttiToUsdE8(tokenInfo.fee)) / Number(PRICE_SCALE);
  const feeUsdText = feeUsd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

  return (
    <Card className={shellClass} data-ocid="token.card">
      <CardHeader className="space-y-3 px-6 pb-4 pt-8 md:px-9 md:pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">
          The ledger
        </p>
        <CardTitle
          className="font-display text-2xl text-foreground md:text-3xl"
          data-ocid="token.name"
        >
          TTTI-T <span className="text-muted-foreground">(Test)</span>
        </CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Live figures from the existing ledger. Its recorded name is{" "}
          {tokenInfo.name || TOKEN_NAME} and its on-chain symbol remains{" "}
          {symbol}
          {";"} TTTI-T is the public Test name, not a change to the ledger or
          its transaction history.
        </p>
      </CardHeader>
      <CardContent className="px-6 pb-8 md:px-9 md:pb-10">
        <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          <Metric
            label="Maximum supply"
            value={formatTtti(tokenInfo.maxSupply, decimals)}
            unit={symbol}
          />
          <Metric
            label="Total supply"
            value={formatTtti(tokenInfo.totalSupply, decimals)}
            unit={symbol}
          />
          <Metric
            label="Reference price"
            value={TOKEN_PRICE_USD.toLocaleString("en-US")}
            unit="USD"
          />
          <Metric
            label="Transfer fee"
            value={formatUnits(tokenInfo.fee, decimals, 0)}
            unit={symbol}
            note={`≈ ${feeUsdText} USD`}
          />
        </dl>

        <p className="border-t border-border/70 py-5 text-xs tracking-wide text-muted-foreground">
          Ledger standards: ICRC-1 · ICRC-2 · ICRC-3
        </p>

        <details
          className="group border-t border-border/70 pt-5"
          data-ocid="token.technical.panel"
        >
          <summary
            className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
            data-ocid="token.technical.toggle"
          >
            Technical details
            <span
              aria-hidden="true"
              className="text-primary transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <dl className="grid gap-5 pb-2 pt-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                Recorded ledger name
              </dt>
              <dd className="mt-2 font-mono text-sm text-foreground">
                {tokenInfo.name || TOKEN_NAME}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                On-chain symbol
              </dt>
              <dd className="mt-2 font-mono text-sm text-foreground">
                {symbol}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                Decimals
              </dt>
              <dd className="mt-2 font-mono text-sm text-foreground">
                {decimals.toString()}
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                Fee collector account
              </dt>
              <dd className="mt-2">
                <FeeCollector account={feeCollector?.account} />
              </dd>
              {feeCollector && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Collected fees: {formatTtti(feeCollector.balance, decimals)}{" "}
                  {symbol}
                </p>
              )}
            </div>
          </dl>
        </details>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  unit,
  note,
}: { label: string; value: string; unit: string; note?: string }) {
  return (
    <div className="min-w-0 border-b border-border/70 py-6 first:pt-3 sm:[&:nth-child(-n+2)]:pt-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.17em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="min-w-0 break-all font-display text-2xl tabular-nums text-foreground md:text-[1.7rem]">
          {value}
        </span>
        <span className="text-xs font-medium tracking-wider text-primary">
          {unit}
        </span>
      </dd>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function FeeCollector({ account }: { account: Account | undefined }) {
  const [copied, setCopied] = useState(false);
  const fullText = account ? encodeAccountText(account) : "";

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!account) return <Skeleton className="h-5 w-48" />;

  return (
    <div
      className="flex min-w-0 items-center gap-2"
      data-ocid="token.fee_collector_account"
    >
      <span
        className="min-w-0 truncate font-mono text-xs text-foreground"
        title={fullText}
        aria-label={`Fee collector account: ${fullText}`}
      >
        {fullText}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-primary"
        aria-label={
          copied ? "Fee collector account copied" : "Copy fee collector account"
        }
        onClick={() =>
          void navigator.clipboard
            .writeText(fullText)
            .then(() => setCopied(true))
            .catch(() => setCopied(false))
        }
        data-ocid="token.fee_collector_account_copy_button"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
