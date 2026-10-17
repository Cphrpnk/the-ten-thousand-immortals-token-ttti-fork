import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  SendHorizontal,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Conversion } from "../../backend";
import {
  useFailedForwards,
  useRetryTreasuryForward,
} from "../../hooks/useQueries";
import { formatIcp, truncateAccountText } from "../../lib/token";
import { Alert, AlertDescription } from "../ui/alert";
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

type RetryFeedback =
  | { tone: "success"; id: string; message: string }
  | { tone: "error"; id: string; message: string };

function failureReason(conversion: Conversion): string {
  return conversion.forward.__kind__ === "failed"
    ? conversion.forward.failed || "Unknown forwarding error"
    : (conversion.message ?? "Unknown forwarding error");
}

/** Admin list of purchases whose ICP forward to the treasury failed. */
export function FailedForwards() {
  const {
    data: failed,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useFailedForwards();
  const retry = useRetryTreasuryForward();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<RetryFeedback | null>(null);

  const sorted = [...(failed ?? [])].sort((a, b) =>
    a.id < b.id ? 1 : a.id > b.id ? -1 : 0,
  );

  const handleRetry = (conversion: Conversion) => {
    const id = conversion.id.toString();
    setRetryingId(id);
    setFeedback(null);
    retry.mutate(conversion.id, {
      onSuccess: (blockIndex) => {
        const message = `Forward for purchase #${id} succeeded — ICP ledger block ${blockIndex.toString()}.`;
        setFeedback({ tone: "success", id, message });
        toast.success("Treasury forward completed", { description: message });
      },
      onError: (error) => {
        const message =
          error.message || "The forward could not be retried. Try again.";
        setFeedback({ tone: "error", id, message });
        toast.error(`Retry failed for purchase #${id}`, {
          description: message,
        });
      },
      onSettled: () => setRetryingId(null),
    });
  };

  return (
    <Card
      className="rounded-lg border-gold bg-card shadow-subtle"
      data-ocid="admin.failed_forwards_card"
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <SendHorizontal className="h-5 w-5 text-primary" />
            Failed Treasury Forwards
            {sorted.length > 0 && (
              <Badge variant="destructive" className="rounded-full">
                {sorted.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Completed purchases whose ICP could not be forwarded to the treasury
            account. Retry sends the held ICP again.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-gold transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-foreground"
          onClick={() => void refetch()}
          disabled={isFetching}
          data-ocid="admin.failed_forwards_refresh_button"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedback && (
          <Alert
            variant={feedback.tone === "error" ? "destructive" : "default"}
            className={
              feedback.tone === "success"
                ? "border-primary/40 bg-primary/5"
                : undefined
            }
            data-ocid={
              feedback.tone === "success"
                ? "admin.failed_forwards_success_state"
                : "admin.failed_forwards_error_state"
            }
          >
            {feedback.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div
            className="space-y-3"
            data-ocid="admin.failed_forwards_loading_state"
          >
            {["ff-skeleton-1", "ff-skeleton-2"].map((key) => (
              <Skeleton key={key} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <Alert
            variant="destructive"
            data-ocid="admin.failed_forwards_load_error_state"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed forwards could not be loaded. Press Refresh to try again.
            </AlertDescription>
          </Alert>
        ) : sorted.length === 0 ? (
          <div
            className="flex items-center gap-3 rounded-lg border border-gold bg-background/50 p-4 text-sm text-muted-foreground"
            data-ocid="admin.failed_forwards_empty_state"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            Every purchase has been forwarded to the treasury. Nothing to retry.
          </div>
        ) : (
          <ul className="space-y-3" data-ocid="admin.failed_forwards_list">
            {sorted.map((conversion, index) => {
              const id = conversion.id.toString();
              const buyer = conversion.depositor.toText();
              const retrying = retryingId === id;
              return (
                <li
                  key={id}
                  className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                  data-ocid={`admin.failed_forward.item.${index + 1}`}
                >
                  <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Conversion
                      </dt>
                      <dd className="font-mono">#{id}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Buyer</dt>
                      <dd className="truncate font-mono text-xs" title={buyer}>
                        {truncateAccountText(buyer, 9, 6)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        ICP amount
                      </dt>
                      <dd className="font-mono tabular-nums">
                        {formatIcp(conversion.icpAmount)} ICP
                      </dd>
                    </div>
                    <div className="sm:col-span-3">
                      <dt className="text-xs text-muted-foreground">
                        Failure reason
                      </dt>
                      <dd className="break-words text-xs text-destructive">
                        {failureReason(conversion)}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 shadow-gold transition-smooth hover:brightness-110"
                    onClick={() => handleRetry(conversion)}
                    disabled={retry.isPending}
                    data-ocid={`admin.failed_forward.retry_button.${index + 1}`}
                  >
                    {retrying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {retrying ? "Retrying…" : "Retry"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
