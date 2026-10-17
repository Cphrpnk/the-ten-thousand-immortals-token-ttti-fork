import AccessControl "mo:caffeineai-authorization/access-control";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

mixin (accessControlState : AccessControl.AccessControlState) {
  // Once an admin exists this only registers the caller as #user. Before that,
  // only a canister controller may call it (and becomes the admin).
  public shared ({ caller }) func initializeAccessControl() : async () {
    if (not accessControlState.adminAssigned and not caller.isController()) {
      Runtime.trap("Unauthorized: only a controller can initialize access control");
    };
    AccessControl.initialize(accessControlState, caller);
  };
};
