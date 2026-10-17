import { Principal } from "@icp-sdk/core/principal";
import { Link, useLocation } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Loader2,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import type { Conversion, PurchaseError, PurchaseResult } from "../backend";
import { ConversionStatus, PriceSource, TreasuryMode } from "../backend";
import { DeliveryAddressCard } from "../components/exchange/DeliveryAddressCard";
import { GetIcpFirstPanel } from "../components/exchange/GetIcpFirstPanel";
import { MigrationNotice } from "../components/exchange/MigrationNotice";
import { PresaleProgress } from "../components/exchange/PresaleProgress";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { useIcpApprove } from "../hooks/useIcpApprove";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { usePlug } from "../hooks/usePlug";
import {
  usePlugBuyExact,
  usePlugDeliveryAddress,
  usePlugPurchase,
} from "../hooks/usePlugPurchase";
import {
  useBuyExactTtti,
  useConvertDeposit,
  useGetDeliveryAddress,
  useGetPresaleStatus,
  useHandleDeposit,
  usePublicTreasuryInfo,
  useQuoteExactTtti,
  useTreasuryState,
  useWalletBalance,
} from "../hooks/useQueries";
import { ICP_LEDGER_CANISTER_ID, requiredIcpBalance } from "../lib/icpLedger";
import {
  ICP_DECIMALS,
  ICP_DIVISOR,
  MIN_PURCHASE,
  TOKEN_PRICE_USD,
  TRANSFERS_FROZEN_PURCHASE_MESSAGE,
  TTTI_DECIMALS,
  TTTI_SYMBOL,
  ceilDiv,
  encodeAccountText,
  formatBps,
  formatIcp,
  formatTtti,
  formatUsdE8,
  parseIcp,
  parseTtti,
  priceMovedMessage,
  truncateAccountText,
  tttiToUsdE8,
  unitsInputValue,
} from "../lib/token";
import { cn } from "../lib/utils";

const ICP_LEDGER = Principal.fromText(ICP_LEDGER_CANISTER_ID);
const PRICE_UNAVAILABLE = "Price unavailable — please try again in a moment";
const PRICE_MOVED =
  "Price moved beyond your price protection — no ICP was taken";
const QUOTE_DEBOUNCE_MS = 400;
const DISPLAY_SYMBOL = "TTTI-T (Test)";

type BuyMode = "icp" | "exact";
const BUY_MODES: Array<{
  value: BuyMode;
  label: string;
  hint: string;
  icon: typeof Coins;
}> = [
  {
    value: "icp",
    label: "Spend ICP",
    hint: `Enter how much ICP to spend; you receive the ${DISPLAY_SYMBOL} it buys at purchase time.`,
    icon: Coins,
  },
  {
    value: "exact",
    label: `Buy exact ${DISPLAY_SYMBOL}`,
    hint: `Enter the exact ${DISPLAY_SYMBOL} you want; the ICP cost is rounded up so you receive the full amount.`,
    icon: Target,
  },
];
const INSUFFICIENT_ICP = "Insufficient ICP (amount + 0.0001 fee)";
const REFUNDED =
  "Delivery failed — your ICP was refunded minus the 0.0001 ICP fee";
const REFUND_FAILED = "Delivery failed and the automatic refund also failed";

/** Gold & Obsidian surface and action styles shared across this page. */
const CARD_CLASS =
  "rounded-xl border border-gold bg-gradient-surface shadow-elevated transition-smooth";
const GOLD_BUTTON =
  "min-h-11 gap-2 rounded-lg border border-gold-strong bg-gradient-primary font-semibold tracking-wide text-primary-foreground shadow-gold transition-smooth hover:shadow-gold-lg hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] disabled:shadow-none";
const OUTLINE_BUTTON =
  "rounded-lg border-gold bg-transparent text-foreground transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring";
const PREVIEW_CLASS =
  "space-y-2 rounded-lg border border-gold bg-background/60 p-4 text-sm";
const AMOUNT_INPUT =
  "h-12 border-gold bg-background/60 font-mono text-lg tabular-nums transition-smooth focus-visible:border-gold-strong focus-visible:ring-2 focus-visible:ring-ring";

const SOURCE_LABELS: Record<PriceSource, string> = {
  [PriceSource.coinbase]: "Coinbase",
  [PriceSource.coingecko]: "CoinGecko",
  [PriceSource.none]: "No live source",
};

type ActiveWallet = "plug" | "internetIdentity";
type Notice = { title: string; message: string; refunded?: boolean };
/** `useMax` is the input text that fills the remaining allocation. */
type Validation = Notice & { useMax?: string };
type Outcome =
  | { kind: "success"; conversion: Conversion; exact: boolean }
  | ({ kind: "error" } & Notice);

function timestampToDate(timestamp: bigint): Date | null {
  if (timestamp <= 0n) return null;
  const date = new Date(Number(timestamp / 1_000_000n));
  return Number.isNaN(date.getTime()) ? null : date;
}

const BPS = 10_000n;
/** 10^24 / (10_000 bps * 10^8 TTTI base) collapses to 10^16. */
const LIVE_DIVISOR = 10n ** 16n;

function marginFactor(marginBps: bigint): bigint {
  return marginBps < BPS ? BPS - marginBps : 0n;
}

/** Backend live formula: icpE8s * usdE8 * (10_000 - marginBps) * 10^8 / 10^24, single floor. */
function liveTtti(icpE8s: bigint, usdE8: bigint, marginBps: bigint): bigint {
  return (icpE8s * usdE8 * marginFactor(marginBps)) / LIVE_DIVISOR;
}

/** ICP e8s that buy `tttiBase` at the live price after the margin. */
function liveIcpFor(
  tttiBase: bigint,
  usdE8: bigint,
  marginBps: bigint,
  roundUp: boolean,
): bigint {
  const denominator = usdE8 * marginFactor(marginBps);
  if (denominator <= 0n) return 0n;
  const numerator = tttiBase * LIVE_DIVISOR;
  return roundUp ? ceilDiv(numerator, denominator) : numerator / denominator;
}

/** Backend fallback formula: icpE8s * rate / 10^8 (rate = base units per ICP). */
function fallbackTtti(icpE8s: bigint, rate: bigint): bigint {
  return (icpE8s * rate) / ICP_DIVISOR;
}

function fallbackIcpFor(
  tttiBase: bigint,
  rate: bigint,
  roundUp: boolean,
): bigint {
  if (rate <= 0n) return 0n;
  const numerator = tttiBase * ICP_DIVISOR;
  return roundUp ? ceilDiv(numerator, rate) : numerator / rate;
}

function safePurchaseMessage(message: string | undefined): string {
  if (!message || /burn/i.test(message)) {
    return "The purchase could not be completed for this destination. Check the recipient and try again.";
  }
  return message;
}

function describePurchaseError(err: PurchaseError): Notice {
  const ref = err.conversion
    ? ` Reference: purchase #${err.conversion.id}.`
    : "";
  const code = err.code;
  switch (code.__kind__) {
    case "salesPaused":
      return {
        title: "Sales are paused",
        message: safePurchaseMessage(err.message),
      };
    case "presaleComplete":
      return {
        title: "Presale complete",
        message: safePurchaseMessage(err.message),
      };
    case "belowMinimum":
      return {
        title: "Below the minimum purchase",
        message: `The minimum is ${formatTtti(code.belowMinimum.minimumTtti)} ${DISPLAY_SYMBOL} (1 USD); you requested ${formatTtti(code.belowMinimum.requestedTtti)} ${DISPLAY_SYMBOL}.`,
      };
    case "aboveRemaining":
      return {
        title: "Above the remaining presale amount",
        message: `The maximum available is ${formatTtti(code.aboveRemaining.maximumTtti)} ${DISPLAY_SYMBOL} (${formatIcp(code.aboveRemaining.maximumIcpE8s)} ICP); you requested ${formatTtti(code.aboveRemaining.requestedTtti)} ${DISPLAY_SYMBOL}.`,
      };
    case "priceUnavailable":
      return {
        title: PRICE_UNAVAILABLE,
        message: safePurchaseMessage(err.message),
      };
    case "priceMoved":
      return {
        title: PRICE_MOVED,
        message: priceMovedMessage(
          code.priceMoved.requiredIcpE8s,
          code.priceMoved.maxIcpE8s,
        ),
      };
    case "transfersFrozen":
      return {
        title: "Purchases paused — transfers frozen",
        message: TRANSFERS_FROZEN_PURCHASE_MESSAGE,
      };
    case "invalidAmount":
      return {
        title: "Invalid amount",
        message: safePurchaseMessage(err.message),
      };
    case "insufficientIcp":
      return {
        title: INSUFFICIENT_ICP,
        message: `${safePurchaseMessage(err.message)} Balance: ${formatIcp(code.insufficientIcp.balance)} ICP.`,
      };
    case "approvalMissing":
      return {
        title: "ICP approval missing",
        message: `${safePurchaseMessage(err.message)} Current allowance: ${formatIcp(code.approvalMissing.allowance)} ICP.`,
      };
    case "deliveryFailedRefunded":
      return {
        title: REFUNDED,
        message: safePurchaseMessage(err.message) + ref,
        refunded: true,
      };
    case "deliveryFailedRefundFailed":
      return {
        title: REFUND_FAILED,
        message: `${safePurchaseMessage(err.message)}${ref} Contact the team with this reference.`,
      };
    case "icpLedgerError":
      return {
        title: "ICP ledger error",
        message: safePurchaseMessage(err.message),
      };
    case "anonymousCaller":
      return {
        title: "Sign in to buy",
        message: safePurchaseMessage(err.message),
      };
    default:
      return {
        title: "Purchase not completed",
        message: safePurchaseMessage(err.message),
      };
  }
}

function outcomeFromResult(result: PurchaseResult, exact: boolean): Outcome {
  if (result.__kind__ === "Err") {
    return { kind: "error", ...describePurchaseError(result.Err) };
  }
  const c = result.Ok;
  const ref = ` Reference: purchase #${c.id}.`;
  if (c.status === ConversionStatus.completed) {
    return { kind: "success", conversion: c, exact };
  }
  if (c.status === ConversionStatus.refunded) {
    return {
      kind: "error",
      title: REFUNDED,
      message: safePurchaseMessage(c.message) + ref,
      refunded: true,
    };
  }
  if (c.status === ConversionStatus.refundFailed) {
    return {
      kind: "error",
      title: REFUND_FAILED,
      message: `${safePurchaseMessage(c.message)}${ref} Contact the team with this reference.`,
    };
  }
  return {
    kind: "error",
    title: "Purchase failed",
    message: safePurchaseMessage(c.message) + ref,
  };
}

export function ExchangePage() {
  const { identity, login, loginStatus } = useInternetIdentity();
  const {
    principal: plugPrincipal,
    connect: connectPlug,
    isConnecting: plugConnecting,
    isAvailable: plugAvailable,
  } = usePlug();
  const iiPrincipal =
    identity && !identity.getPrincipal().isAnonymous()
      ? identity.getPrincipal()
      : null;
  const wallet: ActiveWallet | null = plugPrincipal
    ? "plug"
    : iiPrincipal
      ? "internetIdentity"
      : null;
  const activePrincipal = plugPrincipal ?? iiPrincipal;

  const statusQuery = useGetPresaleStatus();
  const status = statusQuery.data;
  const { data: publicTreasury, isLoading: publicTreasuryLoading } =
    usePublicTreasuryInfo();
  const { data: treasury } = useTreasuryState();
  const balanceQuery = useWalletBalance(
    ICP_LEDGER,
    activePrincipal ? { owner: activePrincipal } : undefined,
  );
  const iiAddress = useGetDeliveryAddress();
  const plugAddress = usePlugDeliveryAddress(wallet === "plug");
  const approve = useIcpApprove();
  const convert = useConvertDeposit();
  const deposit = useHandleDeposit();
  const plugBuy = usePlugPurchase();
  const buyExact = useBuyExactTtti();
  const plugBuyExact = usePlugBuyExact();

  const [buyMode, setBuyMode] = useState<BuyMode>("icp");
  const [hasReadWhitePaper, setHasReadWhitePaper] = useState(false);
  const [amount, setAmount] = useState("");
  const [exactText, setExactText] = useState("");
  const [debouncedExact, setDebouncedExact] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState<"idle" | "approving" | "buying">("idle");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [treasuryCopied, setTreasuryCopied] = useState(false);

  useEffect(() => {
    if (!treasuryCopied) return;
    const timer = window.setTimeout(() => setTreasuryCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [treasuryCopied]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedExact(exactText),
      QUOTE_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [exactText]);

  const locationHash = useLocation({ select: (loc) => loc.hash });
  useEffect(() => {
    const target =
      locationHash === "delivery-address" ||
      window.location.hash === "#delivery-address";
    if (!wallet || !target) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById("delivery-address")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [wallet, locationHash]);

  const autoMode =
    (publicTreasury?.mode ?? treasury?.mode) === TreasuryMode.auto;
  const price = status?.priceUsdE8 ?? 0n;
  const livePriceAvailable = price > 0n;
  const updatedAt = status ? timestampToDate(status.priceUpdatedAt) : null;
  const fallbackRate = status?.fallbackRate ?? 0n;
  const fallbackUsable = !!status?.fallbackEnabled && fallbackRate > 0n;
  // Mirrors the backend: the admin fallback rate applies only when it is
  // enabled and the live price is stale or unavailable.
  const usingFallback =
    fallbackUsable &&
    (!livePriceAvailable ||
      !!status?.priceStale ||
      status?.priceSource === PriceSource.none);
  const priceAvailable = usingFallback || livePriceAvailable;
  const marginBps = publicTreasury?.marginBps ?? 0n;
  const treasuryAccountText = publicTreasury
    ? encodeAccountText(publicTreasury.icpAccount)
    : "";
  const quote = (icpE8s: bigint) =>
    usingFallback
      ? fallbackTtti(icpE8s, fallbackRate)
      : liveTtti(icpE8s, price, marginBps);
  const icpFor = (tttiBase: bigint, roundUp: boolean) =>
    usingFallback
      ? fallbackIcpFor(tttiBase, fallbackRate, roundUp)
      : liveIcpFor(tttiBase, price, marginBps, roundUp);
  const minPurchase = status?.minPurchase ?? MIN_PURCHASE;
  const remaining = status?.remaining ?? 0n;
  const transfersFrozen = !!status?.transfersFrozen;
  const closed = !!status?.complete || !!status?.salesPaused || transfersFrozen;
  const icpBalance =
    balanceQuery.data?.__kind__ === "Ok"
      ? balanceQuery.data.Ok.balance
      : undefined;

  const parsed = parseIcp(amount);
  const hasAmount = parsed !== null && parsed > 0n;
  const tttiOut = hasAmount && priceAvailable ? quote(parsed) : 0n;
  const required = hasAmount ? requiredIcpBalance(parsed) : 0n;
  const maxIcp = priceAvailable ? icpFor(remaining, false) : 0n;
  const busy = step !== "idle";

  let validation: Validation | null = null;
  if (amount.trim() !== "" && !hasAmount) {
    validation = {
      title: "Invalid amount",
      message: "Enter an ICP amount greater than 0 with up to 8 decimals.",
    };
  } else if (hasAmount && priceAvailable && tttiOut < minPurchase) {
    validation = {
      title: "Below the minimum purchase",
      message: `The minimum purchase is ${formatTtti(minPurchase)} ${DISPLAY_SYMBOL} (1 USD), about ${formatIcp(icpFor(minPurchase, true))} ICP.`,
    };
  } else if (hasAmount && priceAvailable && tttiOut > remaining) {
    validation = {
      title: "Above the remaining presale amount",
      message: `Only ${formatTtti(remaining)} ${DISPLAY_SYMBOL} remain. The maximum you can buy is ${formatTtti(remaining)} ${DISPLAY_SYMBOL} (${formatIcp(maxIcp)} ICP).`,
      useMax:
        remaining >= minPurchase
          ? unitsInputValue(maxIcp, ICP_DECIMALS)
          : undefined,
    };
  } else if (hasAmount && icpBalance !== undefined && icpBalance < required) {
    validation = {
      title: INSUFFICIENT_ICP,
      message: `You need ${formatIcp(required)} ICP (purchase + 0.0001 ICP transfer fee + 0.0001 ICP approval fee) but your balance is ${formatIcp(icpBalance)} ICP.`,
    };
  }

  // --- Exact token mode ----------------------------------------------------
  const exactParsed = parseTtti(exactText);
  const exactValid = exactParsed !== null && exactParsed > 0n;
  const debouncedParsed = parseTtti(debouncedExact);
  const quoteQuery = useQuoteExactTtti(
    buyMode === "exact" && debouncedParsed !== null && debouncedParsed > 0n
      ? debouncedParsed
      : null,
  );
  const quoteData = quoteQuery.data;
  const inputSettled = debouncedExact === exactText;
  // Only trust a quote that matches what is currently typed.
  const exactQuote =
    quoteData?.__kind__ === "Ok" &&
    exactValid &&
    quoteData.Ok.tttiAmount === exactParsed
      ? quoteData.Ok
      : null;
  const quoteError =
    quoteData?.__kind__ === "Err" && inputSettled && exactValid
      ? quoteData.Err
      : null;
  const exactRequired = exactQuote
    ? requiredIcpBalance(exactQuote.maxIcpE8s)
    : 0n;

  let exactValidation: Validation | null = null;
  if (exactText.trim() !== "" && !exactValid) {
    exactValidation = {
      title: "Invalid amount",
      message: `Enter a ${DISPLAY_SYMBOL} amount greater than 0 with up to 8 decimals, for example 0.03.`,
    };
  } else if (exactValid && status?.complete) {
    exactValidation = {
      title: "Presale complete",
      message: `The full presale allocation has been sold. No more ${DISPLAY_SYMBOL} can be bought.`,
    };
  } else if (exactValid && exactParsed < minPurchase) {
    exactValidation = {
      title: "Below the minimum purchase",
      message: `The minimum purchase is ${formatTtti(minPurchase)} ${DISPLAY_SYMBOL} (1 USD)${priceAvailable ? `, about ${formatIcp(icpFor(minPurchase, true))} ICP` : ""}.`,
    };
  } else if (exactValid && status && exactParsed > remaining) {
    exactValidation = {
      title: "Above the remaining presale amount",
      message: `Only ${formatTtti(remaining)} ${DISPLAY_SYMBOL} remain. The maximum you can buy is ${formatTtti(remaining)} ${DISPLAY_SYMBOL}${priceAvailable ? ` (about ${formatIcp(icpFor(remaining, true))} ICP)` : ""}.`,
      useMax:
        remaining >= minPurchase
          ? unitsInputValue(remaining, TTTI_DECIMALS)
          : undefined,
    };
  } else if (quoteError) {
    const code = quoteError.code;
    exactValidation = {
      ...describePurchaseError(quoteError),
      useMax:
        code.__kind__ === "aboveRemaining" &&
        code.aboveRemaining.maximumTtti >= minPurchase
          ? unitsInputValue(code.aboveRemaining.maximumTtti, TTTI_DECIMALS)
          : undefined,
    };
  } else if (quoteQuery.isError && inputSettled && exactValid) {
    exactValidation = {
      title: "Quote unavailable",
      message:
        "The ICP cost could not be calculated right now. It retries automatically — or press Retry.",
    };
  } else if (
    exactQuote &&
    icpBalance !== undefined &&
    icpBalance < exactRequired
  ) {
    exactValidation = {
      title: INSUFFICIENT_ICP,
      message: `You need ${formatIcp(exactRequired)} ICP (maximum ${formatIcp(exactQuote.maxIcpE8s)} ICP + 0.0001 ICP transfer fee + 0.0001 ICP approval fee) but your balance is ${formatIcp(icpBalance)} ICP.`,
    };
  }
  const quoteLoading =
    buyMode === "exact" && exactValid && !exactValidation && !exactQuote;

  const isExact = buyMode === "exact";
  const activeValidation = isExact ? exactValidation : validation;
  const setActiveText = isExact ? setExactText : setAmount;
  const canPurchase = isExact
    ? !!wallet &&
      !closed &&
      exactValid &&
      !!exactQuote &&
      !exactValidation &&
      !busy
    : !!wallet &&
      !closed &&
      priceAvailable &&
      hasAmount &&
      !validation &&
      !busy;
  const canSubmit = canPurchase && hasReadWhitePaper;

  // Reuses the existing insufficient-balance validation for the chosen mode.
  const insufficientIcp = activeValidation?.title === INSUFFICIENT_ICP;
  const showGetIcpFirst =
    !!wallet &&
    !!activePrincipal &&
    icpBalance !== undefined &&
    (icpBalance === 0n || insufficientIcp);
  const activeRequired = isExact
    ? exactQuote
      ? exactRequired
      : undefined
    : hasAmount
      ? required
      : undefined;

  const deliveryAccount =
    (wallet === "plug" ? plugAddress.data : iiAddress.data) ?? null;
  const deliveryLabel = deliveryAccount
    ? `${encodeAccountText(deliveryAccount)} (saved delivery address)`
    : activePrincipal
      ? `${encodeAccountText({ owner: activePrincipal })} (your connected wallet)`
      : "Your connected wallet";

  const switchMode = (mode: BuyMode) => {
    setBuyMode(mode);
    setHasReadWhitePaper(false);
    setConfirming(false);
    setOutcome(null);
  };

  const handleConnectPlug = async () => {
    setConnectError(null);
    try {
      await connectPlug();
    } catch (error) {
      setConnectError(
        error instanceof Error ? error.message : "Unable to connect Plug.",
      );
    }
  };

  const handleCopyTreasury = async () => {
    if (!treasuryAccountText) return;
    try {
      await navigator.clipboard.writeText(treasuryAccountText);
      setTreasuryCopied(true);
    } catch {
      setTreasuryCopied(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setOutcome(null);
    if (canSubmit) setConfirming(true);
  };

  const handleConfirm = async () => {
    if (!confirming || !wallet || !canSubmit || busy) return;
    let purchaseE8s: bigint;
    let buy: () => Promise<PurchaseResult>;
    if (isExact) {
      if (!exactQuote) return;
      const { tttiAmount, maxIcpE8s } = exactQuote;
      purchaseE8s = maxIcpE8s;
      buy = () =>
        wallet === "plug"
          ? plugBuyExact.mutateAsync({ tttiAmount, maxIcpE8s })
          : buyExact.mutateAsync({ recipient: null, tttiAmount, maxIcpE8s });
    } else {
      if (parsed === null || parsed <= 0n) return;
      const icpAmount = parsed;
      purchaseE8s = icpAmount;
      buy = () =>
        wallet === "plug"
          ? plugBuy.mutateAsync({ icpAmount, autoMode })
          : autoMode
            ? deposit.mutateAsync(icpAmount)
            : convert.mutateAsync({ recipient: null, icpAmount });
    }
    const captured = isExact ? exactText : amount;
    const setText = setActiveText;
    const restore = () => setText((cur) => (cur === "" ? captured : cur));
    setConfirming(false);
    setHasReadWhitePaper(false);
    setOutcome(null);
    setText("");
    setStep("approving");
    try {
      const approval = await approve.mutateAsync({
        purchaseE8s,
        balanceE8s: icpBalance,
        wallet,
      });
      if (!approval.ok) {
        setOutcome({
          kind: "error",
          title: "ICP approval failed",
          message: approval.message,
        });
        restore();
        return;
      }
      setStep("buying");
      const next = outcomeFromResult(await buy(), isExact);
      setOutcome(next);
      if (next.kind !== "success") restore();
    } catch (error) {
      setOutcome({
        kind: "error",
        title: "Purchase not completed",
        message:
          error instanceof Error && error.message
            ? safePurchaseMessage(error.message)
            : "The purchase could not be submitted. Please try again.",
      });
      restore();
    } finally {
      setStep("idle");
    }
  };

  const exactRateSource = exactQuote
    ? exactQuote.usedFallback
      ? `Fallback rate · ${formatTtti(fallbackRate)} ${DISPLAY_SYMBOL} per ICP`
      : `Live price · ${formatUsdE8(exactQuote.priceUsdE8)} per ICP`
    : "—";

  const purchaseCard = !wallet ? (
    <Card className={CARD_CLASS} data-ocid="exchange.signin_card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <Wallet className="h-5 w-5 text-primary" />
          Connect to buy {DISPLAY_SYMBOL}
        </CardTitle>
        <CardDescription>
          Sign in with Internet Identity or connect Plug. You approve and sign
          every ICP payment yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            className={GOLD_BUTTON}
            onClick={() => void login()}
            disabled={loginStatus === "logging-in"}
            data-ocid="exchange.signin_button"
          >
            {loginStatus === "logging-in" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Sign in with Internet Identity
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("min-h-11", OUTLINE_BUTTON)}
            onClick={() => void handleConnectPlug()}
            disabled={plugConnecting || !plugAvailable}
            data-ocid="exchange.plug_button"
          >
            {plugConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            Connect Plug
          </Button>
        </div>
        {!plugAvailable && (
          <p className="text-xs text-muted-foreground">
            Plug extension not detected.{" "}
            <a
              href="https://plugwallet.ooo"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Install Plug
            </a>{" "}
            or use Internet Identity.
          </p>
        )}
        {connectError && (
          <p
            className="text-sm text-destructive"
            data-ocid="exchange.connect_error_state"
          >
            {connectError}
          </p>
        )}
      </CardContent>
    </Card>
  ) : (
    <Card className={CARD_CLASS} data-ocid="exchange.form_card">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Buy {DISPLAY_SYMBOL}
          </CardTitle>
          <Badge
            variant="outline"
            className="rounded-full border-gold bg-primary/10 text-primary"
          >
            {wallet === "plug"
              ? "Paying with Plug"
              : "Paying with Internet Identity"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">ICP balance</span>
          {balanceQuery.isLoading ? (
            <Skeleton className="h-5 w-28" />
          ) : (
            <span
              className="font-mono font-semibold tabular-nums text-foreground"
              data-ocid="exchange.icp_balance"
            >
              {icpBalance !== undefined
                ? `${formatIcp(icpBalance)} ICP`
                : "Unavailable"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="sr-only">Buy mode</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background/60 p-1">
              {BUY_MODES.map((mode) => {
                const active = buyMode === mode.value;
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => switchMode(mode.value)}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-gold bg-primary/10 text-primary shadow-gold"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    data-ocid={`exchange.mode_${mode.value}.toggle`}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-primary" : "",
                      )}
                    />
                    <span className="truncate">{mode.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {BUY_MODES.find((mode) => mode.value === buyMode)?.hint}
            </p>
          </fieldset>

          {!isExact ? (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="icp-amount">You pay (ICP)</Label>
                  <Link
                    to="/buy-icp"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    data-ocid="exchange.buy_icp_link"
                  >
                    Need ICP?
                  </Link>
                </div>
                <Input
                  id="icp-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setConfirming(false);
                    setHasReadWhitePaper(false);
                    setOutcome(null);
                  }}
                  disabled={closed}
                  autoComplete="off"
                  className={AMOUNT_INPUT}
                  aria-invalid={!!validation}
                  data-ocid="exchange.amount_input"
                />
              </div>

              <dl className={PREVIEW_CLASS}>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">You receive</dt>
                  <dd className="text-right">
                    <span
                      className="block font-mono text-lg font-semibold tabular-nums text-primary"
                      data-ocid="exchange.ttti_output"
                    >
                      {priceAvailable ? formatTtti(tttiOut) : "—"}{" "}
                      {DISPLAY_SYMBOL}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      ≈ {formatUsdE8(tttiToUsdE8(tttiOut), 2)}
                    </span>
                  </dd>
                </div>
                {usingFallback && (
                  <p
                    className="text-right text-xs font-medium text-muted-foreground"
                    data-ocid="exchange.fallback_rate_note"
                  >
                    Using fallback rate · {formatTtti(fallbackRate)}{" "}
                    {DISPLAY_SYMBOL} per ICP
                  </p>
                )}
                <Separator className="bg-primary/20" />
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">ICP ledger fees</dt>
                  <dd className="font-mono tabular-nums">
                    0.0001 + 0.0001 ICP
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Total ICP needed</dt>
                  <dd className="font-mono font-semibold tabular-nums">
                    {hasAmount ? formatIcp(required) : "—"} ICP
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="ttti-amount">
                    You receive ({DISPLAY_SYMBOL})
                  </Label>
                  <Link
                    to="/buy-icp"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    data-ocid="exchange.exact_buy_icp_link"
                  >
                    Need ICP?
                  </Link>
                </div>
                <Input
                  id="ttti-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.03"
                  value={exactText}
                  onChange={(e) => {
                    setExactText(e.target.value);
                    setConfirming(false);
                    setHasReadWhitePaper(false);
                    setOutcome(null);
                  }}
                  disabled={closed}
                  autoComplete="off"
                  className={AMOUNT_INPUT}
                  aria-invalid={!!exactValidation}
                  aria-describedby="ttti-amount-hint"
                  data-ocid="exchange.exact_amount_input"
                />
                <p
                  id="ttti-amount-hint"
                  className="text-xs text-muted-foreground"
                >
                  Up to 8 decimals · minimum {formatTtti(minPurchase)}{" "}
                  {DISPLAY_SYMBOL} (1 USD)
                </p>
              </div>

              <dl
                className={PREVIEW_CLASS}
                aria-live="polite"
                data-ocid="exchange.exact_preview_panel"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">You receive exactly</dt>
                  <dd className="min-w-0 text-right">
                    <span
                      className="block break-all font-mono text-lg font-semibold tabular-nums text-primary"
                      data-ocid="exchange.exact_ttti_output"
                    >
                      {exactValid ? formatTtti(exactParsed) : "—"}{" "}
                      {DISPLAY_SYMBOL}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      ≈{" "}
                      {formatUsdE8(
                        tttiToUsdE8(exactValid ? exactParsed : 0n),
                        2,
                      )}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    ICP cost (rounded up)
                  </dt>
                  <dd
                    className="font-mono font-semibold tabular-nums"
                    data-ocid="exchange.exact_icp_cost"
                  >
                    {quoteLoading ? (
                      <Skeleton
                        className="h-5 w-28"
                        data-ocid="exchange.exact_quote.loading_state"
                      />
                    ) : (
                      `${exactQuote ? formatIcp(exactQuote.icpCostE8s) : "—"} ICP`
                    )}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Rate source</dt>
                  <dd
                    className="flex flex-wrap items-center justify-end gap-1.5 text-right"
                    data-ocid="exchange.exact_rate_source"
                  >
                    {exactRateSource}
                    {exactQuote?.priceStale && (
                      <Badge variant="destructive" className="rounded-full">
                        Stale
                      </Badge>
                    )}
                  </dd>
                </div>
                <Separator className="bg-primary/20" />
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Price protection
                  </dt>
                  <dd data-ocid="exchange.exact_protection">
                    <span className="font-mono tabular-nums">
                      {exactQuote
                        ? `+${formatBps(exactQuote.protectionBps)}`
                        : "—"}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground">fixed</span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Maximum ICP approved
                  </dt>
                  <dd
                    className="font-mono font-semibold tabular-nums"
                    data-ocid="exchange.exact_max_icp"
                  >
                    {exactQuote ? formatIcp(exactQuote.maxIcpE8s) : "—"} ICP
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">ICP ledger fees</dt>
                  <dd className="font-mono tabular-nums">
                    0.0001 + 0.0001 ICP
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Total ICP needed</dt>
                  <dd className="font-mono font-semibold tabular-nums">
                    {exactQuote ? formatIcp(exactRequired) : "—"} ICP
                  </dd>
                </div>
                <p className="flex items-center justify-end gap-1.5 pt-1 text-right text-xs text-muted-foreground">
                  {quoteQuery.isFetching && (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                  )}
                  Only the cost at purchase time is collected · quote refreshes
                  every 30 s
                </p>
              </dl>
            </>
          )}

          {!statusQuery.isLoading && !priceAvailable && (
            <Alert
              variant="destructive"
              data-ocid="exchange.price_unavailable_state"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{PRICE_UNAVAILABLE}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                The ICP/USD price feed is not responding.
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={OUTLINE_BUTTON}
                  onClick={() => void statusQuery.refetch()}
                  disabled={statusQuery.isFetching}
                  data-ocid="exchange.retry_button"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {activeValidation && (
            <Alert variant="destructive" data-ocid="exchange.validation_error">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{activeValidation.title}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{activeValidation.message}</p>
                {activeValidation.useMax !== undefined && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={OUTLINE_BUTTON}
                    onClick={() => {
                      const max = activeValidation.useMax;
                      if (max !== undefined) {
                        setActiveText(max);
                        setHasReadWhitePaper(false);
                        setConfirming(false);
                      }
                    }}
                    data-ocid="exchange.use_max_button"
                  >
                    Use maximum
                  </Button>
                )}
                {isExact && quoteQuery.isError && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={OUTLINE_BUTTON}
                    onClick={() => void quoteQuery.refetch()}
                    disabled={quoteQuery.isFetching}
                    data-ocid="exchange.exact_quote_retry_button"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {showGetIcpFirst && activePrincipal && icpBalance !== undefined && (
            <GetIcpFirstPanel
              principal={activePrincipal.toText()}
              walletName={wallet === "plug" ? "Plug" : "Internet Identity"}
              balanceE8s={icpBalance}
              requiredE8s={activeRequired}
            />
          )}

          {outcome?.kind === "error" && (
            <Alert
              variant={outcome.refunded ? "default" : "destructive"}
              className={
                outcome.refunded ? "border-warning/50 bg-warning/10" : ""
              }
              data-ocid="exchange.error_state"
            >
              {outcome.refunded ? (
                <Undo2 className="h-4 w-4 text-warning" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>{outcome.title}</AlertTitle>
              {outcome.message.trim() && (
                <AlertDescription>{outcome.message}</AlertDescription>
              )}
            </Alert>
          )}

          {outcome?.kind === "success" && (
            <Alert
              className="border-gold-strong bg-primary/10 shadow-gold"
              data-ocid="exchange.success_state"
            >
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertTitle className="font-display text-base tabular-nums">
                {outcome.exact ? "You received exactly " : "You received "}
                {formatTtti(outcome.conversion.tttiAmount)} {DISPLAY_SYMBOL}
              </AlertTitle>
              <AlertDescription className="space-y-1">
                {outcome.exact ? (
                  <p data-ocid="exchange.exact_success_charged">
                    ICP charged: {formatIcp(outcome.conversion.icpAmount)} ICP{" "}
                    {outcome.conversion.usedFallback
                      ? "at the fallback rate"
                      : `at ${formatUsdE8(outcome.conversion.priceUsdE8)} per ICP`}{" "}
                    · purchase #{outcome.conversion.id.toString()}. Only this
                    amount was collected; delivery was fee-free.
                  </p>
                ) : (
                  <p>
                    Paid {formatIcp(outcome.conversion.icpAmount)} ICP at{" "}
                    {formatUsdE8(outcome.conversion.priceUsdE8)} per ICP ·
                    purchase #{outcome.conversion.id.toString()}
                  </p>
                )}
                <p className="break-all">
                  Delivered to{" "}
                  <span className="font-mono">
                    {encodeAccountText(outcome.conversion.recipient)}
                  </span>
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div
            className="flex items-start gap-3 rounded-lg border border-gold bg-background/60 p-4"
            data-ocid="exchange.reading_attestation.panel"
          >
            <input
              id="exchange-read-white-paper"
              type="checkbox"
              checked={hasReadWhitePaper}
              onChange={(event) => setHasReadWhitePaper(event.target.checked)}
              disabled={busy || closed}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
              data-ocid="exchange.read_white_paper.checkbox"
            />
            <div className="min-w-0 space-y-1 text-sm leading-relaxed">
              <label
                htmlFor="exchange-read-white-paper"
                className="cursor-pointer font-medium text-foreground"
              >
                I confirm that I have read the white paper before this purchase.
              </label>
              <p className="text-muted-foreground">
                Read the{" "}
                <Link
                  to="/white-paper"
                  className="font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-ocid="exchange.white_paper.link"
                >
                  white paper
                </Link>{" "}
                before continuing. A new confirmation is required for each
                attempt.
              </p>
            </div>
          </div>

          {confirming && (isExact ? !!exactQuote : hasAmount) ? (
            <div className="space-y-3" data-ocid="exchange.confirm_panel">
              <Alert
                className="border-gold bg-background/60"
                data-ocid="exchange.confirm_state"
              >
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertTitle className="font-display text-base">
                  Confirm your purchase
                </AlertTitle>
                {isExact && exactQuote ? (
                  <AlertDescription className="space-y-3">
                    <dl className="space-y-1.5">
                      {[
                        {
                          label: `${DISPLAY_SYMBOL} you receive (exact)`,
                          value: `${formatTtti(exactQuote.tttiAmount)} ${DISPLAY_SYMBOL}`,
                          id: "ttti",
                        },
                        {
                          label: "Estimated ICP cost",
                          value: `${formatIcp(exactQuote.icpCostE8s)} ICP`,
                          id: "cost",
                        },
                        {
                          label: `Maximum ICP approved (+${formatBps(exactQuote.protectionBps)})`,
                          value: `${formatIcp(exactQuote.maxIcpE8s)} ICP`,
                          id: "max",
                        },
                        {
                          label: "Delivery account",
                          value: deliveryLabel,
                          id: "delivery",
                        },
                        {
                          label: "Delivery fee",
                          value: "None — delivery is fee-free",
                          id: "fee",
                        },
                      ].map((row) => (
                        <div
                          key={row.id}
                          className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3"
                          data-ocid={`exchange.confirm_${row.id}.item`}
                        >
                          <dt className="text-muted-foreground">{row.label}</dt>
                          <dd
                            className={cn(
                              "min-w-0 break-all font-medium sm:text-right",
                              row.id === "delivery" || row.id === "fee"
                                ? "text-xs sm:text-sm"
                                : "font-mono tabular-nums",
                            )}
                          >
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p>
                      Your wallet approves {formatIcp(exactQuote.maxIcpE8s)} ICP
                      + 0.0001 ICP fee on the ICP ledger. Only the cost
                      recalculated at purchase time is collected; if the price
                      moves above the maximum, no ICP is taken.
                    </p>
                  </AlertDescription>
                ) : (
                  <AlertDescription>
                    Your wallet approves {formatIcp(parsed ?? 0n)} ICP + 0.0001
                    ICP fee on the ICP ledger, then {formatIcp(parsed ?? 0n)}{" "}
                    ICP is collected for about {formatTtti(tttiOut)}{" "}
                    {DISPLAY_SYMBOL}
                    {usingFallback ? " (using fallback rate)" : ""}. The final
                    amount uses the price at purchase time.
                  </AlertDescription>
                )}
              </Alert>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className={cn(GOLD_BUTTON, "sm:flex-1")}
                  onClick={() => void handleConfirm()}
                  disabled={!canSubmit}
                  data-ocid="exchange.confirm_button"
                >
                  Approve & buy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("min-h-11", OUTLINE_BUTTON)}
                  onClick={() => {
                    setConfirming(false);
                    setHasReadWhitePaper(false);
                  }}
                  data-ocid="exchange.cancel_button"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="submit"
              className={cn(GOLD_BUTTON, "w-full")}
              disabled={!canSubmit}
              data-ocid="exchange.submit_button"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === "approving"
                ? "Approving ICP in your wallet…"
                : step === "buying"
                  ? `Buying ${DISPLAY_SYMBOL}…`
                  : status?.complete
                    ? "Presale complete"
                    : status?.salesPaused
                      ? "Sales are paused"
                      : transfersFrozen
                        ? "Transfers frozen — purchases paused"
                        : "Review purchase"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-6 md:gap-8"
      data-ocid="exchange.page"
    >
      <header className="space-y-3">
        <p className="text-imperial text-xs font-semibold text-primary">
          The Ten Thousand Immortals · Presale
        </p>
        <h1 className="text-imperial text-gradient-gold text-3xl font-bold md:text-5xl">
          Buy {DISPLAY_SYMBOL}
        </h1>
        <p className="max-w-2xl text-balance text-muted-foreground">
          When one Immortal falls, another steps forward. Take your place in the
          ranks — exchange ICP for {DISPLAY_SYMBOL} at 1 {DISPLAY_SYMBOL} ={" "}
          <span className="font-mono tabular-nums text-foreground">
            {TOKEN_PRICE_USD.toLocaleString("en-US")} USD
          </span>
          . Minimum purchase 1 USD.
        </p>
        <p
          className="token-identity-note max-w-2xl px-4 py-3 text-sm leading-relaxed"
          data-ocid="exchange.token_identity_note"
        >
          This is {DISPLAY_SYMBOL}. For wallet interoperability, the underlying
          ICRC ledger reports the symbol {TTTI_SYMBOL}; your wallet may show
          that symbol instead of the name used here.
        </p>
        <div className="divider-gold max-w-xs" />
      </header>

      {wallet === "internetIdentity" && iiAddress.data === null && (
        <MigrationNotice />
      )}

      {transfersFrozen && (
        <Alert variant="destructive" data-ocid="exchange.frozen_error_state">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Purchases paused — transfers frozen</AlertTitle>
          <AlertDescription>
            {TRANSFERS_FROZEN_PURCHASE_MESSAGE}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          {purchaseCard}
          {wallet && (
            <DeliveryAddressCard
              key={wallet}
              wallet={wallet}
              plugPrincipal={plugPrincipal}
            />
          )}
        </div>

        <aside className="order-first flex min-w-0 flex-col gap-6 lg:order-none lg:col-span-2">
          <PresaleProgress status={status} isLoading={statusQuery.isLoading} />
          <Card className={CARD_CLASS} data-ocid="exchange.price_card">
            <CardHeader className="pb-3">
              <CardTitle className="text-imperial flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" />
                ICP/USD price
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {statusQuery.isLoading ? (
                <Skeleton className="h-8 w-40" />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="font-mono text-2xl font-bold tabular-nums text-primary"
                    data-ocid="exchange.icp_price"
                  >
                    {livePriceAvailable ? formatUsdE8(price) : "—"}
                  </span>
                  {status?.priceStale && (
                    <Badge variant="destructive" className="rounded-full">
                      Stale
                    </Badge>
                  )}
                </div>
              )}
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Source</dt>
                  <dd data-ocid="exchange.price_source">
                    {usingFallback
                      ? "Admin fallback rate"
                      : status
                        ? SOURCE_LABELS[status.priceSource]
                        : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Last updated</dt>
                  <dd className="text-right">
                    {updatedAt
                      ? updatedAt.toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Never"}
                  </dd>
                </div>
                <Separator className="bg-primary/20" />
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Reference price</dt>
                  <dd className="font-mono tabular-nums">
                    1 {DISPLAY_SYMBOL} ={" "}
                    {TOKEN_PRICE_USD.toLocaleString("en-US")} USD
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">1 ICP buys</dt>
                  <dd className="font-mono tabular-nums">
                    {priceAvailable
                      ? `${formatTtti(quote(ICP_DIVISOR))} ${DISPLAY_SYMBOL}`
                      : "—"}
                  </dd>
                </div>
                <Separator className="bg-primary/20" />
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Pricing mode</dt>
                  <dd data-ocid="exchange.pricing_mode">
                    {publicTreasuryLoading ? (
                      <Skeleton className="h-4 w-20" />
                    ) : publicTreasury ? (
                      publicTreasury.mode === TreasuryMode.auto ? (
                        "Automatic"
                      ) : (
                        "Manual"
                      )
                    ) : (
                      "Not configured"
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Presale margin</dt>
                  <dd
                    className="font-mono tabular-nums"
                    data-ocid="exchange.presale_margin"
                  >
                    {publicTreasury ? formatBps(publicTreasury.marginBps) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">
                    Treasury ICP account
                  </dt>
                  <dd className="flex min-w-0 items-center justify-end gap-1">
                    <span
                      className="min-w-0 truncate font-mono text-xs"
                      title={treasuryAccountText || undefined}
                      aria-label={
                        treasuryAccountText
                          ? `Treasury ICP account: ${treasuryAccountText}`
                          : undefined
                      }
                      data-ocid="exchange.treasury_account"
                    >
                      {treasuryAccountText
                        ? truncateAccountText(treasuryAccountText)
                        : "—"}
                    </span>
                    {treasuryAccountText && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-md text-muted-foreground transition-smooth hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => void handleCopyTreasury()}
                        aria-label={
                          treasuryCopied
                            ? "Treasury ICP account copied"
                            : "Copy treasury ICP account"
                        }
                        title={treasuryCopied ? "Copied" : "Copy full account"}
                        data-ocid="exchange.treasury_account_copy_button"
                      >
                        {treasuryCopied ? (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                The price refreshes automatically at purchase when it is older
                than 5 minutes.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
