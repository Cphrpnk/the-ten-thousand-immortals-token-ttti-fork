import AccessControl "mo:caffeineai-authorization/access-control";
import DocumentLib "../lib/document";
import DocumentTypes "../types/document";

mixin (state : DocumentTypes.DocumentState, accessControlState : AccessControl.AccessControlState) {
  public query func getOriginalWhitePaper() : async ?DocumentTypes.OriginalDocument {
    DocumentLib.getOriginal(state)
  };

  // A controller/admin can publish the supplied DOCX from a bundled asset;
  // readers do not have to upload a copy themselves.
  public shared ({ caller }) func publishOriginalWhitePaper(document : DocumentTypes.OriginalDocument) : async () {
    DocumentLib.publishOriginal(state, accessControlState, caller, document);
  };
};
