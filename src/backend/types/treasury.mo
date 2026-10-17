import Common "common";

module {
  // Treasury domain types: treasury ICP account, fallback rate, mode,
  // conversion history, and the ICP ledger integration shapes.

  public type Account = Common.Account;
  public type Timestamp = Common.Timestamp;

  // Auto = handleDeposit is accepted; Manual = handleDeposit is refused.
  public type TreasuryMode = {
    #auto;
    #manual;
  };

  // Admin-controlled configuration.
  // `icpAccount` is the treasury ICP account collected ICP is forwarded to
  // (when it differs from the canister's own default ICP account).
  // `rate` is the fallback rate in TTTI-P base units (8 decimals) per 1 whole
  // ICP; it is used only when the admin has enabled the fallback.
  // `marginBps` is the safety margin in basis points (0-2000, i.e. at most
  // 20%) applied to the live-price conversion.
  public type TreasuryConfig = {
    icpAccount : Account;
    rate : Nat;
    mode : TreasuryMode;
    marginBps : Nat;
  };

  // Public treasury state. `icpBalance` is the ICP (e8s) held by the treasury
  // account; `rate` is the fallback rate; `liveRate` is the live-price rate in
  // TTTI-P base units per whole ICP (margin applied), or null when no price.
  public type TreasuryState = {
    icpBalance : Nat;
    mode : TreasuryMode;
    rate : Nat;
    liveRate : ?Nat;
  };

  public type ConversionStatus = {
    #completed; // TTTI-P delivered
    #failed; // refused or ICP collection failed; nothing taken
    #refunded; // ICP taken, delivery failed, ICP refunded (minus ICP fee)
    #refundFailed; // ICP taken, delivery failed, refund also failed
  };

  // What happened to the collected ICP after a successful delivery.
  public type ForwardStatus = {
    #notRequired; // treasury icpAccount is the canister account (or legacy record)
    #pending; // not attempted yet
    #forwarded : Nat; // ICP ledger block index
    #failed : Text; // forwarding failed; the buyer's credit stands
  };

  // One admin-editable on-ramp entry shown on the Buy ICP page.
  public type OnRampLink = {
    name : Text;
    url : Text;
  };

  // One ICP -> TTTI-P conversion record.
  public type Conversion = {
    id : Nat;
    depositor : Principal; // the buyer (ICP payer)
    recipient : Account; // delivery account credited with TTTI-P
    icpAmount : Nat; // ICP e8s requested / collected
    tttiAmount : Nat; // TTTI-P base units (8 decimals)
    status : ConversionStatus;
    timestamp : Timestamp; // nanoseconds
    priceUsdE8 : Nat; // ICP/USD price used, USD * 10^8 (0 if fallback rate used)
    usedFallback : Bool; // true when the admin fallback rate was used
    fromCollector : Nat; // TTTI-P delivered from the fee collector balance
    minted : Nat; // TTTI-P minted for the remainder
    forward : ForwardStatus;
    message : ?Text; // human-readable failure / refund note
  };

  // --- ICP ledger integration (ICRC-1 / ICRC-2) ------------------------------

  public type IcpTransferArgs = {
    from_subaccount : ?Common.Subaccount;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Timestamp;
  };

  public type IcpTransferFromArgs = {
    spender_subaccount : ?Common.Subaccount;
    from : Account;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Timestamp;
  };

  // icrc1_transfer error variants.
  public type IcpTransferError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Timestamp };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  // icrc2_transfer_from error variants (every ICRC-2 variant, so replies decode).
  public type IcpTransferFromError = {
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

  public type IcpTransferResult = {
    #Ok : Nat;
    #Err : IcpTransferError;
  };

  public type IcpTransferFromResult = {
    #Ok : Nat;
    #Err : IcpTransferFromError;
  };

  // Outcome of collecting ICP from the buyer: block index, a ledger error, or a
  // rejected call (caught, never trapped).
  public type CollectResult = {
    #ok : Nat;
    #ledgerError : IcpTransferFromError;
    #callFailed : Text;
  };

  // --- Treasury API results --------------------------------------------------

  public type TreasuryConfigResult = {
    #Ok : TreasuryConfig;
    #Err : Text;
  };

  // Public subset of the treasury configuration (no buyer data, no fallback
  // rate — that is already part of the public presale status).
  public type PublicTreasuryInfo = {
    mode : TreasuryMode;
    marginBps : Nat;
    icpAccount : Account;
  };

  // Outcome of an admin retry of a failed treasury forward: the ICP ledger
  // block index, or the failure reason.
  public type ForwardRetryResult = {
    #ok : Nat;
    #err : Text;
  };
};
