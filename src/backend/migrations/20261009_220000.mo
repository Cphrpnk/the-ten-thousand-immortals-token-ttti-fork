import Map "mo:core/Map";
import CorePrincipal "mo:core/Principal";
import Blob "mo:core/Blob";
import Order "mo:core/Order";
import AccessControl "mo:caffeineai-authorization/access-control";

module {
  // --- Old state (the previous migration's NewActor) -------------------------

  type Subaccount = Blob;

  type Account = {
    owner : CorePrincipal.Principal;
    subaccount : ?Subaccount;
  };

  module Account {
    public func compare(a : Account, b : Account) : Order.Order {
      switch (CorePrincipal.compare(a.owner, b.owner)) {
        case (#equal) {
          switch (a.subaccount, b.subaccount) {
            case (null, null) #equal;
            case (null, _) #less;
            case (_, null) #greater;
            case (?x, ?y) Blob.compare(x, y);
          };
        };
        case (other) other;
      };
    };
  };

  type Value = {
    #nat : Nat;
    #int : Int;
    #nat8 : Nat8;
    #text : Text;
    #blob : Blob;
  };

  type UserProfile = {
    name : Text;
  };

  type LedgerState = {
    var totalSupply : Nat;
    var fee : Nat;
    var nextBlockIndex : Nat;
  };

  type Ledger = {
    balances : Map.Map<Account, Nat>;
    approvals : Map.Map<Account, Map.Map<Account, { amount : Nat; expires_at : ?Nat64 }>>;
    blocks : Map.Map<Nat, Value>;
    state : LedgerState;
  };

  type PurchaseOrder = {
    buyer : CorePrincipal.Principal;
    amount : Nat;
    status : { #pending; #completed; #failed };
    sessionId : Text;
    timestamp : Nat64;
  };

  type PurchaseState = {
    orders : Map.Map<Text, PurchaseOrder>;
    profiles : Map.Map<CorePrincipal.Principal, UserProfile>;
  };

  type StripeConfiguration = {
    secretKey : Text;
    allowedCountries : [Text];
  };

  type StripeState = {
    var configuration : ?StripeConfiguration;
  };

  type OldActor = {
    ledger : Ledger;
    purchaseState : PurchaseState;
    stripeConfig : StripeState;
    accessControlState : AccessControl.AccessControlState;
  };

  // --- New state -------------------------------------------------------------

  type ProfileState = {
    profiles : Map.Map<CorePrincipal.Principal, UserProfile>;
  };

  type TreasuryMode = {
    #auto;
    #manual;
  };

  type TreasuryConfig = {
    icpAccount : Account;
    rate : Nat;
    mode : TreasuryMode;
  };

  type ConversionStatus = {
    #completed;
    #failed;
  };

  type Conversion = {
    id : Nat;
    depositor : CorePrincipal.Principal;
    recipient : Account;
    icpAmount : Nat;
    tttiAmount : Nat;
    status : ConversionStatus;
    timestamp : Nat64;
  };

  type OnRampLink = {
    name : Text;
    url : Text;
  };

  type TreasuryStore = {
    var config : ?TreasuryConfig;
    var conversions : Map.Map<Nat, Conversion>;
    var nextConversionId : Nat;
    var depositRecipients : Map.Map<CorePrincipal.Principal, Account>;
    var onRampLinks : [OnRampLink];
  };

  type NewActor = {
    ledger : Ledger;
    profileState : ProfileState;
    treasury : TreasuryStore;
    accessControlState : AccessControl.AccessControlState;
  };

  // --- Migration -------------------------------------------------------------

  public func migration(old : OldActor) : NewActor {
    {
      ledger = old.ledger;
      profileState = { profiles = old.purchaseState.profiles };
      treasury = {
        var config = null;
        var conversions = Map.empty();
        var nextConversionId = 0;
        var depositRecipients = Map.empty();
        var onRampLinks = [];
      };
      accessControlState = old.accessControlState;
    };
  };
};
