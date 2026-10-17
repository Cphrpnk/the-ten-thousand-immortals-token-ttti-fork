import Common "../types/common";
import Icrc "../types/icrc";
import Token "../types/token";
import IcrcLib "../lib/icrc";
import AccessControl "mo:caffeineai-authorization/access-control";
import Runtime "mo:core/Runtime";

mixin (ledger : IcrcLib.Ledger, accessControlState : AccessControl.AccessControlState, canisterPrincipal : Principal) {
  // --- Controlled supply management ------------------------------------------

  // Admin-only. Refused when frozen, for 0, to the minting account, or beyond max supply.
  public shared ({ caller }) func mint(to : Common.Account, amount : Nat) : async Icrc.MintResult {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: only admins can mint");
    };
    IcrcLib.mint(ledger, canisterPrincipal, to, amount);
  };

  // Admins may burn from any account; other callers only from their own.
  public shared ({ caller }) func burn(from : Common.Account, amount : Nat) : async Icrc.BurnResult {
    let authorized = from.owner == caller or AccessControl.isAdmin(accessControlState, caller);
    if (not authorized) {
      Runtime.trap("Unauthorized: only admins can burn another account's tokens");
    };
    IcrcLib.burn(ledger, canisterPrincipal, from, amount, authorized);
  };

  // Admin-only. Accepts get_fee_bounds().min ..= get_fee_bounds().max.
  public shared ({ caller }) func set_fee(newFee : Nat) : async Token.SetFeeResult {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: only admins can set the fee");
    };
    IcrcLib.setFee(ledger, newFee);
  };

  public query func get_fee_bounds() : async Token.FeeBounds {
    IcrcLib.feeBounds();
  };

  public query func get_fee() : async Nat {
    IcrcLib.getFee(ledger);
  };

  public query func get_max_supply() : async Nat {
    IcrcLib.getMaxSupply();
  };

  // Admin switch: when true, transfers, approvals, transfer_from, mint, burn and
  // presale delivery are refused with "Transfers are frozen".
  public shared ({ caller }) func setTransfersFrozen(frozen : Bool) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: only admins can freeze transfers");
    };
    IcrcLib.setFrozen(ledger, frozen);
  };
};
