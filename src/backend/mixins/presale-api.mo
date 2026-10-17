import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Presale "../types/presale";
import PresaleLib "../lib/presale";
import TreasuryLib "../lib/treasury";
import IcrcLib "../lib/icrc";
import OracleLib "../lib/oracle";

mixin (
  presale : PresaleLib.PresaleStore,
  treasury : TreasuryLib.TreasuryStore,
  ledger : IcrcLib.Ledger,
  oracle : OracleLib.OracleStore,
  accessControlState : AccessControl.AccessControlState,
  canisterPrincipal : Principal,
) {
  func requirePresaleAdmin(caller : Principal) {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: only admins can manage the presale");
    };
  };

  // --- Presale status (public) -----------------------------------------------

  public query func getPresaleStatus() : async Presale.PresaleStatus {
    PresaleLib.status(presale, treasury, ledger, oracle);
  };

  public query func getAdminSwitches() : async Presale.AdminSwitches {
    PresaleLib.switches(presale, ledger);
  };

  // --- Admin switches (admin-gated) ------------------------------------------

  public shared ({ caller }) func setSalesPaused(paused : Bool) : async () {
    requirePresaleAdmin(caller);
    PresaleLib.setSalesPaused(presale, paused);
  };

  public shared ({ caller }) func setFallbackEnabled(enabled : Bool) : async () {
    requirePresaleAdmin(caller);
    PresaleLib.setFallbackEnabled(presale, enabled);
  };

  // --- Delivery address (per caller) -----------------------------------------

  public shared ({ caller }) func setDeliveryAddress(principalText : Text) : async Presale.DeliveryAddressResult {
    PresaleLib.setDeliveryAddress(treasury.depositRecipients, caller, principalText);
  };

  public query ({ caller }) func getDeliveryAddress() : async ?Common.Account {
    PresaleLib.getDeliveryAddress(treasury.depositRecipients, caller);
  };

  public shared ({ caller }) func clearDeliveryAddress() : async Bool {
    PresaleLib.clearDeliveryAddress(treasury.depositRecipients, caller);
  };

  // --- Balance snapshot export (admin-gated query) ---------------------------

  public query ({ caller }) func exportBalanceSnapshot() : async Presale.BalanceSnapshot {
    requirePresaleAdmin(caller);
    PresaleLib.snapshot(ledger, canisterPrincipal, treasury.depositRecipients);
  };
};
