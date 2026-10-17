import { loadConfig } from "@caffeineai/core-infrastructure";
import { Actor, HttpAgent, type Identity } from "@icp-sdk/core/agent";
import type { IDL } from "@icp-sdk/core/candid";
import type { Principal } from "@icp-sdk/core/principal";
import type { ApproveError } from "../backend";
import { ICP_FEE_E8S, formatIcp } from "./token";

/** Mainnet ICP ledger. Purchases are approved here, never on TTTI-P. */
export const ICP_LEDGER_CANISTER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai";

/** Allowance to grant: the purchase plus the transfer_from fee. */
export function approveAmount(purchaseE8s: bigint): bigint {
  return purchaseE8s + ICP_FEE_E8S;
}

/**
 * ICP balance needed for a purchase: the purchase, the transfer_from fee
 * covered by the allowance, and the fee charged by the approve itself.
 */
export function requiredIcpBalance(purchaseE8s: bigint): bigint {
  return purchaseE8s + 2n * ICP_FEE_E8S;
}

type Opt<T> = [] | [T];

export interface RawAccount {
  owner: Principal;
  subaccount: Opt<Uint8Array>;
}

export interface RawApproveArgs {
  fee: Opt<bigint>;
  memo: Opt<Uint8Array>;
  from_subaccount: Opt<Uint8Array>;
  created_at_time: Opt<bigint>;
  amount: bigint;
  expected_allowance: Opt<bigint>;
  expires_at: Opt<bigint>;
  spender: RawAccount;
}

export type RawApproveError =
  | { GenericError: { message: string; error_code: bigint } }
  | { TemporarilyUnavailable: null }
  | { Duplicate: { duplicate_of: bigint } }
  | { BadFee: { expected_fee: bigint } }
  | { AllowanceChanged: { current_allowance: bigint } }
  | { CreatedInFuture: { ledger_time: bigint } }
  | { TooOld: null }
  | { Expired: { ledger_time: bigint } }
  | { InsufficientFunds: { balance: bigint } };

export type RawApproveResult = { Ok: bigint } | { Err: RawApproveError };

/** Raw-candid actor surface for the ICRC-2 calls the app makes on ICP. */
export interface IcpLedgerActor {
  icrc2_approve: (args: RawApproveArgs) => Promise<RawApproveResult>;
  icrc2_allowance: (args: {
    account: RawAccount;
    spender: RawAccount;
  }) => Promise<{ allowance: bigint; expires_at: Opt<bigint> }>;
  icrc1_balance_of: (account: RawAccount) => Promise<bigint>;
}

/** Minimal ICRC-1/ICRC-2 interface; uses the injected IDL so Plug can use it. */
export const icpLedgerIdlFactory: IDL.InterfaceFactory = ({ IDL: I }) => {
  const Account = I.Record({
    owner: I.Principal,
    subaccount: I.Opt(I.Vec(I.Nat8)),
  });
  const ApproveArgs = I.Record({
    fee: I.Opt(I.Nat),
    memo: I.Opt(I.Vec(I.Nat8)),
    from_subaccount: I.Opt(I.Vec(I.Nat8)),
    created_at_time: I.Opt(I.Nat64),
    amount: I.Nat,
    expected_allowance: I.Opt(I.Nat),
    expires_at: I.Opt(I.Nat64),
    spender: Account,
  });
  const ApproveError = I.Variant({
    GenericError: I.Record({ message: I.Text, error_code: I.Nat }),
    TemporarilyUnavailable: I.Null,
    Duplicate: I.Record({ duplicate_of: I.Nat }),
    BadFee: I.Record({ expected_fee: I.Nat }),
    AllowanceChanged: I.Record({ current_allowance: I.Nat }),
    CreatedInFuture: I.Record({ ledger_time: I.Nat64 }),
    TooOld: I.Null,
    Expired: I.Record({ ledger_time: I.Nat64 }),
    InsufficientFunds: I.Record({ balance: I.Nat }),
  });
  return I.Service({
    icrc2_approve: I.Func(
      [ApproveArgs],
      [I.Variant({ Ok: I.Nat, Err: ApproveError })],
      [],
    ),
    icrc2_allowance: I.Func(
      [I.Record({ account: Account, spender: Account })],
      [I.Record({ allowance: I.Nat, expires_at: I.Opt(I.Nat64) })],
      ["query"],
    ),
    icrc1_balance_of: I.Func([Account], [I.Nat], ["query"]),
  });
};

/** Build ICRC-2 approve args granting `spender` the purchase plus fee. */
export function buildApproveArgs(
  spender: Principal,
  purchaseE8s: bigint,
): RawApproveArgs {
  return {
    fee: [ICP_FEE_E8S],
    memo: [],
    from_subaccount: [],
    created_at_time: [],
    amount: approveAmount(purchaseE8s),
    expected_allowance: [],
    expires_at: [],
    spender: { owner: spender, subaccount: [] },
  };
}

export type ApproveOutcome =
  | { ok: true; blockIndex: bigint }
  | { ok: false; message: string };

/** Convert a raw candid ApproveError into the typed backend shape. */
function toTypedError(error: RawApproveError): ApproveError {
  if ("GenericError" in error) {
    return { __kind__: "GenericError", GenericError: error.GenericError };
  }
  if ("TemporarilyUnavailable" in error) {
    return { __kind__: "TemporarilyUnavailable", TemporarilyUnavailable: null };
  }
  if ("Duplicate" in error) {
    return { __kind__: "Duplicate", Duplicate: error.Duplicate };
  }
  if ("BadFee" in error) return { __kind__: "BadFee", BadFee: error.BadFee };
  if ("AllowanceChanged" in error) {
    return {
      __kind__: "AllowanceChanged",
      AllowanceChanged: error.AllowanceChanged,
    };
  }
  if ("CreatedInFuture" in error) {
    return {
      __kind__: "CreatedInFuture",
      CreatedInFuture: error.CreatedInFuture,
    };
  }
  if ("TooOld" in error) return { __kind__: "TooOld", TooOld: null };
  if ("Expired" in error)
    return { __kind__: "Expired", Expired: error.Expired };
  return {
    __kind__: "InsufficientFunds",
    InsufficientFunds: error.InsufficientFunds,
  };
}

/** Clear English message for every ICRC-2 ApproveError variant. */
export function describeApproveError(error: ApproveError): string {
  switch (error.__kind__) {
    case "InsufficientFunds":
      return `Not enough ICP to approve this purchase. Your balance is ${formatIcp(error.InsufficientFunds.balance)} ICP; the approval fee is 0.0001 ICP.`;
    case "BadFee":
      return `The ICP ledger expects a fee of ${formatIcp(error.BadFee.expected_fee)} ICP. Please try again.`;
    case "AllowanceChanged":
      return `Your existing ICP allowance changed to ${formatIcp(error.AllowanceChanged.current_allowance)} ICP while approving. Please try again.`;
    case "Expired":
    case "ExpiredFrom":
      return "The approval expired before the ledger processed it. Please approve again.";
    case "TooOld":
      return "The approval request is too old. Check your device clock and try again.";
    case "CreatedInFuture":
      return "The approval timestamp is ahead of the ledger clock. Check your device clock and try again.";
    case "Duplicate":
      return `This approval was already submitted (block ${error.Duplicate.duplicate_of.toString()}). You can continue with the purchase.`;
    case "TemporarilyUnavailable":
      return "The ICP ledger is temporarily unavailable. Please try again in a moment.";
    case "GenericError":
      return `The ICP ledger rejected the approval: ${error.GenericError.message}`;
  }
}

export function mapApproveResult(result: RawApproveResult): ApproveOutcome {
  if ("Ok" in result) return { ok: true, blockIndex: result.Ok };
  return { ok: false, message: describeApproveError(toTypedError(result.Err)) };
}

/** Turn an agent/wallet exception into a readable message. */
export function describeCallFailure(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (/reject|denied|declin|cancel/i.test(text)) {
    return "The approval was cancelled in your wallet.";
  }
  if (/fetch|network|timeout|timed out/i.test(text)) {
    return "Could not reach the ICP ledger. Check your connection and try again.";
  }
  return "The ICP approval could not be completed. Please try again.";
}

/** Approve with an Internet Identity by calling the ICP ledger directly. */
export async function approveWithIdentity(
  identity: Identity,
  spender: Principal,
  purchaseE8s: bigint,
): Promise<ApproveOutcome> {
  try {
    const config = await loadConfig();
    const agent = new HttpAgent({ identity, host: config.backend_host });
    if (config.backend_host?.includes("localhost")) {
      await agent.fetchRootKey().catch(() => undefined);
    }
    const ledger = Actor.createActor<IcpLedgerActor>(icpLedgerIdlFactory, {
      agent,
      canisterId: ICP_LEDGER_CANISTER_ID,
    });
    const result = await ledger.icrc2_approve(
      buildApproveArgs(spender, purchaseE8s),
    );
    return mapApproveResult(result);
  } catch (error) {
    return { ok: false, message: describeCallFailure(error) };
  }
}
