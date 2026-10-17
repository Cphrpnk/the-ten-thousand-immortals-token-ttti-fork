import Common "common";

module {
  // ICP/USD price oracle domain types (Coinbase primary, CoinGecko backup).

  public type Timestamp = Common.Timestamp;

  // Which feed produced the cached price. #none until the first refresh.
  public type PriceSource = {
    #none;
    #coinbase;
    #coingecko;
  };

  // `#ok` when a price exists and is fresh (<= 5 minutes old), `#stale` when
  // the cached price is older than 5 minutes, `#unavailable` when no price has
  // ever been fetched.
  public type OracleStatus = {
    #ok;
    #stale;
    #unavailable;
  };

  // The cached ICP/USD price.
  // `usdE8` is the USD price of 1 whole ICP scaled by 10^8 (PRICE_SCALE).
  // `usdMicro` is the same price in micro-USD (usdE8 / 100), kept for clients.
  // `updatedAt` is the nanosecond timestamp of the last successful refresh.
  // `stale` is true when updatedAt is 0 or older than 5 minutes.
  public type IcpPrice = {
    usdE8 : Nat;
    usdMicro : Nat;
    updatedAt : Timestamp;
    status : OracleStatus;
    source : PriceSource;
    stale : Bool;
  };

  // Result of an explicit refresh: the new price or an error message.
  public type PriceResult = {
    #Ok : IcpPrice;
    #Err : Text;
  };
};
