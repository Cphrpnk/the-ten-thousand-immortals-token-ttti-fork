import Principal "mo:core/Principal";
import Wallet "../types/wallet";
import WalletLib "../lib/wallet";

mixin (canisterPrincipal : Principal) {
  // --- Token metadata --------------------------------------------------------

  // Reads a token's metadata (name, symbol, decimals, fee) from its own ICRC-1
  // ledger canister. Callable by any caller.
  public shared func getTokenMetadata(canisterId : Principal) : async Wallet.TokenResult {
    await WalletLib.getTokenMetadata(canisterPrincipal, canisterId);
  };

  // Lists the token descriptors of every ledger in the wallet registry.
  public shared func listTokens() : async [Wallet.TokenDescriptor] {
    await WalletLib.listTokens(canisterPrincipal);
  };

  // --- Balances --------------------------------------------------------------

  // Reads the connected principal's balance for a token from its own ICRC-1 ledger.
  // Callable by any caller.
  public shared func getBalance(canisterId : Principal, account : Wallet.Account) : async Wallet.BalanceResult {
    await WalletLib.getBalance(canisterPrincipal, canisterId, account);
  };

  // --- Transfers (prepared, not submitted) ------------------------------------

  // Prepares an ICRC-1 transfer for the user to sign. The backend does not
  // submit the transfer; the user's wallet signs it.
  public shared func prepareTransfer(canisterId : Principal, from : Wallet.Account, to : Wallet.Account, amount : Nat, memo : ?Blob) : async Wallet.TransferResult {
    await WalletLib.prepareTransfer(canisterPrincipal, canisterId, from, to, amount, memo);
  };
};
