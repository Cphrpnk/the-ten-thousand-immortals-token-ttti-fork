import type { Principal } from "@icp-sdk/core/principal";
import {
  Check,
  Copy,
  Loader2,
  LogIn,
  LogOut,
  Wallet as WalletIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Account } from "../backend";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { DeliveryAddressReminder } from "../components/wallet/DeliveryAddressReminder";
import { ReceivePanel } from "../components/wallet/ReceivePanel";
import { SendPanel } from "../components/wallet/SendPanel";
import { TokenBalanceCard } from "../components/wallet/TokenBalanceCard";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { usePlug } from "../hooks/usePlug";
import { useListTokens } from "../hooks/useWallet";
import { encodeAccountText } from "../lib/token";

const PRIMARY_GOLD =
  "rounded-lg shadow-gold transition-smooth hover:brightness-110";
const OUTLINE_GOLD =
  "rounded-lg border-gold transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-foreground";

function truncatePrincipal(principal: string): string {
  if (principal.length <= 22) return principal;
  return `${principal.slice(0, 12)}…${principal.slice(-6)}`;
}

export function WalletPage() {
  const { identity, login, clear, loginStatus } = useInternetIdentity();
  const {
    principal: plugPrincipal,
    isConnecting: plugConnecting,
    isAvailable: plugAvailable,
    connect: connectPlug,
    disconnect: disconnectPlug,
  } = usePlug();

  const iiPrincipal = identity?.getPrincipal() ?? null;
  const activePrincipal: Principal | null = plugPrincipal ?? iiPrincipal;
  const activeSource = plugPrincipal
    ? "Plug"
    : iiPrincipal
      ? "Internet Identity"
      : null;
  const account: Account | undefined = activePrincipal
    ? { owner: activePrincipal }
    : undefined;
  const accountText = account ? encodeAccountText(account) : "";

  const { data: tokens, isLoading: tokensLoading } = useListTokens();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!accountText) return;
    try {
      await navigator.clipboard.writeText(accountText);
      setCopied(true);
      toast.success("Account copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Unable to copy the account");
    }
  };

  const handleConnectPlug = async () => {
    try {
      await connectPlug();
      toast.success("Plug wallet connected");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to connect Plug",
      );
    }
  };

  const handleDisconnectPlug = async () => {
    await disconnectPlug();
    toast.success("Plug wallet disconnected");
  };

  const handleAuth = async () => {
    if (iiPrincipal) {
      await clear();
      toast.success("Signed out of Internet Identity");
    } else {
      await login();
    }
  };

  return (
    <div className="flex flex-col gap-8 md:gap-12" data-ocid="wallet.page">
      <div className="flex flex-col gap-2">
        <h1 className="text-imperial text-gradient-gold text-3xl leading-tight md:text-5xl">
          Wallet
        </h1>
        <p className="text-muted-foreground">
          Connect your wallet, review balances and send or receive tokens.
        </p>
      </div>

      <DeliveryAddressReminder enabled={!!activePrincipal} />

      <Card className="rounded-lg border-gold bg-card shadow-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <WalletIcon className="h-5 w-5 text-primary" />
            Active Identity
          </CardTitle>
          <CardDescription>
            {activeSource
              ? `Connected with ${activeSource}`
              : "No wallet connected yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Account
              </p>
              <p
                className="truncate font-mono text-sm"
                title={accountText || undefined}
                data-ocid="wallet.principal"
              >
                {accountText ? truncatePrincipal(accountText) : "Not connected"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeSource && (
                <Badge
                  variant="secondary"
                  className="rounded-full border-gold font-mono text-primary"
                >
                  {activeSource}
                </Badge>
              )}
              {activePrincipal && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={OUTLINE_GOLD}
                  onClick={handleCopy}
                  data-ocid="wallet.copy_button"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copy
                </Button>
              )}
            </div>
          </div>

          <Separator className="divider-gold bg-transparent" />

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant={iiPrincipal ? "outline" : "default"}
              onClick={handleAuth}
              disabled={loginStatus === "logging-in"}
              className={iiPrincipal ? OUTLINE_GOLD : PRIMARY_GOLD}
              data-ocid="wallet.ii_button"
            >
              {loginStatus === "logging-in" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : iiPrincipal ? (
                <LogOut className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {iiPrincipal ? "Sign out of II" : "Connect Internet Identity"}
            </Button>

            <Button
              type="button"
              variant={plugPrincipal ? "destructive" : "default"}
              onClick={plugPrincipal ? handleDisconnectPlug : handleConnectPlug}
              disabled={plugConnecting || !plugAvailable}
              className={
                plugPrincipal ? "rounded-lg transition-smooth" : PRIMARY_GOLD
              }
              data-ocid="wallet.plug_button"
            >
              {plugConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : plugPrincipal ? (
                <LogOut className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {plugPrincipal ? "Disconnect Plug" : "Connect Plug"}
            </Button>
          </div>

          {!plugAvailable && (
            <p className="text-xs text-muted-foreground">
              Plug extension not detected. Install Plug to connect a browser
              wallet.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-imperial text-xl text-foreground md:text-2xl">
            Balances
          </h2>
          {activePrincipal && (
            <span className="max-w-[50%] truncate font-mono text-xs text-muted-foreground">
              {truncatePrincipal(activePrincipal.toText())}
            </span>
          )}
        </div>

        {tokensLoading ? (
          <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => `wallet-skeleton-${i}`).map(
              (id) => (
                <Skeleton key={id} className="h-36 w-full rounded-lg" />
              ),
            )}
          </div>
        ) : !tokens || tokens.length === 0 ? (
          <Card
            className="rounded-lg border-dashed border-gold bg-card"
            data-ocid="wallet.empty_state"
          >
            <CardContent className="py-10 text-center text-muted-foreground">
              No tokens are available for this wallet yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tokens.map((token, index) => (
              <TokenBalanceCard
                key={token.canisterId.toText()}
                token={token}
                account={account}
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <SendPanel tokens={tokens ?? []} account={account} />
        <ReceivePanel tokens={tokens ?? []} account={account} />
      </section>
    </div>
  );
}
