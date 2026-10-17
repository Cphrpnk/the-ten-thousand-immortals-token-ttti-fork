import Map "mo:core/Map";
import CorePrincipal "mo:core/Principal";
import Blob "mo:core/Blob";
import Order "mo:core/Order";
import AccessControl "mo:caffeineai-authorization/access-control";
import Stripe "mo:caffeineai-stripe/stripe";

// Old (mo:base) types — the previous actor's real stable signature.
import BaseMap "mo:base/OrderedMap";
import BaseNat "mo:base/Nat";
import BaseText "mo:base/Text";

module {
  // --- Old state (from the previous single-file actor) -----------------------

  type OldTransaction = {
    from : CorePrincipal.Principal;
    to : CorePrincipal.Principal;
    amount : Nat;
    fee : Nat;
    timestamp : Nat64;
  };

  type OldOrderStatus = {
    #pending;
    #completed;
    #failed;
  };

  type OldPurchaseOrder = {
    buyer : CorePrincipal.Principal;
    amount : Nat;
    status : OldOrderStatus;
    sessionId : Text;
    timestamp : Nat64;
  };

  type OldUserProfile = {
    name : Text;
  };

  type OldUserRole = {
    #admin;
    #user;
    #guest;
  };

  type OldAccessControlState = {
    var adminAssigned : Bool;
    var userRoles : BaseMap.Map<CorePrincipal.Principal, OldUserRole>;
  };

  type OldActor = {
    var balances : BaseMap.Map<CorePrincipal.Principal, Nat>;
    var transactions : BaseMap.Map<Nat, OldTransaction>;
    var totalSupply : Nat;
    var transactionCount : Nat;
    var purchaseOrders : BaseMap.Map<Text, OldPurchaseOrder>;
    var stripeConfig : ?Stripe.StripeConfiguration;
    var accessControlState : OldAccessControlState;
    var userProfiles : BaseMap.Map<CorePrincipal.Principal, OldUserProfile>;
    // Retired fields — consumed here so the upgrade can drop them.
    var decimals : Nat;
    var maxSupply : Nat;
    var tokenName : Text;
    var tokenSymbol : Text;
  };

  // --- New state -------------------------------------------------------------

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

  type OrderStatus = {
    #pending;
    #completed;
    #failed;
  };

  type PurchaseOrder = {
    buyer : CorePrincipal.Principal;
    amount : Nat;
    status : OrderStatus;
    sessionId : Text;
    timestamp : Nat64;
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

  type PurchaseState = {
    orders : Map.Map<Text, PurchaseOrder>;
    profiles : Map.Map<CorePrincipal.Principal, UserProfile>;
  };

  type NewActor = {
    ledger : Ledger;
    purchaseState : PurchaseState;
    stripeConfig : Stripe.StripeState;
    accessControlState : AccessControl.AccessControlState;
  };

  // --- Migration -------------------------------------------------------------

  func account(owner : CorePrincipal.Principal) : Account {
    { owner; subaccount = null };
  };

  public func migration(old : OldActor) : NewActor {
    let basePrincipalMap = BaseMap.Make(CorePrincipal.compare);
    let baseNatMap = BaseMap.Make(BaseNat.compare);
    let baseTextMap = BaseMap.Make(BaseText.compare);

    // Re-key balances from Principal to Account.
    let balances = Map.empty<Account, Nat>();
    for ((owner, balance) in basePrincipalMap.entries(old.balances)) {
      balances.add(account(owner), balance);
    };

    // Re-key the old transaction log into ICRC-3 blocks.
    let blocks = Map.empty<Nat, Value>();
    for ((index, tx) in baseNatMap.entries(old.transactions)) {
      blocks.add(index, #text("legacy:" # index.toText() # ":" # tx.amount.toText()));
    };

    // Purchase orders and profiles carry over unchanged.
    let orders = Map.empty<Text, PurchaseOrder>();
    for ((sessionId, order) in baseTextMap.entries(old.purchaseOrders)) {
      orders.add(sessionId, {
        buyer = order.buyer;
        amount = order.amount;
        status = order.status;
        sessionId = order.sessionId;
        timestamp = order.timestamp;
      });
    };

    let profiles = Map.empty<CorePrincipal.Principal, UserProfile>();
    for ((user, profile) in basePrincipalMap.entries(old.userProfiles)) {
      profiles.add(user, { name = profile.name });
    };

    // Convert the old access-control map (mo:base) to the new (mo:core).
    let userRoles = Map.empty<CorePrincipal.Principal, AccessControl.UserRole>();
    for ((user, role) in basePrincipalMap.entries(old.accessControlState.userRoles)) {
      userRoles.add(user, role);
    };

    {
      ledger = {
        balances;
        approvals = Map.empty();
        blocks;
        state = {
          var totalSupply = old.totalSupply;
          var fee = 0;
          var nextBlockIndex = old.transactionCount;
        };
      };
      purchaseState = { orders; profiles };
      stripeConfig = { var configuration = old.stripeConfig };
      accessControlState = {
        var adminAssigned = old.accessControlState.adminAssigned;
        userRoles;
      };
    };
  };
};
