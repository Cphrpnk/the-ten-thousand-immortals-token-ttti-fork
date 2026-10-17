import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Blob "mo:core/Blob";
import Nat8 "mo:core/Nat8";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";
import List "mo:core/List";
import Array "mo:core/Array";
import CertifiedData "mo:core/CertifiedData";
import Account "../types/account";
import Common "../types/common";
import Icrc "../types/icrc";
import Token "../types/token";

module {
  public type Account = Account.Account;
  public type Subaccount = Common.Subaccount;
  public type Timestamp = Common.Timestamp;
  public type Value = Common.Value;
  public type LedgerState = Token.LedgerState;
  public type Transaction = Token.Transaction;
  public type Approval = Token.Approval;
  public type DedupEntry = Token.DedupEntry;
  public type FeeCollectorInfo = Token.FeeCollectorInfo;
  public type LegacyBlockInfo = Token.LegacyBlockInfo;
  public type HolderBalance = Token.HolderBalance;
  public type DeliveryResult = Token.DeliveryResult;

  public type Ledger = {
    balances : Map.Map<Account, Nat>;
    approvals : Map.Map<Account, Map.Map<Account, Approval>>;
    blocks : Map.Map<Nat, Value>;
    state : LedgerState;
    // Deduplication index: hash of (block type, tx) -> block index.
    dedup : Map.Map<Blob, Nat>;
    // The same entries keyed by block index (ledger-time order) for pruning.
    dedupQueue : Map.Map<Nat, DedupEntry>;
  };

  // Token constants.
  let TOKEN_NAME = "TTTI Presale";
  let TOKEN_SYMBOL = "TTTI-P";
  let TOKEN_DECIMALS : Nat8 = 8;
  let TOKEN_MAX_SUPPLY : Nat = 1_000_000_000_000; // 10 000 TTTI-P at 8 decimals
  // Decimals used by blocks below state.legacyBlockBoundary (pre-upgrade).
  public let LEGACY_DECIMALS : Nat8 = 4;
  // Default transfer fee: 0.000001 TTTI-P = 100 base units (= 0.01 USD).
  public let DEFAULT_FEE : Nat = 100;
  // Transfer fee bounds accepted by set_fee (base units).
  public let MIN_FEE : Nat = 0;
  public let MAX_FEE : Nat = 10_000;
  // Smallest accepted burn (base units), equal to the default fee.
  public let MIN_BURN_AMOUNT : Nat = 100;
  // Longest accepted memo (bytes).
  public let MAX_MEMO_BYTES : Nat = 32;
  // Deduplication window and permitted clock drift (nanoseconds).
  let TX_WINDOW_NS : Nat = 86_400_000_000_000; // 24 h
  let PERMITTED_DRIFT_NS : Nat = 120_000_000_000; // 2 min
  // Per-call caps.
  let MAX_BLOCKS_PER_CALL : Nat = 100;
  let MAX_DEDUP_PRUNE : Nat = 50;

  let ICRC1_URL = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1";
  let ICRC2_URL = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-2";
  let ICRC3_URL = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-3";
  let ICRC10_URL = "https://github.com/dfinity/ICRC/blob/main/ICRCs/ICRC-10/ICRC-10.md";

  // GenericError codes.
  let MAX_SUPPLY_ERROR_CODE : Nat = 1;
  let UNAUTHORIZED_ERROR_CODE : Nat = 2;
  let FROZEN_ERROR_CODE : Nat = 3;
  let MEMO_ERROR_CODE : Nat = 4;
  let ZERO_AMOUNT_ERROR_CODE : Nat = 5;
  let MINTING_ACCOUNT_ERROR_CODE : Nat = 6;
  let SELF_APPROVE_ERROR_CODE : Nat = 7;
  let FROZEN_MESSAGE = "Transfers are frozen";
  let MEMO_MESSAGE = "Memo exceeds 32 bytes";
  let ZERO_AMOUNT_MESSAGE = "Amount must be greater than zero";

  // --- Special accounts ------------------------------------------------------

  // Fixed 32-byte fee collector subaccount (printable ASCII).
  public let FEE_COLLECTOR_SUBACCOUNT : Blob = "FEE-COLLECTOR-TTTI-P-00000000001";

  // Fee collector: this canister's principal + FEE_COLLECTOR_SUBACCOUNT. Every
  // transfer / transfer_from / approve fee is credited here.
  public func feeCollectorAccount(canister : Principal) : Account {
    { owner = canister; subaccount = ?FEE_COLLECTOR_SUBACCOUNT };
  };

  // Burn account (= ICRC-1 minting account): this canister's principal with the
  // default (null) subaccount. A transfer to it debits the sender, credits
  // nobody, reduces total supply, and is recorded as a "1burn" block.
  public func burnAccount(canister : Principal) : Account {
    { owner = canister; subaccount = null };
  };

  // --- SHA-256 (pure Motoko) -------------------------------------------------

  let SHA256_K : [Nat32] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  func rotr(x : Nat32, n : Nat32) : Nat32 {
    (x >> n) | (x << (32 - n));
  };

  func sha256(data : Blob) : Blob {
    let bytes = data.toArray();
    let len = bytes.size();
    let bitLen = len * 8;
    // Padded message: data + 0x80 + zeros + 64-bit big-endian bit length.
    let paddedLen = (((len + 8) / 64) + 1) * 64;
    let lenFieldStart = Nat.sub(paddedLen, 8);
    let bitLen64 = bitLen.toNat64();
    let padded = Array.tabulate<Nat8>(paddedLen, func(i) {
      if (i < len) { bytes[i] }
      else if (i == len) { 0x80 }
      else if (i >= lenFieldStart) {
        let shift = Nat.sub(Nat.sub(paddedLen, 1), i) * 8;
        ((bitLen64 >> shift.toNat64()) & 0xff).toNat8();
      } else { 0 };
    });
    var h0 : Nat32 = 0x6a09e667;
    var h1 : Nat32 = 0xbb67ae85;
    var h2 : Nat32 = 0x3c6ef372;
    var h3 : Nat32 = 0xa54ff53a;
    var h4 : Nat32 = 0x510e527f;
    var h5 : Nat32 = 0x9b05688c;
    var h6 : Nat32 = 0x1f83d9ab;
    var h7 : Nat32 = 0x5be0cd19;
    var chunk = 0;
    while (chunk < paddedLen) {
      let w = Array.tabulate<Nat32>(64, func(i) {
        if (i < 16) {
          (padded[chunk + i * 4].toNat32() << 24)
          | (padded[chunk + i * 4 + 1].toNat32() << 16)
          | (padded[chunk + i * 4 + 2].toNat32() << 8)
          | padded[chunk + i * 4 + 3].toNat32();
        } else {
          0;
        };
      }).toVarArray();
      var wi = 16;
      while (wi < 64) {
        let s0 = rotr(w[wi - 15], 7) ^ rotr(w[wi - 15], 18) ^ (w[wi - 15] >> 3);
        let s1 = rotr(w[wi - 2], 17) ^ rotr(w[wi - 2], 19) ^ (w[wi - 2] >> 10);
        w[wi] := w[wi - 16] +% s0 +% w[wi - 7] +% s1;
        wi += 1;
      };
      var a = h0;
      var b = h1;
      var c = h2;
      var d = h3;
      var e = h4;
      var f = h5;
      var g = h6;
      var h = h7;
      var i = 0;
      while (i < 64) {
        let s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        let ch = (e & f) ^ (^e & g);
        let temp1 = h +% s1 +% ch +% SHA256_K[i] +% w[i];
        let s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let temp2 = s0 +% maj;
        h := g;
        g := f;
        f := e;
        e := d +% temp1;
        d := c;
        c := b;
        b := a;
        a := temp1 +% temp2;
        i += 1;
      };
      h0 := h0 +% a;
      h1 := h1 +% b;
      h2 := h2 +% c;
      h3 := h3 +% d;
      h4 := h4 +% e;
      h5 := h5 +% f;
      h6 := h6 +% g;
      h7 := h7 +% h;
      chunk += 64;
    };
    let out = Array.tabulate(32, func(i) {
      let word = switch (i / 4) {
        case (0) h0;
        case (1) h1;
        case (2) h2;
        case (3) h3;
        case (4) h4;
        case (5) h5;
        case (6) h6;
        case (_) h7;
      };
      let shift = Nat.sub(3, i % 4) * 8;
      ((word >> shift.toNat32()) & 0xff).toNat8();
    });
    out.toBlob();
  };

  // --- Byte helpers ----------------------------------------------------------

  // Unsigned LEB128.
  func leb128(n : Nat) : [Nat8] {
    var value = n;
    let out = List.empty<Nat8>();
    loop {
      var byte = (value % 128).toNat8();
      value := value / 128;
      if (value > 0) {
        byte := byte | 0x80;
      };
      out.add(byte);
      if (value == 0) { break };
    };
    out.toArray();
  };

  // Signed LEB128.
  func sleb128(i : Int) : [Nat8] {
    var value = i;
    let out = List.empty<Nat8>();
    loop {
      let low = ((value % 128) + 128) % 128;
      value := (value - low) / 128;
      let lowNat = Int.abs(low);
      let signBitSet = lowNat >= 64;
      if ((value == 0 and not signBitSet) or (value == -1 and signBitSet)) {
        out.add(lowNat.toNat8());
        break;
      };
      out.add((lowNat + 128).toNat8());
    };
    out.toArray();
  };

  func joinBytes(parts : [[Nat8]]) : [Nat8] {
    let out = List.empty<Nat8>();
    for (part in parts.values()) {
      for (b in part.values()) {
        out.add(b);
      };
    };
    out.toArray();
  };

  // --- ICRC-3 representation-independent hash --------------------------------

  public func hashValue(value : Value) : Blob {
    switch (value) {
      case (#Nat(n)) sha256(leb128(n).toBlob());
      case (#Int(i)) sha256(sleb128(i).toBlob());
      case (#Text(t)) sha256(t.encodeUtf8());
      case (#Blob(b)) sha256(b);
      case (#Array(items)) {
        sha256(joinBytes(items.map(func item = hashValue(item).toArray())).toBlob());
      };
      case (#Map(fields)) {
        let pairs = fields.map(
          func((key, v)) = joinBytes([sha256(key.encodeUtf8()).toArray(), hashValue(v).toArray()]).toBlob()
        );
        let sorted = pairs.sort();
        sha256(joinBytes(sorted.map(func p = p.toArray())).toBlob());
      };
    };
  };

  // --- ICRC-3 tip hash tree (IC hash-tree format) -----------------------------
  //
  // The tip tree is a fork of two labelled leaves, labels in lexicographic order:
  //   last_block_hash  -> 32-byte hash of the latest block (state.lastBlockHash)
  //   last_block_index -> unsigned LEB128 of the latest block index

  // SHA-256 over (len(sep) | sep | payload), the IC hash-tree domain separation.
  func domainHash(sep : Text, payload : [Nat8]) : [Nat8] {
    let s = sep.encodeUtf8().toArray();
    sha256(joinBytes([[s.size().toNat8()], s, payload]).toBlob()).toArray();
  };

  func leafHash(data : [Nat8]) : [Nat8] {
    domainHash("ic-hashtree-leaf", data);
  };

  func labeledHash(name : Text, subtreeHash : [Nat8]) : [Nat8] {
    domainHash("ic-hashtree-labeled", joinBytes([name.encodeUtf8().toArray(), subtreeHash]));
  };

  func forkHash(left : [Nat8], right : [Nat8]) : [Nat8] {
    domainHash("ic-hashtree-fork", joinBytes([left, right]));
  };

  // CBOR byte string (major type 2). Inputs here are at most a few dozen bytes.
  func cborBytes(data : [Nat8]) : [Nat8] {
    let n = data.size();
    let header : [Nat8] = if (n < 24) {
      [(64 + n).toNat8()];
    } else {
      [0x58, n.toNat8()];
    };
    header.concat(data);
  };

  // Leaf: [3, bytes]
  func cborLeaf(data : [Nat8]) : [Nat8] {
    joinBytes([[0x82, 0x03], cborBytes(data)]);
  };

  // Labeled: [2, label, subtree]
  func cborLabeled(name : Text, subtree : [Nat8]) : [Nat8] {
    joinBytes([[0x83, 0x02], cborBytes(name.encodeUtf8().toArray()), subtree]);
  };

  func tipRootHash(hash : Blob, index : Nat) : Blob {
    forkHash(
      labeledHash("last_block_hash", leafHash(hash.toArray())),
      labeledHash("last_block_index", leafHash(leb128(index))),
    ).toBlob();
  };

  type TipTree = { rootHash : Blob; hashTree : Blob };

  // The tip tree for the latest block, or null for an empty log.
  func tipTree(ledger : Ledger) : ?TipTree {
    let next = ledger.state.nextBlockIndex;
    if (next == 0) {
      return null;
    };
    let hash = switch (ledger.state.lastBlockHash) {
      case (null) { return null };
      case (?h) { h };
    };
    let tip = Nat.sub(next, 1);
    // Self-describe tag 55799, then fork = [1, left, right].
    let hashTree = joinBytes([
      [0xd9, 0xd9, 0xf7],
      [0x83, 0x01],
      cborLabeled("last_block_hash", cborLeaf(hash.toArray())),
      cborLabeled("last_block_index", cborLeaf(leb128(tip))),
    ]);
    ?{ rootHash = tipRootHash(hash, tip); hashTree = hashTree.toBlob() };
  };

  // Does `haystack` contain `needle` as a contiguous byte run?
  func containsBytes(haystack : Blob, needle : Blob) : Bool {
    let h = haystack.toArray();
    let n = needle.toArray();
    var i = 0;
    var found = false;
    while (not found and i + n.size() <= h.size()) {
      var j = 0;
      var matches = true;
      while (matches and j < n.size()) {
        if (h[i + j] != n[j]) { matches := false };
        j += 1;
      };
      if (matches) { found := true };
      i += 1;
    };
    found;
  };

  // --- Internal helpers ------------------------------------------------------

  // ICRC-1: an all-zero subaccount is the default (null) subaccount.
  func normalize(a : Account) : Account {
    switch (a.subaccount) {
      case (?s) {
        if (s.toArray().all(func b = b == 0)) {
          { owner = a.owner; subaccount = null };
        } else {
          a;
        };
      };
      case (null) a;
    };
  };

  func accountOf(owner : Principal, subaccount : ?Subaccount) : Account {
    normalize({ owner; subaccount });
  };

  func now() : Timestamp {
    Int.abs(Time.now()).toNat64();
  };

  func getBalance(ledger : Ledger, account : Account) : Nat {
    ledger.balances.get(account) ?? 0;
  };

  func setBalance(ledger : Ledger, account : Account, amount : Nat) {
    if (amount == 0) {
      ledger.balances.remove(account);
    } else {
      ledger.balances.add(account, amount);
    };
  };

  func credit(ledger : Ledger, account : Account, amount : Nat) {
    setBalance(ledger, account, getBalance(ledger, account) + amount);
  };

  func debit(ledger : Ledger, account : Account, amount : Nat) {
    setBalance(ledger, account, Nat.sub(getBalance(ledger, account), amount));
  };

  func genericError(code : Nat, message : Text) : { #GenericError : { error_code : Nat; message : Text } } {
    #GenericError({ error_code = code; message });
  };

  func memoTooLong(memo : ?Blob) : Bool {
    switch (memo) {
      case (?m) m.size() > MAX_MEMO_BYTES;
      case (null) false;
    };
  };

  type TimeError = {
    #TooOld;
    #CreatedInFuture : { ledger_time : Timestamp };
  };

  // created_at_time window: older than now - (TX_WINDOW + DRIFT) is TooOld,
  // more than DRIFT ahead of now is CreatedInFuture.
  func checkCreatedAt(created : ?Timestamp, nowTs : Timestamp) : ?TimeError {
    switch (created) {
      case (null) null;
      case (?t) {
        let c = t.toNat();
        let n = nowTs.toNat();
        if (c + TX_WINDOW_NS + PERMITTED_DRIFT_NS < n) {
          ?(#TooOld);
        } else if (c > n + PERMITTED_DRIFT_NS) {
          ?(#CreatedInFuture({ ledger_time = nowTs }));
        } else {
          null;
        };
      };
    };
  };

  func accountValue(a : Account) : Value {
    switch (a.subaccount) {
      case (?sub) #Array([#Blob(a.owner.toBlob()), #Blob(sub)]);
      case (null) #Array([#Blob(a.owner.toBlob())]);
    };
  };

  func addOptNat(fields : List.List<(Text, Value)>, key : Text, value : ?Nat) {
    switch (value) {
      case (?n) fields.add((key, #Nat(n)));
      case (null) {};
    };
  };

  func addOptTime(fields : List.List<(Text, Value)>, key : Text, value : ?Timestamp) {
    switch (value) {
      case (?t) fields.add((key, #Nat(t.toNat())));
      case (null) {};
    };
  };

  func addOptBlob(fields : List.List<(Text, Value)>, key : Text, value : ?Blob) {
    switch (value) {
      case (?b) fields.add((key, #Blob(b)));
      case (null) {};
    };
  };

  // Top-level effective fee: present only when the caller did not set tx.fee.
  func topFee(provided : ?Nat, charged : Nat) : ?Nat {
    switch (provided) {
      case (?_) null;
      case (null) ?charged;
    };
  };

  // Credit a charged fee to the fee collector; returns the collector account
  // for the block's fee_col, or null when no fee was charged.
  func creditFee(ledger : Ledger, canister : Principal, amount : Nat) : ?Account {
    if (amount == 0) {
      return null;
    };
    let collector = feeCollectorAccount(canister);
    credit(ledger, collector, amount);
    ?collector;
  };

  // Appends a standard ICRC-3 generic block:
  // { btype; ts; fee?; fee_col?; phash?; tx } and re-certifies the tip.
  func appendBlock(ledger : Ledger, btype : Text, ts : Timestamp, fee : ?Nat, feeCol : ?Account, tx : List.List<(Text, Value)>) : Nat {
    let fields = List.empty<(Text, Value)>();
    fields.add(("btype", #Text(btype)));
    fields.add(("ts", #Nat(ts.toNat())));
    addOptNat(fields, "fee", fee);
    switch (feeCol) {
      case (?c) fields.add(("fee_col", accountValue(c)));
      case (null) {};
    };
    addOptBlob(fields, "phash", ledger.state.lastBlockHash);
    fields.add(("tx", #Map(tx.toArray())));
    let block : Value = #Map(fields.toArray());
    let hash = hashValue(block);
    let index = ledger.state.nextBlockIndex;
    ledger.blocks.add(index, block);
    ledger.state.nextBlockIndex := index + 1;
    ledger.state.lastBlockHash := ?hash;
    CertifiedData.set(tipRootHash(hash, index));
    index;
  };

  // --- Deduplication -----------------------------------------------------------

  func dedupKey(btype : Text, tx : List.List<(Text, Value)>) : Blob {
    hashValue(#Map([("btype", #Text(btype)), ("tx", #Map(tx.toArray()))]));
  };

  func findDuplicate(ledger : Ledger, created : ?Timestamp, key : Blob) : ?Nat {
    switch (created) {
      case (null) null;
      case (?_) ledger.dedup.get(key);
    };
  };

  func recordDedup(ledger : Ledger, created : ?Timestamp, key : Blob, index : Nat, nowTs : Timestamp) {
    switch (created) {
      case (null) {};
      case (?_) {
        ledger.dedup.add(key, index);
        ledger.dedupQueue.add(index, { txHash = key; ledgerTime = nowTs });
      };
    };
  };

  // Drops at most MAX_DEDUP_PRUNE entries whose window has fully elapsed.
  // Entries are written in ledger-time order, so scanning stops at the first
  // entry that is still live.
  func pruneDedup(ledger : Ledger, nowTs : Timestamp) {
    let n = nowTs.toNat();
    let expired = List.empty<(Nat, Blob)>();
    for ((index, entry) in ledger.dedupQueue.entries()) {
      if (expired.size() >= MAX_DEDUP_PRUNE or entry.ledgerTime.toNat() + TX_WINDOW_NS + 2 * PERMITTED_DRIFT_NS >= n) {
        break;
      };
      expired.add((index, entry.txHash));
    };
    for ((index, key) in expired.values()) {
      ledger.dedupQueue.remove(index);
      if (ledger.dedup.get(key) == ?index) {
        ledger.dedup.remove(key);
      };
    };
  };

  // --- Approvals -------------------------------------------------------------

  // The non-expired approval of `spender` on `account`, if any.
  func activeApproval(ledger : Ledger, account : Account, spender : Account, nowTs : Timestamp) : ?Approval {
    let approval = switch (ledger.approvals.get(account)) {
      case (?spenders) spenders.get(spender);
      case (null) null;
    };
    switch (approval) {
      case (?a) {
        switch (a.expires_at) {
          case (?expiry) { if (expiry <= nowTs) { null } else { ?a } };
          case (null) ?a;
        };
      };
      case (null) null;
    };
  };

  // Sets (or removes, when amount is 0) an approval.
  func setApproval(ledger : Ledger, from : Account, spender : Account, amount : Nat, expiresAt : ?Timestamp) {
    switch (ledger.approvals.get(from)) {
      case (?spenders) {
        if (amount == 0) {
          spenders.remove(spender);
          if (spenders.isEmpty()) {
            ledger.approvals.remove(from);
          };
        } else {
          spenders.add(spender, { amount; expires_at = expiresAt });
        };
      };
      case (null) {
        if (amount > 0) {
          let spenders = Map.empty<Account, Approval>();
          spenders.add(spender, { amount; expires_at = expiresAt });
          ledger.approvals.add(from, spenders);
        };
      };
    };
  };

  // --- ICRC-1 ----------------------------------------------------------------

  public func name() : Text {
    TOKEN_NAME;
  };

  public func symbol() : Text {
    TOKEN_SYMBOL;
  };

  public func decimals() : Nat8 {
    TOKEN_DECIMALS;
  };

  public func fee(ledger : Ledger) : Nat {
    ledger.state.fee;
  };

  public func totalSupply(ledger : Ledger) : Nat {
    ledger.state.totalSupply;
  };

  public func maxSupply() : Nat {
    TOKEN_MAX_SUPPLY;
  };

  public func balanceOf(ledger : Ledger, account : Account) : Nat {
    getBalance(ledger, normalize(account));
  };

  public func metadata(ledger : Ledger) : [(Text, Icrc.MetadataValue)] {
    [
      ("icrc1:name", #Text(TOKEN_NAME)),
      ("icrc1:symbol", #Text(TOKEN_SYMBOL)),
      ("icrc1:decimals", #Nat(TOKEN_DECIMALS.toNat())),
      ("icrc1:fee", #Nat(ledger.state.fee)),
      ("icrc1:max_memo_length", #Nat(MAX_MEMO_BYTES)),
      ("icrc1:max_supply", #Nat(TOKEN_MAX_SUPPLY)),
    ];
  };

  public func supportedStandards() : [Icrc.SupportedStandard] {
    [
      { name = "ICRC-1"; url = ICRC1_URL },
      { name = "ICRC-2"; url = ICRC2_URL },
      { name = "ICRC-3"; url = ICRC3_URL },
      { name = "ICRC-10"; url = ICRC10_URL },
    ];
  };

  // The ICRC-1 minting account (= burn account).
  public func mintingAccount(canister : Principal) : ?Account {
    ?burnAccount(canister);
  };

  // `to == burnAccount(canister)` is a fee-less burn ("1burn"); otherwise a
  // "1xfer" whose fee is credited to the fee collector.
  public func transfer(ledger : Ledger, canister : Principal, caller : Principal, args : Icrc.TransferArgs) : Icrc.TransferResult {
    let nowTs = now();
    pruneDedup(ledger, nowTs);
    if (ledger.state.transfersFrozen) {
      return #Err(genericError(FROZEN_ERROR_CODE, FROZEN_MESSAGE));
    };
    if (memoTooLong(args.memo)) {
      return #Err(genericError(MEMO_ERROR_CODE, MEMO_MESSAGE));
    };
    switch (checkCreatedAt(args.created_at_time, nowTs)) {
      case (?e) { return #Err(e) };
      case (null) {};
    };
    let minting = burnAccount(canister);
    let from = accountOf(caller, args.from_subaccount);
    let to = normalize(args.to);
    if (from == minting) {
      return #Err(genericError(MINTING_ACCOUNT_ERROR_CODE, "Transfers from the minting account are not allowed"));
    };
    if (args.amount == 0) {
      return #Err(genericError(ZERO_AMOUNT_ERROR_CODE, ZERO_AMOUNT_MESSAGE));
    };
    let isBurn = to == minting;
    let currentFee = if (isBurn) 0 else ledger.state.fee;
    if ((args.fee ?? currentFee) != currentFee) {
      return #Err(#BadFee({ expected_fee = currentFee }));
    };
    if (isBurn and args.amount < MIN_BURN_AMOUNT) {
      return #Err(#BadBurn({ min_burn_amount = MIN_BURN_AMOUNT }));
    };
    let btype = if (isBurn) "1burn" else "1xfer";
    let tx = List.empty<(Text, Value)>();
    tx.add(("from", accountValue(from)));
    if (not isBurn) {
      tx.add(("to", accountValue(to)));
    };
    tx.add(("amt", #Nat(args.amount)));
    if (not isBurn) {
      addOptNat(tx, "fee", args.fee);
    };
    addOptBlob(tx, "memo", args.memo);
    addOptTime(tx, "created_at_time", args.created_at_time);
    let key = dedupKey(btype, tx);
    switch (findDuplicate(ledger, args.created_at_time, key)) {
      case (?original) { return #Err(#Duplicate({ duplicate_of = original })) };
      case (null) {};
    };
    let balance = getBalance(ledger, from);
    if (balance < args.amount + currentFee) {
      return #Err(#InsufficientFunds({ balance }));
    };
    debit(ledger, from, args.amount + currentFee);
    let index = if (isBurn) {
      ledger.state.totalSupply := Nat.sub(ledger.state.totalSupply, args.amount);
      appendBlock(ledger, btype, nowTs, null, null, tx);
    } else {
      credit(ledger, to, args.amount);
      let collector = creditFee(ledger, canister, currentFee);
      appendBlock(ledger, btype, nowTs, topFee(args.fee, currentFee), collector, tx);
    };
    recordDedup(ledger, args.created_at_time, key, index, nowTs);
    #Ok(index);
  };

  // --- ICRC-2 ----------------------------------------------------------------

  public func approve(ledger : Ledger, canister : Principal, caller : Principal, args : Icrc.ApproveArgs) : Icrc.ApproveResult {
    let nowTs = now();
    pruneDedup(ledger, nowTs);
    if (ledger.state.transfersFrozen) {
      return #Err(genericError(FROZEN_ERROR_CODE, FROZEN_MESSAGE));
    };
    if (memoTooLong(args.memo)) {
      return #Err(genericError(MEMO_ERROR_CODE, MEMO_MESSAGE));
    };
    switch (checkCreatedAt(args.created_at_time, nowTs)) {
      case (?e) { return #Err(e) };
      case (null) {};
    };
    let from = accountOf(caller, args.from_subaccount);
    let spender = normalize(args.spender);
    if (spender.owner == from.owner) {
      return #Err(genericError(SELF_APPROVE_ERROR_CODE, "Cannot approve yourself as spender"));
    };
    if (from == burnAccount(canister)) {
      return #Err(genericError(MINTING_ACCOUNT_ERROR_CODE, "The minting account cannot approve"));
    };
    switch (args.expires_at) {
      case (?expiry) {
        if (expiry <= nowTs) {
          return #Err(#Expired({ ledger_time = nowTs }));
        };
      };
      case (null) {};
    };
    let currentFee = ledger.state.fee;
    if ((args.fee ?? currentFee) != currentFee) {
      return #Err(#BadFee({ expected_fee = currentFee }));
    };
    let tx = List.empty<(Text, Value)>();
    tx.add(("from", accountValue(from)));
    tx.add(("spender", accountValue(spender)));
    tx.add(("amt", #Nat(args.amount)));
    addOptNat(tx, "expected_allowance", args.expected_allowance);
    addOptTime(tx, "expires_at", args.expires_at);
    addOptNat(tx, "fee", args.fee);
    addOptBlob(tx, "memo", args.memo);
    addOptTime(tx, "created_at_time", args.created_at_time);
    let key = dedupKey("2approve", tx);
    switch (findDuplicate(ledger, args.created_at_time, key)) {
      case (?original) { return #Err(#Duplicate({ duplicate_of = original })) };
      case (null) {};
    };
    let balance = getBalance(ledger, from);
    if (balance < currentFee) {
      return #Err(#InsufficientFunds({ balance }));
    };
    let currentAllowance = switch (activeApproval(ledger, from, spender, nowTs)) {
      case (?a) a.amount;
      case (null) 0;
    };
    switch (args.expected_allowance) {
      case (?expected) {
        if (expected != currentAllowance) {
          return #Err(#AllowanceChanged({ current_allowance = currentAllowance }));
        };
      };
      case (null) {};
    };
    debit(ledger, from, currentFee);
    let collector = creditFee(ledger, canister, currentFee);
    setApproval(ledger, from, spender, args.amount, args.expires_at);
    let index = appendBlock(ledger, "2approve", nowTs, topFee(args.fee, currentFee), collector, tx);
    recordDedup(ledger, args.created_at_time, key, index, nowTs);
    #Ok(index);
  };

  // Expired allowances report 0.
  public func allowance(ledger : Ledger, args : Icrc.AllowanceArgs) : Icrc.Allowance {
    switch (activeApproval(ledger, normalize(args.account), normalize(args.spender), now())) {
      case (?a) { { allowance = a.amount; expires_at = a.expires_at } };
      case (null) { { allowance = 0; expires_at = null } };
    };
  };

  // The allowance must cover amount + fee; after a partial spend the remaining
  // allowance keeps its original expires_at (removed when it reaches 0). A
  // transfer_from to the burn account is a fee-less "1burn".
  public func transferFrom(ledger : Ledger, canister : Principal, caller : Principal, args : Icrc.TransferFromArgs) : Icrc.TransferFromResult {
    let nowTs = now();
    pruneDedup(ledger, nowTs);
    if (ledger.state.transfersFrozen) {
      return #Err(genericError(FROZEN_ERROR_CODE, FROZEN_MESSAGE));
    };
    if (memoTooLong(args.memo)) {
      return #Err(genericError(MEMO_ERROR_CODE, MEMO_MESSAGE));
    };
    switch (checkCreatedAt(args.created_at_time, nowTs)) {
      case (?e) { return #Err(e) };
      case (null) {};
    };
    let minting = burnAccount(canister);
    let spender = accountOf(caller, args.spender_subaccount);
    let from = normalize(args.from);
    let to = normalize(args.to);
    if (from == minting) {
      return #Err(genericError(MINTING_ACCOUNT_ERROR_CODE, "Transfers from the minting account are not allowed"));
    };
    if (args.amount == 0) {
      return #Err(genericError(ZERO_AMOUNT_ERROR_CODE, ZERO_AMOUNT_MESSAGE));
    };
    let isBurn = to == minting;
    let currentFee = if (isBurn) 0 else ledger.state.fee;
    if ((args.fee ?? currentFee) != currentFee) {
      return #Err(#BadFee({ expected_fee = currentFee }));
    };
    if (isBurn and args.amount < MIN_BURN_AMOUNT) {
      return #Err(#BadBurn({ min_burn_amount = MIN_BURN_AMOUNT }));
    };
    let btype = if (isBurn) "1burn" else "1xfer";
    let tx = List.empty<(Text, Value)>();
    tx.add(("from", accountValue(from)));
    if (not isBurn) {
      tx.add(("to", accountValue(to)));
    };
    tx.add(("spender", accountValue(spender)));
    tx.add(("amt", #Nat(args.amount)));
    if (not isBurn) {
      addOptNat(tx, "fee", args.fee);
    };
    addOptBlob(tx, "memo", args.memo);
    addOptTime(tx, "created_at_time", args.created_at_time);
    let key = dedupKey(btype, tx);
    switch (findDuplicate(ledger, args.created_at_time, key)) {
      case (?original) { return #Err(#Duplicate({ duplicate_of = original })) };
      case (null) {};
    };
    let total = args.amount + currentFee;
    let approval = activeApproval(ledger, from, spender, nowTs);
    let currentAllowance = switch (approval) {
      case (?a) a.amount;
      case (null) 0;
    };
    if (currentAllowance < total) {
      return #Err(#InsufficientAllowance({ allowance = currentAllowance }));
    };
    let balance = getBalance(ledger, from);
    if (balance < total) {
      return #Err(#InsufficientFunds({ balance }));
    };
    debit(ledger, from, total);
    let originalExpiry = switch (approval) {
      case (?a) a.expires_at;
      case (null) null;
    };
    setApproval(ledger, from, spender, Nat.sub(currentAllowance, total), originalExpiry);
    let index = if (isBurn) {
      ledger.state.totalSupply := Nat.sub(ledger.state.totalSupply, args.amount);
      appendBlock(ledger, btype, nowTs, null, null, tx);
    } else {
      credit(ledger, to, args.amount);
      let collector = creditFee(ledger, canister, currentFee);
      appendBlock(ledger, btype, nowTs, topFee(args.fee, currentFee), collector, tx);
    };
    recordDedup(ledger, args.created_at_time, key, index, nowTs);
    #Ok(index);
  };

  // --- ICRC-3 ----------------------------------------------------------------

  // Serves every requested range in request order (each ascending) with direct
  // index lookups, at most MAX_BLOCKS_PER_CALL blocks in total. No archives.
  public func getBlocks(ledger : Ledger, args : [Icrc.GetBlocksArgs]) : Icrc.GetBlocksResult {
    let logLength = ledger.state.nextBlockIndex;
    let out = List.empty<Icrc.Block>();
    for (range in args.values()) {
      let stop = Nat.min(range.start + range.length, logLength);
      var i = range.start;
      while (i < stop and out.size() < MAX_BLOCKS_PER_CALL) {
        switch (ledger.blocks.get(i)) {
          case (?block) out.add({ id = i; block });
          case (null) {};
        };
        i += 1;
      };
    };
    { log_length = logLength; blocks = out.toArray(); archived_blocks = [] };
  };

  public func getArchives() : [Icrc.ArchiveInfo] {
    [];
  };

  public func getTipCertificate(ledger : Ledger) : ?Icrc.DataCertificate {
    let tree = switch (tipTree(ledger)) {
      case (null) { return null };
      case (?t) { t };
    };
    let cert = switch (CertifiedData.getCertificate()) {
      case (null) { return null };
      case (?c) { c };
    };
    // The certificate embeds the canister's certified data. If it does not
    // carry this tree's root hash, the certified data is stale (never set for
    // the current tip), so serve nothing rather than a mismatched pair.
    if (not containsBytes(cert, tree.rootHash)) {
      return null;
    };
    ?{ certificate = cert; hash_tree = tree.hashTree };
  };

  // Re-certify the current tip root hash. Called on every install/upgrade
  // because the IC may clear certified_data on upgrade. No-op for an empty log.
  public func certifyTip(ledger : Ledger) {
    switch (tipTree(ledger)) {
      case (?tree) { CertifiedData.set(tree.rootHash) };
      case (null) {};
    };
  };

  public func supportedBlockTypes() : [Icrc.SupportedBlockType] {
    [
      { block_type = "1xfer"; url = ICRC1_URL },
      { block_type = "2approve"; url = ICRC2_URL },
      { block_type = "1mint"; url = ICRC1_URL },
      { block_type = "1burn"; url = ICRC1_URL },
    ];
  };

  // --- Management ------------------------------------------------------------

  // Admin mint ("1mint"). Refused when frozen, for zero amounts, to the
  // minting account, or beyond max supply.
  public func mint(ledger : Ledger, canister : Principal, to : Account, amount : Nat) : Icrc.MintResult {
    if (ledger.state.transfersFrozen) {
      return #Err(genericError(FROZEN_ERROR_CODE, FROZEN_MESSAGE));
    };
    if (amount == 0) {
      return #Err(genericError(ZERO_AMOUNT_ERROR_CODE, ZERO_AMOUNT_MESSAGE));
    };
    let recipient = normalize(to);
    if (recipient == burnAccount(canister)) {
      return #Err(genericError(MINTING_ACCOUNT_ERROR_CODE, "Cannot mint to the minting account"));
    };
    if (ledger.state.totalSupply + amount > TOKEN_MAX_SUPPLY) {
      return #Err(genericError(MAX_SUPPLY_ERROR_CODE, "Mint would exceed max supply of " # TOKEN_MAX_SUPPLY.toText()));
    };
    let nowTs = now();
    credit(ledger, recipient, amount);
    ledger.state.totalSupply := ledger.state.totalSupply + amount;
    let tx = List.empty<(Text, Value)>();
    tx.add(("to", accountValue(recipient)));
    tx.add(("amt", #Nat(amount)));
    #Ok(appendBlock(ledger, "1mint", nowTs, null, null, tx));
  };

  // Burn ("1burn") from `from`. `authorized` is decided by the caller layer
  // (admins may burn any account, others only their own).
  public func burn(ledger : Ledger, canister : Principal, from : Account, amount : Nat, authorized : Bool) : Icrc.BurnResult {
    if (not authorized) {
      return #Err(genericError(UNAUTHORIZED_ERROR_CODE, "Cannot burn another account's tokens"));
    };
    if (ledger.state.transfersFrozen) {
      return #Err(genericError(FROZEN_ERROR_CODE, FROZEN_MESSAGE));
    };
    if (amount == 0) {
      return #Err(genericError(ZERO_AMOUNT_ERROR_CODE, ZERO_AMOUNT_MESSAGE));
    };
    if (amount < MIN_BURN_AMOUNT) {
      return #Err(#BadBurn({ min_burn_amount = MIN_BURN_AMOUNT }));
    };
    let source = normalize(from);
    if (source == burnAccount(canister)) {
      return #Err(genericError(MINTING_ACCOUNT_ERROR_CODE, "Cannot burn from the minting account"));
    };
    let balance = getBalance(ledger, source);
    if (balance < amount) {
      return #Err(#InsufficientFunds({ balance }));
    };
    let nowTs = now();
    debit(ledger, source, amount);
    ledger.state.totalSupply := Nat.sub(ledger.state.totalSupply, amount);
    let tx = List.empty<(Text, Value)>();
    tx.add(("from", accountValue(source)));
    tx.add(("amt", #Nat(amount)));
    #Ok(appendBlock(ledger, "1burn", nowTs, null, null, tx));
  };

  public func setFee(ledger : Ledger, newFee : Nat) : Token.SetFeeResult {
    if (newFee < MIN_FEE or newFee > MAX_FEE) {
      return #err("Fee out of range: must be between " # MIN_FEE.toText() # " and " # MAX_FEE.toText() # " base units");
    };
    ledger.state.fee := newFee;
    #ok;
  };

  public func feeBounds() : Token.FeeBounds {
    { min = MIN_FEE; max = MAX_FEE };
  };

  public func getFee(ledger : Ledger) : Nat {
    ledger.state.fee;
  };

  public func getMaxSupply() : Nat {
    TOKEN_MAX_SUPPLY;
  };

  // --- Transfer freeze (ledger.state.transfersFrozen) ------------------------

  public func isFrozen(ledger : Ledger) : Bool {
    ledger.state.transfersFrozen;
  };

  public func setFrozen(ledger : Ledger, frozen : Bool) : () {
    ledger.state.transfersFrozen := frozen;
  };

  // --- Fee collector / legacy history ----------------------------------------

  // The fee collector account and its balance.
  public func feeCollectorInfo(ledger : Ledger, canister : Principal) : FeeCollectorInfo {
    let account = feeCollectorAccount(canister);
    { account; balance = getBalance(ledger, account) };
  };

  // { boundaryIndex = state.legacyBlockBoundary; legacyDecimals = 4; currentDecimals = 8 }.
  public func legacyBlockInfo(ledger : Ledger) : LegacyBlockInfo {
    {
      boundaryIndex = ledger.state.legacyBlockBoundary;
      legacyDecimals = LEGACY_DECIMALS;
      currentDecimals = TOKEN_DECIMALS;
    };
  };

  // Every non-zero balance (fee collector included), used by the snapshot export.
  public func listBalances(ledger : Ledger) : [HolderBalance] {
    ledger.balances.entries()
      .filter(func((_, balance)) = balance > 0)
      .map(func((account, balance)) = { account; balance })
      .toArray();
  };

  // Presale delivery (refused when transfers are frozen): move min(amount,
  // collector balance) from the fee collector to `to` as a fee-0 "1xfer"
  // block, then mint the remainder as "1mint" (respecting max supply). On #err
  // nothing has been changed.
  public func deliverFromCollectorOrMint(ledger : Ledger, canister : Principal, to : Account, amount : Nat) : DeliveryResult {
    if (ledger.state.transfersFrozen) {
      return #err(FROZEN_MESSAGE);
    };
    if (amount == 0) {
      return #err("Delivery amount must be greater than zero");
    };
    let recipient = normalize(to);
    let collector = feeCollectorAccount(canister);
    if (recipient == collector) {
      return #err("Cannot deliver to the fee collector account");
    };
    if (recipient == burnAccount(canister)) {
      return #err("Cannot deliver to the burn account");
    };
    let collectorBalance = getBalance(ledger, collector);
    let fromCollector = if (collectorBalance < amount) collectorBalance else amount;
    let minted = Nat.sub(amount, fromCollector);
    if (ledger.state.totalSupply + minted > TOKEN_MAX_SUPPLY) {
      return #err("Delivery would exceed max supply of " # TOKEN_MAX_SUPPLY.toText());
    };
    // All checks passed; state changes start here.
    let nowTs = now();
    let indices = List.empty<Nat>();
    if (fromCollector > 0) {
      debit(ledger, collector, fromCollector);
      credit(ledger, recipient, fromCollector);
      let tx = List.empty<(Text, Value)>();
      tx.add(("from", accountValue(collector)));
      tx.add(("to", accountValue(recipient)));
      tx.add(("amt", #Nat(fromCollector)));
      indices.add(appendBlock(ledger, "1xfer", nowTs, ?0, null, tx));
    };
    if (minted > 0) {
      credit(ledger, recipient, minted);
      ledger.state.totalSupply := ledger.state.totalSupply + minted;
      let tx = List.empty<(Text, Value)>();
      tx.add(("to", accountValue(recipient)));
      tx.add(("amt", #Nat(minted)));
      indices.add(appendBlock(ledger, "1mint", nowTs, null, null, tx));
    };
    #ok({ fromCollector; minted; blockIndices = indices.toArray() });
  };
};
