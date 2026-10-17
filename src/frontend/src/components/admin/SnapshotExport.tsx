import { CheckCircle2, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { BalanceSnapshot } from "../../backend";
import { useExportBalanceSnapshot } from "../../hooks/useQueries";
import { TTTI_SYMBOL, formatTtti } from "../../lib/token";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

const COLUMNS = [
  "holder_principal",
  "subaccount_hex",
  "balance_ttti_p",
  "balance_base_units",
  "delivery_address",
  "needs_migration",
  "kind",
];

function toHex(bytes: Uint8Array | undefined): string {
  if (!bytes) return "";
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Plain fixed-precision decimal (no thousands separators) for CSV. */
function plainUnits(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const fraction = (value % divisor).toString().padStart(decimals, "0");
  return decimals > 0
    ? `${value / divisor}.${fraction}`
    : (value / divisor).toString();
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function buildCsv(snapshot: BalanceSnapshot, exportedAt: Date): string {
  const lines = [
    `# Export date: ${exportedAt.toISOString()}`,
    `# Total supply: ${plainUnits(snapshot.totalSupply, snapshot.decimals)} ${TTTI_SYMBOL} (${snapshot.totalSupply.toString()} base units, ${snapshot.decimals} decimals)`,
    COLUMNS.join(","),
  ];
  for (const holder of snapshot.holders) {
    const delivery = holder.deliveryAddress
      ? [
          holder.deliveryAddress.owner.toText(),
          toHex(holder.deliveryAddress.subaccount),
        ]
          .filter(Boolean)
          .join(":")
      : "";
    lines.push(
      [
        holder.account.owner.toText(),
        toHex(holder.account.subaccount),
        plainUnits(holder.balance, snapshot.decimals),
        holder.balance.toString(),
        delivery,
        holder.needsMigration ? "true" : "false",
        holder.kind,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function fileName(date: Date): string {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `ttti-p-snapshot-${stamp}.csv`;
}

interface ExportSummary {
  name: string;
  holders: number;
  needsMigration: number;
  totalSupply: bigint;
}

/** Downloads the migration balance snapshot as a CSV file. */
export function SnapshotExport() {
  const exportSnapshot = useExportBalanceSnapshot();
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    setError(null);
    exportSnapshot.mutate(undefined, {
      onSuccess: (snapshot) => {
        const ms = Number(snapshot.exportedAt / 1_000_000n);
        const exportedAt = Number.isNaN(ms) ? new Date() : new Date(ms);
        const name = fileName(exportedAt);
        const blob = new Blob([buildCsv(snapshot, exportedAt)], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setSummary({
          name,
          holders: snapshot.holders.length,
          needsMigration: snapshot.holders.filter((h) => h.needsMigration)
            .length,
          totalSupply: snapshot.totalSupply,
        });
        toast.success("Snapshot downloaded");
      },
      onError: (err) => {
        setError(err.message || "The snapshot could not be exported.");
      },
    });
  };

  return (
    <Card
      className="rounded-lg border-gold bg-card shadow-subtle"
      data-ocid="admin.snapshot_card"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Balance Snapshot
        </CardTitle>
        <CardDescription>
          Download every {TTTI_SYMBOL} holder balance with delivery addresses
          and migration flags as a CSV file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" data-ocid="admin.snapshot_error_state">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {summary && (
          <Alert
            className="border-primary/40 bg-primary/5"
            data-ocid="admin.snapshot_success_state"
          >
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription className="break-all">
              Saved {summary.name}: {summary.holders} holders,{" "}
              {summary.needsMigration} need migration, total supply{" "}
              {formatTtti(summary.totalSupply)} {TTTI_SYMBOL}.
            </AlertDescription>
          </Alert>
        )}
        <Button
          type="button"
          className="shadow-gold transition-smooth hover:brightness-110"
          onClick={handleExport}
          disabled={exportSnapshot.isPending}
          data-ocid="admin.snapshot_export_button"
        >
          {exportSnapshot.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download CSV
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
