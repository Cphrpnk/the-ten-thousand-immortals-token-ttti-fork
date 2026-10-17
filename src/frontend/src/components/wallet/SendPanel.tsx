import { loadConfig } from "@caffeineai/core-infrastructure";
import { HttpAgent } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createActor } from "../../backend";
import type { Account, TokenDescriptor } from "../../backend";
import { useInternetIdentity } from "../../hooks/useInternetIdentity";
import { usePlug } from "../../hooks/usePlug";
import { usePrepareTransfer, useWalletBalance } from "../../hooks/useWallet";
import { formatUnits, parseUnits } from "../../lib/token";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { normalizeToken } from "./TokenBalanceCard";

interface SendPanelProps {
  tokens: Array<TokenDescriptor>;
  account: Account | undefined;
}

export function SendPanel({ tokens: rawTokens, account }: SendPanelProps) {
  const tokens = rawTokens.map(normalizeToken);
  const [tokenId, setTokenId] = useState<string>("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const prepareTransfer = usePrepareTransfer();
  const { principal: plugPrincipal, requestTransfer } = usePlug();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selected = tokens.find((t) => t.canisterId.toText() === tokenId);
  const disabled = !account || tokens.length === 0;

  const { data: balanceResult } = useWalletBalance(
    selected?.canisterId,
    account,
  );
  const balance =
    balanceResult && balanceResult.__kind__ === "Ok"
      ? (balanceResult.Ok.balance ?? 0n)
      : null;

  const invalidateBalances = () => {
    void queryClient.invalidateQueries({ queryKey: ["walletBalance"] });
    void queryClient.invalidateQueries({ queryKey: ["icrc1BalanceOf"] });
    void queryClient.invalidateQueries({ queryKey: ["icrc3GetBlocks"] });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!account) {
      setError("Connect a wallet before sending.");
      return;
    }
    if (!selected) {
      setError("Select a token to send.");
      return;
    }

    let recipientPrincipal: Principal;
    try {
      recipientPrincipal = Principal.fromText(recipient.trim());
    } catch {
      setError("Enter a valid recipient principal.");
      return;
    }

    const baseAmount = parseUnits(amount, selected.decimals);
    if (baseAmount === null || baseAmount <= 0n) {
      setError(`Enter a valid ${selected.symbol} amount.`);
      return;
    }

    const total = baseAmount + selected.fee;
    if (balance !== null && total > balance) {
      setError(
        `Insufficient ${selected.symbol} balance. You have ${formatAmount(balance, selected.decimals)} ${selected.symbol} but need ${formatAmount(total, selected.decimals)} ${selected.symbol} including the fee.`,
      );
      return;
    }

    const capturedRecipient = recipient;
    const capturedAmount = amount;
    const to: Account = { owner: recipientPrincipal };
    const token = selected;

    const submit = async () => {
      setIsSubmitting(true);
      try {
        // 1. Ask the non-custodial backend to validate and prepare the transfer.
        const prepared = await prepareTransfer.mutateAsync({
          canisterId: token.canisterId,
          from: account,
          to,
          amount: baseAmount,
          memo: null,
        });

        if (prepared.__kind__ === "Err") {
          throw new Error(describeWalletError(prepared.Err));
        }

        // 2. Sign and submit with the connected wallet.
        if (plugPrincipal) {
          await requestTransfer(token.canisterId, {
            to: recipientPrincipal.toText(),
            amount: baseAmount,
            opts: { fee: token.fee },
          });
        } else if (identity) {
          // The app's own actor always targets the TTTI canister, so for
          // Internet Identity we build a direct actor for the SELECTED token's
          // ledger canister (createActor accepts a canisterId) and call
          // icrc1_transfer on it with the connected identity.
          const config = await loadConfig();
          const agent = new HttpAgent({
            identity,
            host: config.backend_host,
          });
          if (config.backend_host?.includes("localhost")) {
            await agent.fetchRootKey().catch(() => undefined);
          }
          const ledgerActor = createActor(
            token.canisterId.toText(),
            async () => {
              throw new Error("File upload is not supported for ledger calls.");
            },
            async () => {
              throw new Error(
                "File download is not supported for ledger calls.",
              );
            },
            { agent },
          );
          const result = await ledgerActor.icrc1_transfer({
            to,
            amount: baseAmount,
            fee: token.fee,
          });
          if (result.__kind__ === "Err") {
            throw new Error(describeTransferError(result.Err));
          }
        } else {
          throw new Error("Connect Internet Identity or Plug to send tokens.");
        }

        invalidateBalances();
        setSuccess(
          `Sent ${formatAmount(baseAmount, token.decimals)} ${token.symbol} to ${truncatePrincipal(recipientPrincipal.toText())}.`,
        );
        toast.success(`Sent ${token.symbol}`);
      } finally {
        setIsSubmitting(false);
      }
    };

    setRecipient("");
    setAmount("");

    void submit().catch((submitError: unknown) => {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "The transfer could not be completed.";
      setError(message);
      setRecipient(capturedRecipient);
      setAmount(capturedAmount);
      toast.error(message);
    });
  };

  return (
    <Card
      className="rounded-lg border-gold bg-card shadow-elevated"
      data-ocid="wallet.send_panel"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Send className="h-4 w-4 text-primary" />
          Send
        </CardTitle>
        <CardDescription>
          Send tokens from your connected wallet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="send-token">Token</Label>
            <Select value={tokenId} onValueChange={setTokenId}>
              <SelectTrigger
                id="send-token"
                className="w-full"
                data-ocid="wallet.send_token_select"
              >
                <SelectValue placeholder="Select a token" />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((token) => (
                  <SelectItem
                    key={token.canisterId.toText()}
                    value={token.canisterId.toText()}
                  >
                    {token.symbol} — {token.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="send-recipient">Recipient principal</Label>
            <Input
              id="send-recipient"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="aaaaa-aa"
              className="font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
              data-ocid="wallet.send_recipient_input"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="send-amount">Amount</Label>
            <Input
              id="send-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={
                selected ? `0.${"0".repeat(selected.decimals)}` : "0"
              }
              inputMode="decimal"
              className="font-mono text-sm"
              autoComplete="off"
              data-ocid="wallet.send_amount_input"
            />
            {selected && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Fee: {formatAmount(selected.fee, selected.decimals)}{" "}
                {selected.symbol}
                {balance !== null &&
                  ` · Balance: ${formatAmount(balance, selected.decimals)} ${selected.symbol}`}
              </p>
            )}
          </div>

          {error && (
            <p
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-ocid="wallet.send_error_state"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {success && (
            <p
              className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
              data-ocid="wallet.send_success_state"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {success}
            </p>
          )}

          <Button
            type="submit"
            className="w-full rounded-lg shadow-gold transition-smooth hover:brightness-110"
            disabled={isSubmitting || disabled}
            data-ocid="wallet.send_button"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSubmitting ? "Sending…" : "Send"}
          </Button>

          {!account && (
            <p className="text-xs text-muted-foreground">
              Connect Internet Identity or Plug to send tokens.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function formatAmount(value: bigint, decimals: number): string {
  return formatUnits(value, decimals, 0);
}

function truncatePrincipal(principal: string): string {
  if (principal.length <= 22) return principal;
  return `${principal.slice(0, 12)}…${principal.slice(-6)}`;
}

function describeWalletError(error: {
  __kind__: string;
  [key: string]: unknown;
}): string {
  switch (error.__kind__) {
    case "InvalidAmount":
      return "The amount is invalid for this ledger.";
    case "InvalidPrincipal":
      return "The recipient principal is invalid.";
    case "LedgerUnavailable":
      return "The token ledger is currently unavailable.";
    case "TransferFailed":
      return typeof error.TransferFailed === "string"
        ? error.TransferFailed
        : "The transfer could not be completed.";
    case "UnknownToken":
      return "This token is not supported by the wallet.";
    default:
      return "The transfer could not be completed.";
  }
}

function describeTransferError(error: {
  __kind__: string;
  [key: string]: unknown;
}): string {
  switch (error.__kind__) {
    case "BadFee":
      return "The ledger rejected the fee. Refresh and try again.";
    case "InsufficientFunds":
      return "Insufficient balance for this transfer.";
    case "TooOld":
      return "The transfer expired. Please try again.";
    case "CreatedInFuture":
      return "The transfer timestamp is invalid. Please try again.";
    case "Duplicate":
      return "This transfer was already submitted.";
    case "TemporarilyUnavailable":
      return "The ledger is temporarily unavailable. Try again shortly.";
    case "GenericError":
      return typeof error.GenericError === "object" &&
        error.GenericError !== null &&
        "message" in error.GenericError
        ? String((error.GenericError as { message: unknown }).message)
        : "The ledger rejected the transfer.";
    default:
      return "The transfer could not be completed.";
  }
}
