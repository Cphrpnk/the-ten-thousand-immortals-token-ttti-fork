import Map "mo:core/Map";
import Set "mo:core/Set";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Error "mo:core/Error";
import Treasury "../types/treasury";

module {
  public type TreasuryConfig = Treasury.TreasuryConfig;
  public type TreasuryMode = Treasury.TreasuryMode;
  public type TreasuryState = Treasury.TreasuryState;
  public type Conversion = Treasury.Conversion;
  public type ConversionStatus = Treasury.ConversionStatus;
  public type ForwardStatus = Treasury.ForwardStatus;
  public type TreasuryConfigResult = Treasury.TreasuryConfigResult;
  public type Account = Treasury.Account;
  public type OnRampLink = Treasury.OnRampLink;
  public type CollectResult = Treasury.CollectResult;
  public type PublicTreasuryInfo = Treasury.PublicTreasuryInfo;
  public type ForwardRetryResult = Treasury.ForwardRetryResult;

  // The ICP ledger canister (mainnet) exposed through its ICRC-1 interface.
  public func icpLedger() : Principal = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");

  // ICP ICRC-1/ICRC-2 interface. Error variants include every ICRC-2
  // transfer_from variant (InsufficientAllowance etc.) so replies decode.
  public type IcpLedger = actor {
    icrc1_balance_of : shared query ({ owner : Principal; subaccount : ?Blob }) -> async Nat;
    icrc1_transfer : shared Treasury.IcpTransferArgs -> async Treasury.IcpTransferResult;
    icrc2_transfer_from : shared Treasury.IcpTransferFromArgs -> async Treasury.IcpTransferFromResult;
  };

  // ICP base units per whole ICP (8 decimals).
  public let ICP_DECIMALS : Nat = 100_000_000;

  // ICP ledger transfer fee in e8s (0.0001 ICP).
  public let ICP_FEE : Nat = 10_000;

  // Denominator of the live-price conversion: ICP e8s (10^8) * USD price scale
  // (10^8) * TTTI-P price in USD (10^4) * basis points (10^4) = 10^24. The
  // numerator carries the TTTI-P base units per token (10^8).
  let LIVE_DENOMINATOR : Nat = 1_000_000_000_000_000_000_000_000;

  // Stable treasury state. `depositRecipients` is the per-caller optional
  // delivery address map (principal -> { owner; subaccount = null }).
  public type TreasuryStore = {
    var config : ?TreasuryConfig;
    var conversions : Map.Map<Nat, Conversion>;
    var nextConversionId : Nat;
    var depositRecipients : Map.Map<Principal, Account>;
    var onRampLinks : [OnRampLink];
  };

  // --- Configuration ---------------------------------------------------------

  public func getConfig(store : TreasuryStore) : ?TreasuryConfig {
    store.config;
  };

  // Maximum live-price safety margin: 2000 bps = 20%. Live pricing can never
  // be zeroed by the margin.
  public let MAX_MARGIN_BPS : Nat = 2_000;

  // Validates and stores the configuration: marginBps in 0..MAX_MARGIN_BPS and
  // a fallback rate > 0. Invalid configs are refused and nothing is stored.
  public func setConfig(store : TreasuryStore, config : TreasuryConfig) : TreasuryConfigResult {
    if (config.marginBps > MAX_MARGIN_BPS) {
      return #Err("The safety margin must be between 0 and 2000 basis points (0% to 20%)");
    };
    if (config.rate == 0) {
      return #Err("The fallback rate must be greater than 0");
    };
    store.config := ?config;
    #Ok(config);
  };

  // What the Exchange and Buy ICP pages need; null when not configured.
  public func publicInfo(store : TreasuryStore) : ?PublicTreasuryInfo {
    switch (store.config) {
      case (?c) { ?{ mode = c.mode; marginBps = c.marginBps; icpAccount = c.icpAccount } };
      case null { null };
    };
  };

  // --- State -----------------------------------------------------------------

  // Reads the live ICP balance of the configured treasury account owner from
  // the ICP ledger. Returns 0 when the treasury is not configured or the call
  // fails. `liveRate` is passed through.
  public func getState(store : TreasuryStore, icpLedger : IcpLedger, liveRate : ?Nat) : async TreasuryState {
    let config = store.config;
    let (icpBalance, mode, rate) = switch (config) {
      case (null) { (0, #manual, 0) };
      case (?c) {
        let balance = await getIcpBalance(icpLedger, c.icpAccount.owner);
        (balance, c.mode, c.rate);
      };
    };
    { icpBalance; mode; rate; liveRate };
  };

  public func getConversions(store : TreasuryStore) : [Conversion] {
    store.conversions.values().toArray();
  };

  func isFailedForward(conversion : Conversion) : Bool {
    switch (conversion.forward) {
      case (#failed(_)) { true };
      case (_) { false };
    };
  };

  // Conversions whose ICP forward to the treasury failed.
  public func failedForwards(store : TreasuryStore) : [Conversion] {
    store.conversions.values().filter(isFailedForward).toArray();
  };

  // Retries the treasury forward of conversion `conversionId` (same amount as
  // the original: icpAmount - ICP_FEE to config.icpAccount). Only a #failed
  // forward is retried; it is marked #pending (and added to the transient
  // `inFlight` guard) before the ledger await, so concurrent calls can never
  // forward twice. Ends as #forwarded(blockIndex) or #failed(reason).
  public func retryForward(store : TreasuryStore, icpLedger : IcpLedger, canisterAccount : Account, inFlight : Set.Set<Nat>, conversionId : Nat) : async ForwardRetryResult {
    let config = store.config ?? (return #err("The treasury is not configured"));
    let conversion = store.conversions.get(conversionId) ?? (return #err("Conversion not found"));
    if (not isFailedForward(conversion)) {
      return #err("Only a failed treasury forward can be retried");
    };
    if (inFlight.contains(conversionId)) {
      return #err("A retry for this conversion is already in progress");
    };
    let target = config.icpAccount;
    if (target == canisterAccount) {
      return #err("The treasury account is the canister's own account; nothing to forward");
    };
    inFlight.add(conversionId);
    updateConversion(store, { conversion with forward = #pending });
    let forward : ForwardStatus = try {
      await forwardIcp(icpLedger, canisterAccount, target, conversion.icpAmount);
    } catch (e) {
      #failed(e.message());
    };
    inFlight.remove(conversionId);
    let latest = store.conversions.get(conversionId) ?? conversion;
    switch (forward) {
      case (#forwarded(blockIndex)) {
        updateConversion(store, { latest with forward; message = null });
        #ok(blockIndex);
      };
      case (#failed(reason)) {
        updateConversion(store, { latest with forward; message = ?("ICP forwarding to the treasury failed: " # reason) });
        #err(reason);
      };
      case (_) {
        let reason = "The treasury forward did not complete";
        updateConversion(store, { latest with forward = #failed(reason); message = ?("ICP forwarding to the treasury failed: " # reason) });
        #err(reason);
      };
    };
  };

  // --- On-ramp links ---------------------------------------------------------

  // The default on-ramp directory: the Onramper aggregator first, then the
  // individual providers. Served when the admin has not set a custom list.
  let defaultOnRampLinks : [OnRampLink] = [
    { name = "Onramper"; url = "https://onramper.com" },
    { name = "Coinbase"; url = "https://www.coinbase.com/how-to-buy/internet-computer" },
    { name = "Binance"; url = "https://www.binance.com" },
  ];

  public func getOnRampLinks(store : TreasuryStore) : [OnRampLink] {
    if (store.onRampLinks.size() == 0) {
      defaultOnRampLinks;
    } else {
      store.onRampLinks;
    };
  };

  public func setOnRampLinks(store : TreasuryStore, links : [OnRampLink]) : () {
    store.onRampLinks := links;
  };

  // Reads the live ICP balance of `owner` from the ICP ledger. Returns 0 when
  // the ledger call fails.
  public func getIcpBalance(icpLedger : IcpLedger, owner : Principal) : async Nat {
    try {
      await icpLedger.icrc1_balance_of({ owner; subaccount = null });
    } catch (_) {
      0;
    };
  };

  // --- Conversion records ----------------------------------------------------

  // Stores `conversion` under a fresh id (store.nextConversionId) with
  // timestamp = now; the input's id and timestamp are ignored. Returns the
  // stored record.
  public func recordConversion(store : TreasuryStore, conversion : Conversion) : Conversion {
    let id = store.nextConversionId;
    store.nextConversionId += 1;
    let stored = { conversion with id; timestamp = Time.now().toNat().toNat64() };
    store.conversions.add(id, stored);
    stored;
  };

  // Replaces the stored record with the same id (e.g. forward status update).
  public func updateConversion(store : TreasuryStore, conversion : Conversion) : () {
    store.conversions.add(conversion.id, conversion);
  };

  // --- Conversion math -------------------------------------------------------

  // 10_000 - marginBps, or 0 when the margin is out of range.
  func keptBps(marginBps : Nat) : Nat {
    if (marginBps >= 10_000) {
      return 0;
    };
    let kept : Int = 10_000 - marginBps;
    kept.toNat();
  };

  // Live price: floor(icpE8s * priceUsdE8 * (10_000 - marginBps) * 10^8 /
  // (10^8 * 10^8 * 10_000 * 10_000)) — Nat, single final division.
  // Returns 0 when marginBps >= 10_000.
  public func tttiFromPrice(icpE8s : Nat, priceUsdE8 : Nat, marginBps : Nat) : Nat {
    icpE8s * priceUsdE8 * keptBps(marginBps) * ICP_DECIMALS / LIVE_DENOMINATOR;
  };

  // Fallback: floor(icpE8s * rate / 10^8), rate in TTTI-P base units per ICP.
  public func tttiFromFallback(icpE8s : Nat, rate : Nat) : Nat {
    icpE8s * rate / ICP_DECIMALS;
  };

  // TTTI-P base units per whole ICP at `usdE8`, margin applied; null when the
  // price is 0 or the margin is out of range.
  public func liveRateFromPrice(store : TreasuryStore, usdE8 : Nat) : ?Nat {
    let marginBps = switch (store.config) {
      case (?c) { c.marginBps };
      case null { 0 };
    };
    if (usdE8 == 0 or marginBps >= 10_000) {
      return null;
    };
    ?tttiFromPrice(ICP_DECIMALS, usdE8, marginBps);
  };

  // Largest ICP amount (e8s) whose live-price conversion does not exceed
  // `tttiAmount` (used to tell the maximum available). 0 when no price.
  public func icpForTtti(tttiAmount : Nat, priceUsdE8 : Nat, marginBps : Nat) : Nat {
    let perE8 = priceUsdE8 * keptBps(marginBps) * ICP_DECIMALS;
    if (perE8 == 0) {
      return 0;
    };
    tttiAmount * LIVE_DENOMINATOR / perE8;
  };

  // Fixed price protection for exact TTTI-P purchases (2%). Buyers cannot
  // change it: the approval / maximum ICP is the quoted cost plus this margin.
  public let EXACT_PRICE_PROTECTION_BPS : Nat = 200;

  // ceil(n / d) for d > 0.
  func ceilDiv(n : Nat, d : Nat) : Nat {
    let q = n / d;
    if (q * d == n) q else q + 1;
  };

  // Smallest ICP amount (e8s) whose live-price conversion yields at least
  // `tttiAmount`: ceil(T * 10^16 / (usdE8 * (10_000 - marginBps))), i.e.
  // ceil(T * LIVE_DENOMINATOR / (usdE8 * kept * 10^8)). null when the price is
  // 0 or the margin leaves nothing.
  public func icpForExactTtti(tttiAmount : Nat, priceUsdE8 : Nat, marginBps : Nat) : ?Nat {
    let perE8 = priceUsdE8 * keptBps(marginBps) * ICP_DECIMALS;
    if (perE8 == 0) {
      return null;
    };
    ?ceilDiv(tttiAmount * LIVE_DENOMINATOR, perE8);
  };

  // Smallest ICP amount (e8s) whose fallback conversion yields at least
  // `tttiAmount`: ceil(T * 10^8 / rate). null when the rate is 0.
  public func icpForExactTttiFallback(tttiAmount : Nat, rate : Nat) : ?Nat {
    if (rate == 0) {
      return null;
    };
    ?ceilDiv(tttiAmount * ICP_DECIMALS, rate);
  };

  // Maximum ICP (e8s) a buyer approves for an exact purchase costing `cost`:
  // ceil(cost * (10_000 + EXACT_PRICE_PROTECTION_BPS) / 10_000).
  public func maxIcpFor(cost : Nat) : Nat {
    ceilDiv(cost * (10_000 + EXACT_PRICE_PROTECTION_BPS), 10_000);
  };

  // `amount` minus the ICP fee, or 0 when the amount does not cover it.
  func minusFee(amount : Nat) : Nat {
    if (amount <= ICP_FEE) {
      return 0;
    };
    let net : Int = amount - ICP_FEE;
    net.toNat();
  };

  // Formats an 8-decimal base-unit amount (ICP e8s or TTTI-P) as a decimal.
  public func formatE8(amount : Nat) : Text {
    let whole = amount / 100_000_000;
    let frac = amount % 100_000_000;
    if (frac == 0) {
      return whole.toText();
    };
    var digits = frac.toText();
    while (digits.size() < 8) {
      digits := "0" # digits;
    };
    whole.toText() # "." # digits.trimEnd(#char '0');
  };

  // --- ICP ledger calls (all try/catch, never trap, no cycles) ---------------

  // icrc2_transfer_from(buyer -> canisterAccount, icpAmount), canister is the spender.
  public func collectIcp(icpLedger : IcpLedger, buyer : Principal, canisterAccount : Account, icpAmount : Nat) : async CollectResult {
    try {
      let result = await icpLedger.icrc2_transfer_from({
        spender_subaccount = null;
        from = { owner = buyer; subaccount = null };
        to = canisterAccount;
        amount = icpAmount;
        fee = null;
        memo = null;
        created_at_time = null;
      });
      switch (result) {
        case (#Ok(blockIndex)) { #ok(blockIndex) };
        case (#Err(err)) { #ledgerError(err) };
      };
    } catch (e) {
      #callFailed(e.message());
    };
  };

  // icrc1_transfer(canister -> buyer, icpAmount - ICP_FEE). #ok(blockIndex) or #err(message).
  public func refundIcp(icpLedger : IcpLedger, buyer : Principal, icpAmount : Nat) : async { #ok : Nat; #err : Text } {
    let amount = minusFee(icpAmount);
    if (amount == 0) {
      return #err("the amount does not cover the 0.0001 ICP ledger fee");
    };
    try {
      let result = await icpLedger.icrc1_transfer({
        from_subaccount = null;
        to = { owner = buyer; subaccount = null };
        amount;
        fee = null;
        memo = null;
        created_at_time = null;
      });
      switch (result) {
        case (#Ok(blockIndex)) { #ok(blockIndex) };
        case (#Err(err)) { #err(transferErrorMessage(err)) };
      };
    } catch (e) {
      #err("the ICP ledger could not be reached: " # e.message());
    };
  };

  // icrc1_transfer(canister -> target, icpAmount - ICP_FEE) when target differs
  // from canisterAccount; #notRequired otherwise.
  public func forwardIcp(icpLedger : IcpLedger, canisterAccount : Account, target : Account, icpAmount : Nat) : async ForwardStatus {
    if (target == canisterAccount) {
      return #notRequired;
    };
    let amount = minusFee(icpAmount);
    if (amount == 0) {
      return #failed("The amount does not cover the 0.0001 ICP ledger fee");
    };
    try {
      let result = await icpLedger.icrc1_transfer({
        from_subaccount = null;
        to = target;
        amount;
        fee = null;
        memo = null;
        created_at_time = null;
      });
      switch (result) {
        case (#Ok(blockIndex)) { #forwarded(blockIndex) };
        case (#Err(err)) { #failed(transferErrorMessage(err)) };
      };
    } catch (e) {
      #failed("The ICP ledger could not be reached: " # e.message());
    };
  };

  // User-facing messages, e.g. #InsufficientAllowance ->
  // "Approval missing or too low: approve the amount + 0.0001 ICP fee".
  public func transferFromErrorMessage(err : Treasury.IcpTransferFromError) : Text {
    switch (err) {
      case (#InsufficientAllowance({ allowance })) {
        "Approval missing or too low: approve the amount + 0.0001 ICP fee (current allowance: " # formatE8(allowance) # " ICP)";
      };
      case (#InsufficientFunds({ balance })) {
        "Insufficient ICP balance: " # formatE8(balance) # " ICP available; the amount plus the 0.0001 ICP fee is required";
      };
      case (#BadFee({ expected_fee })) {
        "The ICP ledger rejected the fee (expected " # formatE8(expected_fee) # " ICP)";
      };
      case (#BadBurn({ min_burn_amount })) {
        "The ICP ledger rejected the transfer as a burn (minimum " # formatE8(min_burn_amount) # " ICP)";
      };
      case (#TooOld) { "The ICP ledger rejected the transfer as too old; please try again" };
      case (#CreatedInFuture(_)) {
        "The ICP ledger rejected the transfer time; please try again";
      };
      case (#Duplicate({ duplicate_of })) {
        "Duplicate ICP transfer (already recorded in block " # duplicate_of.toText() # ")";
      };
      case (#TemporarilyUnavailable) {
        "The ICP ledger is temporarily unavailable; please try again in a moment";
      };
      case (#GenericError({ message })) { "ICP ledger error: " # message };
    };
  };

  // icrc1_transfer errors are a subset of the transfer_from errors.
  public func transferErrorMessage(err : Treasury.IcpTransferError) : Text {
    transferFromErrorMessage(err);
  };
};
