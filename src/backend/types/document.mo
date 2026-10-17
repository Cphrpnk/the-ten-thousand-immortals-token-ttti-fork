import Storage "mo:caffeineai-object-storage/Storage";

module {
  // The object-storage reference, not an inline copy of the DOCX bytes.
  public type OriginalDocument = {
    blob : Storage.ExternalBlob;
    filename : Text;
    mimeType : Text;
  };

  public type DocumentState = {
    var original : ?OriginalDocument;
  };
};
