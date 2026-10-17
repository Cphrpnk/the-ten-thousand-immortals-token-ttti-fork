import Common "common";

module {
  // Multi-token wallet domain types.
  //
  // The app is NON-CUSTODIAL: it reads token metadata and balances from each
  // token's own ICRC-1 ledger canister, and it PREPARES transfers. The user's
  // wallet (Plug) or the app's own Internet Identity agent submits the signed
  // transfer. The backend never holds or moves the user's tokens.

  public type Account = Common.Account;
  public type Subaccount = Common.Subaccount;
  public type Timestamp = Common.Timestamp;

  // A token the wallet knows about: its ICRC-1 ledger canister and the metadata
  // read from that ledger.
  public type TokenDescriptor = {
    canisterId : Principal;
    name : Text;
    symbol : Text;
    decimals : Nat8;
    fee : Nat;
  };

  // A token's metadata plus the connected principal's balance, read from the
  // token's own ledger. `balance` is null when the ledger could not be reached.
  public type TokenBalance = {
    token : TokenDescriptor;
    balance : ?Nat;
  };

  // A transfer prepared for the user to sign. The backend does not submit it.
  public type PreparedTransfer = {
    ledger : Principal;
    from : Account;
    to : Account;
    amount : Nat;
    fee : Nat;
    memo : ?Blob;
    createdAt : Timestamp;
  };

  public type WalletError = {
    #UnknownToken : Principal;
    #LedgerUnavailable : Principal;
    #InvalidPrincipal;
    #InvalidAmount;
    #TransferFailed : Text;
  };

  public type TokenResult = {
    #Ok : TokenDescriptor;
    #Err : WalletError;
  };

  public type BalanceResult = {
    #Ok : TokenBalance;
    #Err : WalletError;
  };

  public type TransferResult = {
    #Ok : PreparedTransfer;
    #Err : WalletError;
  };
};
