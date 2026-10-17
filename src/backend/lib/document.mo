import AccessControl "mo:caffeineai-authorization/access-control";
import Runtime "mo:core/Runtime";
import DocumentTypes "../types/document";

module {
  public func getOriginal(state : DocumentTypes.DocumentState) : ?DocumentTypes.OriginalDocument {
    state.original
  };

  public func publishOriginal(
    state : DocumentTypes.DocumentState,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
    document : DocumentTypes.OriginalDocument,
  ) : () {
    if (accessControlState.userRoles.get(caller) != ?#admin) {
      Runtime.trap("Unauthorized: only admins can publish the original white paper");
    };
    state.original := ?document;
  };
};
