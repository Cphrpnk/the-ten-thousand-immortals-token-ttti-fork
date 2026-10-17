import { Principal } from "@icp-sdk/core/principal";
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Coins,
  Loader2,
  ShieldCheck,
  Snowflake,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Account } from "../backend";
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
import { Skeleton } from "../components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useGetBurnAccount,
  useGetPresaleStatus,
  useIcrc1BalanceOf,
  useIcrc1Transfer,
  useIcrc2Allowance,
  useIcrc2TransferFrom,
  useTokenInfo,
  useTttiIcrc2Approve,
} from "../hooks/useQueries";
import {
  TTTI_DECIMALS,
  TTTI_SYMBOL,
  encodeAccountText,
  formatTtti,
  formatUnits,
  parseTtti,
} from "../lib/token";

const FROZEN_MESSAGE =
  "Transfers are frozen. Transfers, approvals and transfer-from are paused by the administrator; please try again later.";

/** Open form sections let the page's spacing carry the hierarchy. */
const FORM_SECTION = "surface-open rounded-none";
/** Gold primary action with a soft glow. */
const PRIMARY_GOLD =
  "w-full shadow-gold transition-smooth hover:brightness-110";
const TAB_TRIGGER =
  "min-h-11 rounded-none border-b-2 border-transparent px-3 text-muted-foreground shadow-none transition-smooth hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none";

function isFrozenMessage(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes("frozen");
}

function parsePrincipal(input: string): Principal | null {
  try {
    return Principal.fromText(input.trim());
  } catch {
    return null;
  }
}

function truncatePrincipal(principal: string): string {
  if (principal.length <= 20) return principal;
  return `${principal.slice(0, 11)}…${principal.slice(-6)}`;
}

function describeTransferError(error: {
  __kind__: string;
  [key: string]: unknown;
}): string {
  switch (error.__kind__) {
    case "BadFee":
      return "The transfer fee changed. Refresh and try again.";
    case "InsufficientFunds": {
      const detail = error.InsufficientFunds as
        | { balance?: bigint }
        | undefined;
      const balance =
        detail?.balance !== undefined ? formatTtti(detail.balance) : null;
      return balance
        ? `Insufficient funds. Your balance is ${balance} ${TTTI_SYMBOL}.`
        : "Insufficient funds for this transfer.";
    }
    case "BadBurn": {
      const detail = error.BadBurn as { min_burn_amount?: bigint } | undefined;
      const min =
        detail?.min_burn_amount !== undefined
          ? formatTtti(detail.min_burn_amount)
          : null;
      return min
        ? `The amount is below the required minimum of ${min} ${TTTI_SYMBOL}.`
        : "The amount is below the required minimum.";
    }
    case "InsufficientAllowance": {
      const detail = error.InsufficientAllowance as
        | { allowance?: bigint }
        | undefined;
      const allowance =
        detail?.allowance !== undefined ? formatTtti(detail.allowance) : null;
      return allowance
        ? `The allowance is too low. Current allowance: ${allowance} ${TTTI_SYMBOL}.`
        : "The allowance is too low for this transfer.";
    }
    case "Duplicate":
      return "This transaction was already processed.";
    case "TemporarilyUnavailable":
      return "The ledger is temporarily unavailable. Try again shortly.";
    case "CreatedInFuture":
      return "The ledger rejected this as created in the future. Try again.";
    case "TooOld":
      return "This transaction is too old to process. Try again.";
    case "GenericError": {
      const generic = error.GenericError as { message?: string } | undefined;
      if (isFrozenMessage(generic?.message)) return FROZEN_MESSAGE;
      return "The ledger rejected this request. Check the destination and try again.";
    }
    default:
      return "The ledger rejected this request.";
  }
}

function describeApproveError(error: {
  __kind__: string;
  [key: string]: unknown;
}): string {
  switch (error.__kind__) {
    case "AllowanceChanged": {
      const detail = error.AllowanceChanged as
        | { current_allowance?: bigint }
        | undefined;
      const current =
        detail?.current_allowance !== undefined
          ? formatTtti(detail.current_allowance)
          : null;
      return current
        ? `The allowance changed. Current allowance: ${current} ${TTTI_SYMBOL}.`
        : "The allowance changed. Refresh and try again.";
    }
    case "Expired":
      return "This approval expired before it was processed.";
    case "ExpiredFrom":
      return "The approval window expired. Try again.";
    case "InsufficientFunds":
      return "Insufficient funds to cover the approval fee.";
    case "BadFee":
      return "The approval fee changed. Refresh and try again.";
    case "Duplicate":
      return "This approval was already processed.";
    case "TemporarilyUnavailable":
      return "The ledger is temporarily unavailable. Try again shortly.";
    case "CreatedInFuture":
      return "The ledger rejected this as created in the future. Try again.";
    case "TooOld":
      return "This approval is too old to process. Try again.";
    case "GenericError": {
      const generic = error.GenericError as { message?: string } | undefined;
      if (isFrozenMessage(generic?.message)) return FROZEN_MESSAGE;
      return "The ledger rejected this approval.";
    }
    default:
      return "The ledger rejected this approval.";
  }
}

function SignedOutNotice() {
  return (
    <Card
      className="surface-open mx-auto w-full max-w-2xl rounded-none py-10"
      data-ocid="transfer.signed_out_card"
    >
      <CardHeader className="px-0">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Wallet className="w-5 h-5 text-primary" />
          Sign in to manage your tokens
        </CardTitle>
        <CardDescription>
          Transfers and approvals are tied to your Internet Identity principal.
          Sign in from the header to continue.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function BalanceCard({ balance }: { balance: bigint | undefined }) {
  return (
    <Card
      className="surface-open rounded-none border-l-2 border-l-primary py-1"
      data-ocid="transfer.balance_card"
    >
      <CardHeader className="px-6 py-3">
        <CardDescription className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
          <Wallet className="w-4 h-4 text-primary" />
          Your balance
        </CardDescription>
        <CardTitle className="font-mono text-4xl font-semibold tracking-tight tabular-nums text-primary">
          {balance === undefined ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            `${formatTtti(balance)} ${TTTI_SYMBOL}`
          )}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function FormAlert({
  variant,
  message,
  ocid,
}: {
  variant: "error" | "success";
  message: string;
  ocid: string;
}) {
  if (variant === "error") {
    return (
      <Alert variant="destructive" data-ocid={ocid}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert className="border-primary/40 bg-primary/5" data-ocid={ocid}>
      <CheckCircle2 className="h-4 w-4 text-primary" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

interface TransferFormProps {
  owner: Principal;
  fee: bigint | undefined;
  reservedAccount: Account | undefined;
  frozen: boolean;
}

function TransferForm({
  owner,
  fee,
  reservedAccount,
  frozen,
}: TransferFormProps) {
  const transfer = useIcrc1Transfer();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (frozen) {
      setError(FROZEN_MESSAGE);
      return;
    }
    const to = parsePrincipal(recipient);
    if (!to) {
      setError("Enter a valid recipient principal ID.");
      return;
    }
    if (!reservedAccount) {
      setError(
        "Destination validation is unavailable. Please try again shortly.",
      );
      return;
    }
    if (to.toText() === reservedAccount.owner.toText()) {
      setError(
        "This address is reserved by the ledger. Tokens sent there cannot be recovered. Choose another recipient.",
      );
      return;
    }
    const parsed = parseTtti(amount);
    if (parsed === null || parsed <= 0n) {
      setError(
        `Enter an amount greater than 0 with up to ${TTTI_DECIMALS} decimals.`,
      );
      return;
    }

    const capturedRecipient = recipient;
    const capturedAmount = amount;
    setRecipient("");
    setAmount("");

    transfer.mutate(
      { to: { owner: to }, amount: parsed },
      {
        onSuccess: (result) => {
          if (result.__kind__ === "Ok") {
            setSuccess(
              `Sent ${formatTtti(parsed)} ${TTTI_SYMBOL} to ${truncatePrincipal(to.toText())}.`,
            );
            toast.success("Transfer complete");
          } else {
            setError(describeTransferError(result.Err));
            setRecipient(capturedRecipient);
            setAmount(capturedAmount);
          }
        },
        onError: (err) => {
          setError(
            isFrozenMessage(err.message)
              ? FROZEN_MESSAGE
              : "Transfer failed. Check the destination and try again.",
          );
          setRecipient(capturedRecipient);
          setAmount(capturedAmount);
        },
      },
    );
  };

  return (
    <Card className={FORM_SECTION} data-ocid="transfer.transfer_card">
      <CardHeader className="px-0 pb-7">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <ArrowRightLeft className="w-5 h-5 text-primary" />
          Transfer {TTTI_SYMBOL}
        </CardTitle>
        <CardDescription>
          Send tokens from your principal to another account. The transfer fee
          of {fee === undefined ? "—" : formatUnits(fee, TTTI_DECIMALS, 0)}{" "}
          {TTTI_SYMBOL} is deducted from your balance and credited to the fee
          collector.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="space-y-7">
          <div className="space-y-2">
            <Label htmlFor="transfer-recipient">Recipient Principal</Label>
            <Input
              id="transfer-recipient"
              type="text"
              placeholder="aaaaa-aa"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              data-ocid="transfer.recipient_input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer-amount">Amount ({TTTI_SYMBOL})</Label>
            <Input
              id="transfer-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoComplete="off"
              data-ocid="transfer.amount_input"
            />
            <p className="text-xs text-muted-foreground">
              Up to {TTTI_DECIMALS} decimals. Fee:{" "}
              {fee === undefined ? "—" : formatUnits(fee, TTTI_DECIMALS, 0)}{" "}
              {TTTI_SYMBOL}. Sending from {truncatePrincipal(owner.toText())}.
            </p>
          </div>

          {error && (
            <FormAlert
              variant="error"
              message={error}
              ocid="transfer.transfer_error_state"
            />
          )}
          {success && (
            <FormAlert
              variant="success"
              message={success}
              ocid="transfer.transfer_success_state"
            />
          )}

          <Button
            type="submit"
            className={PRIMARY_GOLD}
            disabled={transfer.isPending || frozen || !reservedAccount}
            data-ocid="transfer.transfer_submit_button"
          >
            {transfer.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : frozen ? (
              <>
                <Snowflake className="w-4 h-4" />
                Transfers are frozen
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Send Tokens
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ApproveForm({ owner, frozen }: { owner: Principal; frozen: boolean }) {
  const approve = useTttiIcrc2Approve();
  const [spender, setSpender] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const spenderPrincipal = useMemo(() => parsePrincipal(spender), [spender]);

  const allowanceArgs = useMemo(
    () =>
      spenderPrincipal
        ? { account: { owner }, spender: { owner: spenderPrincipal } }
        : undefined,
    [owner, spenderPrincipal],
  );

  const { data: allowance, isLoading: isAllowanceLoading } =
    useIcrc2Allowance(allowanceArgs);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const to = parsePrincipal(spender);
    if (!to) {
      setError("Enter a valid spender principal ID.");
      return;
    }
    const parsed = parseTtti(amount);
    if (parsed === null || parsed <= 0n) {
      setError(
        `Enter an allowance greater than 0 with up to ${TTTI_DECIMALS} decimals.`,
      );
      return;
    }

    const capturedSpender = spender;
    const capturedAmount = amount;
    setSpender("");
    setAmount("");

    approve.mutate(
      { spender: { owner: to }, amount: parsed },
      {
        onSuccess: (result) => {
          if (result.__kind__ === "Ok") {
            setSuccess(
              `Approved ${formatTtti(parsed)} ${TTTI_SYMBOL} for ${truncatePrincipal(to.toText())}.`,
            );
            toast.success("Allowance approved");
          } else {
            setError(describeApproveError(result.Err));
            setSpender(capturedSpender);
            setAmount(capturedAmount);
          }
        },
        onError: (err) => {
          setError(
            isFrozenMessage(err.message)
              ? FROZEN_MESSAGE
              : err.message || "Approval failed. Please try again.",
          );
          setSpender(capturedSpender);
          setAmount(capturedAmount);
        },
      },
    );
  };

  return (
    <Card className={FORM_SECTION} data-ocid="transfer.approve_card">
      <CardHeader className="px-0 pb-7">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Approve a Spender
        </CardTitle>
        <CardDescription>
          Allow another principal to transfer tokens on your behalf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 px-0">
        <form onSubmit={handleSubmit} className="space-y-7">
          <div className="space-y-2">
            <Label htmlFor="approve-spender">Spender Principal</Label>
            <Input
              id="approve-spender"
              type="text"
              placeholder="aaaaa-aa"
              value={spender}
              onChange={(e) => setSpender(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              data-ocid="transfer.spender_input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="approve-amount">Allowance ({TTTI_SYMBOL})</Label>
            <Input
              id="approve-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoComplete="off"
              data-ocid="transfer.approve_amount_input"
            />
            <p className="text-xs text-muted-foreground">
              Up to {TTTI_DECIMALS} decimals. Approving charges the{" "}
              {TTTI_SYMBOL} transfer fee.
            </p>
          </div>

          {error && (
            <FormAlert
              variant="error"
              message={error}
              ocid="transfer.approve_error_state"
            />
          )}
          {success && (
            <FormAlert
              variant="success"
              message={success}
              ocid="transfer.approve_success_state"
            />
          )}

          <Button
            type="submit"
            className={PRIMARY_GOLD}
            disabled={approve.isPending || frozen}
            data-ocid="transfer.approve_submit_button"
          >
            {approve.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Approving...
              </>
            ) : frozen ? (
              <>
                <Snowflake className="w-4 h-4" />
                Transfers are frozen
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Approve Allowance
              </>
            )}
          </Button>
        </form>

        <div className="rule-quiet pt-6" data-ocid="transfer.allowance_panel">
          <p className="text-sm text-muted-foreground">
            Current allowance
            {spenderPrincipal
              ? ` for ${truncatePrincipal(spenderPrincipal.toText())}`
              : ""}
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight font-mono tabular-nums text-foreground">
            {!spenderPrincipal
              ? "Enter a spender to view"
              : isAllowanceLoading
                ? "Loading…"
                : `${formatTtti(allowance?.allowance ?? 0n)} ${TTTI_SYMBOL}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function TransferFromForm({
  frozen,
  reservedAccount,
}: { frozen: boolean; reservedAccount: Account | undefined }) {
  const transferFrom = useIcrc2TransferFrom();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const fromPrincipal = parsePrincipal(from);
    if (!fromPrincipal) {
      setError("Enter a valid 'from' principal ID.");
      return;
    }
    const toPrincipal = parsePrincipal(to);
    if (!toPrincipal) {
      setError("Enter a valid 'to' principal ID.");
      return;
    }
    if (!reservedAccount) {
      setError(
        "Destination validation is unavailable. Please try again shortly.",
      );
      return;
    }
    if (toPrincipal.toText() === reservedAccount.owner.toText()) {
      setError(
        "This address is reserved by the ledger. Tokens sent there cannot be recovered. Choose another recipient.",
      );
      return;
    }
    const parsed = parseTtti(amount);
    if (parsed === null || parsed <= 0n) {
      setError(
        `Enter an amount greater than 0 with up to ${TTTI_DECIMALS} decimals.`,
      );
      return;
    }

    const capturedFrom = from;
    const capturedTo = to;
    const capturedAmount = amount;
    setFrom("");
    setTo("");
    setAmount("");

    transferFrom.mutate(
      {
        from: { owner: fromPrincipal },
        to: { owner: toPrincipal },
        amount: parsed,
      },
      {
        onSuccess: (result) => {
          if (result.__kind__ === "Ok") {
            setSuccess(
              `Transferred ${formatTtti(parsed)} ${TTTI_SYMBOL} from ${truncatePrincipal(fromPrincipal.toText())} to ${truncatePrincipal(toPrincipal.toText())}.`,
            );
            toast.success("Transfer from complete");
          } else {
            setError(describeTransferError(result.Err));
            setFrom(capturedFrom);
            setTo(capturedTo);
            setAmount(capturedAmount);
          }
        },
        onError: (err) => {
          setError(
            isFrozenMessage(err.message)
              ? FROZEN_MESSAGE
              : "Transfer failed. Check the destination and try again.",
          );
          setFrom(capturedFrom);
          setTo(capturedTo);
          setAmount(capturedAmount);
        },
      },
    );
  };

  return (
    <Card className={FORM_SECTION} data-ocid="transfer.transfer_from_card">
      <CardHeader className="px-0 pb-7">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <ArrowRightLeft className="w-5 h-5 text-primary" />
          Transfer From an Allowance
        </CardTitle>
        <CardDescription>
          Spend an allowance you were granted to move tokens from another
          principal's account.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="space-y-7">
          <div className="space-y-2">
            <Label htmlFor="transfer-from-source">From Principal</Label>
            <Input
              id="transfer-from-source"
              type="text"
              placeholder="aaaaa-aa"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              data-ocid="transfer.from_input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer-from-destination">To Principal</Label>
            <Input
              id="transfer-from-destination"
              type="text"
              placeholder="aaaaa-aa"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              data-ocid="transfer.to_input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer-from-amount">Amount ({TTTI_SYMBOL})</Label>
            <Input
              id="transfer-from-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoComplete="off"
              data-ocid="transfer.transfer_from_amount_input"
            />
          </div>

          {error && (
            <FormAlert
              variant="error"
              message={error}
              ocid="transfer.transfer_from_error_state"
            />
          )}
          {success && (
            <FormAlert
              variant="success"
              message={success}
              ocid="transfer.transfer_from_success_state"
            />
          )}

          <Button
            type="submit"
            className={PRIMARY_GOLD}
            disabled={transferFrom.isPending || frozen || !reservedAccount}
            data-ocid="transfer.transfer_from_submit_button"
          >
            {transferFrom.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Transferring...
              </>
            ) : frozen ? (
              <>
                <Snowflake className="w-4 h-4" />
                Transfers are frozen
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Transfer From
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function TransferPage() {
  const { identity } = useInternetIdentity();
  const owner = identity?.getPrincipal();

  const account = useMemo(() => (owner ? { owner } : undefined), [owner]);

  const { data: balance, isLoading: isBalanceLoading } =
    useIcrc1BalanceOf(account);
  const { data: tokenInfo } = useTokenInfo();
  const { data: reservedAccount } = useGetBurnAccount();
  const { data: presaleStatus } = useGetPresaleStatus();
  const frozen = presaleStatus?.transfersFrozen ?? false;
  const fee = tokenInfo?.fee;

  if (!owner) {
    return (
      <div className="flex flex-col gap-6" data-ocid="transfer.page">
        <SignedOutNotice />
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-10 md:gap-12"
      data-ocid="transfer.page"
    >
      <header className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center text-primary">
            <Coins className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-imperial text-gradient-gold text-2xl leading-tight md:text-3xl">
              Manage Tokens
            </h1>
            <p className="text-sm text-muted-foreground">
              Transfer, approve and spend {tokenInfo?.symbol || TTTI_SYMBOL}{" "}
              allowances.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-gold font-mono"
            title={encodeAccountText({ owner })}
            data-ocid="transfer.account_badge"
          >
            {truncatePrincipal(encodeAccountText({ owner }))}
          </Badge>
          <Badge
            variant="secondary"
            className="font-mono tabular-nums text-primary"
            data-ocid="transfer.fee_badge"
          >
            Fee {fee === undefined ? "—" : formatUnits(fee, TTTI_DECIMALS, 0)}{" "}
            {TTTI_SYMBOL}
          </Badge>
        </div>
      </header>

      {frozen && (
        <Alert variant="destructive" data-ocid="transfer.frozen_error_state">
          <Snowflake className="h-4 w-4" />
          <AlertTitle>Transfers are frozen</AlertTitle>
          <AlertDescription>
            The administrator has paused transfers, approvals and transfer-from
            on the {TTTI_SYMBOL} ledger. Your balance is safe; these actions
            will be available again once transfers are unfrozen.
          </AlertDescription>
        </Alert>
      )}

      <BalanceCard balance={isBalanceLoading ? undefined : balance} />

      <Tabs defaultValue="transfer" data-ocid="transfer.tabs">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="transfer"
            className={TAB_TRIGGER}
            data-ocid="transfer.transfer.tab"
          >
            Transfer
          </TabsTrigger>
          <TabsTrigger
            value="approve"
            className={TAB_TRIGGER}
            data-ocid="transfer.approve.tab"
          >
            Approve
          </TabsTrigger>
          <TabsTrigger
            value="transfer-from"
            className={TAB_TRIGGER}
            data-ocid="transfer.transfer_from.tab"
          >
            Transfer From
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfer" className="mt-8">
          <TransferForm
            owner={owner}
            fee={fee}
            reservedAccount={reservedAccount}
            frozen={frozen}
          />
        </TabsContent>
        <TabsContent value="approve" className="mt-8">
          <ApproveForm owner={owner} frozen={frozen} />
        </TabsContent>
        <TabsContent value="transfer-from" className="mt-8">
          <TransferFromForm frozen={frozen} reservedAccount={reservedAccount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
