import Principal "mo:core/Principal";
import List "mo:core/List";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import Wallet "../types/wallet";

module {
  public type TokenDescriptor = Wallet.TokenDescriptor;
  public type TokenBalance = Wallet.TokenBalance;
  public type PreparedTransfer = Wallet.PreparedTransfer;
  public type WalletError = Wallet.WalletError;
  public type TokenResult = Wallet.TokenResult;
  public type BalanceResult = Wallet.BalanceResult;
  public type TransferResult = Wallet.TransferResult;
  public type Account = Wallet.Account;

  // The wallet's token registry: the ICRC-1 ledgers the wallet reads and
  // prepares transfers for (ICP, TTTI, ckBTC, ckUSDC). The registry is fixed in
  // code; the app does not support adding tokens by canister ID.
  //
  // TTTI is this canister's own principal, so it is passed in at composition
  // time rather than hard-coded.
  func icpLedger() : Principal = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
  func ckBtcLedger() : Principal = Principal.fromText("mxzaz-hqaaa-aaaar-qaada-cai");
  func ckUsdcLedger() : Principal = Principal.fromText("xevnm-gaaaa-aaaar-qafnq-cai");

  // Minimal ICRC-1 ledger interface: metadata, fee and balance reads.
  type Ledger = actor {
    icrc1_name : () -> async Text;
    icrc1_symbol : () -> async Text;
    icrc1_decimals : () -> async Nat8;
    icrc1_fee : () -> async Nat;
    icrc1_balance_of : (Account) -> async Nat;
  };

  // The fixed registry, in display order. `tttiLedger` is the canister's own
  // principal.
  public func registry(tttiLedger : Principal) : [Principal] {
    [icpLedger(), tttiLedger, ckBtcLedger(), ckUsdcLedger()];
  };

  func isKnown(tttiLedger : Principal, canisterId : Principal) : Bool {
    registry(tttiLedger).any(func p = p == canisterId);
  };

  // Reads a token's metadata (name, symbol, decimals, fee) from its own ICRC-1
  // ledger canister.
  public func getTokenMetadata(tttiLedger : Principal, canisterId : Principal) : async TokenResult {
    if (not isKnown(tttiLedger, canisterId)) {
      return #Err(#UnknownToken(canisterId));
    };
    let ledger : Ledger = actor (canisterId.toText());
    try {
      let name = await ledger.icrc1_name();
      let symbol = await ledger.icrc1_symbol();
      let decimals = await ledger.icrc1_decimals();
      let fee = await ledger.icrc1_fee();
      #Ok({ canisterId; name; symbol; decimals; fee });
    } catch (_) {
      #Err(#LedgerUnavailable(canisterId));
    };
  };

  // Reads the connected principal's balance for a token from its own ICRC-1 ledger.
  public func getBalance(tttiLedger : Principal, canisterId : Principal, account : Account) : async BalanceResult {
    if (not isKnown(tttiLedger, canisterId)) {
      return #Err(#UnknownToken(canisterId));
    };
    let ledger : Ledger = actor (canisterId.toText());
    try {
      let name = await ledger.icrc1_name();
      let symbol = await ledger.icrc1_symbol();
      let decimals = await ledger.icrc1_decimals();
      let fee = await ledger.icrc1_fee();
      let balance = await ledger.icrc1_balance_of(account);
      #Ok({
        token = { canisterId; name; symbol; decimals; fee };
        balance = ?balance;
      });
    } catch (_) {
      #Err(#LedgerUnavailable(canisterId));
    };
  };

  // Prepares an ICRC-1 transfer for the user to sign. The backend does not
  // submit the transfer.
  public func prepareTransfer(tttiLedger : Principal, canisterId : Principal, from : Account, to : Account, amount : Nat, memo : ?Blob) : async TransferResult {
    if (not isKnown(tttiLedger, canisterId)) {
      return #Err(#UnknownToken(canisterId));
    };
    if (amount == 0) {
      return #Err(#InvalidAmount);
    };
    let ledger : Ledger = actor (canisterId.toText());
    try {
      let fee = await ledger.icrc1_fee();
      #Ok({
        ledger = canisterId;
        from;
        to;
        amount;
        fee;
        memo;
        createdAt = Time.now().toNat().toNat64();
      });
    } catch (_) {
      #Err(#LedgerUnavailable(canisterId));
    };
  };

  // Lists the token descriptors of every ledger in the wallet registry.
  public func listTokens(tttiLedger : Principal) : async [TokenDescriptor] {
    let descriptors = List.empty<TokenDescriptor>();
    for (canisterId in registry(tttiLedger).values()) {
      let ledger : Ledger = actor (canisterId.toText());
      try {
        let name = await ledger.icrc1_name();
        let symbol = await ledger.icrc1_symbol();
        let decimals = await ledger.icrc1_decimals();
        let fee = await ledger.icrc1_fee();
        descriptors.add({ canisterId; name; symbol; decimals; fee });
      } catch (_) {
        // Skip a ledger that cannot be reached.
      };
    };
    descriptors.toArray();
  };
};
