import { Principal } from "@icp-sdk/core/principal";
import type { Block, LegacyBlockInfo, Value__1 } from "../backend";
import { LEGACY_TTTI_DECIMALS, TTTI_DECIMALS } from "./token";

/** ICRC-3 generic block value as returned by icrc3_get_blocks. */
export type BlockValue = Value__1;

/** Maximum number of blocks the ledger serves per icrc3_get_blocks call. */
export const MAX_BLOCKS_PER_CALL = 100n;

export type BlockKind =
  | "transfer"
  | "transferFrom"
  | "approve"
  | "mint"
  | "burn"
  | "legacy-unknown";

export interface DecodedMemo {
  hex: string;
  /** Present only when the memo is valid, printable UTF-8. */
  utf8?: string;
}

export interface DecodedBlock {
  id: bigint;
  kind: BlockKind;
  /** True for pre-upgrade ':'-separated Text blocks. */
  legacy: boolean;
  btype?: string;
  from?: string;
  to?: string;
  spender?: string;
  amount: bigint | null;
  fee?: bigint;
  feeCollector?: string;
  memo?: DecodedMemo;
  createdAt?: bigint;
  /** Ledger timestamp in nanoseconds. */
  ts: bigint | null;
  expiresAt?: bigint;
  expectedAllowance?: bigint;
  /** Hex hash of the parent block (new blocks only). */
  phash?: string;
  /** Decimals this block's amounts are encoded with. */
  decimals: number;
}

// --- Bytes, hex, CRC32, base32 ----------------------------------------------

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Short hex for display, e.g. "3fa9c2…0b71". */
export function shortHex(hex: string, head = 6, tail = 4): string {
  if (hex.length <= head + tail + 1) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): Uint8Array {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  return new Uint8Array([
    (crc >>> 24) & 0xff,
    (crc >>> 16) & 0xff,
    (crc >>> 8) & 0xff,
    crc & 0xff,
  ]);
}

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/** RFC 4648 base32, lowercase, without padding. */
function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/**
 * Standard ICRC-1 textual account encoding: the bare principal for a null or
 * all-zero subaccount, else `principal-checksum.hexSubaccount` where checksum
 * is base32(crc32(owner bytes || 32-byte subaccount)) and the hex subaccount
 * has its leading zeros stripped.
 */
export function encodeIcrcAccountText(
  owner: Principal | Uint8Array,
  subaccount?: Uint8Array | null,
): string {
  const principal =
    owner instanceof Uint8Array ? Principal.fromUint8Array(owner) : owner;
  const ownerText = principal.toText();
  if (!subaccount || subaccount.every((byte) => byte === 0)) return ownerText;

  const sub = new Uint8Array(32);
  sub.set(subaccount.slice(-32), 32 - Math.min(subaccount.length, 32));
  const ownerBytes = principal.toUint8Array();
  const joined = new Uint8Array(ownerBytes.length + sub.length);
  joined.set(ownerBytes, 0);
  joined.set(sub, ownerBytes.length);

  const checksum = base32(crc32(joined));
  const hex = toHex(sub).replace(/^0+/, "");
  return `${ownerText}-${checksum}.${hex}`;
}

// --- Value accessors ---------------------------------------------------------

type Fields = Map<string, BlockValue>;

function asFields(value: BlockValue | undefined): Fields | null {
  return value?.__kind__ === "Map" ? new Map(value.Map) : null;
}

function natField(fields: Fields, key: string): bigint | undefined {
  const value = fields.get(key);
  if (value?.__kind__ === "Nat") return value.Nat;
  if (value?.__kind__ === "Int") return value.Int;
  return undefined;
}

function textField(fields: Fields, key: string): string | undefined {
  const value = fields.get(key);
  return value?.__kind__ === "Text" ? value.Text : undefined;
}

function blobField(fields: Fields, key: string): Uint8Array | undefined {
  const value = fields.get(key);
  return value?.__kind__ === "Blob" ? value.Blob : undefined;
}

/** Account values are Array [Blob owner] or [Blob owner, Blob subaccount]. */
function accountField(fields: Fields, key: string): string | undefined {
  const value = fields.get(key);
  if (value?.__kind__ !== "Array") return undefined;
  const [owner, subaccount] = value.Array;
  if (owner?.__kind__ !== "Blob") return undefined;
  try {
    return encodeIcrcAccountText(
      owner.Blob,
      subaccount?.__kind__ === "Blob" ? subaccount.Blob : null,
    );
  } catch {
    return toHex(owner.Blob);
  }
}

function isPrintable(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return false;
  }
  return text.length > 0;
}

export function decodeMemo(bytes: Uint8Array): DecodedMemo {
  const hex = toHex(bytes);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return isPrintable(text) ? { hex, utf8: text } : { hex };
  } catch {
    return { hex };
  }
}

// --- Block decoding ------------------------------------------------------------

function decodeMapBlock(
  id: bigint,
  top: Fields,
  decimals: number,
): DecodedBlock {
  const tx = asFields(top.get("tx")) ?? new Map<string, BlockValue>();
  const btype = textField(top, "btype");
  const memo = blobField(tx, "memo");
  const phash = blobField(top, "phash");
  const spender = accountField(tx, "spender");

  const entry: DecodedBlock = {
    id,
    kind: "legacy-unknown",
    legacy: false,
    btype,
    from: accountField(tx, "from"),
    to: accountField(tx, "to"),
    spender,
    amount: natField(tx, "amt") ?? null,
    fee: natField(tx, "fee") ?? natField(top, "fee"),
    feeCollector: accountField(top, "fee_col"),
    memo: memo ? decodeMemo(memo) : undefined,
    createdAt: natField(tx, "created_at_time"),
    ts: natField(top, "ts") ?? null,
    phash: phash ? toHex(phash) : undefined,
    decimals,
  };

  switch (btype) {
    case "1xfer":
      return { ...entry, kind: spender ? "transferFrom" : "transfer" };
    case "2approve":
      return {
        ...entry,
        kind: "approve",
        expectedAllowance: natField(tx, "expected_allowance"),
        expiresAt: natField(tx, "expires_at"),
      };
    case "1mint":
      return { ...entry, kind: "mint" };
    case "1burn":
      return { ...entry, kind: "burn", fee: undefined };
    default:
      return entry;
  }
}

function toBigInt(value: string | undefined): bigint | undefined {
  if (value === undefined || value === "") return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function orUndefined(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

/** Pre-upgrade ':'-separated Text blocks (types '1'..'4'). */
function decodeLegacyText(
  id: bigint,
  raw: string,
  decimals: number,
): DecodedBlock {
  const parts = raw.split(":");
  const base: DecodedBlock = {
    id,
    kind: "legacy-unknown",
    legacy: true,
    amount: null,
    ts: null,
    decimals,
  };

  switch (parts[0]) {
    case "1": {
      // 1:from:to:amount:fee:timestamp[:feeCollector]
      return {
        ...base,
        kind: "transfer",
        from: orUndefined(parts[1]),
        to: orUndefined(parts[2]),
        amount: toBigInt(parts[3]) ?? null,
        fee: toBigInt(parts[4]),
        ts: toBigInt(parts[5]) ?? null,
        feeCollector: orUndefined(parts[6]),
      };
    }
    case "2": {
      // 2:from:spender:amount:fee:expires:timestamp[:feeCollector]
      const expires = toBigInt(parts[5]);
      return {
        ...base,
        kind: "approve",
        from: orUndefined(parts[1]),
        spender: orUndefined(parts[2]),
        amount: toBigInt(parts[3]) ?? null,
        fee: toBigInt(parts[4]),
        expiresAt: expires && expires > 0n ? expires : undefined,
        ts: toBigInt(parts[6]) ?? null,
        feeCollector: orUndefined(parts[7]),
      };
    }
    case "3":
      // 3:to:amount:timestamp
      return {
        ...base,
        kind: "mint",
        to: orUndefined(parts[1]),
        amount: toBigInt(parts[2]) ?? null,
        ts: toBigInt(parts[3]) ?? null,
      };
    case "4":
      // 4:from:amount:timestamp
      return {
        ...base,
        kind: "burn",
        from: orUndefined(parts[1]),
        amount: toBigInt(parts[2]) ?? null,
        ts: toBigInt(parts[3]) ?? null,
      };
    case "legacy":
      // legacy:index:amount
      return { ...base, amount: toBigInt(parts[2]) ?? null };
    default:
      return base;
  }
}

/**
 * Decode a block Value into a typed entry. Map values are ICRC-3 standard
 * blocks (always `currentDecimals`); Text values are legacy blocks whose
 * decimals follow the legacy boundary.
 */
export function decodeBlockValue(
  id: bigint,
  value: BlockValue,
  legacyInfo?: LegacyBlockInfo,
): DecodedBlock {
  const current = legacyInfo?.currentDecimals || TTTI_DECIMALS;
  const legacyDecimals = legacyInfo?.legacyDecimals || LEGACY_TTTI_DECIMALS;
  const top = asFields(value);
  if (top) return decodeMapBlock(id, top, current);

  const belowBoundary = !!legacyInfo && id < legacyInfo.boundaryIndex;
  const decimals = belowBoundary ? legacyDecimals : current;
  if (value.__kind__ === "Text") {
    return decodeLegacyText(id, value.Text, decimals);
  }
  return {
    id,
    kind: "legacy-unknown",
    legacy: belowBoundary,
    amount: null,
    ts: null,
    decimals,
  };
}

export function decodeBlock(
  block: Block,
  legacyInfo?: LegacyBlockInfo,
): DecodedBlock {
  return decodeBlockValue(block.id, block.block, legacyInfo);
}

// --- Tip certificate hash tree -------------------------------------------------

export interface DecodedHashTree {
  lastBlockHash: Uint8Array;
  lastBlockIndex: bigint;
}

const SELF_DESCRIBE = [0xd9, 0xd9, 0xf7];

function expectBytes(bytes: Uint8Array, pos: number, expected: number[]) {
  for (let i = 0; i < expected.length; i++) {
    if (bytes[pos + i] !== expected[i]) {
      throw new Error("Unexpected CBOR structure");
    }
  }
  return pos + expected.length;
}

function readByteString(
  bytes: Uint8Array,
  pos: number,
): { value: Uint8Array; next: number } {
  const head = bytes[pos];
  if (head === undefined) throw new Error("Unexpected end of data");
  let length: number;
  let start: number;
  if (head >= 0x40 && head < 0x58) {
    length = head - 0x40;
    start = pos + 1;
  } else if (head === 0x58) {
    const len = bytes[pos + 1];
    if (len === undefined) throw new Error("Unexpected end of data");
    length = len;
    start = pos + 2;
  } else {
    throw new Error("Expected a CBOR byte string");
  }
  if (start + length > bytes.length) throw new Error("Truncated byte string");
  return { value: bytes.slice(start, start + length), next: start + length };
}

function readLabeledLeaf(
  bytes: Uint8Array,
  pos: number,
): { label: string; value: Uint8Array; next: number } {
  // 83 02 <label> 82 03 <value>
  let cursor = expectBytes(bytes, pos, [0x83, 0x02]);
  const label = readByteString(bytes, cursor);
  cursor = expectBytes(bytes, label.next, [0x82, 0x03]);
  const value = readByteString(bytes, cursor);
  return {
    label: new TextDecoder().decode(label.value),
    value: value.value,
    next: value.next,
  };
}

function readLeb128(bytes: Uint8Array): bigint {
  if (bytes.length === 0) throw new Error("Empty LEB128 value");
  let result = 0n;
  let shift = 0n;
  for (const byte of bytes) {
    result |= BigInt(byte & 0x7f) << shift;
    shift += 7n;
    if ((byte & 0x80) === 0) return result;
  }
  throw new Error("Unterminated LEB128 value");
}

/** Decode the ICRC-3 tip hash tree: d9d9f7 83 01 <leaf> <leaf>. */
export function decodeTipHashTree(bytes: Uint8Array): DecodedHashTree {
  let pos = expectBytes(bytes, 0, SELF_DESCRIBE);
  pos = expectBytes(bytes, pos, [0x83, 0x01]);
  const left = readLabeledLeaf(bytes, pos);
  const right = readLabeledLeaf(bytes, left.next);
  const leaves = new Map<string, Uint8Array>([
    [left.label, left.value],
    [right.label, right.value],
  ]);
  const hash = leaves.get("last_block_hash");
  const index = leaves.get("last_block_index");
  if (!hash || !index) throw new Error("Missing tip labels");
  return { lastBlockHash: hash, lastBlockIndex: readLeb128(index) };
}
