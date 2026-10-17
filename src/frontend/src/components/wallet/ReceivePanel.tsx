import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Account, TokenDescriptor } from "../../backend";
import { encodeAccountText } from "../../lib/token";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface ReceivePanelProps {
  tokens: Array<TokenDescriptor>;
  account: Account | undefined;
}

export function ReceivePanel({ tokens, account }: ReceivePanelProps) {
  const [tokenId, setTokenId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const selected = tokens.find((t) => t.canisterId.toText() === tokenId);
  const identifier = account ? encodeAccountText(account) : "";

  const handleCopy = async () => {
    if (!identifier) return;
    try {
      await navigator.clipboard.writeText(identifier);
      setCopied(true);
      toast.success("Account copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Unable to copy the account");
    }
  };

  return (
    <Card
      className="rounded-lg border-gold bg-card shadow-elevated"
      data-ocid="wallet.receive_panel"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Download className="h-4 w-4 text-primary" />
          Receive
        </CardTitle>
        <CardDescription>Share your account to receive tokens.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="receive-token">Token</Label>
          <Select value={tokenId} onValueChange={setTokenId}>
            <SelectTrigger
              id="receive-token"
              className="w-full"
              data-ocid="wallet.receive_token_select"
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
          <Label>Account</Label>
          <div
            className="rounded-lg border border-gold bg-muted p-3"
            data-ocid="wallet.receive_identifier"
          >
            <p className="break-all font-mono text-xs text-foreground">
              {identifier || "Connect a wallet to view your account."}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full rounded-lg border-gold transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-foreground"
          onClick={handleCopy}
          disabled={!identifier}
          data-ocid="wallet.receive_copy_button"
        >
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copied" : "Copy account"}
        </Button>

        {selected && (
          <p className="text-xs text-muted-foreground">
            Receiving {selected.symbol} to this account.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
