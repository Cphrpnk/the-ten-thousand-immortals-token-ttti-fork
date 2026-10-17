import { Principal } from "@icp-sdk/core/principal";
import {
  AlertCircle,
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  Coins,
  History,
  Landmark,
  Loader2,
  Percent,
  RefreshCw,
  Settings2,
  ShieldAlert,
  TrendingUp,
  Undo2,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  Account,
  Conversion,
  OnRampLink,
  PurchaseResult,
} from "../backend";
import {
  ConversionStatus,
  OracleStatus,
  PriceSource,
  TreasuryMode,
} from "../backend";
import { FailedForwards } from "../components/admin/FailedForwards";
import {
  FallbackRateSwitch,
  LaunchControls,
} from "../components/admin/LaunchControls";
import { SnapshotExport } from "../components/admin/SnapshotExport";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useIcpApprove } from "../hooks/useIcpApprove";
import {
  useConversions,
  useConvertDeposit,
  useFeeBounds,
  useGetBurnAccount,
  useGetCallerIcpBalance,
  useGetFee,
  useGetFeeCollector,
  useGetIcpPrice,
  useGetMaxSupply,
  useGetOnRampLinks,
  useGetPresaleStatus,
  useIsCallerAdmin,
  useMint,
  useRefreshIcpPrice,
  useSetFee,
  useSetOnRampLinks,
  useSetTreasuryConfig,
  useTokenInfo,
  useTreasuryConfig,
  useTreasuryState,
} from "../hooks/useQueries";
import { requiredIcpBalance } from "../lib/icpLedger";
import {
  ICP_FEE_E8S,
  MAX_MARGIN_BPS,
  TTTI_DECIMALS,
  TTTI_SYMBOL,
  encodeAccountText,
  formatBps,
  formatIcp,
  formatTtti,
  formatUsdE8,
  parseIcp,
  parseTtti,
  parseUnits,
  truncateAccountText,
  unitsInputValue,
} from "../lib/token";

/** Margin input is a percentage with up to 2 decimals (1% = 100 bps). */
const MARGIN_PERCENT_DECIMALS = 2;

/** Open sections, with a quiet rule rather than stacked card frames. */
const GOLD_CARD =
  "surface-open rounded-none border-t border-border shadow-none";
const PRIMARY_GOLD = "shadow-gold transition-smooth hover:brightness-110";
const SECONDARY_GOLD =
  "border border-gold transition-smooth hover:border-gold-strong";
const OUTLINE_GOLD =
  "border-gold transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-foreground";

const PRICE_SOURCE_LABELS: Record<PriceSource, string> = {
  [PriceSource.coinbase]: "Coinbase",
  [PriceSource.coingecko]: "CoinGecko",
  [PriceSource.none]: "No source",
};

/** TTTI-P amount as an editable decimal string (no thousands separators). */
function toInputAmount(value: bigint): string {
  return formatTtti(value).replace(/,/g, "");
}

function toHex(bytes: Uint8Array | undefined): string {
  if (!bytes) return "";
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type ConvertNotice = {
  tone: "success" | "refunded" | "error";
  title: string;
  message: string;
} | null;

/** Keep historical conversion rows intact while withholding ledger-internal wording. */
function safeConversionMessage(message: string | undefined): string {
  if (!message) return "";
  return /burn/i.test(message)
    ? "Delivery could not be completed for this ledger destination."
    : message;
}

/** Map a convertDeposit result to a clear success / refunded / error notice. */
function describePurchase(
  result: PurchaseResult,
  icpAmount: bigint,
): ConvertNotice {
  if (result.__kind__ === "Ok") {
    const c = result.Ok;
    return {
      tone: "success",
      title: "Conversion complete",
      message: `Converted ${formatIcp(icpAmount)} ICP into ${formatTtti(c.tttiAmount)} ${TTTI_SYMBOL} at ${formatUsdE8(c.priceUsdE8)} per ICP${c.usedFallback ? " (fallback rate)" : ""}.`,
    };
  }
  const code = result.Err.code.__kind__;
  if (code === "deliveryFailedRefunded") {
    return {
      tone: "refunded",
      title: "Delivery failed — ICP refunded",
      message:
        "The token delivery could not be completed. Your ICP was returned. Please check the recipient before trying again.",
    };
  }
  return {
    tone: "error",
    title:
      code === "deliveryFailedRefundFailed"
        ? "Delivery failed and the refund failed"
        : "Conversion failed",
    message:
      code === "deliveryFailedRefundFailed"
        ? `Token delivery and ICP refund could not be completed. Contact support${result.Err.conversion ? ` with purchase #${result.Err.conversion.id}` : ""}.`
        : "The conversion could not be completed. Please check the recipient and try again.",
  };
}

/** Format a nanosecond bigint timestamp as a locale string. */
function formatTimestamp(timestamp: bigint): string {
  const date = new Date(Number(timestamp / 1_000_000n));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function truncatePrincipal(principal: Principal): string {
  const text = principal.toText();
  if (text.length <= 18) return text;
  return `${text.slice(0, 9)}…${text.slice(-6)}`;
}

function AdminOnlyNotice() {
  return (
    <Card
      className="w-full max-w-2xl mx-auto rounded-lg border-destructive/40 bg-card"
      data-ocid="admin.denied_card"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg text-destructive">
          <ShieldAlert className="h-5 w-5" />
          Admins Only
        </CardTitle>
        <CardDescription>
          This panel controls token issuance, fees, and the treasury. Your
          principal does not have administrator access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive" data-ocid="admin.denied_state">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>
            Sign in with an administrator identity to mint tokens, set the
            transfer fee, configure the treasury, or review supply.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export function AdminPage() {
  const { data: isAdmin, isLoading: isAdminLoading } = useIsCallerAdmin();
  const { data: tokenInfo, isLoading: isTokenLoading } = useTokenInfo();
  const { data: maxSupply } = useGetMaxSupply();
  const { data: currentFee, isLoading: isFeeLoading } = useGetFee();
  const { data: feeBounds } = useFeeBounds();

  const { data: treasuryConfig, isLoading: isConfigLoading } =
    useTreasuryConfig();
  const { data: treasuryState, isLoading: isStateLoading } = useTreasuryState();
  const { data: conversions, isLoading: isConversionsLoading } =
    useConversions();

  const { data: onRampLinks, isLoading: isOnRampsLoading } =
    useGetOnRampLinks();

  const { data: callerIcpBalance } = useGetCallerIcpBalance();
  const { data: presale, isLoading: isPresaleLoading } = useGetPresaleStatus();
  const { data: feeCollector, isLoading: isCollectorLoading } =
    useGetFeeCollector();
  const { data: reservedAccount } = useGetBurnAccount();

  const {
    data: icpPrice,
    isLoading: isPriceLoading,
    isError: isPriceError,
  } = useGetIcpPrice();
  const refreshPrice = useRefreshIcpPrice();

  const mint = useMint();
  const setFee = useSetFee();
  const setTreasuryConfig = useSetTreasuryConfig();
  const setOnRampLinks = useSetOnRampLinks();
  const approve = useIcpApprove();
  const convertDeposit = useConvertDeposit();

  const [recipient, setRecipient] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);

  const [feeInput, setFeeInput] = useState("");
  const [feeError, setFeeError] = useState<string | null>(null);
  const [feeSuccess, setFeeSuccess] = useState<string | null>(null);

  const [icpOwner, setIcpOwner] = useState("");
  const [icpSubaccount, setIcpSubaccount] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [mode, setMode] = useState<TreasuryMode>(TreasuryMode.manual);
  const [marginInput, setMarginInput] = useState("0");
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configInitialized, setConfigInitialized] = useState(false);

  const [convertAmount, setConvertAmount] = useState("");
  const [convertRecipient, setConvertRecipient] = useState("");
  const [convertNotice, setConvertNotice] = useState<ConvertNotice>(null);

  const [onRampDraft, setOnRampDraft] = useState<
    Array<OnRampLink & { id: string }>
  >([]);
  const [onRampError, setOnRampError] = useState<string | null>(null);
  const [onRampSuccess, setOnRampSuccess] = useState<string | null>(null);
  const [onRampsInitialized, setOnRampsInitialized] = useState(false);

  // One-time initialization of the config draft from the loaded config.
  if (!configInitialized && !isConfigLoading && treasuryConfig) {
    setIcpOwner(treasuryConfig.icpAccount.owner.toText());
    setIcpSubaccount(
      treasuryConfig.icpAccount.subaccount
        ? Array.from(treasuryConfig.icpAccount.subaccount)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        : "",
    );
    setRateInput(toInputAmount(treasuryConfig.rate));
    setMode(treasuryConfig.mode);
    setMarginInput(
      unitsInputValue(treasuryConfig.marginBps, MARGIN_PERCENT_DECIMALS),
    );
    setConfigInitialized(true);
  }

  // One-time initialization of the on-ramp draft from the loaded links.
  if (!onRampsInitialized && !isOnRampsLoading) {
    setOnRampDraft(
      (onRampLinks ?? []).map((link, index) => ({
        ...link,
        id: `onramp-${index}`,
      })),
    );
    setOnRampsInitialized(true);
  }

  if (isAdminLoading) {
    return (
      <div
        className="w-full max-w-2xl mx-auto space-y-4"
        data-ocid="admin.loading_state"
      >
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6" data-ocid="admin.page">
        <AdminOnlyNotice />
      </div>
    );
  }

  const handleMint = (e: React.FormEvent) => {
    e.preventDefault();
    setMintError(null);
    setMintSuccess(null);

    let owner: Principal;
    try {
      owner = Principal.fromText(recipient.trim());
    } catch {
      setMintError("Enter a valid principal ID.");
      return;
    }

    const amount = parseTtti(mintAmount);
    if (amount === null || amount <= 0n) {
      setMintError(
        `Enter an amount greater than 0 with up to ${TTTI_DECIMALS} decimals.`,
      );
      return;
    }

    const capturedRecipient = recipient;
    const capturedAmount = mintAmount;
    setRecipient("");
    setMintAmount("");

    mint.mutate(
      { to: { owner }, amount },
      {
        onSuccess: (result) => {
          if (result.__kind__ === "Ok") {
            setMintSuccess(
              `Minted ${formatTtti(amount)} ${TTTI_SYMBOL} to ${owner.toText()}.`,
            );
            toast.success("Tokens minted");
          } else {
            const message = describeTransferError(result.Err);
            setMintError(message);
            setRecipient(capturedRecipient);
            setMintAmount(capturedAmount);
          }
        },
        onError: (error) => {
          setMintError(error.message || "Mint failed. Please try again.");
          setRecipient(capturedRecipient);
          setMintAmount(capturedAmount);
        },
      },
    );
  };

  const feeMin = feeBounds?.min ?? 0n;
  const feeMax = feeBounds?.max;
  const feeBoundsLabel =
    feeMax === undefined
      ? null
      : `${formatTtti(feeMin)} – ${formatTtti(feeMax)} ${TTTI_SYMBOL} (${feeMin.toString()}–${feeMax.toString()} base units)`;
  const feeParsed = parseTtti(feeInput);
  const feeInlineError =
    feeInput.trim() === ""
      ? null
      : feeParsed === null
        ? `Enter a fee with up to ${TTTI_DECIMALS} decimals, e.g. 0.000001.`
        : feeParsed < feeMin || (feeMax !== undefined && feeParsed > feeMax)
          ? `The fee must be between ${feeBoundsLabel ?? "the allowed bounds"}.`
          : null;

  const marginParsed = parseUnits(marginInput, MARGIN_PERCENT_DECIMALS);
  const marginInlineError =
    marginInput.trim() === ""
      ? `Enter a margin between 0% and ${formatBps(MAX_MARGIN_BPS)}.`
      : marginParsed === null
        ? "Enter a percentage with up to 2 decimals, e.g. 2 or 2.5."
        : marginParsed > MAX_MARGIN_BPS
          ? `The margin cannot exceed ${formatBps(MAX_MARGIN_BPS)} (${MAX_MARGIN_BPS.toString()} bps).`
          : null;

  const handleSetFee = (e: React.FormEvent) => {
    e.preventDefault();
    setFeeError(null);
    setFeeSuccess(null);

    const fee = parseTtti(feeInput);
    if (fee === null || fee < 0n) {
      setFeeError(
        `Enter a fee of 0 or more with up to ${TTTI_DECIMALS} decimals.`,
      );
      return;
    }
    if (feeInlineError) return;

    const capturedFee = feeInput;
    setFeeInput("");

    setFee.mutate(fee, {
      onSuccess: () => {
        setFeeSuccess(
          `Transfer fee updated to ${formatTtti(fee)} ${TTTI_SYMBOL}.`,
        );
        toast.success("Fee updated");
      },
      onError: (error) => {
        setFeeError(error.message || "Failed to update the fee.");
        toast.error(error.message || "Failed to update the fee.");
        setFeeInput(capturedFee);
      },
    });
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    setConfigSuccess(null);

    let owner: Principal;
    try {
      owner = Principal.fromText(icpOwner.trim());
    } catch {
      setConfigError("Enter a valid ICP account principal.");
      return;
    }

    const subaccountHex = icpSubaccount.trim().replace(/^0x/i, "");
    let subaccount: Uint8Array | undefined;
    if (subaccountHex.length > 0) {
      if (!/^[0-9a-fA-F]{64}$/.test(subaccountHex)) {
        setConfigError(
          "The subaccount must be 64 hex characters (32 bytes) or left empty.",
        );
        return;
      }
      subaccount = new Uint8Array(
        subaccountHex
          .match(/.{2}/g)
          ?.map((byte) => Number.parseInt(byte, 16)) ?? [],
      );
    }

    const rate = parseTtti(rateInput);
    if (rate === null || rate <= 0n) {
      setConfigError(
        `Enter a fallback rate greater than 0 ${TTTI_SYMBOL} per ICP with up to ${TTTI_DECIMALS} decimals.`,
      );
      return;
    }

    const account: Account = subaccount ? { owner, subaccount } : { owner };

    if (marginParsed === null || marginInlineError) {
      setConfigError(marginInlineError ?? "Enter a valid presale margin.");
      return;
    }
    const marginBps = marginParsed;

    setTreasuryConfig.mutate(
      {
        icpAccount: account,
        rate,
        mode,
        marginBps,
      },
      {
        onSuccess: (saved) => {
          setMarginInput(
            unitsInputValue(saved.marginBps, MARGIN_PERCENT_DECIMALS),
          );
          setConfigSuccess(
            `Treasury configuration saved (margin ${formatBps(saved.marginBps)}).`,
          );
          toast.success("Treasury configuration saved");
        },
        onError: (error) => {
          setConfigError(error.message || "Failed to save the configuration.");
          toast.error(error.message || "Failed to save the configuration.");
        },
      },
    );
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setConvertNotice(null);
    const fail = (message: string) =>
      setConvertNotice({ tone: "error", title: "Conversion failed", message });

    let recipientAccount: Account | null = null;
    if (convertRecipient.trim() !== "") {
      try {
        recipientAccount = {
          owner: Principal.fromText(convertRecipient.trim()),
        };
      } catch {
        fail("Enter a valid recipient principal ID, or leave it empty.");
        return;
      }
      if (!reservedAccount) {
        fail(
          "Destination validation is unavailable. Please try again shortly.",
        );
        return;
      }
      if (recipientAccount.owner.toText() === reservedAccount.owner.toText()) {
        fail(
          "This address is reserved by the ledger. Choose another recipient.",
        );
        return;
      }
    }

    const icpAmount = parseIcp(convertAmount);
    if (icpAmount === null || icpAmount <= 0n) {
      fail("Enter an ICP amount greater than 0 with up to 8 decimals.");
      return;
    }

    const captured = convertAmount;
    setConvertAmount("");
    const restore = () =>
      setConvertAmount((current) => (current === "" ? captured : current));

    // convertDeposit collects ICP via ICRC-2 transfer_from on the ICP ledger,
    // so approve the canister for the amount plus the 0.0001 ICP fee first.
    const outcome = await approve.mutateAsync({
      purchaseE8s: icpAmount,
      balanceE8s: callerIcpBalance,
    });
    if (!outcome.ok) {
      fail(outcome.message);
      restore();
      return;
    }

    convertDeposit.mutate(
      { recipient: recipientAccount, icpAmount },
      {
        onSuccess: (result) => {
          const notice = describePurchase(result, icpAmount);
          setConvertNotice(notice);
          if (notice?.tone === "success") {
            toast.success("Conversion complete");
          } else {
            restore();
          }
        },
        onError: () => {
          fail(
            "The conversion could not be completed. Please check the recipient and try again.",
          );
          restore();
        },
      },
    );
  };

  const handleSaveOnRamps = (e: React.FormEvent) => {
    e.preventDefault();
    setOnRampError(null);
    setOnRampSuccess(null);

    const cleaned: Array<OnRampLink & { id: string }> = [];
    for (const link of onRampDraft) {
      const name = link.name.trim();
      const url = link.url.trim();
      if (name.length === 0 && url.length === 0) continue;
      if (name.length === 0) {
        setOnRampError("Every on-ramp needs a name.");
        return;
      }
      if (!/^https?:\/\//.test(url)) {
        setOnRampError(`Enter a valid http(s) URL for "${name}".`);
        return;
      }
      cleaned.push({ id: link.id, name, url });
    }

    setOnRampLinks.mutate(cleaned, {
      onSuccess: () => {
        setOnRampDraft(cleaned);
        setOnRampSuccess("On-ramp links saved.");
        toast.success("On-ramp links saved");
      },
      onError: (error) => {
        setOnRampError(error.message || "Failed to save the on-ramp links.");
      },
    });
  };

  const handleRefreshPrice = () => {
    refreshPrice.mutate(undefined, {
      onSuccess: (result) => {
        if (result.__kind__ === "Ok") {
          toast.success("ICP/USD price refreshed");
        } else {
          toast.error(result.Err || "The oracle refresh failed.");
        }
      },
      onError: (error) => {
        toast.error(error.message || "The oracle refresh failed.");
      },
    });
  };

  const totalSupply = tokenInfo?.totalSupply ?? 0n;
  const supplyCap = maxSupply ?? tokenInfo?.maxSupply ?? 0n;
  const remaining = supplyCap > totalSupply ? supplyCap - totalSupply : 0n;
  const usedPercent =
    supplyCap > 0n ? Number((totalSupply * 10000n) / supplyCap) / 100 : 0;
  const usedPercentText =
    totalSupply > 0n && usedPercent < 0.01
      ? "<0.01%"
      : `${usedPercent.toFixed(2)}%`;

  const activeMode = treasuryState?.mode ?? treasuryConfig?.mode;
  const activeRate = treasuryState?.rate ?? treasuryConfig?.rate ?? 0n;
  const icpBalance = treasuryState?.icpBalance ?? 0n;
  const isManual = activeMode === TreasuryMode.manual;

  const convertParsed = parseIcp(convertAmount);
  const convertRequired =
    convertParsed !== null && convertParsed > 0n
      ? requiredIcpBalance(convertParsed)
      : null;
  const convertShortfall =
    convertRequired !== null &&
    callerIcpBalance !== undefined &&
    callerIcpBalance < convertRequired;

  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-12 md:gap-16"
      data-ocid="admin.page"
    >
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-imperial text-gradient-gold text-2xl leading-tight md:text-3xl">
            Admin Panel
          </h1>
          <Badge variant="secondary" className="gap-1 border-gold text-primary">
            <ShieldAlert className="w-3 h-3" />
            Admin
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Mint {TTTI_SYMBOL}, run the presale switches, configure the ICP
          treasury, and review supply, conversions and snapshots.
        </p>
      </header>

      <section
        className="grid gap-x-8 gap-y-6 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4"
        data-ocid="admin.supply_section"
      >
        <StatCard
          icon={<Coins className="w-4 h-4" />}
          label="Total Supply"
          value={
            isTokenLoading ? null : `${formatTtti(totalSupply)} ${TTTI_SYMBOL}`
          }
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Max Supply"
          value={
            isTokenLoading ? null : `${formatTtti(supplyCap)} ${TTTI_SYMBOL}`
          }
        />
        <StatCard
          icon={<UserPlus className="w-4 h-4" />}
          label="Remaining Mintable"
          value={
            isTokenLoading ? null : `${formatTtti(remaining)} ${TTTI_SYMBOL}`
          }
        />
        <StatCard
          icon={<Percent className="w-4 h-4" />}
          label="Transfer Fee"
          value={
            isFeeLoading
              ? null
              : `${formatTtti(currentFee ?? 0n)} ${TTTI_SYMBOL}`
          }
        />
      </section>

      <section className="space-y-2" data-ocid="admin.supply_progress">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Supply used</span>
          <span className="font-mono tabular-nums text-primary">
            {usedPercentText}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-primary transition-all"
            style={{ width: `${Math.min(usedPercent, 100)}%` }}
          />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Card className={GOLD_CARD} data-ocid="admin.presale_card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Coins className="w-5 h-5 text-primary" />
              Presale Allocation
            </CardTitle>
            <CardDescription>
              Progress of the{" "}
              {presale ? formatTtti(presale.allocation) : "1.00"} {TTTI_SYMBOL}{" "}
              presale allocation.
              {presale?.complete ? " The presale is complete." : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPresaleLoading || !presale ? (
              <Skeleton
                className="h-24 w-full"
                data-ocid="admin.presale_loading_state"
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SupplyRow label="Sold" value={formatTtti(presale.sold)} />
                  <SupplyRow
                    label="Reserved"
                    value={formatTtti(presale.reserved)}
                  />
                  <SupplyRow
                    label="Remaining"
                    value={formatTtti(presale.remaining)}
                  />
                </div>
                <div className="space-y-2" data-ocid="admin.presale_progress">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Sold + reserved</span>
                    <span className="font-mono tabular-nums text-primary">
                      {presale.allocation > 0n
                        ? (
                            Number(
                              ((presale.sold + presale.reserved) * 10000n) /
                                presale.allocation,
                            ) / 100
                          ).toFixed(2)
                        : "0.00"}
                      %
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-primary transition-all"
                      style={{
                        width: `${
                          presale.allocation > 0n
                            ? Math.min(
                                Number(
                                  ((presale.sold + presale.reserved) * 10000n) /
                                    presale.allocation,
                                ) / 100,
                                100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={GOLD_CARD} data-ocid="admin.fee_collector_card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Landmark className="w-5 h-5 text-primary" />
              Fee Collector
            </CardTitle>
            <CardDescription>
              Transfer fees accrue here; the presale sells these tokens before
              minting new ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isCollectorLoading || !feeCollector ? (
              <Skeleton
                className="h-24 w-full"
                data-ocid="admin.fee_collector_loading_state"
              />
            ) : (
              <>
                <SupplyRow
                  label="Balance"
                  value={`${formatTtti(feeCollector.balance)} ${TTTI_SYMBOL}`}
                />
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd
                    className="font-mono break-all"
                    data-ocid="admin.fee_collector_owner"
                  >
                    {feeCollector.account.owner.toText()}
                  </dd>
                  <dt className="text-muted-foreground">Subaccount</dt>
                  <dd className="font-mono break-all">
                    {toHex(feeCollector.account.subaccount) || "Default"}
                  </dd>
                </dl>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <LaunchControls />

      <Card className={GOLD_CARD} data-ocid="admin.oracle_card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
            ICP/USD Oracle
          </CardTitle>
          <CardDescription>
            The live price purchases use, fetched from Coinbase with CoinGecko
            as backup. Refresh it when the price is stale or unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPriceLoading ? (
            <Skeleton className="h-9 w-48" />
          ) : isPriceError || !icpPrice ? (
            <Alert variant="destructive" data-ocid="admin.oracle_error_state">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The ICP/USD price could not be loaded. Refresh the oracle to try
                again.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <p
                className="text-2xl font-semibold tracking-tight font-mono tabular-nums text-primary"
                data-ocid="admin.oracle_price"
              >
                {formatUsdE8(icpPrice.usdE8)}
              </p>
              <Badge variant="outline" data-ocid="admin.oracle_source">
                {PRICE_SOURCE_LABELS[icpPrice.source]}
              </Badge>
              {icpPrice.stale && (
                <Badge variant="destructive" data-ocid="admin.oracle_stale">
                  Stale
                </Badge>
              )}
              {!icpPrice.stale && (
                <Badge
                  variant={
                    icpPrice.status === OracleStatus.unavailable
                      ? "destructive"
                      : "default"
                  }
                  data-ocid="admin.oracle_status"
                >
                  {icpPrice.status === OracleStatus.unavailable
                    ? "Unavailable"
                    : "Live"}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Updated {formatTimestamp(icpPrice.updatedAt)}
              </span>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            className={SECONDARY_GOLD}
            onClick={handleRefreshPrice}
            disabled={refreshPrice.isPending}
            data-ocid="admin.oracle_refresh_button"
          >
            {refreshPrice.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Refresh price
              </>
            )}
          </Button>

          <Separator className="divider-gold bg-transparent" />

          <FallbackRateSwitch
            fallbackRate={presale?.fallbackRate ?? treasuryConfig?.rate ?? 0n}
          />
        </CardContent>
      </Card>

      <div className="grid gap-10 lg:grid-cols-2">
        <Card className={GOLD_CARD} data-ocid="admin.mint_card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <UserPlus className="w-5 h-5 text-primary" />
              Mint Tokens
            </CardTitle>
            <CardDescription>
              Issue new {TTTI_SYMBOL} to a principal. Minting cannot exceed the
              10 000 {TTTI_SYMBOL} maximum supply.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMint} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mint-recipient">Recipient Principal</Label>
                <Input
                  id="mint-recipient"
                  type="text"
                  placeholder="aaaaa-aa"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  data-ocid="admin.mint_recipient_input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mint-amount">Amount ({TTTI_SYMBOL})</Label>
                <Input
                  id="mint-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00000000"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  autoComplete="off"
                  data-ocid="admin.mint_amount_input"
                />
                <p className="text-xs text-muted-foreground">
                  Up to {TTTI_DECIMALS} decimals. Remaining mintable:{" "}
                  {formatTtti(remaining)} {TTTI_SYMBOL}.
                </p>
              </div>

              {mintError && (
                <Alert variant="destructive" data-ocid="admin.mint_error_state">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{mintError}</AlertDescription>
                </Alert>
              )}

              {mintSuccess && (
                <Alert
                  className="border-primary/40 bg-primary/5"
                  data-ocid="admin.mint_success_state"
                >
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription>{mintSuccess}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className={`w-full ${PRIMARY_GOLD}`}
                disabled={mint.isPending}
                data-ocid="admin.mint_submit_button"
              >
                {mint.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4" />
                    Mint Tokens
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className={GOLD_CARD} data-ocid="admin.fee_card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Percent className="w-5 h-5 text-primary" />
              Transfer Fee
            </CardTitle>
            <CardDescription>
              The fee charged on every token transfer. Current fee:{" "}
              {isFeeLoading
                ? "…"
                : `${formatTtti(currentFee ?? 0n)} ${TTTI_SYMBOL}`}
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetFee} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fee-amount">New Fee ({TTTI_SYMBOL})</Label>
                <Input
                  id="fee-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder={formatTtti(currentFee ?? 0n)}
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  autoComplete="off"
                  aria-invalid={!!feeInlineError}
                  aria-describedby="fee-amount-hint"
                  className={
                    feeInlineError
                      ? "border-destructive focus-visible:ring-destructive"
                      : undefined
                  }
                  data-ocid="admin.fee_input"
                />
                {feeInlineError ? (
                  <p
                    id="fee-amount-hint"
                    className="text-xs text-destructive"
                    role="alert"
                    data-ocid="admin.fee_field_error"
                  >
                    {feeInlineError}
                  </p>
                ) : (
                  <p
                    id="fee-amount-hint"
                    className="text-xs text-muted-foreground"
                  >
                    Up to {TTTI_DECIMALS} decimals, e.g. 0.000001.
                    {feeBoundsLabel
                      ? ` Allowed range: ${feeBoundsLabel}.`
                      : " Loading allowed range…"}
                  </p>
                )}
              </div>

              {feeError && (
                <Alert variant="destructive" data-ocid="admin.fee_error_state">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{feeError}</AlertDescription>
                </Alert>
              )}

              {feeSuccess && (
                <Alert
                  className="border-primary/40 bg-primary/5"
                  data-ocid="admin.fee_success_state"
                >
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription>{feeSuccess}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                variant="secondary"
                className={`w-full ${SECONDARY_GOLD}`}
                disabled={
                  setFee.isPending ||
                  !!feeInlineError ||
                  feeInput.trim() === "" ||
                  feeMax === undefined
                }
                data-ocid="admin.fee_submit_button"
              >
                {setFee.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Percent className="w-4 h-4" />
                    Update Fee
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className={GOLD_CARD} data-ocid="admin.treasury_card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Settings2 className="w-5 h-5 text-primary" />
            Treasury Configuration
          </CardTitle>
          <CardDescription>
            Set the ICP deposit account, the conversion rate, and whether
            deposits convert automatically or on demand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1 border-l border-border pl-4">
              <p className="text-sm text-muted-foreground">ICP balance</p>
              {isStateLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <p
                  className="text-lg font-semibold tracking-tight font-mono tabular-nums"
                  data-ocid="admin.treasury_icp_balance"
                >
                  {formatIcp(icpBalance)} ICP
                </p>
              )}
            </div>
            <div className="space-y-1 border-l border-border pl-4">
              <p className="text-sm text-muted-foreground">Active mode</p>
              {isStateLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p data-ocid="admin.treasury_mode">
                  <Badge variant={isManual ? "secondary" : "default"}>
                    {activeMode === TreasuryMode.auto ? "Auto" : "Manual"}
                  </Badge>
                </p>
              )}
            </div>
            <div className="space-y-1 border-l border-border pl-4">
              <p className="text-sm text-muted-foreground">Conversion rate</p>
              {isStateLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <p
                  className="text-lg font-semibold tracking-tight font-mono tabular-nums"
                  data-ocid="admin.treasury_rate"
                >
                  {formatTtti(activeRate)} {TTTI_SYMBOL} / ICP
                </p>
              )}
            </div>
          </div>

          <Separator />

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="treasury-owner">ICP Account Principal</Label>
                <Input
                  id="treasury-owner"
                  type="text"
                  placeholder="aaaaa-aa"
                  value={icpOwner}
                  onChange={(e) => setIcpOwner(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  data-ocid="admin.treasury_owner_input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treasury-subaccount">
                  Subaccount (optional, 64 hex)
                </Label>
                <Input
                  id="treasury-subaccount"
                  type="text"
                  placeholder="Leave empty for the default subaccount"
                  value={icpSubaccount}
                  onChange={(e) => setIcpSubaccount(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  data-ocid="admin.treasury_subaccount_input"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="treasury-rate">
                  Fallback rate ({TTTI_SYMBOL} per ICP)
                </Label>
                <Input
                  id="treasury-rate"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00030000"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  autoComplete="off"
                  data-ocid="admin.treasury_rate_input"
                />
                <p className="text-xs text-muted-foreground">
                  {TTTI_SYMBOL} credited per 1 ICP, up to {TTTI_DECIMALS}{" "}
                  decimals. Used only when the live price is unavailable and the
                  fallback rate is enabled.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none">Mode</p>
                <fieldset className="flex gap-2">
                  <legend className="sr-only">Treasury mode</legend>
                  <Button
                    type="button"
                    variant={isManual ? "default" : "outline"}
                    className={`flex-1 ${isManual ? PRIMARY_GOLD : OUTLINE_GOLD}`}
                    onClick={() => setMode(TreasuryMode.manual)}
                    data-ocid="admin.treasury_mode_manual_button"
                  >
                    Manual
                  </Button>
                  <Button
                    type="button"
                    variant={mode === TreasuryMode.auto ? "default" : "outline"}
                    className={`flex-1 ${mode === TreasuryMode.auto ? PRIMARY_GOLD : OUTLINE_GOLD}`}
                    onClick={() => setMode(TreasuryMode.auto)}
                    data-ocid="admin.treasury_mode_auto_button"
                  >
                    Auto
                  </Button>
                </fieldset>
                <p className="text-xs text-muted-foreground">
                  {mode === TreasuryMode.auto
                    ? "Deposits convert automatically at the current rate."
                    : "An admin triggers each conversion manually."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="treasury-margin">Presale margin (%)</Label>
                <div className="relative">
                  <Input
                    id="treasury-margin"
                    type="text"
                    inputMode="decimal"
                    placeholder="2"
                    value={marginInput}
                    onChange={(e) => setMarginInput(e.target.value)}
                    autoComplete="off"
                    aria-invalid={!!marginInlineError}
                    aria-describedby="treasury-margin-hint"
                    className={`pr-10 font-mono tabular-nums ${marginInlineError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    data-ocid="admin.treasury_margin_input"
                  />
                  <span
                    className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                    aria-hidden="true"
                  >
                    %
                  </span>
                </div>
                {marginInlineError ? (
                  <p
                    id="treasury-margin-hint"
                    className="text-xs text-destructive"
                    role="alert"
                    data-ocid="admin.treasury_margin_field_error"
                  >
                    {marginInlineError}
                  </p>
                ) : (
                  <p
                    id="treasury-margin-hint"
                    className="text-xs text-muted-foreground"
                  >
                    {marginParsed !== null
                      ? `${marginParsed.toString()} bps. `
                      : ""}
                    Deducted from the live-price conversion. Allowed 0% –{" "}
                    {formatBps(MAX_MARGIN_BPS)} (0–{MAX_MARGIN_BPS.toString()}{" "}
                    bps).
                  </p>
                )}
              </div>
            </div>

            {configError && (
              <Alert
                variant="destructive"
                data-ocid="admin.treasury_config_error_state"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{configError}</AlertDescription>
              </Alert>
            )}

            {configSuccess && (
              <Alert
                className="border-primary/40 bg-primary/5"
                data-ocid="admin.treasury_config_success_state"
              >
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription>{configSuccess}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className={`w-full sm:w-auto ${PRIMARY_GOLD}`}
              disabled={setTreasuryConfig.isPending || !!marginInlineError}
              data-ocid="admin.treasury_save_button"
            >
              {setTreasuryConfig.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Settings2 className="w-4 h-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </form>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                Manual Conversion
              </h3>
              <p className="text-sm text-muted-foreground">
                Approve the presale canister on the ICP ledger (amount + 0.0001
                ICP fee), then buy {TTTI_SYMBOL} with your own ICP. Available in
                manual mode.
              </p>
            </div>

            <form onSubmit={handleConvert} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="convert-recipient">
                  Recipient Principal (optional)
                </Label>
                <Input
                  id="convert-recipient"
                  type="text"
                  placeholder="Leave empty to use your delivery address or principal"
                  value={convertRecipient}
                  onChange={(e) => setConvertRecipient(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  disabled={!isManual}
                  data-ocid="admin.convert_recipient_input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="convert-amount">ICP amount</Label>
                <Input
                  id="convert-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00000000"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  autoComplete="off"
                  disabled={!isManual}
                  data-ocid="admin.convert_amount_input"
                />
                {!isManual ? (
                  <p className="text-xs text-muted-foreground">
                    Switch the treasury to manual mode to trigger a conversion.
                  </p>
                ) : (
                  <p
                    className={
                      convertShortfall
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                    data-ocid="admin.convert_balance_hint"
                  >
                    Your ICP balance:{" "}
                    {callerIcpBalance === undefined
                      ? "…"
                      : `${formatIcp(callerIcpBalance)} ICP`}
                    {convertRequired !== null &&
                      ` · Required incl. 2 × ${formatIcp(ICP_FEE_E8S)} ICP fees: ${formatIcp(convertRequired)} ICP`}
                  </p>
                )}
              </div>

              {convertNotice && (
                <Alert
                  variant={
                    convertNotice.tone === "error" ? "destructive" : "default"
                  }
                  className={
                    convertNotice.tone === "success"
                      ? "border-primary/40 bg-primary/5"
                      : convertNotice.tone === "refunded"
                        ? "border-warning/50 bg-warning/10"
                        : undefined
                  }
                  data-ocid={
                    convertNotice.tone === "success"
                      ? "admin.convert_success_state"
                      : convertNotice.tone === "refunded"
                        ? "admin.convert_refunded_state"
                        : "admin.convert_error_state"
                  }
                >
                  {convertNotice.tone === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : convertNotice.tone === "refunded" ? (
                    <Undo2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>{convertNotice.title}</AlertTitle>
                  <AlertDescription>{convertNotice.message}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                variant="secondary"
                className={`w-full sm:w-auto ${SECONDARY_GOLD}`}
                disabled={
                  approve.isPending || convertDeposit.isPending || !isManual
                }
                data-ocid="admin.convert_submit_button"
              >
                {approve.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Approving ICP...
                  </>
                ) : convertDeposit.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    Approve & convert ICP
                  </>
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className={GOLD_CARD} data-ocid="admin.onramp_card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Banknote className="w-5 h-5 text-primary" />
            On-Ramp Links
          </CardTitle>
          <CardDescription>
            The providers shown on the Buy ICP page. Leave a row empty to remove
            it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveOnRamps} className="space-y-4">
            {onRampDraft.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No on-ramp links configured. Add one below.
              </p>
            )}

            {onRampDraft.map((link, index) => (
              <div
                key={link.id}
                className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
                data-ocid={`admin.onramp_row.${index + 1}`}
              >
                <div className="space-y-2">
                  <Label htmlFor={`onramp-name-${index}`}>Name</Label>
                  <Input
                    id={`onramp-name-${index}`}
                    type="text"
                    placeholder="MoonPay"
                    value={link.name}
                    onChange={(e) =>
                      setOnRampDraft((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, name: e.target.value }
                            : item,
                        ),
                      )
                    }
                    autoComplete="off"
                    data-ocid={`admin.onramp_name_input.${index + 1}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`onramp-url-${index}`}>URL</Label>
                  <Input
                    id={`onramp-url-${index}`}
                    type="url"
                    placeholder="https://www.moonpay.com/buy/icp"
                    value={link.url}
                    onChange={(e) =>
                      setOnRampDraft((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, url: e.target.value } : item,
                        ),
                      )
                    }
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                    data-ocid={`admin.onramp_url_input.${index + 1}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={OUTLINE_GOLD}
                  onClick={() =>
                    setOnRampDraft((prev) => prev.filter((_, i) => i !== index))
                  }
                  data-ocid={`admin.onramp_remove_button.${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className={OUTLINE_GOLD}
              onClick={() =>
                setOnRampDraft((prev) => [
                  ...prev,
                  { id: `onramp-new-${Date.now()}`, name: "", url: "" },
                ])
              }
              data-ocid="admin.onramp_add_button"
            >
              Add on-ramp
            </Button>

            {onRampError && (
              <Alert variant="destructive" data-ocid="admin.onramp_error_state">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{onRampError}</AlertDescription>
              </Alert>
            )}

            {onRampSuccess && (
              <Alert
                className="border-primary/40 bg-primary/5"
                data-ocid="admin.onramp_success_state"
              >
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription>{onRampSuccess}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className={`w-full sm:w-auto ${PRIMARY_GOLD}`}
              disabled={setOnRampLinks.isPending}
              data-ocid="admin.onramp_save_button"
            >
              {setOnRampLinks.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Banknote className="w-4 h-4" />
                  Save On-Ramp Links
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <FailedForwards />

      <Card className={GOLD_CARD} data-ocid="admin.conversions_card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <History className="w-5 h-5 text-primary" />
            ICP → {TTTI_SYMBOL} Conversions
          </CardTitle>
          <CardDescription>
            Every purchase with its status, the ICP/USD price used and whether
            the fallback rate applied, most recent first.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isConversionsLoading ? (
            <div
              className="space-y-3 p-6"
              data-ocid="admin.conversions_loading_state"
            >
              {Array.from(
                { length: 3 },
                (_, i) => `conversion-skeleton-${i}`,
              ).map((id) => (
                <Skeleton key={id} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !conversions || conversions.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center"
              data-ocid="admin.conversions_empty_state"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold bg-secondary text-primary">
                <Banknote className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-semibold">
                  No conversions yet
                </h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  ICP purchases converted into {TTTI_SYMBOL} will be listed
                  here.
                </p>
              </div>
            </div>
          ) : (
            <ConversionList conversions={conversions} />
          )}
        </CardContent>
      </Card>

      <SnapshotExport />
    </div>
  );
}

function ConversionList({ conversions }: { conversions: Conversion[] }) {
  const sorted = [...conversions].sort((a, b) =>
    a.id < b.id ? 1 : a.id > b.id ? -1 : 0,
  );

  return (
    <>
      <div className="hidden md:block">
        <Table data-ocid="admin.conversions_table">
          <TableHeader className="sticky top-0 bg-secondary [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead>Depositor</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead className="text-right">ICP</TableHead>
              <TableHead className="text-right">{TTTI_SYMBOL}</TableHead>
              <TableHead className="text-right">Price used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((conversion, index) => (
              <TableRow
                key={conversion.id.toString()}
                className="transition-smooth hover:bg-primary/5"
                data-ocid={`admin.conversion_row.${index + 1}`}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  #{conversion.id.toString()}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {truncatePrincipal(conversion.depositor)}
                </TableCell>
                <TableCell
                  className="font-mono text-xs"
                  title={encodeAccountText(conversion.recipient)}
                >
                  {truncateAccountText(
                    encodeAccountText(conversion.recipient),
                    9,
                    6,
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatIcp(conversion.icpAmount)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums text-primary">
                  {formatTtti(conversion.tttiAmount)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums whitespace-nowrap">
                  {formatUsdE8(conversion.priceUsdE8)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <ConversionStatusBadge status={conversion.status} />
                    {conversion.usedFallback && <FallbackBadge />}
                  </div>
                </TableCell>
                <TableCell
                  className="max-w-56 truncate text-xs text-muted-foreground"
                  title={safeConversionMessage(conversion.message)}
                >
                  {safeConversionMessage(conversion.message) || "—"}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  {formatTimestamp(conversion.timestamp)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div
        className="space-y-3 p-4 md:hidden"
        data-ocid="admin.conversions_list"
      >
        {sorted.map((conversion, index) => (
          <div
            key={conversion.id.toString()}
            className="space-y-3 border-t border-border py-5"
            data-ocid={`admin.conversion_item.${index + 1}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1">
                <ConversionStatusBadge status={conversion.status} />
                {conversion.usedFallback && <FallbackBadge />}
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                #{conversion.id.toString()}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {TTTI_SYMBOL} credited
              </span>
              <span className="font-mono font-semibold tabular-nums text-primary">
                {formatTtti(conversion.tttiAmount)}
              </span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">ICP</dt>
              <dd className="font-mono text-right tabular-nums">
                {formatIcp(conversion.icpAmount)}
              </dd>
              <dt className="text-muted-foreground">Price used</dt>
              <dd className="font-mono text-right tabular-nums">
                {formatUsdE8(conversion.priceUsdE8)}
              </dd>
              <dt className="text-muted-foreground">Depositor</dt>
              <dd className="font-mono text-right break-all">
                {conversion.depositor.toText()}
              </dd>
              <dt className="text-muted-foreground">Recipient</dt>
              <dd className="font-mono text-right break-all">
                {conversion.recipient.owner.toText()}
              </dd>
              <dt className="text-muted-foreground">Time</dt>
              <dd className="text-right">
                {formatTimestamp(conversion.timestamp)}
              </dd>
            </dl>
            {conversion.message && (
              <p className="text-xs text-muted-foreground break-words">
                {safeConversionMessage(conversion.message)}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

const STATUS_STYLES: Record<
  ConversionStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  [ConversionStatus.completed]: {
    label: "Completed",
    className: "border-success/30 bg-success/10 text-success",
    icon: CheckCircle2,
  },
  [ConversionStatus.refunded]: {
    label: "Refunded",
    className: "border-warning/40 bg-warning/10 text-warning",
    icon: Undo2,
  },
  [ConversionStatus.refundFailed]: {
    label: "Refund failed",
    className:
      "border-destructive/50 bg-destructive/20 text-destructive font-semibold",
    icon: AlertCircle,
  },
  [ConversionStatus.failed]: {
    label: "Failed",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
    icon: AlertCircle,
  },
};

function ConversionStatusBadge({ status }: { status: ConversionStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES[ConversionStatus.failed];
  const Icon = style.icon;
  return (
    <Badge variant="outline" className={`gap-1.5 ${style.className}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {style.label}
    </Badge>
  );
}

function FallbackBadge() {
  return (
    <Badge variant="secondary" className="border-gold text-xs text-primary">
      Fallback rate
    </Badge>
  );
}

function describeTransferError(error: {
  __kind__: string;
  [key: string]: unknown;
}): string {
  switch (error.__kind__) {
    case "BadFee":
      return "The fee changed. Refresh and try again.";
    case "InsufficientFunds":
      return `The mint would exceed the maximum supply of 10 000 ${TTTI_SYMBOL}.`;
    case "Duplicate":
      return "This mint was already processed.";
    case "TemporarilyUnavailable":
      return "The ledger is temporarily unavailable. Try again shortly.";
    case "GenericError": {
      return "Mint failed. Check the recipient and try again.";
    }
    default:
      return "Mint failed.";
  }
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card
      className="surface-open gap-2 rounded-none border-l border-border py-2 pl-4 shadow-none"
      data-ocid="admin.stat_card"
    >
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground [&_svg]:text-primary">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-widest">
            {label}
          </span>
        </div>
        {value === null ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="text-xl font-semibold tracking-tight font-mono tabular-nums text-foreground">
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SupplyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 border-l border-border pl-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tracking-tight font-mono tabular-nums">
        {value}
      </p>
    </div>
  );
}
