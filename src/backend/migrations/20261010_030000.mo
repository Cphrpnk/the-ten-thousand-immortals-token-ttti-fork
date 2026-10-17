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
    marginBps : Nat;
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

  type OracleStore = {
    var usdMicro : Nat;
    var updatedAt : Nat64;
  };

  type OldActor = {
    ledger : Ledger;
    profileState : ProfileState;
    treasury : TreasuryStore;
    oracle : OracleStore;
    accessControlState : AccessControl.AccessControlState;
  };

  // --- New state -------------------------------------------------------------

  type NewLedger = {
    balances : Map.Map<Account, Nat>;
    approvals : Map.Map<Account, Map.Map<Account, { amount : Nat; expires_at : ?Nat64 }>>;
    blocks : Map.Map<Nat, Value>;
    state : LedgerState;
    var merkleLeaves : [Blob];
  };

  type NewActor = {
    ledger : NewLedger;
    profileState : ProfileState;
    treasury : TreasuryStore;
    oracle : OracleStore;
    accessControlState : AccessControl.AccessControlState;
  };

  // --- Migration -------------------------------------------------------------

  public func migration(old : OldActor) : NewActor {
    {
      ledger = {
        balances = old.ledger.balances;
        approvals = old.ledger.approvals;
        blocks = old.ledger.blocks;
        state = old.ledger.state;
        var merkleLeaves = [];
      };
      profileState = old.profileState;
      treasury = old.treasury;
      oracle = old.oracle;
      accessControlState = old.accessControlState;
    };
  };
};
