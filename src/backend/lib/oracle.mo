import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";
import Char "mo:core/Char";
import Text "mo:core/Text";
import Time "mo:core/Time";
import OutCall "mo:caffeineai-http-outcalls/outcall";
import Oracle "../types/oracle";

module {
  public type IcpPrice = Oracle.IcpPrice;
  public type OracleStatus = Oracle.OracleStatus;
  public type PriceResult = Oracle.PriceResult;
  public type PriceSource = Oracle.PriceSource;

  // Stable oracle state: the last known ICP/USD price (USD * 10^8), its
  // timestamp (ns, 0 = never) and the feed that produced it.
  public type OracleStore = {
    var usdE8 : Nat;
    var updatedAt : Nat64;
    var source : PriceSource;
  };

  // USD price scale: prices are stored as USD * 10^8.
  public let PRICE_SCALE : Nat = 100_000_000;

  // A cached price older than this (5 minutes, in ns) is stale.
  public let STALE_AFTER_NS : Nat = 300_000_000_000;

  // Primary feed: Coinbase spot, JSON `{"data":{"amount":"N.NN",...}}` (string).
  public let COINBASE_URL = "https://api.coinbase.com/v2/prices/ICP-USD/spot";

  // Backup feed: CoinGecko simple price, JSON `{"internet-computer":{"usd":N.NN}}`.
  public let COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd";

  // Response ceiling for the price outcalls (headers included); the bodies are
  // well under 100 bytes.
  let MAX_RESPONSE_BYTES : Nat64 = 16_000;

  // Returns the cached price with status/stale computed against Time.now().
  // Never performs an outcall.
  public func getPrice(store : OracleStore) : IcpPrice {
    let stale = isStale(store);
    let status : OracleStatus = if (store.updatedAt == 0) {
      #unavailable;
    } else if (stale) {
      #stale;
    } else {
      #ok;
    };
    {
      usdE8 = store.usdE8;
      usdMicro = store.usdE8 / 100;
      updatedAt = store.updatedAt;
      status;
      source = store.source;
      stale;
    };
  };

  // True when no price was ever fetched or the price is older than 5 minutes.
  public func isStale(store : OracleStore) : Bool {
    if (store.updatedAt == 0 or store.usdE8 == 0) {
      return true;
    };
    let age : Int = Time.now() - store.updatedAt.toNat();
    age > STALE_AFTER_NS;
  };

  // Fetches Coinbase first, then CoinGecko on any failure; parses the decimal
  // price into USD * 10^8 without Float; updates the store on success. On
  // failure of both feeds the last known price is kept and #Err is returned.
  // Every outcall wrapped in try/catch; no cycles attached; never traps.
  public func refreshPrice(store : OracleStore, transform : OutCall.Transform) : async PriceResult {
    switch (await fetchPrice(COINBASE_URL, "\"amount\":", transform)) {
      case (?usdE8) {
        save(store, usdE8, #coinbase);
        return #Ok(getPrice(store));
      };
      case null {};
    };
    switch (await fetchPrice(COINGECKO_URL, "\"usd\":", transform)) {
      case (?usdE8) {
        save(store, usdE8, #coingecko);
        #Ok(getPrice(store));
      };
      case null {
        #Err("Price unavailable — both price feeds (Coinbase, CoinGecko) failed; the last known price was kept");
      };
    };
  };

  // Refreshes only when the cached price is stale. Returns true when a fresh
  // (not stale) price is available afterwards.
  public func refreshIfStale(store : OracleStore, transform : OutCall.Transform) : async Bool {
    if (isStale(store)) {
      ignore await refreshPrice(store, transform);
    };
    not isStale(store);
  };

  func save(store : OracleStore, usdE8 : Nat, source : PriceSource) {
    store.usdE8 := usdE8;
    store.updatedAt := Time.now().toNat().toNat64();
    store.source := source;
  };

  // GETs `url` and parses the number following `marker`. null on any failure
  // (rejected call, non-200 status, unparsable body, zero price).
  func fetchPrice(url : Text, marker : Text, transform : OutCall.Transform) : async ?Nat {
    try {
      let response = await OutCall.httpRequest({
        url;
        method = #get;
        headers = [{ name = "Accept"; value = "application/json" }];
        body = null;
        maxResponseBytes = MAX_RESPONSE_BYTES;
        transform;
      });
      if (response.status != 200) {
        return null;
      };
      let body = switch (response.body.decodeUtf8()) {
        case (?text) { text };
        case null { return null };
      };
      let parts = body.split(#text marker);
      ignore parts.next();
      switch (parts.next()) {
        case (?rest) {
          switch (parseDecimalE8(rest)) {
            case (?price) { if (price == 0) null else ?price };
            case null { null };
          };
        };
        case null { null };
      };
    } catch (_) {
      null;
    };
  };

  // Parses a leading decimal number (optionally preceded by spaces / a quote)
  // into units of 10^-8, truncating digits beyond the 8th decimal.
  func parseDecimalE8(text : Text) : ?Nat {
    var whole = 0;
    var frac = 0;
    var fracDigits = 0;
    var digits = 0;
    var seenDot = false;
    for (c in text.chars()) {
      let code = c.toNat32().toNat();
      if (code >= 48 and code <= 57) {
        let value : Int = code - 48;
        let d = value.toNat();
        if (seenDot) {
          if (fracDigits < 8) {
            frac := frac * 10 + d;
            fracDigits += 1;
          };
        } else {
          whole := whole * 10 + d;
        };
        digits += 1;
      } else if (c == '.' and not seenDot) {
        seenDot := true;
      } else if (digits == 0 and not seenDot and (c == ' ' or c == '\"')) {
        // skip leading whitespace / opening quote
      } else {
        break;
      };
    };
    if (digits == 0) {
      return null;
    };
    while (fracDigits < 8) {
      frac := frac * 10;
      fracDigits += 1;
    };
    ?(whole * PRICE_SCALE + frac);
  };
};
