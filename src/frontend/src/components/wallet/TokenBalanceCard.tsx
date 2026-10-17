import type { Principal } from "@icp-sdk/core/principal";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { Account, TokenDescriptor } from "../../backend";
import { useWalletBalance } from "../../hooks/useWallet";
import {
  TOKEN_NAME,
  TTTI_DECIMALS,
  TTTI_SYMBOL,
  formatUnits,
} from "../../lib/token";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export { formatUnits };

/** True for this app's own presale token (any TTTI symbol variant). */
export function isTttiToken(token: TokenDescriptor): boolean {
  return token.symbol.toUpperCase().startsWith("TTTI");
}

/** Present TTTI-P with its canonical name, symbol and 8 decimals. */
export function normalizeToken(token: TokenDescriptor): TokenDescriptor {
  if (!isTttiToken(token)) return token;
  return {
    ...token,
    name: TOKEN_NAME,
    symbol: TTTI_SYMBOL,
    decimals: TTTI_DECIMALS,
  };
}

interface TokenBalanceCardProps {
  token: TokenDescriptor;
  account: Account | undefined;
  index: number;
}

export function TokenBalanceCard({
  token: rawToken,
  account,
  index,
}: TokenBalanceCardProps) {
  const token = normalizeToken(rawToken);
  const { data, isLoading, isError, refetch, isFetching } = useWalletBalance(
    token.canisterId,
    account,
  );

  const balance =
    data && data.__kind__ === "Ok" ? (data.Ok.balance ?? 0n) : null;
  const ledgerUnavailable = data?.__kind__ === "Err";

  return (
    <Card
      className="rounded-lg border-gold bg-gradient-surface shadow-subtle transition-smooth hover:border-gold-strong hover:shadow-gold animate-fade-in"
      data-ocid={`wallet.item.${index}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="secondary"
            className="rounded-full border-gold font-mono text-xs text-primary"
            data-ocid={`wallet.symbol.${index}`}
          >
            {token.symbol}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground transition-smooth hover:bg-primary/10 hover:text-primary"
            onClick={() => void refetch()}
            disabled={isFetching || !account}
            aria-label={`Refresh ${token.symbol} balance`}
            data-ocid={`wallet.refresh_button.${index}`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        <CardTitle className="text-sm font-display font-medium text-foreground">
          {token.name}
        </CardTitle>
        <CardDescription className="font-mono text-xs truncate">
          {token.canisterId.toText()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : !account ? (
          <p className="text-sm text-muted-foreground">
            Connect a wallet to view this balance.
          </p>
        ) : isError || ledgerUnavailable ? (
          <p
            className="flex items-center gap-2 text-sm text-destructive"
            data-ocid={`wallet.error_state.${index}`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Ledger unavailable
          </p>
        ) : (
          <p
            className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-2xl font-semibold tabular-nums break-all text-foreground"
            data-ocid={`wallet.balance.${index}`}
          >
            {formatUnits(balance ?? 0n, token.decimals)}
            <span className="text-base font-normal text-primary">
              {token.symbol}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export interface TokenOption {
  canisterId: Principal;
  symbol: string;
  name: string;
  decimals: number;
  fee: bigint;
}
