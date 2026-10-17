import Common "common";
import Oracle "oracle";
import Treasury "treasury";

module {
  public type Account = Common.Account;
  public type Timestamp = Common.Timestamp;
  public type Conversion = Treasury.Conversion;

  // --- Presale status --------------------------------------------------------

  // All TTTI-P amounts are base units (8 decimals). `remaining` =
  // allocation - sold - reserved. `complete` = sold >= allocation.
  public type PresaleStatus = {
    allocation : Nat; // 100_000_000 (1 TTTI-P)
    sold : Nat;
    reserved : Nat;
    remaining : Nat;
    complete : Bool;
    minPurchase : Nat; // 10_000 (0.0001 TTTI-P = 1 USD)
    tokenPriceUsd : Nat; // 10_000 USD per whole TTTI-P
    salesPaused : Bool;
    transfersFrozen : Bool;
    fallbackEnabled : Bool;
    fallbackRate : Nat; // TTTI-P base units per whole ICP (config.rate), 0 if unset
    priceUsdE8 : Nat; // ICP/USD * 10^8
    priceUpdatedAt : Timestamp; // nanoseconds, 0 = never
    priceSource : Oracle.PriceSource;
    priceStale : Bool; // older than 5 minutes (or never fetched)
    liveRate : ?Nat; // TTTI-P base units per whole ICP at the cached price, margin applied
  };

  // The three admin switches.
  public type AdminSwitches = {
    salesPaused : Bool;
    transfersFrozen : Bool;
    fallbackEnabled : Bool;
  };

  // --- Purchase pipeline -----------------------------------------------------

  public type PurchaseErrorCode = {
    #anonymousCaller;
    #notConfigured;
    #autoDepositsDisabled;
    #salesPaused; // "Sales are paused"
    #presaleComplete; // "Presale complete"
    #invalidAmount;
    #belowMinimum : { minimumTtti : Nat; requestedTtti : Nat };
    #aboveRemaining : { maximumTtti : Nat; maximumIcpE8s : Nat; requestedTtti : Nat };
    #priceUnavailable; // "Price unavailable — please try again in a moment"
    #approvalMissing : { allowance : Nat }; // "Approval missing or too low: approve amount + 0.0001 ICP fee"
    #insufficientIcp : { balance : Nat };
    #icpLedgerError; // any other ICP ledger error or rejected call
    #deliveryFailedRefunded;
    #deliveryFailedRefundFailed;
    // Exact purchase: the ICP cost at purchase time exceeds the buyer's maximum.
    #priceMoved : { requiredIcpE8s : Nat; maxIcpE8s : Nat };
    // Token transfers are frozen by the admin; no ICP is taken.
    #transfersFrozen; // "Token transfers are currently frozen; purchases are paused"
  };

  // Quote for buying an exact TTTI-P amount. `icpCostE8s` = ICP needed (rounded
  // up); `maxIcpE8s` = cost plus the fixed price protection (`protectionBps`);
  // `priceUsdE8` = 0 when the admin fallback rate is used.
  public type ExactQuote = {
    tttiAmount : Nat;
    icpCostE8s : Nat;
    maxIcpE8s : Nat;
    priceUsdE8 : Nat;
    usedFallback : Bool;
    priceStale : Bool;
    protectionBps : Nat;
  };

  public type ExactQuoteResult = {
    #Ok : ExactQuote;
    #Err : PurchaseError;
  };

  // `message` is the user-facing text. `conversion` is the recorded conversion
  // when one was written (failed / refunded / refundFailed), otherwise null.
  public type PurchaseError = {
    code : PurchaseErrorCode;
    message : Text;
    conversion : ?Conversion;
  };

  public type PurchaseResult = {
    #Ok : Conversion;
    #Err : PurchaseError;
  };

  // --- Delivery address ------------------------------------------------------

  public type DeliveryAddressErrorCode = {
    #anonymousCaller;
    #empty;
    #accountIdentifier; // "This is an account ID; please paste your Principal ID instead"
    #invalidPrincipal;
    #anonymousPrincipal;
  };

  public type DeliveryAddressError = {
    code : DeliveryAddressErrorCode;
    message : Text;
  };

  public type DeliveryAddressResult = {
    #Ok : Account;
    #Err : DeliveryAddressError;
  };

  // --- Balance snapshot export -----------------------------------------------

  public type HolderKind = {
    #holder;
    #feeCollector;
  };

  // `needsMigration` is true when the holder principal has no delivery address
  // (always false for the fee collector).
  public type SnapshotEntry = {
    account : Account;
    balance : Nat;
    deliveryAddress : ?Account;
    needsMigration : Bool;
    kind : HolderKind;
  };

  public type BalanceSnapshot = {
    exportedAt : Timestamp; // nanoseconds
    totalSupply : Nat;
    decimals : Nat8;
    holders : [SnapshotEntry]; // non-zero balances only
  };
};
