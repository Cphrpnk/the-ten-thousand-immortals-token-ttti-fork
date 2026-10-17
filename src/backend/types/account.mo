import Principal "mo:core/Principal";
import Order "mo:core/Order";
import Blob "mo:core/Blob";
import Char "mo:core/Char";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Nat32 "mo:core/Nat32";

module {
  public type Subaccount = Blob;

  public type Account = {
    owner : Principal;
    subaccount : ?Subaccount;
  };

  public func compare(a : Account, b : Account) : Order.Order {
    switch (Principal.compare(a.owner, b.owner)) {
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

  public func equal(a : Account, b : Account) : Bool {
    Principal.equal(a.owner, b.owner) and a.subaccount == b.subaccount;
  };

  let BASE32_ALPHABET : [Char] = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
    'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '2', '3', '4', '5', '6', '7',
  ];

  let HEX_DIGITS : [Char] = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f',
  ];

  // CRC-32 (IEEE 802.3, reflected polynomial 0xEDB88320).
  func crc32(bytes : [Nat8]) : Nat32 {
    var crc : Nat32 = 0xFFFFFFFF;
    for (byte in bytes.values()) {
      crc := crc ^ byte.toNat32();
      var k = 0;
      while (k < 8) {
        if ((crc & 1) == 1) {
          crc := (crc >> 1) ^ 0xEDB88320;
        } else {
          crc := crc >> 1;
        };
        k += 1;
      };
    };
    crc ^ 0xFFFFFFFF;
  };

  // RFC 4648 base32, lowercase, no padding.
  func base32(bytes : [Nat8]) : Text {
    var buffer : Nat = 0;
    var bits : Nat = 0;
    var out = "";
    for (byte in bytes.values()) {
      buffer := buffer * 256 + byte.toNat();
      bits += 8;
      while (bits >= 5) {
        let shift = Nat.sub(bits, 5);
        let divisor = 2 ** shift;
        out #= BASE32_ALPHABET[buffer / divisor].toText();
        buffer := buffer % divisor;
        bits := shift;
      };
    };
    if (bits > 0) {
      out #= BASE32_ALPHABET[buffer * (2 ** Nat.sub(5, bits))].toText();
    };
    out;
  };

  // Lowercase hex with leading zeros stripped.
  func hexStripped(bytes : [Nat8]) : Text {
    var out = "";
    var started = false;
    for (byte in bytes.values()) {
      let n = byte.toNat();
      for (digit in [n / 16, n % 16].values()) {
        if (started or digit != 0) {
          started := true;
          out #= HEX_DIGITS[digit].toText();
        };
      };
    };
    out;
  };

  // Standard ICRC-1 textual encoding: a null or all-zero subaccount is the bare
  // principal text; otherwise
  // `<principal>-<base32(crc32(principal bytes || subaccount))>.<hex subaccount>`
  // with the hex subaccount's leading zeros stripped.
  public func toText(a : Account) : Text {
    let ownerText = a.owner.toText();
    switch (a.subaccount) {
      case (null) ownerText;
      case (?sub) {
        let subBytes = sub.toArray();
        if (subBytes.all(func b = b == 0)) {
          return ownerText;
        };
        let checksum = crc32(a.owner.toBlob().toArray().concat(subBytes));
        let checksumBytes : [Nat8] = [
          ((checksum >> 24) & 0xff).toNat8(),
          ((checksum >> 16) & 0xff).toNat8(),
          ((checksum >> 8) & 0xff).toNat8(),
          (checksum & 0xff).toNat8(),
        ];
        ownerText # "-" # base32(checksumBytes) # "." # hexStripped(subBytes);
      };
    };
  };
};
