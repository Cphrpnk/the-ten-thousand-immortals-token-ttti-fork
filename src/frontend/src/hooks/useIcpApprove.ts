import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ApproveOutcome,
  approveWithIdentity,
  requiredIcpBalance,
} from "../lib/icpLedger";
import { formatIcp } from "../lib/token";
import { useInternetIdentity } from "./useInternetIdentity";
import { usePlug } from "./usePlug";
import { useGetCanisterPrincipal } from "./useQueries";

export type ApproveWallet = "internetIdentity" | "plug";

export interface IcpApproveParams {
  /** Purchase amount in ICP e8s (the allowance adds the 0.0001 ICP fee). */
  purchaseE8s: bigint;
  /** Caller's ICP balance in e8s; when given, checked against requiredIcpBalance. */
  balanceE8s?: bigint;
  /** Force a wallet; defaults to Internet Identity when signed in, else Plug. */
  wallet?: ApproveWallet;
}

/**
 * Approve the presale canister (getCanisterPrincipal) as ICRC-2 spender on the
 * ICP ledger. Resolves with an ApproveOutcome and never rejects, so callers
 * render `outcome.message` on failure.
 */
export function useIcpApprove() {
  const { identity } = useInternetIdentity();
  const { principal: plugPrincipal, approveIcp } = usePlug();
  const { data: spender } = useGetCanisterPrincipal();
  const queryClient = useQueryClient();

  const hasIdentity = !!identity && !identity.getPrincipal().isAnonymous();
  const defaultWallet: ApproveWallet | null = hasIdentity
    ? "internetIdentity"
    : plugPrincipal
      ? "plug"
      : null;

  const mutation = useMutation<ApproveOutcome, Error, IcpApproveParams>({
    mutationFn: async ({ purchaseE8s, balanceE8s, wallet }) => {
      if (purchaseE8s <= 0n) {
        return { ok: false, message: "Enter an ICP amount greater than zero." };
      }
      if (!spender) {
        return {
          ok: false,
          message: "The presale canister is still loading. Try again shortly.",
        };
      }
      const required = requiredIcpBalance(purchaseE8s);
      if (balanceE8s !== undefined && balanceE8s < required) {
        return {
          ok: false,
          message: `Insufficient ICP. You need ${formatIcp(required)} ICP (purchase plus 2 × 0.0001 ICP fees) but have ${formatIcp(balanceE8s)} ICP.`,
        };
      }
      const chosen = wallet ?? defaultWallet;
      if (chosen === "plug") {
        if (!plugPrincipal) {
          return { ok: false, message: "Connect Plug to approve ICP." };
        }
        return approveIcp(spender, purchaseE8s);
      }
      if (chosen === "internetIdentity" && identity && hasIdentity) {
        return approveWithIdentity(identity, spender, purchaseE8s);
      }
      return {
        ok: false,
        message: "Connect Internet Identity or Plug to approve ICP.",
      };
    },
    onSuccess: (outcome) => {
      if (!outcome.ok) return;
      void queryClient.invalidateQueries({ queryKey: ["callerIcpBalance"] });
      void queryClient.invalidateQueries({ queryKey: ["walletBalance"] });
    },
  });

  return { ...mutation, spender, defaultWallet };
}
