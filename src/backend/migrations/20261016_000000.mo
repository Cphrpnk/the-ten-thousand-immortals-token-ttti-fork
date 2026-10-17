module {
  // Subset migration: every existing actor field (including the ledger and
  // presale stores) is carried forward unchanged by the migration chain.
  type OldActor = {};
  type OriginalDocument = {
    blob : Blob;
    filename : Text;
    mimeType : Text;
  };
  type NewActor = {
    documentState : { var original : ?OriginalDocument };
  };

  public func migration(_old : OldActor) : NewActor {
    { documentState = { var original = null } };
  };
};
