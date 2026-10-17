import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";

module {
  public type UserProfile = Common.UserProfile;

  // User profiles only. Purchase orders were removed with the Stripe surface.
  public type ProfileState = {
    profiles : Map.Map<Principal, UserProfile>;
  };

  public func newState() : ProfileState {
    { profiles = Map.empty() };
  };

  public func getCallerUserProfile(state : ProfileState, caller : Principal) : ?UserProfile {
    state.profiles.get(caller);
  };

  public func saveCallerUserProfile(state : ProfileState, caller : Principal, profile : UserProfile) : () {
    state.profiles.add(caller, profile);
  };

  // Returns `user`'s profile only when the caller is that (signed-in) user.
  public func getUserProfile(state : ProfileState, caller : Principal, callerIsAdmin : Bool, user : Principal) : ?UserProfile {
    if (not callerIsAdmin and (caller.isAnonymous() or caller != user)) {
      return null;
    };
    state.profiles.get(user);
  };
};
