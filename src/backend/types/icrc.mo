import Common "common";

module {
  public type Account = Common.Account;
  public type Subaccount = Common.Subaccount;
  public type Timestamp = Common.Timestamp;
  public type Value = Common.Value;

  // ---------------------------------------------------------------------------
  // ICRC-1 / ICRC-10
  // ---------------------------------------------------------------------------

  // ICRC-1 metadata value.
  public type MetadataValue = {
    #Nat : Nat;
    #Int : Int;
    #Text : Text;
    #Blob : Blob;
  };

  // ICRC-1 / ICRC-10 supported standard entry.
  public type SupportedStandard = {
    name : Text;
    url : Text;
  };

  public type TransferArgs = {
    from_subaccount : ?Subaccount;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Timestamp;
  };

  public type TransferError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Timestamp };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  public type TransferResult = {
    #Ok : Nat;
    #Err : TransferError;
  };

  // ---------------------------------------------------------------------------
  // ICRC-2
  // ---------------------------------------------------------------------------

  public type ApproveArgs = {
    from_subaccount : ?Subaccount;
    spender : Account;
    amount : Nat;
    expected_allowance : ?Nat;
    expires_at : ?Timestamp;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Timestamp;
  };

  public type ApproveError = {
    #BadFee : { expected_fee : Nat };
    #InsufficientFunds : { balance : Nat };
    #AllowanceChanged : { current_allowance : Nat };
    #ExpiredFrom : { ledger_time : Timestamp };
    #Expired : { ledger_time : Timestamp };
    #TooOld;
    #CreatedInFuture : { ledger_time : Timestamp };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  public type ApproveResult = {
    #Ok : Nat;
    #Err : ApproveError;
  };

  public type AllowanceArgs = {
    account : Account;
    spender : Account;
  };

  public type Allowance = {
    allowance : Nat;
    expires_at : ?Timestamp;
  };

  public type TransferFromArgs = {
    spender_subaccount : ?Subaccount;
    from : Account;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Timestamp;
  };

  public type TransferFromError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #InsufficientAllowance : { allowance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Timestamp };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  public type TransferFromResult = {
    #Ok : Nat;
    #Err : TransferFromError;
  };

  // ---------------------------------------------------------------------------
  // ICRC-3
  // ---------------------------------------------------------------------------

  public type Block = {
    id : Nat;
    block : Value;
  };

  public type GetBlocksArgs = {
    start : Nat;
    length : Nat;
  };

  public type GetBlocksResult = {
    log_length : Nat;
    blocks : [Block];
    archived_blocks : [{
      args : [GetBlocksArgs];
      callback : shared query ([GetBlocksArgs]) -> async GetBlocksResult;
    }];
  };

  public type GetArchivesArgs = {
    from : ?Principal;
  };

  public type ArchiveInfo = {
    canister_id : Principal;
    start : Nat;
    end : Nat;
  };

  public type DataCertificate = {
    certificate : Blob;
    hash_tree : Blob;
  };

  public type SupportedBlockType = {
    block_type : Text;
    url : Text;
  };

  // ---------------------------------------------------------------------------
  // Management
  // ---------------------------------------------------------------------------

  public type MintResult = {
    #Ok : Nat;
    #Err : TransferError;
  };

  public type BurnResult = {
    #Ok : Nat;
    #Err : TransferError;
  };
};
