import Map "mo:core/Map";
import Principal "mo:core/Principal";
import List "mo:core/List";
import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Nat32 "mo:core/Nat32";
import Int "mo:core/Int";
import Char "mo:core/Char";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Error "mo:core/Error";
import OutCall "mo:caffeineai-http-outcalls/outcall";
import Common "../types/common";
import Presale "../types/presale";
import IcrcLib "icrc";
import TreasuryLib "treasury";
import OracleLib "oracle";

module {
  public type Account = Common.Account;
  public type PresaleStatus = Presale.PresaleStatus;
  public type AdminSwitches = Presale.AdminSwitches;
  public type PurchaseResult = Presale.PurchaseResult;
  public type PurchaseError = Presale.PurchaseError;
  public type DeliveryAddressResult = Presale.DeliveryAddressResult;
  public type DeliveryAddressError = Presale.DeliveryAddressError;
  public type BalanceSnapshot = Presale.BalanceSnapshot;

  // Stable presale state. `sold` = TTTI-P actually delivered by the presale;
  // `reserved` = TTTI-P held for in-flight purchases (reserved before the first
  // await, released on failure, moved to `sold` on success).
  public type PresaleStore = {
    var sold : Nat;
    var reserved : Nat;
    var salesPaused : Bool;
    var fallbackEnabled : Bool;
  };

  // Everything the purchase pipeline touches.
  public type PurchaseContext = {
    presale : PresaleStore;
    treasury : TreasuryLib.TreasuryStore;
    ledger : IcrcLib.Ledger;
    oracle : OracleLib.OracleStore;
    icpLedger : TreasuryLib.IcpLedger;
    transform : OutCall.Transform;
    canister : Principal;
  };

  // Presale allocation: exactly 1 TTTI-P.
  public let ALLOCATION : Nat = 100_000_000;
  // Minimum purchase: 1 USD = 0.0001 TTTI-P.
  public let MIN_PURCHASE : Nat = 10_000;
  // Reference price: 1 TTTI-P = 10 000 USD.
  public let TOKEN_PRICE_USD : Nat = 10_000;

  // --- Status and switches ---------------------------------------------------

  // remaining = ALLOCATION - sold - reserved (saturating at 0).
  public func remaining(presale : PresaleStore) : Nat {
    let used = presale.sold + presale.reserved;
    if (used >= ALLOCATION) {
      return 0;
    };
    let left : Int = ALLOCATION - used;
    left.toNat();
  };

  public func status(presale : PresaleStore, treasury : TreasuryLib.TreasuryStore, ledger : IcrcLib.Ledger, oracle : OracleLib.OracleStore) : PresaleStatus {
    {
      allocation = ALLOCATION;
      sold = presale.sold;
      reserved = presale.reserved;
      remaining = remaining(presale);
      complete = presale.sold >= ALLOCATION;
      minPurchase = MIN_PURCHASE;
      tokenPriceUsd = TOKEN_PRICE_USD;
      salesPaused = presale.salesPaused;
      transfersFrozen = IcrcLib.isFrozen(ledger);
      fallbackEnabled = presale.fallbackEnabled;
      fallbackRate = switch (treasury.config) {
        case (?c) { c.rate };
        case null { 0 };
      };
      priceUsdE8 = oracle.usdE8;
      priceUpdatedAt = oracle.updatedAt;
      priceSource = oracle.source;
      priceStale = OracleLib.isStale(oracle);
      liveRate = TreasuryLib.liveRateFromPrice(treasury, oracle.usdE8);
    };
  };

  public func switches(presale : PresaleStore, ledger : IcrcLib.Ledger) : AdminSwitches {
    {
      salesPaused = presale.salesPaused;
      transfersFrozen = IcrcLib.isFrozen(ledger);
      fallbackEnabled = presale.fallbackEnabled;
    };
  };

  public func setSalesPaused(presale : PresaleStore, paused : Bool) : () {
    presale.salesPaused := paused;
  };

  public func setFallbackEnabled(presale : PresaleStore, enabled : Bool) : () {
    presale.fallbackEnabled := enabled;
  };

  // --- Purchase pipeline -----------------------------------------------------

  func failure(code : Presale.PurchaseErrorCode, message : Text) : PurchaseError {
    { code; message; conversion = null };
  };

  func refuse(code : Presale.PurchaseErrorCode, message : Text) : PurchaseResult {
    #Err(failure(code, message));
  };

  let PRICE_UNAVAILABLE : Text = "Price unavailable — please try again in a moment";
  let TRANSFERS_FROZEN : Text = "Token transfers are currently frozen; purchases are paused";

  // Refusal for a paused or completed presale, or null when sales are open.
  func gate(presale : PresaleStore) : ?PurchaseError {
    if (presale.salesPaused) {
      return ?failure(#salesPaused, "Sales are paused");
    };
    if (presale.sold >= ALLOCATION) {
      return ?failure(#presaleComplete, "Presale complete");
    };
    null;
  };

  // Minimum / remaining refusal for `requested` TTTI-P, or null when allowed.
  // A request below the minimum is allowed when it takes the whole remainder.
  // `phrase` precedes the requested amount in the message.
  func limitError(requested : Nat, rem : Nat, maxIcp : Nat, phrase : Text) : ?PurchaseError {
    if (requested < MIN_PURCHASE and requested < rem) {
      return ?{
        code = #belowMinimum({ minimumTtti = MIN_PURCHASE; requestedTtti = requested });
        message = "Minimum purchase is 0.0001 TTTI-P (1 USD); " # phrase # " " # TreasuryLib.formatE8(requested) # " TTTI-P";
        conversion = null;
      };
    };
    if (requested > rem or rem == 0) {
      return ?{
        code = #aboveRemaining({
          maximumTtti = rem;
          maximumIcpE8s = maxIcp;
          requestedTtti = requested;
        });
        message = "Only " # TreasuryLib.formatE8(rem) # " TTTI-P is available right now (about " # TreasuryLib.formatE8(maxIcp) # " ICP); " # phrase # " " # TreasuryLib.formatE8(requested) # " TTTI-P";
        conversion = null;
      };
    };
    null;
  };

  // ICP (e8s, rounded up) needed for exactly `ttti` TTTI-P with the live price
  // or, when `useFallback`, the admin fallback rate. null when no usable price.
  func exactCost(config : TreasuryLib.TreasuryConfig, useFallback : Bool, usdE8 : Nat, ttti : Nat) : ?Nat {
    if (useFallback) {
      TreasuryLib.icpForExactTttiFallback(ttti, config.rate);
    } else {
      TreasuryLib.icpForExactTtti(ttti, usdE8, config.marginBps);
    };
  };

  // Read-only quote for buying exactly `tttiAmount` TTTI-P at the stored price
  // (no outcall). Fallback rate only when enabled, rate > 0 and the price is
  // stale or missing; otherwise the last known live price is quoted (flagged
  // `priceStale`; the purchase refreshes it). Same refusals as a purchase.
  public func quoteExact(presale : PresaleStore, treasury : TreasuryLib.TreasuryStore, oracle : OracleLib.OracleStore, tttiAmount : Nat) : Presale.ExactQuoteResult {
    let config = switch (treasury.config) {
      case (?c) { c };
      case null {
        return #Err(failure(#notConfigured, "The presale treasury is not configured yet"));
      };
    };
    if (tttiAmount == 0) {
      return #Err(failure(#invalidAmount, "Enter a TTTI-P amount greater than 0"));
    };
    switch (gate(presale)) {
      case (?refused) { return #Err(refused) };
      case null {};
    };
    let priceStale = OracleLib.isStale(oracle);
    let useFallback = priceStale and presale.fallbackEnabled and config.rate > 0;
    let usdE8 = oracle.usdE8;
    let cost = exactCost(config, useFallback, usdE8, tttiAmount) ?? (return #Err(failure(#priceUnavailable, PRICE_UNAVAILABLE)));
    let rem = remaining(presale);
    switch (limitError(tttiAmount, rem, exactCost(config, useFallback, usdE8, rem) ?? 0, "you requested")) {
      case (?refused) { return #Err(refused) };
      case null {};
    };
    #Ok({
      tttiAmount;
      icpCostE8s = cost;
      maxIcpE8s = TreasuryLib.maxIcpFor(cost);
      priceUsdE8 = if (useFallback) 0 else usdE8;
      usedFallback = useFallback;
      priceStale;
      protectionBps = TreasuryLib.EXACT_PRICE_PROTECTION_BPS;
    });
  };

  // Returns `amount` of reserved TTTI-P to the pool (saturating at 0).
  func release(presale : PresaleStore, amount : Nat) {
    if (presale.reserved > amount) {
      let left : Int = presale.reserved - amount;
      presale.reserved := left.toNat();
    } else {
      presale.reserved := 0;
    };
  };

  // What the buyer asked for: spend an ICP amount, or receive exactly
  // `tttiAmount` TTTI-P paying at most `maxIcpE8s`.
  type Request = {
    #icp : Nat;
    #exact : { tttiAmount : Nat; maxIcpE8s : Nat };
  };

  // ICP-amount purchase (convertDeposit / handleDeposit).
  public func purchase(ctx : PurchaseContext, buyer : Principal, recipient : ?Account, icpAmount : Nat) : async PurchaseResult {
    await* run(ctx, buyer, recipient, #icp(icpAmount));
  };

  // Exact TTTI-P purchase (buyExactTtti): the ICP cost is computed (rounded
  // up) at purchase time; refused with #priceMoved before any ICP is taken
  // when it exceeds `maxIcpE8s`. Only the cost is collected, never the cap.
  public func purchaseExact(ctx : PurchaseContext, buyer : Principal, recipient : ?Account, tttiAmount : Nat, maxIcpE8s : Nat) : async PurchaseResult {
    await* run(ctx, buyer, recipient, #exact({ tttiAmount; maxIcpE8s }));
  };

  // Shared purchase pipeline.
  // Order: caller not anonymous -> configured -> amount > 0 -> not paused ->
  // not complete -> transfers not frozen -> (exact: backend quote at the
  // stored price) -> refresh price if stale (OracleLib.refreshIfStale) ->
  // gate and freeze checks again -> if
  // still stale and fallback disabled refuse #priceUnavailable -> price the
  // request (ICP amount: single-floor TTTI-P; exact: ceiling ICP cost) ->
  // minimum / remaining checks -> exact only: cost <= min(maxIcpE8s,
  // maxIcpFor(backend quote)) -> RESERVE
  // (before the first ICP await) -> TreasuryLib.collectIcp into { owner =
  // canister; subaccount = null } -> IcrcLib.deliverFromCollectorOrMint to the
  // delivery account (`recipient` ?? stored delivery address ?? buyer) -> on
  // delivery failure refund (minus ICP_FEE) and record #refunded /
  // #refundFailed -> on success commit reserved -> sold, record #completed,
  // then forward ICP to the treasury icpAccount (failure recorded in
  // `forward`, credit stands). Reservation is released on every failure path.
  // Never traps.
  func run(ctx : PurchaseContext, buyer : Principal, recipient : ?Account, request : Request) : async* PurchaseResult {
    if (buyer.isAnonymous()) {
      return refuse(#anonymousCaller, "Please sign in to buy TTTI-P");
    };
    let config = switch (ctx.treasury.config) {
      case (?c) { c };
      case null {
        return refuse(#notConfigured, "The presale treasury is not configured yet");
      };
    };
    switch (request) {
      case (#icp(amount)) {
        if (amount == 0) {
          return refuse(#invalidAmount, "Enter an ICP amount greater than 0");
        };
      };
      case (#exact(r)) {
        if (r.tttiAmount == 0) {
          return refuse(#invalidAmount, "Enter a TTTI-P amount greater than 0");
        };
      };
    };
    switch (gate(ctx.presale)) {
      case (?refused) { return #Err(refused) };
      case null {};
    };
    if (IcrcLib.isFrozen(ctx.ledger)) {
      return refuse(#transfersFrozen, TRANSFERS_FROZEN);
    };

    // Exact purchases: the backend's own quote at the stored (pre-refresh)
    // price, decided exactly like quoteExactTtti. null when no stored price;
    // the fresh-price cost is then the reference.
    let quotedCost : ?Nat = switch (request) {
      case (#exact(r)) {
        let useStoredFallback = OracleLib.isStale(ctx.oracle) and ctx.presale.fallbackEnabled and config.rate > 0;
        exactCost(config, useStoredFallback, ctx.oracle.usdE8, r.tttiAmount);
      };
      case (#icp(_)) { null };
    };

    // Refresh the price when older than 5 minutes (may await an outcall).
    let fresh = try {
      await OracleLib.refreshIfStale(ctx.oracle, ctx.transform);
    } catch (_) {
      false;
    };
    // State may have changed while the price was refreshed.
    switch (gate(ctx.presale)) {
      case (?refused) { return #Err(refused) };
      case null {};
    };
    if (IcrcLib.isFrozen(ctx.ledger)) {
      return refuse(#transfersFrozen, TRANSFERS_FROZEN);
    };

    let usdE8 = ctx.oracle.usdE8;
    let usedFallback = not fresh;
    if (usedFallback and not (ctx.presale.fallbackEnabled and config.rate > 0)) {
      return refuse(#priceUnavailable, PRICE_UNAVAILABLE);
    };
    let priceUsed = if (usedFallback) 0 else usdE8;
    let rem = remaining(ctx.presale);

    let (ttti, icpAmount) = switch (request) {
      case (#icp(amount)) {
        let converted = if (usedFallback) {
          TreasuryLib.tttiFromFallback(amount, config.rate);
        } else {
          TreasuryLib.tttiFromPrice(amount, usdE8, config.marginBps);
        };
        let maxIcp = if (usedFallback) {
          rem * TreasuryLib.ICP_DECIMALS / config.rate;
        } else {
          TreasuryLib.icpForTtti(rem, usdE8, config.marginBps);
        };
        switch (limitError(converted, rem, maxIcp, "this amount converts to")) {
          case (?refused) { return #Err(refused) };
          case null {};
        };
        (converted, amount);
      };
      case (#exact({ tttiAmount; maxIcpE8s })) {
        let cost = exactCost(config, usedFallback, usdE8, tttiAmount) ?? (return refuse(#priceUnavailable, PRICE_UNAVAILABLE));
        switch (limitError(tttiAmount, rem, exactCost(config, usedFallback, usdE8, rem) ?? 0, "you requested")) {
          case (?refused) { return #Err(refused) };
          case null {};
        };
        // Server-side 2% protection: the effective limit is the smaller of the
        // caller's maximum and the backend quote plus the fixed protection, so
        // a larger caller maximum never widens it.
        let limit = Nat.min(maxIcpE8s, TreasuryLib.maxIcpFor(quotedCost ?? cost));
        if (cost > limit) {
          return refuse(
            #priceMoved({ requiredIcpE8s = cost; maxIcpE8s = limit }),
            "Price moved above your approved maximum — no ICP was taken, please retry",
          );
        };
        (tttiAmount, cost);
      };
    };

    // Reserve synchronously, before the first ICP ledger await, so concurrent
    // purchases can never together exceed the allocation.
    ctx.presale.reserved += ttti;

    let canisterAccount : Account = { owner = ctx.canister; subaccount = null };
    let collected : TreasuryLib.CollectResult = try {
      await TreasuryLib.collectIcp(ctx.icpLedger, buyer, canisterAccount, icpAmount);
    } catch (e) {
      #callFailed(e.message());
    };
    switch (collected) {
      case (#ok(_)) {};
      case (#ledgerError(err)) {
        release(ctx.presale, ttti);
        let code : Presale.PurchaseErrorCode = switch (err) {
          case (#InsufficientAllowance({ allowance })) {
            #approvalMissing({ allowance });
          };
          case (#InsufficientFunds({ balance })) { #insufficientIcp({ balance }) };
          case (_) { #icpLedgerError };
        };
        return #Err({
          code;
          message = TreasuryLib.transferFromErrorMessage(err);
          conversion = null;
        });
      };
      case (#callFailed(reason)) {
        release(ctx.presale, ttti);
        return refuse(#icpLedgerError, "The ICP ledger could not be reached; no ICP was taken (" # reason # ")");
      };
    };

    // ICP is now held by the canister: every outcome below is recorded.
    let to : Account = switch (recipient) {
      case (?r) { r };
      case null {
        ctx.treasury.depositRecipients.get(buyer) ?? ({
          owner = buyer;
          subaccount = null;
        });
      };
    };
    let base : TreasuryLib.Conversion = {
      id = 0;
      depositor = buyer;
      recipient = to;
      icpAmount;
      tttiAmount = ttti;
      status = #completed;
      timestamp = 0;
      priceUsdE8 = priceUsed;
      usedFallback;
      fromCollector = 0;
      minted = 0;
      forward = #notRequired;
      message = null;
    };

    switch (IcrcLib.deliverFromCollectorOrMint(ctx.ledger, ctx.canister, to, ttti)) {
      case (#err(reason)) {
        release(ctx.presale, ttti);
        let refund : { #ok : Nat; #err : Text } = try {
          await TreasuryLib.refundIcp(ctx.icpLedger, buyer, icpAmount);
        } catch (e) {
          #err(e.message());
        };
        let (status, code, message) : (TreasuryLib.ConversionStatus, Presale.PurchaseErrorCode, Text) = switch (refund) {
          case (#ok(_)) {
            (#refunded, #deliveryFailedRefunded, "TTTI-P delivery failed (" # reason # "); your ICP was refunded minus the 0.0001 ICP fee");
          };
          case (#err(refundReason)) {
            (#refundFailed, #deliveryFailedRefundFailed, "TTTI-P delivery failed (" # reason # ") and the ICP refund also failed (" # refundReason # "); please contact support with this conversion");
          };
        };
        let recorded = TreasuryLib.recordConversion(ctx.treasury, { base with status; message = ?message });
        #Err({ code; message; conversion = ?recorded });
      };
      case (#ok(delivery)) {
        release(ctx.presale, ttti);
        ctx.presale.sold += ttti;
        let target = config.icpAccount;
        let needsForward = target != canisterAccount;
        let pending : TreasuryLib.ForwardStatus = if (needsForward) #pending else #notRequired;
        let recorded = TreasuryLib.recordConversion(
          ctx.treasury,
          {
            base with fromCollector = delivery.fromCollector;
            minted = delivery.minted;
            forward = pending;
          },
        );
        if (not needsForward) {
          return #Ok(recorded);
        };
        // Forward the collected ICP to the treasury; a failure is recorded and
        // never undoes the buyer's credit.
        let forward : TreasuryLib.ForwardStatus = try {
          await TreasuryLib.forwardIcp(ctx.icpLedger, canisterAccount, target, icpAmount);
        } catch (e) {
          #failed(e.message());
        };
        let note : ?Text = switch (forward) {
          case (#failed(reason)) { ?("ICP forwarding to the treasury failed: " # reason) };
          case (_) { null };
        };
        let forwarded : TreasuryLib.Conversion = { recorded with forward; message = note };
        TreasuryLib.updateConversion(ctx.treasury, forwarded);
        #Ok(forwarded);
      };
    };
  };

  // --- Delivery address ------------------------------------------------------

  func addressError(code : Presale.DeliveryAddressErrorCode, message : Text) : DeliveryAddressError {
    { code; message };
  };

  func isHex(text : Text) : Bool {
    text.chars().all(func c = (c >= '0' and c <= '9') or (c >= 'a' and c <= 'f') or (c >= 'A' and c <= 'F'));
  };

  // Validates principal text without trapping (base32 + CRC32 round-trip via
  // Principal.fromBlob(...).toText() == input). Rejects empty text, a
  // 64-hex-character legacy account identifier ("This is an account ID; please
  // paste your Principal ID instead"), invalid text and the anonymous principal.
  public func parseDeliveryAddress(text : Text) : { #ok : Principal; #err : DeliveryAddressError } {
    let trimmed = text.trim(#predicate(func c = c == ' ' or c == '\t' or c == '\n' or c == '\r'));
    if (trimmed.size() == 0) {
      return #err(addressError(#empty, "Please paste your Principal ID"));
    };
    if (trimmed.size() == 64 and isHex(trimmed)) {
      return #err(addressError(#accountIdentifier, "This is an account ID; please paste your Principal ID instead"));
    };
    let invalid = addressError(#invalidPrincipal, "This is not a valid Principal ID; please check it and paste it again");
    let lower = trimmed.toLower();

    // Base32 (RFC 4648, lowercase, no padding) decode, ignoring dashes.
    let bytes = List.empty<Nat8>();
    var buffer = 0;
    var bits = 0;
    for (c in lower.chars()) {
      if (c != '-') {
        let code = c.toNat32().toNat();
        let value : Int = if (code >= 97 and code <= 122) {
          code - 97;
        } else if (code >= 50 and code <= 55) {
          code - 24;
        } else {
          -1;
        };
        if (value < 0) {
          return #err(invalid);
        };
        buffer := buffer * 32 + value.toNat();
        bits += 5;
        if (bits >= 8) {
          let rest : Int = bits - 8;
          bits := rest.toNat();
          let divisor = 2 ** bits;
          bytes.add((buffer / divisor).toNat8());
          buffer := buffer % divisor;
        };
      };
    };
    // 4 CRC32 bytes + 1..29 principal bytes.
    if (bytes.size() < 5 or bytes.size() > 33) {
      return #err(invalid);
    };
    let body = List.empty<Nat8>();
    var index = 0;
    for (b in bytes.values()) {
      if (index >= 4) {
        body.add(b);
      };
      index += 1;
    };
    let principal = Principal.fromBlob(body.toArray().toBlob());
    // The canonical text re-encodes the CRC and dash grouping.
    if (principal.toText() != lower) {
      return #err(invalid);
    };
    if (principal.isAnonymous()) {
      return #err(addressError(#anonymousPrincipal, "The anonymous principal cannot receive TTTI-P; please paste your own Principal ID"));
    };
    #ok(principal);
  };

  // Stores { owner = parsed; subaccount = null } for `caller` (anonymous caller refused).
  public func setDeliveryAddress(addresses : Map.Map<Principal, Account>, caller : Principal, text : Text) : DeliveryAddressResult {
    if (caller.isAnonymous()) {
      return #Err(addressError(#anonymousCaller, "Please sign in to set a delivery address"));
    };
    switch (parseDeliveryAddress(text)) {
      case (#ok(owner)) {
        let account : Account = { owner; subaccount = null };
        addresses.add(caller, account);
        #Ok(account);
      };
      case (#err(err)) { #Err(err) };
    };
  };

  public func getDeliveryAddress(addresses : Map.Map<Principal, Account>, caller : Principal) : ?Account {
    addresses.get(caller);
  };

  // Returns true when an address was removed.
  public func clearDeliveryAddress(addresses : Map.Map<Principal, Account>, caller : Principal) : Bool {
    switch (addresses.take(caller)) {
      case (?_) { true };
      case null { false };
    };
  };

  // --- Balance snapshot ------------------------------------------------------

  // Built from IcrcLib.listBalances: non-zero balances, delivery address per
  // holder principal, needsMigration = no delivery address (false for the fee
  // collector, which is labeled #feeCollector).
  public func snapshot(ledger : IcrcLib.Ledger, canister : Principal, addresses : Map.Map<Principal, Account>) : BalanceSnapshot {
    let feeCollector = IcrcLib.feeCollectorAccount(canister);
    func entry(holding : IcrcLib.HolderBalance) : Presale.SnapshotEntry {
      if (holding.account == feeCollector) {
        {
          account = holding.account;
          balance = holding.balance;
          deliveryAddress = null;
          needsMigration = false;
          kind = #feeCollector;
        };
      } else {
        let deliveryAddress = addresses.get(holding.account.owner);
        {
          account = holding.account;
          balance = holding.balance;
          deliveryAddress;
          needsMigration = deliveryAddress == null;
          kind = #holder;
        };
      };
    };
    {
      exportedAt = Time.now().toNat().toNat64();
      totalSupply = IcrcLib.totalSupply(ledger);
      decimals = IcrcLib.decimals();
      holders = IcrcLib.listBalances(ledger).filter(func h = h.balance > 0).map(entry);
    };
  };
};
