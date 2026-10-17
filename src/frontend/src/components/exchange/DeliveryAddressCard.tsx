import type { Principal } from "@icp-sdk/core/principal";
import { CheckCircle2, Loader2, MapPin, RefreshCw, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  usePlugClearDeliveryAddress,
  usePlugDeliveryAddress,
  usePlugSetDeliveryAddress,
} from "../../hooks/usePlugPurchase";
import {
  useClearDeliveryAddress,
  useGetDeliveryAddress,
  useSetDeliveryAddress,
} from "../../hooks/useQueries";
import {
  DELIVERY_ADDRESS_MESSAGES,
  TTTI_SYMBOL,
  validateDeliveryAddress,
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
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Skeleton } from "../ui/skeleton";

interface DeliveryAddressCardProps {
  /** Wallet that signs the calls; Plug users save as the Plug principal. */
  wallet: "plug" | "internetIdentity";
  plugPrincipal: Principal | null;
}

export function DeliveryAddressCard({
  wallet,
  plugPrincipal,
}: DeliveryAddressCardProps) {
  const isPlug = wallet === "plug";
  const iiQuery = useGetDeliveryAddress();
  const plugQuery = usePlugDeliveryAddress(isPlug);
  const iiSet = useSetDeliveryAddress();
  const plugSet = usePlugSetDeliveryAddress();
  const iiClear = useClearDeliveryAddress();
  const plugClear = usePlugClearDeliveryAddress();

  const query = isPlug ? plugQuery : iiQuery;
  const save = isPlug ? plugSet : iiSet;
  const clear = isPlug ? plugClear : iiClear;
  const savedText = query.data?.owner.toText() ?? null;
  const plugText = plugPrincipal?.toText() ?? null;

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const initialized = useRef(false);
  const autoSaved = useRef(false);

  // One-time initialization of the editable field once the saved value loads.
  useEffect(() => {
    if (initialized.current || query.data === undefined) return;
    initialized.current = true;
    setDraft(savedText ?? (isPlug && plugText ? plugText : ""));
  }, [query.data, savedText, isPlug, plugText]);

  // If loading the saved address fails, still offer the Plug principal.
  const loadFailed = query.isError && query.data === undefined;
  useEffect(() => {
    if (!loadFailed || !isPlug || !plugText) return;
    setDraft((current) => (current === "" ? plugText : current));
  }, [loadFailed, isPlug, plugText]);

  // Plug users: save the connected Plug principal automatically, once.
  const plugSaveMutate = plugSet.mutate;
  useEffect(() => {
    if (!isPlug || !plugText || autoSaved.current) return;
    if (plugQuery.data !== null) return;
    autoSaved.current = true;
    plugSaveMutate(plugText);
  }, [isPlug, plugText, plugQuery.data, plugSaveMutate]);

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const validation = validateDeliveryAddress(draft);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    save.mutate(validation.principal.toText(), {
      onSuccess: (result) => {
        if (result.__kind__ === "Ok") {
          setNotice("Delivery address saved.");
        } else {
          setError(
            DELIVERY_ADDRESS_MESSAGES[result.Err.code] ?? result.Err.message,
          );
        }
      },
      onError: (err) =>
        setError(err.message || "Saving the address failed. Try again."),
    });
  };

  const handleClear = () => {
    setError(null);
    setNotice(null);
    if (draft.trim() === savedText) setDraft("");
    clear.mutate(undefined, {
      onSuccess: () => setNotice("Delivery address removed."),
      onError: (err) =>
        setError(err.message || "Removing the address failed. Try again."),
    });
  };

  const busy = save.isPending || clear.isPending;

  return (
    <Card
      id="delivery-address"
      className="scroll-mt-24 rounded-xl border border-gold bg-gradient-surface shadow-elevated transition-smooth"
      data-ocid="delivery.card"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <MapPin className="h-4 w-4 text-primary" />
            Delivery wallet address
          </CardTitle>
          <Badge
            variant="outline"
            className="rounded-full border-border text-muted-foreground"
          >
            Optional
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-gold bg-primary/10 text-primary"
          >
            Recommended
          </Badge>
        </div>
        <CardDescription>
          {isPlug
            ? `Auto-filled with your connected Plug principal. Your ${TTTI_SYMBOL} is credited here.`
            : `Not required to buy. Add the Principal ID of a wallet you control so your ${TTTI_SYMBOL} reaches it automatically at launch.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSave} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="delivery-address-input">Principal ID</Label>
            <Input
              id="delivery-address-input"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
                setNotice(null);
              }}
              placeholder="e.g. abcde-fghij-…-cai"
              autoComplete="off"
              spellCheck={false}
              className="border-gold bg-background/60 font-mono text-sm transition-smooth focus-visible:border-gold-strong focus-visible:ring-2 focus-visible:ring-ring"
              aria-invalid={!!error}
              aria-describedby={error ? "delivery-address-error" : undefined}
              data-ocid="delivery.input"
            />
            {error && (
              <p
                id="delivery-address-error"
                className="text-sm text-destructive"
                data-ocid="delivery.error_state"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                className="flex items-center gap-1.5 text-sm text-success"
                aria-live="polite"
                data-ocid="delivery.success_state"
              >
                <CheckCircle2 className="h-4 w-4" />
                {notice}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              className="min-h-10 rounded-lg border border-gold-strong bg-gradient-primary font-semibold text-primary-foreground shadow-gold transition-smooth hover:shadow-gold-lg hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] disabled:shadow-none sm:flex-1"
              disabled={busy || draft.trim() === ""}
              data-ocid="delivery.save_button"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save address
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-10 rounded-lg border-gold bg-transparent transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
              onClick={handleClear}
              disabled={busy || !savedText}
              data-ocid="delivery.delete_button"
            >
              {clear.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear
            </Button>
          </div>
        </form>

        <div
          className="rounded-lg border border-border bg-background/60 p-3"
          data-ocid="delivery.saved"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Saved address
          </p>
          {query.isLoading ? (
            <Skeleton className="mt-1 h-5 w-48" />
          ) : loadFailed ? (
            <div
              className="mt-1 flex flex-wrap items-center gap-2"
              data-ocid="delivery.load_error_state"
            >
              <p className="text-sm text-destructive">
                Couldn't load your saved address. You can still enter one above.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-lg border-gold bg-transparent px-2 text-xs transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-primary"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
                data-ocid="delivery.retry_button"
              >
                {query.isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Retry
              </Button>
            </div>
          ) : savedText ? (
            <p className="break-all font-mono text-sm">{savedText}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              None saved — purchases are credited to the principal you buy with.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
