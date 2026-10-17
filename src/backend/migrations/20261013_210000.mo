import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Int "mo:core/Int";
import Blob "mo:core/Blob";
import Text "mo:core/Text";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";
import Array "mo:core/Array";
import List "mo:core/List";
import CorePrincipal "mo:core/Principal";

// Standard ICRC-3 Value: lower-case legacy tags become the standard
// Nat/Int/Text/Blob tags (identical payloads, same block indexes); #nat8 widens
// to #Nat. The ledger gains lastBlockHash (representation-independent hash of
// the last existing block, so the first standard block chains to it) and an
// empty deduplication index. The unused merkleLeaves field is dropped.
module {
  // --- Old state (20261013_000000 NewActor, ledger only) ----------------------

  type Subaccount = Blob;

  type Account = {
    owner : CorePrincipal.Principal;
    subaccount : ?Subaccount;
  };

  type OldValue = {
    #nat : Nat;
    #int : Int;
    #nat8 : Nat8;
    #text : Text;
    #blob : Blob;
  };

  type Approval = { amount : Nat; expires_at : ?Nat64 };

  type OldLedgerState = {
    var totalSupply : Nat;
    var fee : Nat;
    var nextBlockIndex : Nat;
    var transfersFrozen : Bool;
    legacyBlockBoundary : Nat;
  };

  type OldLedger = {
    balances : Map.Map<Account, Nat>;
    approvals : Map.Map<Account, Map.Map<Account, Approval>>;
    blocks : Map.Map<Nat, OldValue>;
    state : OldLedgerState;
    var merkleLeaves : [Blob];
  };

  type OldActor = {
    ledger : OldLedger;
  };

  // --- New state -------------------------------------------------------------

  type Value = {
    #Nat : Nat;
    #Int : Int;
    #Text : Text;
    #Blob : Blob;
    #Array : [Value];
    #Map : [(Text, Value)];
  };

  type LedgerState = {
    var totalSupply : Nat;
    var fee : Nat;
    var nextBlockIndex : Nat;
    var transfersFrozen : Bool;
    legacyBlockBoundary : Nat;
    var lastBlockHash : ?Blob;
  };

  type DedupEntry = {
    txHash : Blob;
    ledgerTime : Nat64;
  };

  type Ledger = {
    balances : Map.Map<Account, Nat>;
    approvals : Map.Map<Account, Map.Map<Account, Approval>>;
    blocks : Map.Map<Nat, Value>;
    state : LedgerState;
    dedup : Map.Map<Blob, Nat>;
    dedupQueue : Map.Map<Nat, DedupEntry>;
  };

  type NewActor = {
    ledger : Ledger;
  };

  // --- SHA-256 + representation-independent hash -------------------------------

  let K : [Nat32] = [
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
    let paddedLen = (((len + 8) / 64) + 1) * 64;
    let lenFieldStart = Nat.sub(paddedLen, 8);
    let bitLen64 = (len * 8).toNat64();
    let padded = Array.tabulate<Nat8>(paddedLen, func(i) {
      if (i < len) { bytes[i] }
      else if (i == len) { 0x80 }
      else if (i >= lenFieldStart) {
        let shift = Nat.sub(Nat.sub(paddedLen, 1), i) * 8;
        ((bitLen64 >> shift.toNat64()) & 0xff).toNat8();
      } else { 0 };
    });
    let hs : [var Nat32] = [var 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var chunk = 0;
    while (chunk < paddedLen) {
      let w = Array.tabulate<Nat32>(64, func(i) {
        if (i < 16) {
          (padded[chunk + i * 4].toNat32() << 24)
          | (padded[chunk + i * 4 + 1].toNat32() << 16)
          | (padded[chunk + i * 4 + 2].toNat32() << 8)
          | padded[chunk + i * 4 + 3].toNat32();
        } else { 0 };
      }).toVarArray();
      var wi = 16;
      while (wi < 64) {
        let s0 = rotr(w[wi - 15], 7) ^ rotr(w[wi - 15], 18) ^ (w[wi - 15] >> 3);
        let s1 = rotr(w[wi - 2], 17) ^ rotr(w[wi - 2], 19) ^ (w[wi - 2] >> 10);
        w[wi] := w[wi - 16] +% s0 +% w[wi - 7] +% s1;
        wi += 1;
      };
      var a = hs[0];
      var b = hs[1];
      var c = hs[2];
      var d = hs[3];
      var e = hs[4];
      var f = hs[5];
      var g = hs[6];
      var h = hs[7];
      var i = 0;
      while (i < 64) {
        let s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        let ch = (e & f) ^ (^e & g);
        let temp1 = h +% s1 +% ch +% K[i] +% w[i];
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
      hs[0] := hs[0] +% a;
      hs[1] := hs[1] +% b;
      hs[2] := hs[2] +% c;
      hs[3] := hs[3] +% d;
      hs[4] := hs[4] +% e;
      hs[5] := hs[5] +% f;
      hs[6] := hs[6] +% g;
      hs[7] := hs[7] +% h;
      chunk += 64;
    };
    Array.tabulate(32, func(i) {
      let shift = Nat.sub(3, i % 4) * 8;
      ((hs[i / 4] >> shift.toNat32()) & 0xff).toNat8();
    }).toBlob();
  };

  func leb128(n : Nat) : [Nat8] {
    var value = n;
    let out = List.empty<Nat8>();
    loop {
      var byte = (value % 128).toNat8();
      value := value / 128;
      if (value > 0) { byte := byte | 0x80 };
      out.add(byte);
      if (value == 0) { break };
    };
    out.toArray();
  };

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

  func concatHashes(hashes : [Blob]) : Blob {
    let out = List.empty<Nat8>();
    for (h in hashes.values()) {
      for (b in h.values()) { out.add(b) };
    };
    out.toArray().toBlob();
  };

  func hashValue(value : Value) : Blob {
    switch (value) {
      case (#Nat(n)) sha256(leb128(n).toBlob());
      case (#Int(i)) sha256(sleb128(i).toBlob());
      case (#Text(t)) sha256(t.encodeUtf8());
      case (#Blob(b)) sha256(b);
      case (#Array(items)) sha256(concatHashes(items.map(hashValue)));
      case (#Map(fields)) {
        let pairs = fields.map(func((k, v)) = concatHashes([sha256(k.encodeUtf8()), hashValue(v)]));
        sha256(concatHashes(pairs.sort()));
      };
    };
  };

  func convert(v : OldValue) : Value {
    switch (v) {
      case (#nat(n)) #Nat(n);
      case (#int(i)) #Int(i);
      case (#nat8(n)) #Nat(n.toNat());
      case (#text(t)) #Text(t);
      case (#blob(b)) #Blob(b);
    };
  };

  // --- Migration -------------------------------------------------------------

  public func migration(old : OldActor) : NewActor {
    let blocks = old.ledger.blocks.map<Nat, OldValue, Value>(func(_, v) = convert(v));
    let next = old.ledger.state.nextBlockIndex;
    let lastBlockHash : ?Blob = if (next == 0) null else {
      switch (blocks.get(Nat.sub(next, 1))) {
        case (?block) ?hashValue(block);
        case (null) null;
      };
    };
    {
      ledger = {
        balances = old.ledger.balances;
        approvals = old.ledger.approvals;
        blocks;
        state = {
          var totalSupply = old.ledger.state.totalSupply;
          var fee = old.ledger.state.fee;
          var nextBlockIndex = next;
          var transfersFrozen = old.ledger.state.transfersFrozen;
          legacyBlockBoundary = old.ledger.state.legacyBlockBoundary;
          var lastBlockHash = lastBlockHash;
        };
        dedup = Map.empty();
        dedupQueue = Map.empty();
      };
    };
  };
};
