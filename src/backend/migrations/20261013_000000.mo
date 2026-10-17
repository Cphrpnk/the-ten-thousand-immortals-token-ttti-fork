import Map "mo:core/Map";
import CorePrincipal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";

// TTTI -> TTTI-P upgrade: 4 -> 8 decimals. Every stored amount is rescaled by
// 10^4 so no holder loses value; the transfer fee becomes 100 base units; the
// legacy decimals boundary (current nextBlockIndex) is recorded; blocks are
// NOT rewritten; the presale store starts empty with all switches off.
module {
  // --- Old state (20261010_030000 NewActor) ----------------------------------

  type Subaccount = Blob;

  type Account = {
    owner : CorePrincipal.Principal;
    subaccount : ?Subaccount;
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

  type Approval = { amount : Nat; expires_at : ?Nat64 };

  type Ledger = {
    balances : Map.Map<Account, Nat>;
    approvals : Map.Map<Account, Map.Map<Account, Approval>>;
    blocks : Map.Map<Nat, Value>;
    state : LedgerState;
    var merkleLeaves : [Blob];
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

  type NewLedgerState = {
    var totalSupply : Nat;
    var fee : Nat;
    var nextBlockIndex : Nat;
    var transfersFrozen : Bool;
    legacyBlockBoundary : Nat;
  };

  type NewLedger = {
    balances : Map.Map<Account, Nat>;
    approvals : Map.Map<Account, Map.Map<Account, Approval>>;
    blocks : Map.Map<Nat, Value>;
    state : NewLedgerState;
    var merkleLeaves : [Blob];
  };

  type NewConversionStatus = {
    #completed;
    #failed;
    #refunded;
    #refundFailed;
  };

  type ForwardStatus = {
    #notRequired;
    #pending;
    #forwarded : Nat;
    #failed : Text;
  };

  type NewConversion = {
    id : Nat;
    depositor : CorePrincipal.Principal;
    recipient : Account;
    icpAmount : Nat;
    tttiAmount : Nat;
    status : NewConversionStatus;
    timestamp : Nat64;
    priceUsdE8 : Nat;
    usedFallback : Bool;
    fromCollector : Nat;
    minted : Nat;
    forward : ForwardStatus;
    message : ?Text;
  };

  type NewTreasuryStore = {
    var config : ?TreasuryConfig;
    var conversions : Map.Map<Nat, NewConversion>;
    var nextConversionId : Nat;
    var depositRecipients : Map.Map<CorePrincipal.Principal, Account>;
    var onRampLinks : [OnRampLink];
  };

  type PriceSource = {
    #none;
    #coinbase;
    #coingecko;
  };

  type NewOracleStore = {
    var usdE8 : Nat;
    var updatedAt : Nat64;
    var source : PriceSource;
  };

  type PresaleStore = {
    var sold : Nat;
    var reserved : Nat;
    var salesPaused : Bool;
    var fallbackEnabled : Bool;
  };

  type NewActor = {
    ledger : NewLedger;
    profileState : ProfileState;
    treasury : NewTreasuryStore;
    oracle : NewOracleStore;
    presale : PresaleStore;
    accessControlState : AccessControl.AccessControlState;
  };

  // --- Migration -------------------------------------------------------------

  // 4 -> 8 decimals.
  let SCALE : Nat = 10_000;
  // New transfer fee: 0.000001 TTTI-P.
  let NEW_FEE : Nat = 100;

  public func migration(old : OldActor) : NewActor {
    let balances = old.ledger.balances.map<Account, Nat, Nat>(func(_, b) = b * SCALE);

    let approvals = old.ledger.approvals.map<Account, Map.Map<Account, Approval>, Map.Map<Account, Approval>>(
      func(_, inner) = inner.map(
        func(_, a) = { amount = a.amount * SCALE; expires_at = a.expires_at }
      )
    );

    let conversions = old.treasury.conversions.map<Nat, Conversion, NewConversion>(
      func(_, c) = {
        id = c.id;
        depositor = c.depositor;
        recipient = c.recipient;
        icpAmount = c.icpAmount;
        tttiAmount = c.tttiAmount * SCALE;
        status = switch (c.status) {
          case (#completed) #completed;
          case (#failed) #failed;
        };
        timestamp = c.timestamp;
        priceUsdE8 = 0;
        usedFallback = false;
        fromCollector = 0;
        minted = 0;
        forward = #notRequired;
        message = null;
      }
    );

    let config : ?TreasuryConfig = switch (old.treasury.config) {
      case (null) null;
      case (?c) ?{ c with rate = c.rate * SCALE };
    };

    {
      ledger = {
        balances;
        approvals;
        blocks = old.ledger.blocks;
        state = {
          var totalSupply = old.ledger.state.totalSupply * SCALE;
          var fee = NEW_FEE;
          var nextBlockIndex = old.ledger.state.nextBlockIndex;
          var transfersFrozen = false;
          legacyBlockBoundary = old.ledger.state.nextBlockIndex;
        };
        var merkleLeaves = old.ledger.merkleLeaves;
      };
      profileState = old.profileState;
      treasury = {
        var config = config;
        var conversions = conversions;
        var nextConversionId = old.treasury.nextConversionId;
        var depositRecipients = old.treasury.depositRecipients;
        var onRampLinks = old.treasury.onRampLinks;
      };
      oracle = {
        var usdE8 = old.oracle.usdMicro * 100;
        var updatedAt = old.oracle.updatedAt;
        var source = if (old.oracle.updatedAt == 0) #none else #coingecko;
      };
      presale = {
        var sold = 0;
        var reserved = 0;
        var salesPaused = false;
        var fallbackEnabled = false;
      };
      accessControlState = old.accessControlState;
    };
  };
};
