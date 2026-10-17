import Common "common";

module {
  public type Account = Common.Account;
  public type Timestamp = Common.Timestamp;

  // Internal ledger state shapes.
  //
  // `transfersFrozen` is the admin switch that refuses icrc1_transfer,
  // icrc2_transfer_from, icrc2_approve, mint, burn and presale delivery
  // ("Transfers are frozen").
  // `legacyBlockBoundary` is the block index recorded at the 4 -> 8 decimals
  // upgrade: blocks with index < legacyBlockBoundary carry 4-decimal amounts.
  // `lastBlockHash` is the ICRC-3 representation-independent hash of the latest
  // block (null for an empty log); new blocks chain to it via `phash`.
  public type LedgerState = {
    var totalSupply : Nat;
    var fee : Nat;
    var nextBlockIndex : Nat;
    var transfersFrozen : Bool;
    legacyBlockBoundary : Nat;
    var lastBlockHash : ?Blob;
  };

  // One deduplication record: the transaction hash and the ledger time at
  // which the block was written (used for bounded pruning).
  public type DedupEntry = {
    txHash : Blob;
    ledgerTime : Timestamp;
  };

  public type Transaction = {
    from : Account;
    to : Account;
    amount : Nat;
    fee : Nat;
    timestamp : Timestamp;
  };

  public type Approval = {
    amount : Nat;
    expires_at : ?Timestamp;
  };

  // The fee collector account and its current TTTI-P balance (base units).
  public type FeeCollectorInfo = {
    account : Account;
    balance : Nat;
  };

  // Legacy History support: blocks with index < boundaryIndex were written
  // with `legacyDecimals` (4); later blocks use `currentDecimals` (8).
  public type LegacyBlockInfo = {
    boundaryIndex : Nat;
    legacyDecimals : Nat8;
    currentDecimals : Nat8;
  };

  // One non-zero ledger balance.
  public type HolderBalance = {
    account : Account;
    balance : Nat;
  };

  // Outcome of a presale delivery: how much came from the fee collector
  // balance, how much was minted, and the block indices written.
  public type DeliveryResult = {
    #ok : { fromCollector : Nat; minted : Nat; blockIndices : [Nat] };
    #err : Text;
  };

  // Allowed transfer fee range (base units), mirrored by the Admin form.
  public type FeeBounds = {
    min : Nat;
    max : Nat;
  };

  public type SetFeeResult = {
    #ok;
    #err : Text;
  };
};
