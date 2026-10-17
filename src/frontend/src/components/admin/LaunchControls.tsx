import { AlertTriangle, Loader2, Power, Snowflake } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useGetAdminSwitches,
  useSetFallbackEnabled,
  useSetSalesPaused,
  useSetTransfersFrozen,
} from "../../hooks/useQueries";
import { TTTI_SYMBOL, formatTtti } from "../../lib/token";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Label } from "../ui/label";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";

interface SwitchRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  pending: boolean;
  onLabel: string;
  offLabel: string;
  onChange: (value: boolean) => void;
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  pending,
  onLabel,
  offLabel,
  onChange,
}: SwitchRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gold bg-background/50 p-4 transition-smooth hover:border-gold-strong">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="font-semibold">
            {label}
          </Label>
          <Badge
            variant={checked ? "destructive" : "secondary"}
            data-ocid={`${id}.status`}
          >
            {checked ? onLabel : offLabel}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        {pending && (
          <Loader2
            className="h-4 w-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <Switch
          id={id}
          checked={checked}
          disabled={pending}
          onCheckedChange={onChange}
          data-ocid={`${id}.switch`}
        />
      </div>
    </div>
  );
}

function notify(promise: Promise<void>, success: string) {
  promise
    .then(() => toast.success(success))
    .catch((error: Error) =>
      toast.error(error.message || "The switch could not be updated."),
    );
}

/** 'Stop sales' and 'Freeze transfers' launch switches. */
export function LaunchControls() {
  const { data: switches, isLoading } = useGetAdminSwitches();
  const setSalesPaused = useSetSalesPaused();
  const setTransfersFrozen = useSetTransfersFrozen();
  const [confirmFreeze, setConfirmFreeze] = useState(false);

  const handleFreeze = (value: boolean) => {
    if (value) {
      setConfirmFreeze(true);
      return;
    }
    notify(setTransfersFrozen.mutateAsync(false), "Holder transfers resumed");
  };

  return (
    <Card
      className="rounded-lg border-gold bg-card shadow-subtle"
      data-ocid="admin.launch_controls_card"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Power className="w-5 h-5 text-primary" />
          Launch Controls
        </CardTitle>
        <CardDescription>
          Emergency switches for the presale. Changes apply immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !switches ? (
          <div className="space-y-3" data-ocid="admin.launch_loading_state">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <SwitchRow
              id="admin-sales-paused"
              label="Stop sales"
              description="Pause every new purchase. Existing balances and transfers are unaffected."
              checked={switches.salesPaused}
              pending={setSalesPaused.isPending}
              onLabel="Sales stopped"
              offLabel="Sales open"
              onChange={(value) =>
                notify(
                  setSalesPaused.mutateAsync(value),
                  value ? "Sales stopped" : "Sales resumed",
                )
              }
            />
            <SwitchRow
              id="admin-transfers-frozen"
              label="Freeze transfers"
              description="Blocks all holder transfers, approvals and transfer_from calls on the ledger."
              checked={switches.transfersFrozen}
              pending={setTransfersFrozen.isPending}
              onLabel="Frozen"
              offLabel="Transfers active"
              onChange={handleFreeze}
            />
            {switches.transfersFrozen && (
              <Alert
                variant="destructive"
                data-ocid="admin.transfers_frozen_state"
              >
                <Snowflake className="h-4 w-4" />
                <AlertTitle>Transfers are frozen</AlertTitle>
                <AlertDescription>
                  No holder can move {TTTI_SYMBOL} until you turn this off.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmFreeze} onOpenChange={setConfirmFreeze}>
        <AlertDialogContent
          className="border-gold bg-card shadow-gold-lg"
          data-ocid="admin.freeze_dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Freeze all transfers?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This blocks all holder transfers of {TTTI_SYMBOL} — no holder will
              be able to send, approve or spend tokens until you unfreeze the
              ledger. Use it only to prepare the balance snapshot for the
              migration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-gold transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-foreground"
              data-ocid="admin.freeze_cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground transition-smooth hover:bg-destructive/90"
              onClick={() =>
                notify(
                  setTransfersFrozen.mutateAsync(true),
                  "Holder transfers frozen",
                )
              }
              data-ocid="admin.freeze_confirm_button"
            >
              Freeze transfers
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** 'Enable fallback rate' switch, shown next to the ICP/USD price settings. */
export function FallbackRateSwitch({ fallbackRate }: { fallbackRate: bigint }) {
  const { data: switches, isLoading } = useGetAdminSwitches();
  const setFallbackEnabled = useSetFallbackEnabled();

  if (isLoading || !switches) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <div className="space-y-3" data-ocid="admin.fallback_panel">
      <SwitchRow
        id="admin-fallback-enabled"
        label="Enable fallback rate"
        description={`When both Coinbase and CoinGecko fail, purchases use the admin rate of ${formatTtti(fallbackRate)} ${TTTI_SYMBOL} per ICP. Off by default: sales are refused while the price is unavailable.`}
        checked={switches.fallbackEnabled}
        pending={setFallbackEnabled.isPending}
        onLabel="Fallback on"
        offLabel="Fallback off"
        onChange={(value) =>
          notify(
            setFallbackEnabled.mutateAsync(value),
            value ? "Fallback rate enabled" : "Fallback rate disabled",
          )
        }
      />
      {switches.fallbackEnabled && fallbackRate === 0n && (
        <Alert variant="destructive" data-ocid="admin.fallback_error_state">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            The fallback rate is 0. Set it in Treasury Configuration before
            relying on it.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
