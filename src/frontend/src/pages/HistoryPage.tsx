import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  History,
  Link2,
  PiggyBank,
  ShieldCheck,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DataCertificate, GetBlocksArgs } from "../backend";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  useGetLegacyBlockInfo,
  useIcrc3GetBlocks,
  useIcrc3GetTipCertificate,
} from "../hooks/useQueries";
import {
  type BlockKind,
  type DecodedBlock,
  type DecodedHashTree,
  type DecodedMemo,
  MAX_BLOCKS_PER_CALL,
  decodeBlock,
  decodeTipHashTree,
  shortHex,
  toHex,
} from "../lib/icrc3Blocks";
import { TTTI_SYMBOL, formatUnits } from "../lib/token";

/** Blocks shown per page (always below the 100-block per-call cap). */
const PAGE_SIZE = 50n;

/** Open ledger surfaces separated by quiet rules. */
const GOLD_CARD =
  "surface-open rounded-none border-t border-border shadow-none";
const OUTLINE_GOLD =
  "border-gold transition-smooth hover:border-gold-strong hover:bg-primary/10 hover:text-foreground";

function formatAmount(amount: bigint | null | undefined, decimals: number) {
  if (amount === null || amount === undefined) return "—";
  return formatUnits(amount, decimals);
}

function formatTimestamp(timestamp: bigint | null | undefined): string {
  if (timestamp === null || timestamp === undefined) return "—";
  const date = new Date(Number(timestamp / 1_000_000n));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function truncateAccount(account: string): string {
  if (account.length <= 18) return account;
  return `${account.slice(0, 9)}…${account.slice(-6)}`;
}

function AccountText({ account }: { account: string | undefined }) {
  if (!account) return <span className="text-muted-foreground">—</span>;
  return <span title={account}>{truncateAccount(account)}</span>;
}

function TipPanel({
  certificate,
  isLoading,
  logLength,
}: {
  certificate: DataCertificate | null | undefined;
  isLoading: boolean;
  logLength: bigint | undefined;
}) {
  const isCertified = !!certificate && certificate.certificate.length > 0;

  const decoded = useMemo<
    { ok: true; tree: DecodedHashTree } | { ok: false } | null
  >(() => {
    if (!certificate) return null;
    try {
      return { ok: true, tree: decodeTipHashTree(certificate.hash_tree) };
    } catch {
      return { ok: false };
    }
  }, [certificate]);

  return (
    <Card
      className="surface-open rounded-none border-t border-border shadow-none"
      data-ocid="history.tip_panel"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle className="font-display text-lg">
              Tip certificate
            </CardTitle>
          </div>
          {!isLoading && (
            <Badge
              variant="outline"
              className={
                isCertified
                  ? "border-gold bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground"
              }
              data-ocid="history.tip_certificate_badge"
            >
              {isCertified ? "Certified" : "No certificate"}
            </Badge>
          )}
        </div>
        <CardDescription>
          Tip data returned by the ledger. It is shown for reference and is not
          cryptographically verified in this browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3" data-ocid="history.tip_loading_state">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : !certificate ? (
          <div
            className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground"
            data-ocid="history.tip_empty_state"
          >
            {logLength === 0n
              ? "The block log is empty, so there is no tip to certify yet. A certificate appears after the first transaction."
              : "The ledger did not return a tip certificate."}
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">Tip index</span>
              <span
                className="font-mono text-lg font-semibold tabular-nums text-primary"
                data-ocid="history.tip_index"
              >
                {decoded?.ok ? decoded.tree.lastBlockIndex.toString() : "—"}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Certificate size
              </span>
              <span
                className="font-mono text-sm tabular-nums"
                data-ocid="history.tip_certificate_size"
              >
                {certificate.certificate.length.toLocaleString("en-US")} bytes
              </span>
            </div>
            {decoded?.ok ? (
              <div className="space-y-1.5">
                <span className="text-sm text-muted-foreground">
                  Last block hash
                </span>
                <p
                  className="select-all border-l border-gold bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed break-all"
                  data-ocid="history.tip_hash"
                >
                  {toHex(decoded.tree.lastBlockHash)}
                </p>
              </div>
            ) : (
              <div
                className="space-y-1.5"
                data-ocid="history.tip_decode_error_state"
              >
                <p className="text-sm text-destructive">
                  Unable to decode hash tree
                </p>
                <pre
                  className="max-h-32 select-all overflow-auto border-l border-border bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap"
                  data-ocid="history.tip_hash_tree"
                >
                  {certificate.hash_tree.length === 0
                    ? "—"
                    : toHex(certificate.hash_tree)}
                </pre>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Returned by the ledger.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const KIND_META: Record<
  BlockKind,
  { label: string; icon: typeof ArrowUpRight; className: string }
> = {
  transfer: {
    label: "Transfer",
    icon: ArrowUpRight,
    className: "bg-primary/10 text-primary border-gold",
  },
  transferFrom: {
    label: "Transfer",
    icon: ArrowUpRight,
    className: "bg-primary/10 text-primary border-gold",
  },
  mint: {
    label: "Mint",
    icon: Coins,
    className: "bg-success/10 text-success border-success/30",
  },
  burn: {
    label: "Ledger adjustment",
    icon: History,
    className: "bg-muted text-muted-foreground border-border",
  },
  approve: {
    label: "Approval",
    icon: ArrowDownLeft,
    className: "bg-accent/10 text-accent border-accent/30",
  },
  "legacy-unknown": {
    label: "Block",
    icon: History,
    className: "bg-muted text-muted-foreground border-border",
  },
};

function KindBadge({ kind }: { kind: BlockKind }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-medium ${meta.className}`}
      title={
        kind === "transferFrom" ? "Transfer by an approved spender" : undefined
      }
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

function FeeDetail({ entry }: { entry: DecodedBlock }) {
  if (entry.kind === "burn") {
    return <span className="text-muted-foreground">No fee</span>;
  }
  if (entry.fee === undefined || entry.fee === 0n) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="font-mono tabular-nums">
        {formatAmount(entry.fee, entry.decimals)}
      </span>
      {entry.feeCollector && (
        <span
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
          title={`Credited to fee collector ${entry.feeCollector}`}
          data-ocid="history.fee_collector_credit"
        >
          <PiggyBank className="h-3 w-3" aria-hidden="true" />
          to fee collector
        </span>
      )}
    </span>
  );
}

function MemoValue({ memo }: { memo: DecodedMemo }) {
  return (
    <span className="break-all" title={`0x${memo.hex}`}>
      {memo.utf8 ? (
        <>
          “{memo.utf8}”{" "}
          <span className="text-muted-foreground">0x{shortHex(memo.hex)}</span>
        </>
      ) : (
        `0x${shortHex(memo.hex)}`
      )}
    </span>
  );
}

interface DetailItem {
  key: string;
  label: string;
  value: ReactNode;
}

/** Optional ICRC-3 fields shown beneath a block. */
function detailItems(entry: DecodedBlock): DetailItem[] {
  const items: DetailItem[] = [];
  if (entry.kind === "transferFrom" && entry.spender) {
    items.push({
      key: "spender",
      label: "Spender",
      value: <AccountText account={entry.spender} />,
    });
  }
  if (entry.memo) {
    items.push({
      key: "memo",
      label: "Memo",
      value: <MemoValue memo={entry.memo} />,
    });
  }
  if (entry.createdAt !== undefined) {
    items.push({
      key: "created",
      label: "Created",
      value: formatTimestamp(entry.createdAt),
    });
  }
  if (entry.expiresAt !== undefined) {
    items.push({
      key: "expires",
      label: "Expires",
      value: formatTimestamp(entry.expiresAt),
    });
  }
  if (entry.expectedAllowance !== undefined) {
    items.push({
      key: "expected",
      label: "Expected allowance",
      value: `${formatAmount(entry.expectedAllowance, entry.decimals)} ${TTTI_SYMBOL}`,
    });
  }
  return items;
}

function BlockId({
  entry,
  index,
  onJump,
}: {
  entry: DecodedBlock;
  index: number;
  onJump: (id: bigint) => void;
}) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1.5">
        #{entry.id.toString()}
        {entry.legacy && (
          <Badge
            variant="outline"
            className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
            title={`Recorded before the upgrade with ${entry.decimals} decimals`}
          >
            legacy
          </Badge>
        )}
      </span>
      {entry.phash && entry.id > 0n && (
        <button
          type="button"
          onClick={() => onJump(entry.id - 1n)}
          className="inline-flex items-center gap-1 rounded text-[11px] text-muted-foreground transition-smooth hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={`Parent hash ${entry.phash}`}
          aria-label={`Parent hash ${shortHex(entry.phash)}, go to block ${(entry.id - 1n).toString()}`}
          data-ocid={`history.phash_link.${index + 1}`}
        >
          <Link2 className="h-3 w-3" aria-hidden="true" />
          {shortHex(entry.phash)}
        </button>
      )}
    </span>
  );
}

function FromValue({ entry }: { entry: DecodedBlock }) {
  if (entry.kind === "mint") {
    return <span className="text-muted-foreground">Minted</span>;
  }
  return <AccountText account={entry.from} />;
}

function ToValue({ entry }: { entry: DecodedBlock }) {
  if (entry.kind === "burn") {
    return <span className="text-muted-foreground">Ledger</span>;
  }
  if (entry.kind === "approve") {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <AccountText account={entry.spender ?? entry.to} />
        <span className="font-body text-[11px] text-muted-foreground">
          spender
        </span>
      </span>
    );
  }
  return <AccountText account={entry.to} />;
}

interface EntryProps {
  entry: DecodedBlock;
  index: number;
  highlighted: boolean;
  onJump: (id: bigint) => void;
}

function EntryRow({ entry, index, highlighted, onJump }: EntryProps) {
  const details = detailItems(entry);
  const rowTone = highlighted ? "bg-primary/10" : "";
  return (
    <>
      <TableRow
        className={`transition-smooth hover:bg-primary/5 ${rowTone} ${details.length > 0 ? "border-b-0" : ""}`}
        data-block-id={entry.id.toString()}
        data-ocid={`history.item.${index + 1}`}
      >
        <TableCell className="align-top font-mono text-xs text-muted-foreground">
          <BlockId entry={entry} index={index} onJump={onJump} />
        </TableCell>
        <TableCell className="align-top">
          <KindBadge kind={entry.kind} />
        </TableCell>
        <TableCell className="align-top font-mono text-xs">
          <span className="inline-flex flex-col gap-0.5">
            <FromValue entry={entry} />
            {entry.kind === "transferFrom" && entry.spender && (
              <span className="font-body text-[11px] text-muted-foreground">
                via {truncateAccount(entry.spender)}
              </span>
            )}
          </span>
        </TableCell>
        <TableCell className="align-top font-mono text-xs">
          <ToValue entry={entry} />
        </TableCell>
        <TableCell className="align-top text-right font-mono font-semibold tabular-nums text-foreground">
          {entry.kind === "burn" && entry.amount !== null ? "−" : ""}
          {formatAmount(entry.amount, entry.decimals)}
        </TableCell>
        <TableCell className="align-top text-right text-xs">
          <FeeDetail entry={entry} />
        </TableCell>
        <TableCell className="align-top text-right text-xs text-muted-foreground whitespace-nowrap tabular-nums">
          {formatTimestamp(entry.ts)}
        </TableCell>
      </TableRow>
      {details.length > 0 && (
        <TableRow className={`hover:bg-primary/5 ${rowTone}`}>
          <TableCell colSpan={7} className="pt-0 pb-3">
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
              {details.map((item) => (
                <div key={item.key} className="flex min-w-0 gap-1.5">
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="min-w-0 font-mono">{item.value}</dd>
                </div>
              ))}
            </dl>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function EntryCard({ entry, index, highlighted, onJump }: EntryProps) {
  return (
    <Card
      className={`${GOLD_CARD} ${highlighted ? "ring-2 ring-primary/50" : ""}`}
      data-block-id={entry.id.toString()}
      data-ocid={`history.item.${index + 1}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <KindBadge kind={entry.kind} />
          <span className="font-mono text-xs text-muted-foreground">
            <BlockId entry={entry} index={index} onJump={onJump} />
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {entry.kind === "approve" ? "Allowance" : "Amount"}
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums text-primary">
            {entry.kind === "burn" && entry.amount !== null ? "−" : ""}
            {formatAmount(entry.amount, entry.decimals)} {TTTI_SYMBOL}
          </span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">From</dt>
          <dd className="font-mono text-right break-all">
            {entry.kind === "mint" ? "Minted" : (entry.from ?? "—")}
          </dd>
          <dt className="text-muted-foreground">
            {entry.kind === "approve" ? "Spender" : "To"}
          </dt>
          <dd className="font-mono text-right break-all">
            {entry.kind === "burn"
              ? "Ledger"
              : entry.kind === "approve"
                ? (entry.spender ?? entry.to ?? "—")
                : (entry.to ?? "—")}
          </dd>
          <dt className="text-muted-foreground">Fee</dt>
          <dd className="text-right">
            <FeeDetail entry={entry} />
          </dd>
          {entry.feeCollector && (
            <>
              <dt className="text-muted-foreground">Fee collector</dt>
              <dd className="font-mono text-right break-all">
                {entry.feeCollector}
              </dd>
            </>
          )}
          {detailItems(entry).map((item) => (
            <div key={item.key} className="contents">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="min-w-0 font-mono text-right">{item.value}</dd>
            </div>
          ))}
          <dt className="text-muted-foreground">Time</dt>
          <dd className="text-right">{formatTimestamp(entry.ts)}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  const ids = Array.from({ length: 5 }, (_, i) => `history-skeleton-${i}`);
  return (
    <div className="space-y-3" data-ocid="history.loading_state">
      {ids.map((id) => (
        <Skeleton key={id} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 border-t border-border px-6 py-16 text-center"
      data-ocid="history.empty_state"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold bg-secondary text-primary shadow-gold">
        <History className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="font-display text-xl font-semibold">
          No transactions yet
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Recorded ledger activity will appear here as soon as the first block
          is recorded.
        </p>
      </div>
      <Button
        asChild
        variant="outline"
        className={OUTLINE_GOLD}
        data-ocid="history.primary_button"
      >
        <a href="/">Back to token overview</a>
      </Button>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  rangeLabel,
  disabled,
  onPage,
}: {
  page: number;
  totalPages: number;
  rangeLabel: string;
  disabled: boolean;
  onPage: (page: number) => void;
}) {
  const isNewest = page === 0;
  const isOldest = page >= totalPages - 1;
  const controls = [
    {
      id: "pagination_first",
      label: "Latest blocks",
      icon: ChevronsLeft,
      target: 0,
      off: isNewest,
    },
    {
      id: "pagination_prev",
      label: "Newer blocks",
      icon: ChevronLeft,
      target: page - 1,
      off: isNewest,
    },
    {
      id: "pagination_next",
      label: "Older blocks",
      icon: ChevronRight,
      target: page + 1,
      off: isOldest,
    },
    {
      id: "pagination_last",
      label: "Oldest blocks",
      icon: ChevronsRight,
      target: totalPages - 1,
      off: isOldest,
    },
  ];
  return (
    <nav
      aria-label="Block history pages"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
      data-ocid="history.pagination"
    >
      <p
        className="text-xs text-muted-foreground tabular-nums"
        data-ocid="history.pagination_range"
      >
        {rangeLabel} · Page {page + 1} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {controls.map((control) => {
          const Icon = control.icon;
          const compact =
            control.id === "pagination_first" ||
            control.id === "pagination_last";
          return (
            <Button
              key={control.id}
              type="button"
              variant="outline"
              size={compact ? "icon" : "sm"}
              className={`rounded-lg ${OUTLINE_GOLD}`}
              disabled={disabled || control.off}
              onClick={() => onPage(control.target)}
              aria-label={control.label}
              title={control.label}
              data-ocid={`history.${control.id}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {!compact && (
                <span>
                  {control.id === "pagination_prev" ? "Newer" : "Older"}
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}

export function HistoryPage() {
  // Probe the log so we know its total length before paging from the tip.
  const probeArgs = useMemo<GetBlocksArgs[]>(
    () => [{ start: 0n, length: 1n }],
    [],
  );
  const {
    data: probe,
    isLoading: isProbeLoading,
    isError: isProbeError,
    refetch: refetchProbe,
  } = useIcrc3GetBlocks(probeArgs);

  const [requestedPage, setRequestedPage] = useState(0);
  const [focusId, setFocusId] = useState<bigint | null>(null);
  const [highlightId, setHighlightId] = useState<bigint | null>(null);

  const logLength = probe?.log_length;
  const totalPages =
    logLength === undefined
      ? 0
      : Number((logLength + PAGE_SIZE - 1n) / PAGE_SIZE);
  const page = Math.max(0, Math.min(requestedPage, totalPages - 1));

  // Page 0 holds the newest PAGE_SIZE blocks; one capped range per page.
  const pageArgs = useMemo<GetBlocksArgs[]>(() => {
    if (logLength === undefined) return [];
    const end = logLength - BigInt(page) * PAGE_SIZE;
    if (end <= 0n) return [];
    const start = end > PAGE_SIZE ? end - PAGE_SIZE : 0n;
    const length = end - start;
    return [
      {
        start,
        length: length > MAX_BLOCKS_PER_CALL ? MAX_BLOCKS_PER_CALL : length,
      },
    ];
  }, [logLength, page]);

  const {
    data,
    isLoading: isPageLoading,
    isError: isPageError,
    refetch: refetchPage,
  } = useIcrc3GetBlocks(pageArgs);

  const {
    data: tipCertificate,
    isLoading: isTipLoading,
    refetch: refetchTip,
  } = useIcrc3GetTipCertificate();

  const {
    data: legacyInfo,
    isLoading: isLegacyLoading,
    isError: isLegacyError,
    refetch: refetchLegacy,
  } = useGetLegacyBlockInfo();

  const isLoading = isProbeLoading || isLegacyLoading;
  const isListLoading = pageArgs.length > 0 && isPageLoading;
  const isError = isProbeError || isPageError || isLegacyError;
  const refetch = useCallback(async () => {
    await refetchLegacy();
    await refetchProbe();
    await refetchPage();
    await refetchTip();
  }, [refetchLegacy, refetchProbe, refetchPage, refetchTip]);

  const entries = useMemo<DecodedBlock[]>(() => {
    if (!data?.blocks || !legacyInfo) return [];
    return data.blocks
      .map((block) => decodeBlock(block, legacyInfo))
      .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  }, [data, legacyInfo]);

  // Follow a phash link: switch to the page holding the parent, then scroll.
  const jumpToBlock = useCallback(
    (id: bigint) => {
      if (logLength === undefined || id >= logLength) return;
      setRequestedPage(Number((logLength - 1n - id) / PAGE_SIZE));
      setFocusId(id);
      setHighlightId(id);
    },
    [logLength],
  );

  useEffect(() => {
    if (focusId === null || !entries.some((entry) => entry.id === focusId)) {
      return;
    }
    const nodes = document.querySelectorAll<HTMLElement>(
      `[data-block-id="${focusId.toString()}"]`,
    );
    const target = Array.from(nodes).find((node) => node.offsetParent !== null);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
    setFocusId(null);
  }, [focusId, entries]);

  const total = data?.log_length ?? logLength ?? 0n;
  const rangeArgs = pageArgs[0];
  const rangeLabel = rangeArgs
    ? `Blocks #${(rangeArgs.start + rangeArgs.length - 1n).toString()}–#${rangeArgs.start.toString()} of ${total.toLocaleString("en-US")}`
    : `0 of ${total.toLocaleString("en-US")} blocks`;

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-10 md:gap-14"
      data-ocid="history.page"
    >
      <header className="flex flex-wrap items-end justify-between gap-6 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold bg-secondary text-primary shadow-gold">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-imperial text-gradient-gold text-2xl leading-tight md:text-3xl">
              Transaction History
            </h1>
            <p className="text-sm text-muted-foreground">
              Ledger activity in chronological order, newest first.
            </p>
          </div>
        </div>
        {logLength !== undefined && (
          <Badge
            variant="outline"
            className="border-gold bg-primary/10 font-mono text-primary tabular-nums"
            data-ocid="history.total_count"
          >
            {total.toLocaleString("en-US")} blocks
          </Badge>
        )}
      </header>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <Card
          className="rounded-lg border-destructive bg-card"
          data-ocid="history.error_state"
        >
          <CardHeader>
            <CardTitle className="font-display text-lg text-destructive">
              Could not load the block log
            </CardTitle>
            <CardDescription>
              The ledger did not respond. Check your connection and try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className={OUTLINE_GOLD}
              onClick={() => void refetch()}
              data-ocid="history.retry_button"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <TipPanel
            certificate={tipCertificate}
            isLoading={isTipLoading}
            logLength={logLength}
          />

          {logLength === 0n ? (
            <EmptyState />
          ) : (
            <>
              {isListLoading ? (
                <LoadingState />
              ) : (
                <>
                  {/* Desktop table */}
                  <Card
                    className={`hidden md:block ${GOLD_CARD}`}
                    data-ocid="history.table"
                  >
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
                          <TableRow>
                            <TableHead className="w-32">Block</TableHead>
                            <TableHead className="w-32">Type</TableHead>
                            <TableHead>From</TableHead>
                            <TableHead>To</TableHead>
                            <TableHead className="text-right">
                              Amount ({TTTI_SYMBOL})
                            </TableHead>
                            <TableHead className="text-right">Fee</TableHead>
                            <TableHead className="text-right">Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.map((entry, index) => (
                            <EntryRow
                              key={entry.id.toString()}
                              entry={entry}
                              index={index}
                              highlighted={entry.id === highlightId}
                              onJump={jumpToBlock}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden" data-ocid="history.list">
                    {entries.map((entry, index) => (
                      <EntryCard
                        key={entry.id.toString()}
                        entry={entry}
                        index={index}
                        highlighted={entry.id === highlightId}
                        onJump={jumpToBlock}
                      />
                    ))}
                  </div>
                </>
              )}

              <PaginationBar
                page={page}
                totalPages={totalPages}
                rangeLabel={rangeLabel}
                disabled={isListLoading}
                onPage={(next) => {
                  setHighlightId(null);
                  setRequestedPage(next);
                }}
              />

              {legacyInfo && legacyInfo.boundaryIndex > 0n && (
                <p className="text-center text-xs text-muted-foreground">
                  Blocks before #{legacyInfo.boundaryIndex.toString()} use{" "}
                  {legacyInfo.legacyDecimals} decimals, later blocks{" "}
                  {legacyInfo.currentDecimals}.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
