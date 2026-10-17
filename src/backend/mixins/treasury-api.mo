import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Set "mo:core/Set";
import AccessControl "mo:caffeineai-authorization/access-control";
import OutCall "mo:caffeineai-http-outcalls/outcall";
import Common "../types/common";
import Treasury "../types/treasury";
import Presale "../types/presale";
import TreasuryLib "../lib/treasury";
import PresaleLib "../lib/presale";
import IcrcLib "../lib/icrc";
import OracleLib "../lib/oracle";

mixin (
  treasury : TreasuryLib.TreasuryStore,
  presale : PresaleLib.PresaleStore,
  ledger : IcrcLib.Ledger,
  accessControlState : AccessControl.AccessControlState,
  canisterPrincipal : Principal,
  oracle : OracleLib.OracleStore,
) {
  // The ICP ledger canister (mainnet). Transient: a capability handle.
  transient let icpLedger : TreasuryLib.IcpLedger = actor ("ryjl3-tyaaa-aaaaa-aaaba-cai");

  // This canister seen as an actor, so the pipeline can pass the actor-level
  // `transform` query (declared in oracle-api) to the price outcalls.
  transient let selfActor : actor { transform : OutCall.Transform } = actor (canisterPrincipal.toText());

  // Conversion ids whose treasury forward retry is awaiting the ICP ledger.
  // Transient: a lock, not durable state.
  transient let forwardsInFlight = Set.empty<Nat>();

  // The canister's own principal: the ICRC-2 spender the buyer must approve
  // on the ICP ledger, and the owner of the account ICP is collected into.
  public query func getCanisterPrincipal() : async Principal {
    canisterPrincipal;
  };

  func requireAdmin(caller : Principal) {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: only admins can manage the treasury");
    };
  };

  func purchaseContext() : PresaleLib.PurchaseContext {
    {
      presale;
      treasury;
      ledger;
      oracle;
      icpLedger;
      transform = selfActor.transform;
      canister = canisterPrincipal;
    };
  };

  // --- Configuration ---------------------------------------------------------

  // Admin only. Refused (#Err) when marginBps > TreasuryLib.MAX_MARGIN_BPS
  // (2000 = 20%) or the fallback rate is 0.
  public shared ({ caller }) func setTreasuryConfig(config : Treasury.TreasuryConfig) : async Treasury.TreasuryConfigResult {
    requireAdmin(caller);
    TreasuryLib.setConfig(treasury, config);
  };

  // Admin only: the full configuration.
  public query ({ caller }) func getTreasuryConfig() : async ?Treasury.TreasuryConfig {
    requireAdmin(caller);
    TreasuryLib.getConfig(treasury);
  };

  // Public: what the Exchange and Buy ICP pages need (no buyer data).
  public query func getPublicTreasuryInfo() : async ?Treasury.PublicTreasuryInfo {
    TreasuryLib.publicInfo(treasury);
  };

  // --- Treasury state (public read, no buyer data) ---------------------------

  public shared func getTreasuryState() : async Treasury.TreasuryState {
    await TreasuryLib.getState(treasury, icpLedger, TreasuryLib.liveRateFromPrice(treasury, oracle.usdE8));
  };

  // Admin only: every recorded conversion.
  public query ({ caller }) func getConversions() : async [Treasury.Conversion] {
    requireAdmin(caller);
    TreasuryLib.getConversions(treasury);
  };

  // --- Failed treasury forwards (admin) --------------------------------------

  public query ({ caller }) func getFailedForwards() : async [Treasury.Conversion] {
    requireAdmin(caller);
    TreasuryLib.failedForwards(treasury);
  };

  // Retries a #failed forward once at a time (#pending + in-flight guard
  // before the ledger await, so it can never double-forward).
  public shared ({ caller }) func retryTreasuryForward(conversionId : Nat) : async Treasury.ForwardRetryResult {
    requireAdmin(caller);
    await TreasuryLib.retryForward(
      treasury,
      icpLedger,
      { owner = canisterPrincipal; subaccount = null },
      forwardsInFlight,
      conversionId,
    );
  };

  public shared ({ caller }) func getCallerIcpBalance() : async Nat {
    await TreasuryLib.getIcpBalance(icpLedger, caller);
  };

  // --- On-ramp links ---------------------------------------------------------

  public query func getOnRampLinks() : async [Treasury.OnRampLink] {
    TreasuryLib.getOnRampLinks(treasury);
  };

  public shared ({ caller }) func setOnRampLinks(links : [Treasury.OnRampLink]) : async () {
    requireAdmin(caller);
    TreasuryLib.setOnRampLinks(treasury, links);
  };

  // --- Purchases (signed-in callers) -----------------------------------------

  // `recipient` = explicit delivery account, or null to use the caller's
  // stored delivery address, otherwise the caller's principal.
  public shared ({ caller }) func convertDeposit(recipient : ?Common.Account, icpAmount : Nat) : async Presale.PurchaseResult {
    await PresaleLib.purchase(purchaseContext(), caller, recipient, icpAmount);
  };

  // Same pipeline with recipient = null; refused with #autoDepositsDisabled
  // when the treasury mode is #manual.
  public shared ({ caller }) func handleDeposit(icpAmount : Nat) : async Presale.PurchaseResult {
    switch (treasury.config) {
      case (?c) {
        if (c.mode == #manual) {
          return #Err({
            code = #autoDepositsDisabled;
            message = "Automatic deposits are disabled; please use the Exchange page to convert ICP";
            conversion = null;
          });
        };
      };
      case null {};
    };
    await PresaleLib.purchase(purchaseContext(), caller, null, icpAmount);
  };

  // Read-only quote for buying exactly `tttiAmount` TTTI-P (base units) at the
  // stored ICP/USD price (no outcall): ICP cost rounded up plus the maximum ICP
  // with the fixed 2% price protection.
  public query func quoteExactTtti(tttiAmount : Nat) : async Presale.ExactQuoteResult {
    PresaleLib.quoteExact(presale, treasury, oracle, tttiAmount);
  };

  // Buys exactly `tttiAmount` TTTI-P for the caller, collecting only the ICP
  // cost computed at purchase time; refused with #priceMoved (no ICP taken)
  // when that cost exceeds `maxIcpE8s`. Same gating as convertDeposit.
  public shared ({ caller }) func buyExactTtti(recipient : ?Common.Account, tttiAmount : Nat, maxIcpE8s : Nat) : async Presale.PurchaseResult {
    await PresaleLib.purchaseExact(purchaseContext(), caller, recipient, tttiAmount, maxIcpE8s);
  };
};
