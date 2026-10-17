import Account "account";

module {
  // Cross-cutting shared types used across the token domains.

  public type Subaccount = Account.Subaccount;

  public type Account = Account.Account;

  public type Timestamp = Nat64;

  // The standard ICRC-3 generic value (Candid: Nat / Int / Text / Blob / Array / Map).
  public type Value = {
    #Nat : Nat;
    #Int : Int;
    #Text : Text;
    #Blob : Blob;
    #Array : [Value];
    #Map : [(Text, Value)];
  };

  public type UserProfile = {
    name : Text;
  };
};
