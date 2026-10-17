import Array "mo:core/Array";
import Int "mo:core/Int";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat8 "mo:core/Nat8";
import Nat64 "mo:core/Nat64";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import OQL "mo:caffeineai-oql";
import Expose "mo:caffeineai-oql/Expose";
import MapEntity "mo:caffeineai-oql/MapEntity";
import Entity "mo:caffeineai-oql/Entity";
import NatValue "mo:caffeineai-oql/NatValue";
import Nat64Value "mo:caffeineai-oql/Nat64Value";
import TextValue "mo:caffeineai-oql/TextValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import Common "../types/common";
import AccountTypes "../types/account";
import Treasury "../types/treasury";
import Oracle "../types/oracle";
import OracleLib "../lib/oracle";
import TreasuryLib "../lib/treasury";
import PresaleLib "../lib/presale";
import IcrcLib "../lib/icrc";
import DocumentTypes "../types/document";

mixin (
  treasury : TreasuryLib.TreasuryStore,
  profiles : Map.Map<Principal, Common.UserProfile>,
  oracle : OracleLib.OracleStore,
  presale : PresaleLib.PresaleStore,
  ledger : IcrcLib.Ledger,
  canister : Principal,
  documentState : DocumentTypes.DocumentState,
) {
  func conversionStatusText(status : Treasury.ConversionStatus) : Text {
    switch (status) {
      case (#completed) "completed";
      case (#failed) "failed";
      case (#refunded) "refunded";
      case (#refundFailed) "refundFailed";
    };
  };

  func forwardStatusText(forward : Treasury.ForwardStatus) : Text {
    switch (forward) {
      case (#notRequired) "notRequired";
      case (#pending) "pending";
      case (#forwarded(_)) "forwarded";
      case (#failed(_)) "failed";
    };
  };

  func forwardBlockIndex(forward : Treasury.ForwardStatus) : ?Nat {
    switch (forward) {
      case (#forwarded(index)) ?index;
      case (_) null;
    };
  };

  // The forward failure reason, "" unless the forward is #failed.
  func forwardError(forward : Treasury.ForwardStatus) : Text {
    switch (forward) {
      case (#failed(reason)) reason;
      case (_) "";
    };
  };

  func oracleStatusText(status : Oracle.OracleStatus) : Text {
    switch (status) {
      case (#ok) "ok";
      case (#stale) "stale";
      case (#unavailable) "unavailable";
    };
  };

  func priceSourceText(source : Oracle.PriceSource) : Text {
    switch (source) {
      case (#none) "none";
      case (#coinbase) "coinbase";
      case (#coingecko) "coingecko";
    };
  };

  func holderKindText(account : Common.Account) : Text {
    if (account == IcrcLib.feeCollectorAccount(canister)) "feeCollector" else "holder";
  };

  // The treasury configuration as zero or one row.
  func treasuryConfigRows() : [Treasury.TreasuryConfig] {
    switch (treasury.config) {
      case (?c) [c];
      case null [];
    };
  };

  func treasuryModeText(mode : Treasury.TreasuryMode) : Text {
    switch (mode) {
      case (#auto) "auto";
      case (#manual) "manual";
    };
  };

  // --- ICRC-3 block decoding (read-only) -------------------------------------

  func blockFields(block : Common.Value) : [(Text, Common.Value)] {
    switch (block) {
      case (#Map(fields)) fields;
      case (_) [];
    };
  };

  func field(fields : [(Text, Common.Value)], key : Text) : ?Common.Value {
    switch (fields.find(func(entry : (Text, Common.Value)) : Bool = entry.0 == key)) {
      case (?(_, value)) ?value;
      case null null;
    };
  };

  func txFields(block : Common.Value) : [(Text, Common.Value)] {
    switch (field(blockFields(block), "tx")) {
      case (?(#Map(fields))) fields;
      case (_) [];
    };
  };

  func natField(fields : [(Text, Common.Value)], key : Text) : ?Nat {
    switch (field(fields, key)) {
      case (?(#Nat(n))) ?n;
      case (_) null;
    };
  };

  // An ICRC-3 account value (#Array [owner blob, subaccount blob?]) as the
  // standard ICRC-1 account text.
  func accountField(fields : [(Text, Common.Value)], key : Text) : ?Text {
    let items = switch (field(fields, key)) {
      case (?(#Array(items))) items;
      case (_) return null;
    };
    if (items.size() == 0 or items.size() > 2) {
      return null;
    };
    let owner = switch (items[0]) {
      case (#Blob(b)) Principal.fromBlob(b);
      case (_) return null;
    };
    let subaccount : ?Blob = if (items.size() == 2) {
      switch (items[1]) {
        case (#Blob(s)) ?s;
        case (_) return null;
      };
    } else {
      null;
    };
    ?AccountTypes.toText({ owner; subaccount });
  };

  // "1xfer" / "2approve" / "1mint" / "1burn", "legacy" for text blocks.
  func blockType(block : Common.Value) : Text {
    switch (block) {
      case (#Text(_)) "legacy";
      case (#Map(fields)) {
        switch (field(fields, "btype")) {
          case (?(#Text(t))) t;
          case (_) "unknown";
        };
      };
      case (_) "unknown";
    };
  };

  // Effective fee: top-level `fee`, else the caller-provided `tx.fee`.
  func blockFee(block : Common.Value) : ?Nat {
    switch (natField(blockFields(block), "fee")) {
      case (?f) ?f;
      case null natField(txFields(block), "fee");
    };
  };

  func legacyText(block : Common.Value) : Text {
    switch (block) {
      case (#Text(t)) t;
      case (_) "";
    };
  };

  func blockDecimals(index : Nat) : Nat {
    if (index < ledger.state.legacyBlockBoundary) IcrcLib.LEGACY_DECIMALS.toNat() else IcrcLib.decimals().toNat();
  };

  // Sample with every optional column set, so the schema types them.
  func sampleBlock() : (Nat, Common.Value) {
    let account : Common.Value = #Array([#Blob(Principal.fromText("aaaaa-aa").toBlob())]);
    (
      0,
      #Map([
        ("btype", #Text("2approve")),
        ("ts", #Nat(0)),
        ("fee", #Nat(0)),
        ("fee_col", account),
        ("tx", #Map([("from", account), ("to", account), ("spender", account), ("amt", #Nat(0)), ("expires_at", #Nat(0))])),
      ]),
    );
  };

  // --- ICRC-2 allowances (flattened owner -> spender) ------------------------

  func allowanceRows() : [(Common.Account, Common.Account, IcrcLib.Approval)] {
    let rows = List.empty<(Common.Account, Common.Account, IcrcLib.Approval)>();
    for ((owner, spenders) in ledger.approvals.entries()) {
      for ((spender, approval) in spenders.entries()) {
        rows.add((owner, spender, approval));
      };
    };
    rows.toArray();
  };

  func approvalExpired(approval : IcrcLib.Approval) : Bool {
    switch (approval.expires_at) {
      case (?expiry) expiry.toNat() <= Int.abs(Time.now());
      case null false;
    };
  };

  include Expose({
    entities = [
      // Presale purchase records (all statuses), keyed by conversion id.
      treasury.conversions.toEntityManual("conversion", "Conversion", "id")
        .sample({
          id = 0;
          depositor = Principal.fromText("aaaaa-aa");
          recipient = { owner = Principal.fromText("aaaaa-aa"); subaccount = null };
          icpAmount = 0;
          tttiAmount = 0;
          status = #completed;
          timestamp = 0;
          priceUsdE8 = 0;
          usedFallback = false;
          fromCollector = 0;
          minted = 0;
          forward = #forwarded(0);
          message = ?"";
        } : Treasury.Conversion)
        .payload("id", func c = c.id)
        .payload("depositor", func c = c.depositor)
        .payload("recipient", func c = c.recipient.owner)
        .payload("recipientAccount", func c = AccountTypes.toText(c.recipient))
        .payload("icpAmount", func c = c.icpAmount)
        .payload("tttiAmount", func c = c.tttiAmount)
        .payload("status", func c = conversionStatusText(c.status))
        .payload("timestamp", func c = c.timestamp)
        .payload("priceUsdE8", func c = c.priceUsdE8)
        .payload("usedFallback", func c = c.usedFallback)
        .payload("fromCollector", func c = c.fromCollector)
        .payload("minted", func c = c.minted)
        .payload("forward", func c = forwardStatusText(c.forward))
        .payload("forwardBlockIndex", func c = forwardBlockIndex(c.forward))
        .payload("forwardError", func c = forwardError(c.forward))
        .payload("message", func c = c.message)
        .controllerOnly()
        .build(),
      // User profiles, keyed by the user's principal.
      OQL.Entity.manual<(Principal, Common.UserProfile)>(
        "profile",
        func () = profiles.entries(),
        "Profile",
        "user",
      )
        .sample((Principal.fromText("aaaaa-aa"), { name = "" }))
        .payload("user", func((user, _)) = user)
        .payload("name", func((_, p)) = p.name)
        .controllerOnly()
        .build(),
      // The cached ICP/USD price (single row).
      OQL.Entity.manual<Oracle.IcpPrice>(
        "icpPrice",
        func () = [OracleLib.getPrice(oracle)].values(),
        "IcpPrice",
        "updatedAt",
      )
        .sample({ usdE8 = 0; usdMicro = 0; updatedAt = 0; status = #unavailable; source = #none; stale = true } : Oracle.IcpPrice)
        .payload("usdE8", func p = p.usdE8)
        .payload("usdMicro", func p = p.usdMicro)
        .payload("updatedAt", func p = p.updatedAt)
        .payload("status", func p = oracleStatusText(p.status))
        .payload("source", func p = priceSourceText(p.source))
        .payload("stale", func p = p.stale)
        .controllerOnly()
        .build(),
      // Buyer delivery addresses, keyed by the buyer's principal.
      OQL.Entity.manual<(Principal, Common.Account)>(
        "deliveryAddress",
        func () = treasury.depositRecipients.entries(),
        "DeliveryAddress",
        "buyer",
      )
        .sample((Principal.fromText("aaaaa-aa"), { owner = Principal.fromText("aaaaa-aa"); subaccount = null }))
        .payload("buyer", func((buyer, _)) = buyer)
        .payload("owner", func((_, account)) = account.owner)
        .payload("account", func((_, account)) = AccountTypes.toText(account))
        .payload("hasSubaccount", func((_, account)) = account.subaccount != null)
        .controllerOnly()
        .build(),
      // Presale status and admin switches (single row, id "presale").
      OQL.Entity.manual<PresaleLib.PresaleStore>(
        "presaleStatus",
        func () = [presale].values(),
        "PresaleStatus",
        "id",
      )
        .sample(presale)
        .payload("id", func(_) = "presale")
        .payload("allocation", func(_) = PresaleLib.ALLOCATION)
        .payload("sold", func p = p.sold)
        .payload("reserved", func p = p.reserved)
        .payload("remaining", func p = PresaleLib.remaining(p))
        .payload("complete", func p = p.sold >= PresaleLib.ALLOCATION)
        .payload("minPurchase", func(_) = PresaleLib.MIN_PURCHASE)
        .payload("salesPaused", func p = p.salesPaused)
        .payload("fallbackEnabled", func p = p.fallbackEnabled)
        .payload("transfersFrozen", func(_) = IcrcLib.isFrozen(ledger))
        .payload("legacyBlockBoundary", func(_) = ledger.state.legacyBlockBoundary)
        .controllerOnly()
        .build(),
      // Treasury configuration (single row, id "treasury"; absent until set).
      OQL.Entity.manual<Treasury.TreasuryConfig>(
        "treasuryConfig",
        func () = treasuryConfigRows().values(),
        "TreasuryConfig",
        "id",
      )
        .sample({
          icpAccount = { owner = Principal.fromText("aaaaa-aa"); subaccount = null };
          rate = 0;
          mode = #auto;
          marginBps = 0;
        } : Treasury.TreasuryConfig)
        .payload("id", func(_) = "treasury")
        .payload("icpAccountOwner", func c = c.icpAccount.owner)
        .payload("icpAccount", func c = AccountTypes.toText(c.icpAccount))
        .payload("icpAccountHasSubaccount", func c = c.icpAccount.subaccount != null)
        .payload("fallbackRate", func c = c.rate)
        .payload("mode", func c = treasuryModeText(c.mode))
        .payload("marginBps", func c = c.marginBps)
        .controllerOnly()
        .build(),
      // TTTI-P ledger balances (8 decimals), keyed by the account text.
      OQL.Entity.manual<(Common.Account, Nat)>(
        "tttiBalance",
        func () = ledger.balances.entries(),
        "TttiBalance",
        "account",
      )
        .sample(({ owner = Principal.fromText("aaaaa-aa"); subaccount = null }, 0))
        .payload("account", func((account, _)) = AccountTypes.toText(account))
        .payload("owner", func((account, _)) = account.owner)
        .payload("hasSubaccount", func((account, _)) = account.subaccount != null)
        .payload("kind", func((account, _)) = holderKindText(account))
        .payload("balance", func((_, balance)) = balance)
        .controllerOnly()
        .build(),
      // ICRC-3 block log, keyed by block index. Standard blocks are decoded;
      // legacy text blocks have btype "legacy" and their raw text in legacyText.
      OQL.Entity.manual<(Nat, Common.Value)>(
        "ledgerBlock",
        func () = ledger.blocks.entries(),
        "LedgerBlock",
        "index",
      )
        .sample(sampleBlock())
        .payload("index", func((index, _)) = index)
        .payload("btype", func((_, block)) = blockType(block))
        .payload("ts", func((_, block)) = natField(blockFields(block), "ts"))
        .payload("amount", func((_, block)) = natField(txFields(block), "amt"))
        .payload("fee", func((_, block)) = blockFee(block))
        .payload("from", func((_, block)) = accountField(txFields(block), "from"))
        .payload("to", func((_, block)) = accountField(txFields(block), "to"))
        .payload("spender", func((_, block)) = accountField(txFields(block), "spender"))
        .payload("feeCollector", func((_, block)) = accountField(blockFields(block), "fee_col"))
        .payload("expiresAt", func((_, block)) = natField(txFields(block), "expires_at"))
        .payload("decimals", func((index, _)) = blockDecimals(index))
        .payload("legacyText", func((_, block)) = legacyText(block))
        .controllerOnly()
        .build(),
      // ICRC-2 approvals, one row per (owner, spender), keyed "owner|spender".
      OQL.Entity.manual<(Common.Account, Common.Account, IcrcLib.Approval)>(
        "allowance",
        func () = allowanceRows().values(),
        "Allowance",
        "id",
      )
        .sample(({ owner = Principal.fromText("aaaaa-aa"); subaccount = null }, { owner = Principal.fromText("aaaaa-aa"); subaccount = null }, ({ amount = 0; expires_at = null } : IcrcLib.Approval)))
        .payload("id", func((owner, spender, _)) = AccountTypes.toText(owner) # "|" # AccountTypes.toText(spender))
        .payload("owner", func((owner, _, _)) = AccountTypes.toText(owner))
        .payload("spender", func((_, spender, _)) = AccountTypes.toText(spender))
        .payload("amount", func((_, _, approval)) = approval.amount)
        .payload("expiresAt", func((_, _, approval)) = approval.expires_at)
        .payload("expired", func((_, _, approval)) = approvalExpired(approval))
        .controllerOnly()
        .build(),
      // Ledger totals and switches (single row, id "ledger").
      OQL.Entity.manual<IcrcLib.Ledger>(
        "ledgerState",
        func () = [ledger].values(),
        "LedgerState",
        "id",
      )
        .sample(ledger)
        .payload("id", func(_) = "ledger")
        .payload("totalSupply", func l = l.state.totalSupply)
        .payload("maxSupply", func(_) = IcrcLib.maxSupply())
        .payload("fee", func l = l.state.fee)
        .payload("blockCount", func l = l.state.nextBlockIndex)
        .payload("legacyBlockBoundary", func l = l.state.legacyBlockBoundary)
        .payload("transfersFrozen", func l = l.state.transfersFrozen)
        .payload("holderCount", func l = l.balances.size())
        .payload("dedupEntries", func l = l.dedup.size())
        .controllerOnly()
        .build(),
      // On-ramp links served on the Buy ICP page (defaults when none are set).
      OQL.Entity.manual<Treasury.OnRampLink>(
        "onRampLink",
        func () = TreasuryLib.getOnRampLinks(treasury).values(),
        "OnRampLink",
        "name",
      )
        .sample({ name = ""; url = "" } : Treasury.OnRampLink)
        .payload("name", func l = l.name)
        .payload("url", func l = l.url)
        .payload("custom", func(_) = treasury.onRampLinks.size() > 0)
        .controllerOnly()
        .build(),
      // Published document metadata; the blob's contents are never exposed as a row.
      OQL.Entity.manual<DocumentTypes.DocumentState>(
        "originalWhitePaper",
        func () = [documentState].values(),
        "OriginalWhitePaper",
        "id",
      )
        .sample(documentState)
        .payload("id", func(_) = "original")
        .payload("published", func d = d.original != null)
        .payload("filename", func d = switch (d.original) { case (?paper) paper.filename; case null "" })
        .payload("mimeType", func d = switch (d.original) { case (?paper) paper.mimeType; case null "" })
        .controllerOnly()
        .build(),
    ];
  });
};
