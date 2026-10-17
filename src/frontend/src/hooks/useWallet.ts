import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Account,
  BalanceResult,
  TokenDescriptor,
  TokenResult,
  TransferResult,
} from "../backend";
import { useActor } from "./useActor";

/** List the wallet's supported token descriptors. */
export function useListTokens() {
  const { actor, isFetching } = useActor();

  return useQuery<Array<TokenDescriptor>>({
    queryKey: ["listTokens"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listTokens();
    },
    enabled: !!actor && !isFetching,
  });
}

/** Read a single token's metadata by canister id. */
export function useTokenMetadata(canisterId: Principal | undefined) {
  const { actor, isFetching } = useActor();

  return useQuery<TokenResult>({
    queryKey: ["tokenMetadata", canisterId?.toText()],
    queryFn: async () => {
      if (!actor || !canisterId) throw new Error("Actor not initialized");
      return actor.getTokenMetadata(canisterId);
    },
    enabled: !!actor && !isFetching && !!canisterId,
  });
}

/** Read a token balance for an account. */
export function useWalletBalance(
  canisterId: Principal | undefined,
  account: Account | undefined,
) {
  const { actor, isFetching } = useActor();

  return useQuery<BalanceResult>({
    queryKey: [
      "walletBalance",
      canisterId?.toText(),
      account?.owner.toText(),
      account?.subaccount,
    ],
    queryFn: async () => {
      if (!actor || !canisterId || !account) {
        throw new Error("Actor not initialized");
      }
      return actor.getBalance(canisterId, account);
    },
    enabled: !!actor && !isFetching && !!canisterId && !!account,
  });
}

/** Prepare a non-custodial transfer for the user to sign. */
export function usePrepareTransfer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<
    TransferResult,
    Error,
    {
      canisterId: Principal;
      from: Account;
      to: Account;
      amount: bigint;
      memo: Uint8Array | null;
    }
  >({
    mutationFn: async (params) => {
      if (!actor) throw new Error("Actor not available");
      return actor.prepareTransfer(
        params.canisterId,
        params.from,
        params.to,
        params.amount,
        params.memo,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["walletBalance"] });
    },
  });
}
