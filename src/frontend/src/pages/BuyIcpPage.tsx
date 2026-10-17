import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CreditCard,
  ExternalLink,
  Landmark,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { SiInternetcomputer } from "react-icons/si";
import { TreasuryMode } from "../backend";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useGetOnRampLinks,
  useGetPresaleStatus,
  usePublicTreasuryInfo,
} from "../hooks/useQueries";
import {
  TOKEN_PRICE_USD,
  TRANSFERS_FROZEN_PURCHASE_MESSAGE,
  TTTI_SYMBOL,
  encodeAccountText,
  formatBps,
} from "../lib/token";
import { cn } from "../lib/utils";

interface OnRamp {
  name: string;
  url: string;
  description: string;
  icon: typeof CreditCard;
  primary?: boolean;
}

function iconFor(name: string): typeof CreditCard {
  const normalized = name.toLowerCase();
  if (normalized.includes("onramper")) return Banknote;
  if (normalized.includes("moonpay")) return CreditCard;
  if (normalized.includes("ramp")) return Banknote;
  if (normalized.includes("transak")) return Landmark;
  return CreditCard;
}

const ONRAMPER: OnRamp = {
  name: "Onramper",
  url: "https://onramper.com/",
  description:
    "Aggregator that compares and routes to the best on-ramp for your region.",
  icon: Banknote,
  primary: true,
};

const DEFAULT_ONRAMPS: Array<OnRamp> = [
  ONRAMPER,
  {
    name: "MoonPay",
    url: "https://www.moonpay.com/buy/icp",
    description:
      "Card and bank purchases of ICP with the broadest regional coverage.",
    icon: CreditCard,
  },
  {
    name: "Ramp",
    url: "https://ramp.network/buy?swapAsset=ICP",
    description: "Fast card checkout with transparent, up-front fees.",
    icon: Banknote,
  },
  {
    name: "Transak",
    url: "https://global.transak.com/?cryptoCurrency=ICP",
    description: "Bank transfer and card on-ramp with wide fiat support.",
    icon: Landmark,
  },
];

const WALLETS = [
  {
    name: "Plug",
    url: "https://plugwallet.ooo/",
    description: "Browser extension and mobile wallet for ICP.",
  },
  {
    name: "Stoic",
    url: "https://www.stoicwallet.com/",
    description: "Web wallet with a built-in ICP account identifier.",
  },
  {
    name: "NNS",
    url: "https://nns.ic0.app/",
    description: "The Network Nervous System dapp and its ICP wallet.",
  },
];

const STEPS = [
  "Open your ICP wallet (Plug, Stoic, or the NNS dapp) and copy your ICP account identifier.",
  "Choose an on-ramp above and complete the purchase with your card or bank transfer.",
  "At the provider, paste your own wallet address as the destination. This is a manual step.",
  "Wait for the ICP to arrive in your wallet, then return to the Exchange to claim your TTTI.",
];

const cardClass =
  "rounded-lg bg-card border border-gold shadow-subtle transition-smooth hover:border-gold-strong";
const panelClass = "rounded-lg border border-gold bg-background/60 p-5";
const ctaClass =
  "group h-12 gap-2 rounded-md border border-gold-strong bg-gradient-primary px-8 text-base font-semibold tracking-wide text-primary-foreground shadow-gold transition-smooth hover:shadow-gold-lg hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function ReturnToPurchase({
  ocid,
  className,
}: { ocid: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 rounded-lg border border-gold bg-card p-6 shadow-subtle sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground sm:text-base">
        Once you have ICP, come back and claim your TTTI.
      </p>
      <Button asChild className={ctaClass} data-ocid={ocid}>
        <Link to="/exchange">
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Return to purchase
        </Link>
      </Button>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-imperial text-lg text-foreground md:text-xl">
      {children}
    </h2>
  );
}

export function BuyIcpPage() {
  const { identity, login, loginStatus } = useInternetIdentity();
  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();
  const { data: publicTreasury, isLoading } = usePublicTreasuryInfo();
  const { data: status } = useGetPresaleStatus();
  const transfersFrozen = !!status?.transfersFrozen;
  const {
    data: onRampLinks,
    isLoading: onRampsLoading,
    isError: onRampsError,
  } = useGetOnRampLinks();

  const pricingRows: Array<{ id: string; label: string; value: string }> =
    publicTreasury
      ? [
          {
            id: "mode",
            label: "Pricing mode",
            value:
              publicTreasury.mode === TreasuryMode.auto
                ? "Automatic (live ICP/USD price)"
                : "Manual",
          },
          {
            id: "margin",
            label: "Presale margin",
            value: formatBps(publicTreasury.marginBps),
          },
          {
            id: "reference",
            label: "Reference price",
            value: `1 ${TTTI_SYMBOL} = ${TOKEN_PRICE_USD.toLocaleString("en-US")} USD`,
          },
        ]
      : [];

  const publicTreasuryPanel = (
    <div
      className={cn(panelClass, "space-y-4")}
      data-ocid="buy_icp.treasury_panel"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Presale pricing & treasury ICP account
      </p>
      {isLoading ? (
        <div className="space-y-2" data-ocid="buy_icp.deposit_loading_state">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : publicTreasury ? (
        <>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            {pricingRows.map((row) => (
              <div
                key={row.id}
                className="space-y-0.5"
                data-ocid={`buy_icp.pricing_${row.id}`}
              >
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Treasury ICP account (receives the ICP from purchases)
            </p>
            <p
              className="break-all font-mono text-sm text-foreground"
              data-ocid="buy_icp.deposit_account"
            >
              {encodeAccountText(publicTreasury.icpAccount)}
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          The treasury account has not been configured by an admin yet.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Purchases are price-protected: if the ICP price moves beyond the
        protection limit before your purchase settles, it is rejected and no ICP
        is taken — simply review the new quote and try again.
      </p>
    </div>
  );

  // Signed-out or failed lookups fall back to the default directory.
  const configured: Array<OnRamp> =
    !onRampsError && onRampLinks && onRampLinks.length > 0
      ? onRampLinks.map((link) => ({
          name: link.name,
          url: link.url,
          description: "Buy ICP from this provider.",
          icon: iconFor(link.name),
        }))
      : DEFAULT_ONRAMPS;

  const hasOnramper = configured.some((ramp) =>
    ramp.name.toLowerCase().includes("onramper"),
  );
  const onramps: Array<OnRamp> = hasOnramper
    ? configured.map((ramp) => ({
        ...ramp,
        primary: ramp.name.toLowerCase().includes("onramper"),
      }))
    : [ONRAMPER, ...configured];

  const showSkeleton = onRampsLoading && !onRampsError;

  return (
    <div
      className="mx-auto flex max-w-5xl flex-col gap-10"
      data-ocid="buy_icp.page"
    >
      <header className="animate-fade-up space-y-4">
        <Badge
          variant="secondary"
          className="gap-1.5 rounded-full border border-gold text-xs uppercase tracking-widest"
        >
          <SiInternetcomputer className="h-3 w-3" />
          On-ramp
        </Badge>
        <h1 className="text-imperial text-balance text-3xl leading-tight text-foreground md:text-5xl">
          Get <span className="text-gradient-gold">ICP</span> first
        </h1>
        <p className="max-w-2xl text-muted-foreground md:text-lg">
          Every Immortal needs provisions before the march. Acquire ICP from a
          trusted on-ramp, send it to your own wallet, then return to claim your
          place among the Ten Thousand.
        </p>
        <div className="divider-gold" />
      </header>

      <ReturnToPurchase ocid="buy_icp.return_top_button" />

      {transfersFrozen && (
        <Alert variant="destructive" data-ocid="buy_icp.frozen_error_state">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Purchases paused — transfers frozen</AlertTitle>
          <AlertDescription>
            {TRANSFERS_FROZEN_PURCHASE_MESSAGE}
          </AlertDescription>
        </Alert>
      )}

      <Alert
        className="border-warning/30 bg-warning/10 text-foreground"
        data-ocid="buy_icp.warning_state"
      >
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">Two separate steps</AlertTitle>
        <AlertDescription className="text-foreground/85">
          The purchase happens at the third-party provider. Sending the ICP to
          your wallet is a manual step you complete yourself — the provider does
          not deliver to your wallet automatically, and it does not know about
          this app.
        </AlertDescription>
      </Alert>

      <section className="space-y-5" data-ocid="buy_icp.onramp_section">
        <div className="space-y-2">
          <SectionTitle>Choose an on-ramp</SectionTitle>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Each provider opens in a new tab. Onramper is the recommended
            aggregator — it compares providers and routes you to the best one
            for your region.
          </p>
        </div>
        {showSkeleton ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            data-ocid="buy_icp.onramp_loading_state"
          >
            {Array.from({ length: 4 }, (_, i) => `onramp-skeleton-${i}`).map(
              (id) => (
                <Skeleton key={id} className="h-52 w-full rounded-lg" />
              ),
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {onramps.map((ramp) => {
              const Icon = ramp.icon;
              const slug = ramp.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
              return (
                <article
                  key={ramp.name}
                  className={cn(
                    cardClass,
                    "flex flex-col gap-4 p-5 hover:-translate-y-0.5",
                    ramp.primary && "border-gold-strong shadow-gold",
                  )}
                  data-ocid={`buy_icp.onramp_card.${slug}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gold bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    {ramp.primary && (
                      <Badge className="rounded-full text-[10px] uppercase tracking-widest">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-semibold text-foreground">
                      {ramp.name}
                    </h3>
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {ramp.description}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className={cn(
                      "mt-auto w-full gap-2 rounded-md transition-smooth focus-visible:ring-2 focus-visible:ring-ring",
                      ramp.primary
                        ? "border-gold-strong bg-gradient-primary text-primary-foreground hover:brightness-110 hover:text-primary-foreground"
                        : "border-gold-strong bg-transparent text-primary hover:bg-primary/10 hover:text-primary",
                    )}
                    data-ocid={`buy_icp.onramp_link.${slug}`}
                  >
                    <a
                      href={ramp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buy ICP with ${ramp.name} (opens in a new tab)`}
                    >
                      Buy with {ramp.name}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        className={cn(cardClass, "space-y-8 p-6 md:p-8")}
        data-ocid="buy_icp.instructions_card"
      >
        <div className="space-y-2">
          <SectionTitle>The four steps</SectionTitle>
          <p className="text-sm text-muted-foreground">
            Follow these steps with your own ICP wallet (Plug, Stoic, or NNS).
          </p>
        </div>

        <ol className="grid gap-4 md:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step} className={cn(panelClass, "flex gap-4")}>
              <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-strong bg-primary/10 text-base font-semibold text-primary">
                {index + 1}
              </span>
              <span className="text-sm leading-relaxed text-foreground">
                {step}
              </span>
            </li>
          ))}
        </ol>

        <div className="divider-gold" />

        <div className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Get an ICP wallet
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {WALLETS.map((wallet) => (
              <a
                key={wallet.name}
                href={wallet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-lg border border-gold bg-background/60 p-4 transition-smooth hover:border-gold-strong hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                data-ocid={`buy_icp.wallet_link.${wallet.name.toLowerCase()}`}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                  {wallet.name}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground transition-smooth group-hover:text-primary" />
                </span>
                <span className="mt-1 block text-xs text-foreground/80">
                  {wallet.description}
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="divider-gold" />

        {publicTreasuryPanel}

        {isAuthenticated ? (
          <div
            className={cn(panelClass, "space-y-2")}
            data-ocid="buy_icp.account_panel"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Wallet className="h-4 w-4 text-primary" />
              Your account
            </p>
            <p
              className="break-all font-mono text-sm text-foreground"
              data-ocid="buy_icp.own_account"
            >
              {encodeAccountText({ owner: identity.getPrincipal() })}
            </p>
            <p className="text-xs text-muted-foreground">
              Send ICP to your own wallet first — the treasury account only
              receives ICP when you buy on the Exchange.
            </p>
          </div>
        ) : (
          <div
            className={cn(
              panelClass,
              "flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between",
            )}
            data-ocid="buy_icp.signin_prompt"
          >
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-primary" />
                Your account details
              </p>
              <p className="text-sm text-muted-foreground">
                Sign in with Internet Identity whenever you are ready to see
                your own account.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void login()}
              disabled={loginStatus === "logging-in"}
              className="gap-2 rounded-md border-gold-strong bg-transparent text-primary transition-smooth hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
              data-ocid="buy_icp.signin_button"
            >
              {loginStatus === "logging-in" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {loginStatus === "logging-in" ? "Connecting..." : "Sign in"}
            </Button>
          </div>
        )}
      </section>

      <ReturnToPurchase ocid="buy_icp.return_bottom_button" />
    </div>
  );
}
