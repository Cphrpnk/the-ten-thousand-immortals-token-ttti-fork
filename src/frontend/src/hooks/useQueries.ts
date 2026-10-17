import type { Principal } from "@icp-sdk/core/principal";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  Account,
  AdminSwitches,
  Allowance,
  AllowanceArgs,
  ApproveArgs,
  ApproveResult,
  BalanceSnapshot,
  Conversion,
  DataCertificate,
  DeliveryAddressResult,
  ExactQuoteResult,
  FeeBounds,
  FeeCollectorInfo,
  GetBlocksArgs,
  GetBlocksResult,
  IcpPrice,
  LegacyBlockInfo,
  OnRampLink,
  PresaleStatus,
  PriceResult,
  PublicTreasuryInfo,
  PurchaseResult,
  SupportedBlockType,
  SupportedStandard,
  TransferArgs,
  TransferFromArgs,
  TransferFromResult,
  TransferResult__1,
  TreasuryConfig,
  TreasuryState,
  UserProfile,
} from "../backend";
import { useActor } from "./useActor";

export {
  useListTokens,
  usePrepareTransfer,
  useTokenMetadata,
  useWalletBalance,
} from "./useWallet";

/** Refresh everything a purchase or admin switch can change. */
function invalidatePresale(queryClient: QueryClient) {
  for (const key of [
    "presaleStatus",
    "adminSwitches",
    "conversions",
    "failedForwards",
    "treasuryState",
    "icrc1BalanceOf",
    "walletBalance",
    "callerIcpBalance",
    "tokenInfo",
    "feeCollector",
    "icpPrice",
    "icrc3GetBlocks",
    "exactQuote",
  ]) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  maxSupply: bigint;
  totalSupply: bigint;
  fee: bigint;
  standards: Array<SupportedStandard>;
}

export function useTokenInfo() {
  const { actor, isFetching } = useActor();

  return useQuery<TokenInfo>({
    queryKey: ["tokenInfo"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not initialized");

      const [name, symbol, decimals, maxSupply, totalSupply, fee, standards] =
        await Promise.all([
          actor.icrc1_name(),
          actor.icrc1_symbol(),
          actor.icrc1_decimals(),
          actor.get_max_supply(),
          actor.icrc1_total_supply(),
          actor.icrc1_fee(),
          actor.icrc1_supported_standards(),
        ]);

      return {
        name,
        symbol,
        decimals,
        maxSupply,
        totalSupply,
        fee,
        standards,
      };
    },
    enabled: !!actor && !isFetching,
  });
}

export function useIcrc1Fee() {
  const { actor, isFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ["icrc1Fee"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.icrc1_fee();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetFee() {
  const { actor, isFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ["getFee"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.get_fee();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetMaxSupply() {
  const { actor, isFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ["getMaxSupply"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.get_max_supply();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useIcrc1BalanceOf(account: Account | undefined) {
  const { actor, isFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ["icrc1BalanceOf", account?.owner.toText(), account?.subaccount],
    queryFn: async () => {
      if (!actor || !account) throw new Error("Actor not initialized");
      return actor.icrc1_balance_of(account);
    },
    enabled: !!actor && !isFetching && !!account,
  });
}

export function useIcrc1Transfer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<TransferResult__1, Error, TransferArgs>({
    mutationFn: async (args: TransferArgs) => {
      if (!actor) throw new Error("Actor not available");
      return actor.icrc1_transfer(args);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["icrc1BalanceOf"] });
      void queryClient.invalidateQueries({ queryKey: ["tokenInfo"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc3GetBlocks"] });
      void queryClient.invalidateQueries({
        queryKey: ["icrc3GetTipCertificate"],
      });
    },
  });
}

/**
 * ICRC-2 approve on the TTTI-P ledger itself (Transfer page only).
 * Presale purchases must approve on the ICP ledger: use hooks/useIcpApprove.
 */
export function useTttiIcrc2Approve() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<ApproveResult, Error, ApproveArgs>({
    mutationFn: async (args: ApproveArgs) => {
      if (!actor) throw new Error("Actor not available");
      return actor.icrc2_approve(args);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["icrc2Allowance"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc1BalanceOf"] });
      void queryClient.invalidateQueries({ queryKey: ["walletBalance"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc3GetBlocks"] });
    },
  });
}

/** @deprecated TTTI-P-only approve; use useTttiIcrc2Approve or useIcpApprove. */
export const useIcrc2Approve = useTttiIcrc2Approve;

export function useIcrc2Allowance(args: AllowanceArgs | undefined) {
  const { actor, isFetching } = useActor();

  return useQuery<Allowance>({
    queryKey: [
      "icrc2Allowance",
      args?.account.owner.toText(),
      args?.spender.owner.toText(),
    ],
    queryFn: async () => {
      if (!actor || !args) throw new Error("Actor not initialized");
      return actor.icrc2_allowance(args);
    },
    enabled: !!actor && !isFetching && !!args,
  });
}

export function useIcrc2TransferFrom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<TransferFromResult, Error, TransferFromArgs>({
    mutationFn: async (args: TransferFromArgs) => {
      if (!actor) throw new Error("Actor not available");
      return actor.icrc2_transfer_from(args);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["icrc1BalanceOf"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc2Allowance"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc3GetBlocks"] });
      void queryClient.invalidateQueries({
        queryKey: ["icrc3GetTipCertificate"],
      });
    },
  });
}

export function useIcrc3GetBlocks(args: Array<GetBlocksArgs>) {
  const { actor, isFetching } = useActor();

  return useQuery<GetBlocksResult>({
    queryKey: [
      "icrc3GetBlocks",
      args.map((a) => [a.start.toString(), a.length.toString()]),
    ],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.icrc3_get_blocks(args);
    },
    enabled: !!actor && !isFetching && args.length > 0,
  });
}

export function useIcrc3GetTipCertificate() {
  const { actor, isFetching } = useActor();

  return useQuery<DataCertificate | null>({
    queryKey: ["icrc3GetTipCertificate"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.icrc3_get_tip_certificate();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useIcrc3SupportedBlockTypes() {
  const { actor, isFetching } = useActor();

  return useQuery<Array<SupportedBlockType>>({
    queryKey: ["icrc3SupportedBlockTypes"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.icrc3_supported_block_types();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useMint() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { to: Account; amount: bigint }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.mint(params.to, params.amount);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tokenInfo"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc1BalanceOf"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc3GetBlocks"] });
      void queryClient.invalidateQueries({
        queryKey: ["icrc3GetTipCertificate"],
      });
    },
  });
}

export function useBurn() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { from: Account; amount: bigint }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.burn(params.from, params.amount);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tokenInfo"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc1BalanceOf"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc3GetBlocks"] });
      void queryClient.invalidateQueries({
        queryKey: ["icrc3GetTipCertificate"],
      });
    },
  });
}

/** Inclusive transfer-fee bounds (base units) accepted by set_fee. */
export function useFeeBounds() {
  const { actor, isFetching } = useActor();

  return useQuery<FeeBounds>({
    queryKey: ["feeBounds"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not initialized");
      return actor.get_fee_bounds();
    },
    enabled: !!actor && !isFetching,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Sets the transfer fee; rejects with the backend err text on failure. */
export function useSetFee() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, bigint>({
    mutationFn: async (newFee: bigint) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.set_fee(newFee);
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tokenInfo"] });
      void queryClient.invalidateQueries({ queryKey: ["getFee"] });
      void queryClient.invalidateQueries({ queryKey: ["icrc1Fee"] });
    },
  });
}

export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      await actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

// --- Treasury (ICP -> TTTI) -------------------------------------------------

/** True only once the backend confirmed the caller is an admin. */
function useAdminGate(): boolean {
  const { data: isAdmin } = useIsCallerAdmin();
  return isAdmin === true;
}

/** Public pricing mode, margin and treasury ICP account (no buyer data). */
export function usePublicTreasuryInfo() {
  const { actor, isFetching } = useActor();

  return useQuery<PublicTreasuryInfo | null>({
    queryKey: ["publicTreasuryInfo"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getPublicTreasuryInfo();
    },
    enabled: !!actor && !isFetching,
  });
}

/** Full treasury config (admin-only endpoint; never called for non-admins). */
export function useTreasuryConfig() {
  const { actor, isFetching } = useActor();
  const isAdmin = useAdminGate();

  return useQuery<TreasuryConfig | null>({
    queryKey: ["treasuryConfig"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getTreasuryConfig();
    },
    enabled: !!actor && !isFetching && isAdmin,
  });
}

/** Saves the treasury config; rejects with the backend Err text on failure. */
export function useSetTreasuryConfig() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<TreasuryConfig, Error, TreasuryConfig>({
    mutationFn: async (config: TreasuryConfig) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.setTreasuryConfig(config);
      if (result.__kind__ === "Err") throw new Error(result.Err);
      return result.Ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["treasuryConfig"] });
      void queryClient.invalidateQueries({ queryKey: ["publicTreasuryInfo"] });
      void queryClient.invalidateQueries({ queryKey: ["treasuryState"] });
      void queryClient.invalidateQueries({ queryKey: ["presaleStatus"] });
      void queryClient.invalidateQueries({ queryKey: ["exactQuote"] });
    },
  });
}

/** Conversions whose ICP forward to the treasury failed (admin-only). */
export function useFailedForwards() {
  const { actor, isFetching } = useActor();
  const isAdmin = useAdminGate();

  return useQuery<Array<Conversion>>({
    queryKey: ["failedForwards"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getFailedForwards();
    },
    enabled: !!actor && !isFetching && isAdmin,
  });
}

/** Retries a failed forward; resolves with the ICP ledger block index. */
export function useRetryTreasuryForward() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<bigint, Error, bigint>({
    mutationFn: async (conversionId: bigint) => {
      if (!actor) throw new Error("Actor not available");
      const result = await actor.retryTreasuryForward(conversionId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["failedForwards"] });
      void queryClient.invalidateQueries({ queryKey: ["conversions"] });
      void queryClient.invalidateQueries({ queryKey: ["treasuryState"] });
    },
  });
}

export function useTreasuryState() {
  const { actor, isFetching } = useActor();

  return useQuery<TreasuryState>({
    queryKey: ["treasuryState"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getTreasuryState();
    },
    enabled: !!actor && !isFetching,
  });
}

/** All conversions (admin-only endpoint; never called for non-admins). */
export function useConversions() {
  const { actor, isFetching } = useActor();
  const isAdmin = useAdminGate();

  return useQuery<Array<Conversion>>({
    queryKey: ["conversions"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getConversions();
    },
    enabled: !!actor && !isFetching && isAdmin,
  });
}

export function useConvertDeposit() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseResult,
    Error,
    { recipient: Account | null; icpAmount: bigint }
  >({
    mutationFn: async (params) => {
      if (!actor) throw new Error("Actor not available");
      return actor.convertDeposit(params.recipient, params.icpAmount);
    },
    onSuccess: () => {
      invalidatePresale(queryClient);
    },
  });
}

export function useGetCanisterPrincipal() {
  const { actor, isFetching } = useActor();

  return useQuery<Principal>({
    queryKey: ["canisterPrincipal"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCanisterPrincipal();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetCallerIcpBalance() {
  const { actor, isFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ["callerIcpBalance"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerIcpBalance();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetOnRampLinks() {
  const { actor, isFetching } = useActor();

  return useQuery<Array<OnRampLink>>({
    queryKey: ["onRampLinks"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getOnRampLinks();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetOnRampLinks() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (links: Array<OnRampLink>) => {
      if (!actor) throw new Error("Actor not available");
      await actor.setOnRampLinks(links);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["onRampLinks"] });
    },
  });
}

export function useHandleDeposit() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<PurchaseResult, Error, bigint>({
    mutationFn: async (icpAmount: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.handleDeposit(icpAmount);
    },
    onSuccess: () => {
      invalidatePresale(queryClient);
    },
  });
}

// --- Exact TTTI-P purchase ---------------------------------------------------

/** Quote for buying exactly `tttiAmount` base units (stored price, no outcall). */
export function useQuoteExactTtti(tttiAmount: bigint | null) {
  const { actor, isFetching } = useActor();

  return useQuery<ExactQuoteResult>({
    queryKey: ["exactQuote", tttiAmount?.toString() ?? ""],
    queryFn: async () => {
      if (!actor || tttiAmount === null) throw new Error("Actor not available");
      return actor.quoteExactTtti(tttiAmount);
    },
    enabled: !!actor && !isFetching && tttiAmount !== null && tttiAmount > 0n,
    refetchInterval: 30_000,
  });
}

/** Buy exactly `tttiAmount`, paying at most `maxIcpE8s` (Internet Identity). */
export function useBuyExactTtti() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseResult,
    Error,
    { recipient: Account | null; tttiAmount: bigint; maxIcpE8s: bigint }
  >({
    mutationFn: async (params) => {
      if (!actor) throw new Error("Actor not available");
      return actor.buyExactTtti(
        params.recipient,
        params.tttiAmount,
        params.maxIcpE8s,
      );
    },
    onSuccess: () => {
      invalidatePresale(queryClient);
    },
  });
}

// --- ICP/USD oracle ---------------------------------------------------------

export function useGetIcpPrice() {
  const { actor, isFetching } = useActor();

  return useQuery<IcpPrice>({
    queryKey: ["icpPrice"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getIcpPrice();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useRefreshIcpPrice() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<PriceResult, Error, void>({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.refreshIcpPrice();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["icpPrice"] });
      void queryClient.invalidateQueries({ queryKey: ["treasuryState"] });
      void queryClient.invalidateQueries({ queryKey: ["presaleStatus"] });
    },
  });
}

// --- Presale status & admin switches ----------------------------------------

export function useGetPresaleStatus() {
  const { actor, isFetching } = useActor();

  return useQuery<PresaleStatus>({
    queryKey: ["presaleStatus"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getPresaleStatus();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30_000,
  });
}

export function useGetAdminSwitches() {
  const { actor, isFetching } = useActor();

  return useQuery<AdminSwitches>({
    queryKey: ["adminSwitches"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getAdminSwitches();
    },
    enabled: !!actor && !isFetching,
  });
}

function useSwitchMutation(
  call: (
    actor: NonNullable<ReturnType<typeof useActor>["actor"]>,
    value: boolean,
  ) => Promise<void>,
) {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, boolean>({
    mutationFn: async (value: boolean) => {
      if (!actor) throw new Error("Actor not available");
      await call(actor, value);
    },
    onSuccess: () => {
      invalidatePresale(queryClient);
    },
  });
}

export function useSetSalesPaused() {
  return useSwitchMutation((actor, paused) => actor.setSalesPaused(paused));
}

export function useSetFallbackEnabled() {
  return useSwitchMutation((actor, enabled) =>
    actor.setFallbackEnabled(enabled),
  );
}

export function useSetTransfersFrozen() {
  return useSwitchMutation((actor, frozen) => actor.setTransfersFrozen(frozen));
}

// --- Delivery address (optional, for the later migration) -------------------

export function useGetDeliveryAddress() {
  const { actor, isFetching } = useActor();

  return useQuery<Account | null>({
    queryKey: ["deliveryAddress"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getDeliveryAddress();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetDeliveryAddress() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<DeliveryAddressResult, Error, string>({
    mutationFn: async (principalText: string) => {
      if (!actor) throw new Error("Actor not available");
      return actor.setDeliveryAddress(principalText.trim());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deliveryAddress"] });
    },
  });
}

export function useClearDeliveryAddress() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, void>({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.clearDeliveryAddress();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deliveryAddress"] });
    },
  });
}

// --- Admin: snapshot, fee collector, burn account, legacy blocks ------------

/** On-demand export (admin) of all holder balances for the migration. */
export function useExportBalanceSnapshot() {
  const { actor } = useActor();

  return useMutation<BalanceSnapshot, Error, void>({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.exportBalanceSnapshot();
    },
  });
}

export function useGetFeeCollector() {
  const { actor, isFetching } = useActor();

  return useQuery<FeeCollectorInfo>({
    queryKey: ["feeCollector"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getFeeCollector();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetBurnAccount() {
  const { actor, isFetching } = useActor();

  return useQuery<Account>({
    queryKey: ["burnAccount"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getBurnAccount();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetLegacyBlockInfo() {
  const { actor, isFetching } = useActor();

  return useQuery<LegacyBlockInfo>({
    queryKey: ["legacyBlockInfo"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getLegacyBlockInfo();
    },
    enabled: !!actor && !isFetching,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
