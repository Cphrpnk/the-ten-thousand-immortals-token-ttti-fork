import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import PurchaseLib "../lib/purchase";
import AccessControl "mo:caffeineai-authorization/access-control";

mixin (profileState : PurchaseLib.ProfileState, accessControlState : AccessControl.AccessControlState) {
  public query ({ caller }) func getCallerUserProfile() : async ?Common.UserProfile {
    PurchaseLib.getCallerUserProfile(profileState, caller);
  };

  // Anonymous callers are refused.
  public shared ({ caller }) func saveCallerUserProfile(profile : Common.UserProfile) : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: please sign in to save a profile");
    };
    PurchaseLib.saveCallerUserProfile(profileState, caller, profile);
  };

  // The caller's own profile, or any profile for admins; null otherwise.
  // Non-trapping admin check: unregistered principals are simply not admins.
  public query ({ caller }) func getUserProfile(user : Principal) : async ?Common.UserProfile {
    let callerIsAdmin = accessControlState.userRoles.get(caller) == ?#admin;
    PurchaseLib.getUserProfile(profileState, caller, callerIsAdmin, user);
  };
};
