import { T as TTTI_SYMBOL, a as TOKEN_NAME, b as TTTI_DECIMALS, c as TreasuryMode, L as LEGACY_TTTI_DECIMALS, U as UserRole, H as HolderKind, M as MAX_MARGIN_BPS, v as validateDeliveryAddress, I as ICP_DIVISOR, P as PriceSource, d as MIN_PURCHASE, e as TOKEN_PRICE_USD, f as Principal, g as TTTI_DIVISOR, t as tttiFromIcp, O as OracleStatus, w as withPriceProtection, i as icpForTtti, h as TRANSFERS_FROZEN_PURCHASE_MESSAGE, C as ConversionStatus, j as exactFallbackIcpCost, k as exactLiveIcpCost } from "./index-RtH6BxUK.js";
const FEE = 100n;
const FEE_BOUNDS = { min: 0n, max: 10000n };
const MAX_SUPPLY = 10000n * TTTI_DIVISOR;
const ALLOCATION = 1n * TTTI_DIVISOR;
const ICP_LEDGER_FEE = 10000n;
const MOCK_USD_E8 = 1250000000n;
const MOCK_USD_MICRO = MOCK_USD_E8 / 100n;
const MOCK_LIVE_RATE = tttiFromIcp(ICP_DIVISOR, MOCK_USD_E8);
const FALLBACK_RATE = 100000n;
const nowNs = () => BigInt(Date.now()) * 1000000n;
const principalFrom = (seed) => Principal.fromUint8Array(
  new Uint8Array(Array.from({ length: 29 }, (_, i) => seed * 31 + i & 255))
);
const ICP_CANISTER = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
const CKBTC_CANISTER = Principal.fromText("mxzaz-hqaaa-aaaar-qaada-cai");
const CKUSDC_CANISTER = Principal.fromText("xevnm-gaaaa-aaaar-qafnq-cai");
const TTTI_CANISTER = Principal.fromUint8Array(
  new Uint8Array([0, 0, 0, 0, 0, 48, 0, 18, 1, 1])
);
const CALLER = principalFrom(1);
const HOLDER_2 = principalFrom(2);
const HOLDER_3 = principalFrom(3);
const CALLER_ACCOUNT = { owner: CALLER };
const FEE_COLLECTOR = {
  owner: TTTI_CANISTER,
  subaccount: new TextEncoder().encode("FEE-COLLECTOR-TTTI-P-00000000001")
};
const BURN_ACCOUNT = { owner: TTTI_CANISTER };
const TREASURY_ACCOUNT = {
  owner: HOLDER_3,
  subaccount: new Uint8Array(Array.from({ length: 32 }, (_, i) => i === 31 ? 7 : 0))
};
const STANDARDS = [
  { name: "ICRC-1", url: "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1" },
  { name: "ICRC-2", url: "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-2" },
  { name: "ICRC-3", url: "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-3" },
  { name: "ICRC-10", url: "https://github.com/dfinity/ICRC/blob/main/ICRCs/ICRC-10/ICRC-10.md" }
];
const state = {
  originalWhitePaper: null,
  salesPaused: false,
  fallbackEnabled: false,
  transfersFrozen: false,
  sold: 1250000n,
  fee: FEE,
  feeCollectorBalance: 300n,
  deliveryAddress: null,
  conversions: [],
  treasuryConfig: {
    mode: TreasuryMode.auto,
    rate: FALLBACK_RATE,
    icpAccount: TREASURY_ACCOUNT,
    marginBps: 0n
  }
};
const tokens = () => [
  { canisterId: ICP_CANISTER, name: "Internet Computer", symbol: "ICP", decimals: 8, fee: ICP_LEDGER_FEE },
  { canisterId: TTTI_CANISTER, name: TOKEN_NAME, symbol: TTTI_SYMBOL, decimals: TTTI_DECIMALS, fee: state.fee },
  { canisterId: CKBTC_CANISTER, name: "ckBTC", symbol: "ckBTC", decimals: 8, fee: 10n },
  { canisterId: CKUSDC_CANISTER, name: "ckUSDC", symbol: "ckUSDC", decimals: 6, fee: 10000n }
];
const SAMPLE_BALANCES = {
  [ICP_CANISTER.toText()]: 250000000n,
  [TTTI_CANISTER.toText()]: 250000n,
  [CKBTC_CANISTER.toText()]: 1500000n,
  [CKUSDC_CANISTER.toText()]: 125000000n
};
function liveTtti(icpAmount) {
  return icpAmount * MOCK_USD_E8 * (10000n - state.treasuryConfig.marginBps) / 10n ** 16n;
}
function makeConversion(icpAmount, recipient, exact) {
  const tttiAmount = (exact == null ? void 0 : exact.tttiAmount) ?? liveTtti(icpAmount);
  const fromCollector = state.feeCollectorBalance < tttiAmount ? state.feeCollectorBalance : tttiAmount;
  return {
    id: BigInt(state.conversions.length + 1),
    status: ConversionStatus.completed,
    depositor: CALLER,
    usedFallback: (exact == null ? void 0 : exact.usedFallback) ?? false,
    priceUsdE8: (exact == null ? void 0 : exact.priceUsdE8) ?? MOCK_USD_E8,
    minted: tttiAmount - fromCollector,
    fromCollector,
    recipient,
    timestamp: nowNs(),
    tttiAmount,
    icpAmount,
    forward: { __kind__: "forwarded", forwarded: icpAmount - ICP_LEDGER_FEE }
  };
}
state.conversions.push(makeConversion(ICP_DIVISOR, CALLER_ACCOUNT));
state.conversions.unshift({
  ...makeConversion(ICP_DIVISOR / 2n, { owner: HOLDER_2 }),
  depositor: HOLDER_2,
  forward: {
    __kind__: "failed",
    failed: "ICP ledger transfer failed: TemporarilyUnavailable"
  }
});
let nextIcpBlockIndex = 9118204n;
function purchaseError(code, message) {
  return { __kind__: "Err", Err: { code, message } };
}
const frozenError = () => purchaseError({ __kind__: "transfersFrozen", transfersFrozen: null }, TRANSFERS_FROZEN_PURCHASE_MESSAGE);
function mockPurchase(recipient, icpAmount) {
  if (state.salesPaused) {
    return purchaseError({ __kind__: "salesPaused", salesPaused: null }, "Sales are paused.");
  }
  if (state.transfersFrozen) return frozenError();
  const remaining = ALLOCATION - state.sold;
  if (remaining <= 0n) {
    return purchaseError({ __kind__: "presaleComplete", presaleComplete: null }, "Presale complete.");
  }
  const requested = liveTtti(icpAmount);
  if (requested < MIN_PURCHASE) {
    return purchaseError(
      { __kind__: "belowMinimum", belowMinimum: { minimumTtti: MIN_PURCHASE, requestedTtti: requested } },
      "The minimum purchase is 1 USD (0.0001 TTTI-P)."
    );
  }
  if (requested > remaining) {
    return purchaseError(
      {
        __kind__: "aboveRemaining",
        aboveRemaining: {
          maximumIcpE8s: icpForTtti(remaining, MOCK_USD_E8),
          maximumTtti: remaining,
          requestedTtti: requested
        }
      },
      "Only the remaining presale allocation can be purchased."
    );
  }
  const conversion = makeConversion(icpAmount, recipient ?? state.deliveryAddress ?? CALLER_ACCOUNT);
  state.feeCollectorBalance -= conversion.fromCollector;
  state.sold += conversion.tttiAmount;
  state.conversions.unshift(conversion);
  return { __kind__: "Ok", Ok: conversion };
}
const PROTECTION_BPS = 200n;
const PRICE_MOVE_DEMO_TTTI = 123456n;
const PRICE_MOVE_DEMO_BPS = 500n;
const MOCK_PRICE_STALE = false;
function exactCost(tttiAmount, useFallback, usdE8) {
  return useFallback ? exactFallbackIcpCost(tttiAmount, state.treasuryConfig.rate) : exactLiveIcpCost(tttiAmount, usdE8, state.treasuryConfig.marginBps);
}
function checkExact(tttiAmount) {
  const fail = (result) => ({ ok: false, result });
  if (tttiAmount <= 0n) {
    return fail(purchaseError({ __kind__: "invalidAmount", invalidAmount: null }, "Enter an amount greater than 0."));
  }
  if (state.salesPaused) {
    return fail(purchaseError({ __kind__: "salesPaused", salesPaused: null }, "Sales are paused."));
  }
  if (state.transfersFrozen) return fail(frozenError());
  const remaining = ALLOCATION > state.sold ? ALLOCATION - state.sold : 0n;
  if (remaining === 0n) {
    return fail(purchaseError({ __kind__: "presaleComplete", presaleComplete: null }, "Presale complete."));
  }
  const useFallback = state.fallbackEnabled && MOCK_USD_E8 <= 0n && state.treasuryConfig.rate > 0n;
  if (!useFallback && MOCK_USD_E8 <= 0n) {
    return fail(
      purchaseError({ __kind__: "priceUnavailable", priceUnavailable: null }, "Price unavailable — please try again in a moment.")
    );
  }
  const buysWholeSmallRemainder = remaining < MIN_PURCHASE && tttiAmount === remaining;
  if (tttiAmount < MIN_PURCHASE && !buysWholeSmallRemainder) {
    return fail(
      purchaseError(
        { __kind__: "belowMinimum", belowMinimum: { minimumTtti: MIN_PURCHASE, requestedTtti: tttiAmount } },
        "The minimum purchase is 1 USD (0.0001 TTTI-P)."
      )
    );
  }
  if (tttiAmount > remaining) {
    return fail(
      purchaseError(
        {
          __kind__: "aboveRemaining",
          aboveRemaining: {
            maximumIcpE8s: exactCost(remaining, useFallback, MOCK_USD_E8),
            maximumTtti: remaining,
            requestedTtti: tttiAmount
          }
        },
        "Only the remaining presale allocation can be purchased."
      )
    );
  }
  return { ok: true, useFallback, costE8s: exactCost(tttiAmount, useFallback, MOCK_USD_E8) };
}
function mockQuoteExact(tttiAmount) {
  const check = checkExact(tttiAmount);
  if (!check.ok) {
    if (check.result.__kind__ === "Err") return { __kind__: "Err", Err: check.result.Err };
    return { __kind__: "Err", Err: { code: { __kind__: "invalidAmount", invalidAmount: null }, message: "Invalid amount." } };
  }
  return {
    __kind__: "Ok",
    Ok: {
      tttiAmount,
      icpCostE8s: check.costE8s,
      maxIcpE8s: withPriceProtection(check.costE8s, PROTECTION_BPS),
      priceUsdE8: check.useFallback ? 0n : MOCK_USD_E8,
      usedFallback: check.useFallback,
      priceStale: MOCK_PRICE_STALE,
      protectionBps: PROTECTION_BPS
    }
  };
}
function mockBuyExact(recipient, tttiAmount, maxIcpE8s) {
  const check = checkExact(tttiAmount);
  if (!check.ok) return check.result;
  const required = tttiAmount === PRICE_MOVE_DEMO_TTTI ? (check.costE8s * (10000n + PRICE_MOVE_DEMO_BPS) + 9999n) / 10000n : check.costE8s;
  if (required > maxIcpE8s) {
    return purchaseError(
      { __kind__: "priceMoved", priceMoved: { requiredIcpE8s: required, maxIcpE8s } },
      "Price moved above your approved maximum — no ICP was taken, please retry"
    );
  }
  const conversion = makeConversion(required, recipient ?? state.deliveryAddress ?? CALLER_ACCOUNT, {
    tttiAmount,
    priceUsdE8: check.useFallback ? 0n : MOCK_USD_E8,
    usedFallback: check.useFallback
  });
  state.feeCollectorBalance -= conversion.fromCollector;
  state.sold += conversion.tttiAmount;
  state.conversions.unshift(conversion);
  return { __kind__: "Ok", Ok: conversion };
}
const mockPrice = () => ({
  status: OracleStatus.ok,
  source: PriceSource.coinbase,
  usdMicro: MOCK_USD_MICRO,
  usdE8: MOCK_USD_E8,
  updatedAt: nowNs(),
  stale: false
});
const LEGACY_BOUNDARY = 3n;
const MAX_BLOCKS_PER_CALL = 100n;
const vNat = (Nat) => ({ __kind__: "Nat", Nat });
const vText = (Text) => ({ __kind__: "Text", Text });
const vBlob = (Blob) => ({ __kind__: "Blob", Blob });
const vMap = (Map) => ({ __kind__: "Map", Map });
const vAccount = (account) => ({
  __kind__: "Array",
  Array: account.subaccount ? [vBlob(account.owner.toUint8Array()), vBlob(account.subaccount)] : [vBlob(account.owner.toUint8Array())]
});
function encodeLeb128(value) {
  const out = [];
  let rest = value;
  do {
    const byte = Number(rest & 0x7fn);
    rest >>= 7n;
    out.push(rest > 0n ? byte | 128 : byte);
  } while (rest > 0n);
  return out;
}
function encodeSleb128(value) {
  const out = [];
  let rest = value;
  for (; ; ) {
    const byte = Number(rest & 0x7fn);
    rest >>= 7n;
    const done = rest === 0n && (byte & 64) === 0 || rest === -1n && (byte & 64) !== 0;
    out.push(done ? byte : byte | 128);
    if (done) return out;
  }
}
async function sha256(bytes) {
  const copy = new Uint8Array(bytes);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", copy));
}
function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
function compareBytes(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}
async function hashValue(value) {
  switch (value.__kind__) {
    case "Nat":
      return sha256(new Uint8Array(encodeLeb128(value.Nat)));
    case "Int":
      return sha256(new Uint8Array(encodeSleb128(value.Int)));
    case "Text":
      return sha256(new TextEncoder().encode(value.Text));
    case "Blob":
      return sha256(value.Blob);
    case "Array":
      return sha256(concat(await Promise.all(value.Array.map(hashValue))));
    case "Map": {
      const pairs = await Promise.all(
        value.Map.map(
          async ([key, inner]) => concat([await sha256(new TextEncoder().encode(key)), await hashValue(inner)])
        )
      );
      pairs.sort(compareBytes);
      return sha256(concat(pairs));
    }
  }
}
const BLOCK_BUILDERS = [
  // Legacy Text blocks (4-decimal amounts, below the legacy boundary).
  (ts) => vText(`3:${CALLER.toText()}:2500:${ts}`),
  (ts) => vText(`1:${CALLER.toText()}:${HOLDER_2.toText()}:1000:1:${ts}`),
  (ts) => vText(`4:${HOLDER_2.toText()}:50:${ts}`),
  // Legacy Text blocks written after the 8-decimal rescale (at/above the
  // boundary), still in ':' form before the first standard Map block.
  (ts) => vText(`3:${CALLER.toText()}:500000:${ts}`),
  (ts) => vText(`1:${CALLER.toText()}:${HOLDER_2.toText()}:150000:${FEE}:${ts}`),
  // 1mint (first Map block; phash = hash of the last legacy Text block)
  (ts, phash) => vMap([
    ["btype", vText("1mint")],
    ["ts", vNat(ts)],
    ["phash", vBlob(phash ?? new Uint8Array(32))],
    ["tx", vMap([["to", vAccount(CALLER_ACCOUNT)], ["amt", vNat(250000n)]])]
  ]),
  // 1xfer with block-level fee and fee collector
  (ts, phash) => vMap([
    ["btype", vText("1xfer")],
    ["ts", vNat(ts)],
    ["fee", vNat(FEE)],
    ["fee_col", vAccount(FEE_COLLECTOR)],
    ["phash", vBlob(phash ?? new Uint8Array(32))],
    [
      "tx",
      vMap([
        ["from", vAccount(CALLER_ACCOUNT)],
        ["to", vAccount({ owner: HOLDER_2 })],
        ["amt", vNat(100000n)]
      ])
    ]
  ]),
  // 2approve with expires_at and expected_allowance
  (ts, phash) => vMap([
    ["btype", vText("2approve")],
    ["ts", vNat(ts)],
    ["fee", vNat(FEE)],
    ["fee_col", vAccount(FEE_COLLECTOR)],
    ["phash", vBlob(phash ?? new Uint8Array(32))],
    [
      "tx",
      vMap([
        ["from", vAccount(CALLER_ACCOUNT)],
        ["spender", vAccount({ owner: HOLDER_3 })],
        ["amt", vNat(50000n)],
        ["expected_allowance", vNat(0n)],
        ["expires_at", vNat(ts + 7n * 24n * 3600n * 1000000000n)]
      ])
    ]
  ]),
  // 1burn to the minting account (fee-less)
  (ts, phash) => vMap([
    ["btype", vText("1burn")],
    ["ts", vNat(ts)],
    ["phash", vBlob(phash ?? new Uint8Array(32))],
    ["tx", vMap([["from", vAccount({ owner: HOLDER_2 })], ["amt", vNat(20000n)]])]
  ]),
  // Fee-0 presale delivery from the fee collector
  (ts, phash) => vMap([
    ["btype", vText("1xfer")],
    ["ts", vNat(ts)],
    ["fee", vNat(0n)],
    ["phash", vBlob(phash ?? new Uint8Array(32))],
    [
      "tx",
      vMap([
        ["from", vAccount(FEE_COLLECTOR)],
        ["to", vAccount(CALLER_ACCOUNT)],
        ["amt", vNat(300n)]
      ])
    ]
  ]),
  // 1xfer with memo, created_at_time and a caller-specified fee
  (ts, phash) => vMap([
    ["btype", vText("1xfer")],
    ["ts", vNat(ts)],
    ["fee_col", vAccount(FEE_COLLECTOR)],
    ["phash", vBlob(phash ?? new Uint8Array(32))],
    [
      "tx",
      vMap([
        ["from", vAccount({ owner: HOLDER_2 })],
        ["to", vAccount({ owner: HOLDER_3 })],
        ["amt", vNat(12345n)],
        ["fee", vNat(FEE)],
        ["memo", vBlob(new TextEncoder().encode("Immortal #42"))],
        ["created_at_time", vNat(ts - 1000000000n)]
      ])
    ]
  ])
];
let blockLogPromise = null;
function sampleBlockLog() {
  blockLogPromise ?? (blockLogPromise = (async () => {
    const base = nowNs() - 3n * 24n * 3600n * 1000000000n;
    const blocks = [];
    let previous = null;
    for (const [index, build] of BLOCK_BUILDERS.entries()) {
      const id = BigInt(index);
      const ts = base + id * 3600n * 1000000000n;
      const block = build(ts, id >= LEGACY_BOUNDARY ? previous : null);
      blocks.push({ id, block });
      previous = await hashValue(block);
    }
    return { blocks, tipHash: previous ?? new Uint8Array(32) };
  })());
  return blockLogPromise;
}
async function mockGetBlocks(ranges) {
  const { blocks } = await sampleBlockLog();
  const logLength = BigInt(blocks.length);
  const out = [];
  for (const { start, length } of ranges) {
    const end = start + length < logLength ? start + length : logLength;
    for (let i = start; i < end && BigInt(out.length) < MAX_BLOCKS_PER_CALL; i++) {
      out.push(blocks[Number(i)]);
    }
  }
  return { log_length: logLength, blocks: out, archived_blocks: [] };
}
const MOCK_CERTIFICATE = new Uint8Array(Array.from({ length: 64 }, (_, i) => i * 7 + 3 & 255));
function cborBytes(data) {
  const body = Array.from(data);
  return body.length < 24 ? [64 + body.length, ...body] : [88, body.length, ...body];
}
function labeledLeaf(label, value) {
  return [131, 2, ...cborBytes(new TextEncoder().encode(label)), 130, 3, ...cborBytes(value)];
}
function buildMockHashTree(tipIndex, tipHash) {
  return new Uint8Array([
    217,
    217,
    247,
    131,
    1,
    ...labeledLeaf("last_block_hash", tipHash),
    ...labeledLeaf("last_block_index", encodeLeb128(tipIndex))
  ]);
}
const findToken = (canisterId) => {
  const list = tokens();
  return list.find((t) => t.canisterId.toText() === canisterId.toText()) ?? list[0];
};
const mockBackend = {
  _immutableObjectStorageBlobsAreLive: async (hashes) => hashes.map(() => false),
  _immutableObjectStorageBlobsToDelete: async () => [],
  _immutableObjectStorageConfirmBlobDeletion: async () => void 0,
  _immutableObjectStorageCreateCertificate: async (blobHash) => ({ method: "GET", blob_hash: blobHash }),
  _immutableObjectStorageRefillCashier: async () => ({ success: true, topped_up_amount: 0n }),
  _immutableObjectStorageUpdateGatewayPrincipals: async () => void 0,
  _initialize_access_control: async () => void 0,
  _internet_identity_sign_in_finish: async () => ({ __kind__: "ok", ok: null }),
  _internet_identity_sign_in_start: async () => new Uint8Array(),
  assignCallerUserRole: async () => void 0,
  burn: async () => ({ __kind__: "Ok", Ok: 9n }),
  buyExactTtti: async (recipient, tttiAmount, maxIcpE8s) => mockBuyExact(recipient, tttiAmount, maxIcpE8s),
  clearDeliveryAddress: async () => {
    const had = state.deliveryAddress !== null;
    state.deliveryAddress = null;
    return had;
  },
  convertDeposit: async (recipient, icpAmount) => mockPurchase(recipient, icpAmount),
  execute: async () => ({ hasMore: false, rows: [] }),
  exportBalanceSnapshot: async () => ({
    exportedAt: nowNs(),
    totalSupply: state.sold + state.feeCollectorBalance,
    decimals: TTTI_DECIMALS,
    holders: [
      { account: CALLER_ACCOUNT, balance: 250000n, deliveryAddress: state.deliveryAddress ?? void 0, needsMigration: state.deliveryAddress === null, kind: HolderKind.holder },
      { account: { owner: HOLDER_2 }, balance: 900000n, deliveryAddress: { owner: HOLDER_3 }, needsMigration: false, kind: HolderKind.holder },
      { account: { owner: HOLDER_3 }, balance: state.sold - 1150000n, needsMigration: true, kind: HolderKind.holder },
      { account: FEE_COLLECTOR, balance: state.feeCollectorBalance, needsMigration: false, kind: HolderKind.feeCollector }
    ]
  }),
  getAdminSwitches: async () => ({
    salesPaused: state.salesPaused,
    fallbackEnabled: state.fallbackEnabled,
    transfersFrozen: state.transfersFrozen
  }),
  getApiDoc: async () => JSON.stringify({ methods: [] }),
  getBalance: async (canisterId) => ({
    __kind__: "Ok",
    Ok: { token: findToken(canisterId), balance: SAMPLE_BALANCES[canisterId.toText()] ?? 0n }
  }),
  getBurnAccount: async () => BURN_ACCOUNT,
  getCallerIcpBalance: async () => 250000000n,
  getCallerUserProfile: async () => ({ name: "Aiko Tanaka" }),
  getCallerUserRole: async () => UserRole.admin,
  getCanisterPrincipal: async () => TTTI_CANISTER,
  getConversions: async () => state.conversions,
  getDeliveryAddress: async () => state.deliveryAddress,
  getFailedForwards: async () => state.conversions.filter((c) => c.forward.__kind__ === "failed"),
  getFeeCollector: async () => ({ account: FEE_COLLECTOR, balance: state.feeCollectorBalance }),
  getIcpPrice: async () => mockPrice(),
  getLegacyBlockInfo: async () => ({
    boundaryIndex: LEGACY_BOUNDARY,
    legacyDecimals: LEGACY_TTTI_DECIMALS,
    currentDecimals: TTTI_DECIMALS
  }),
  getOnRampLinks: async () => [
    { name: "MoonPay", url: "https://www.moonpay.com/buy/icp" },
    { name: "Ramp", url: "https://ramp.network/buy?swapAsset=ICP" },
    { name: "Transak", url: "https://global.transak.com/?cryptoCurrency=ICP" }
  ],
  getOriginalWhitePaper: async () => state.originalWhitePaper,
  getPresaleStatus: async () => {
    const remaining = ALLOCATION > state.sold ? ALLOCATION - state.sold : 0n;
    return {
      allocation: ALLOCATION,
      sold: state.sold,
      reserved: 0n,
      remaining,
      complete: remaining === 0n,
      minPurchase: MIN_PURCHASE,
      tokenPriceUsd: BigInt(TOKEN_PRICE_USD),
      salesPaused: state.salesPaused,
      transfersFrozen: state.transfersFrozen,
      fallbackEnabled: state.fallbackEnabled,
      fallbackRate: state.treasuryConfig.rate,
      priceUsdE8: MOCK_USD_E8,
      priceUpdatedAt: nowNs(),
      priceSource: PriceSource.coinbase,
      priceStale: false,
      liveRate: MOCK_LIVE_RATE
    };
  },
  getPublicTreasuryInfo: async () => ({
    mode: state.treasuryConfig.mode,
    marginBps: state.treasuryConfig.marginBps,
    icpAccount: state.treasuryConfig.icpAccount
  }),
  getTokenMetadata: async (canisterId) => ({ __kind__: "Ok", Ok: findToken(canisterId) }),
  getTreasuryConfig: async () => state.treasuryConfig,
  getTreasuryState: async () => ({
    mode: state.treasuryConfig.mode,
    rate: state.treasuryConfig.rate,
    icpBalance: 5n * ICP_DIVISOR,
    liveRate: MOCK_LIVE_RATE
  }),
  getUserProfile: async () => ({ name: "Aiko Tanaka" }),
  get_fee: async () => state.fee,
  get_fee_bounds: async () => FEE_BOUNDS,
  get_max_supply: async () => MAX_SUPPLY,
  handleDeposit: async (icpAmount) => mockPurchase(null, icpAmount),
  icrc10_supported_standards: async () => STANDARDS,
  icrc1_balance_of: async () => 250000n,
  icrc1_decimals: async () => TTTI_DECIMALS,
  icrc1_fee: async () => state.fee,
  icrc1_metadata: async () => [
    ["icrc1:name", { __kind__: "Text", Text: TOKEN_NAME }],
    ["icrc1:symbol", { __kind__: "Text", Text: TTTI_SYMBOL }],
    ["icrc1:decimals", { __kind__: "Nat", Nat: BigInt(TTTI_DECIMALS) }],
    ["icrc1:fee", { __kind__: "Nat", Nat: state.fee }],
    ["icrc1:max_memo_length", { __kind__: "Nat", Nat: 32n }]
  ],
  icrc1_minting_account: async () => BURN_ACCOUNT,
  icrc1_name: async () => TOKEN_NAME,
  icrc1_supported_standards: async () => STANDARDS,
  icrc1_symbol: async () => TTTI_SYMBOL,
  icrc1_total_supply: async () => state.sold + state.feeCollectorBalance,
  icrc1_transfer: async () => state.transfersFrozen ? { __kind__: "Err", Err: { __kind__: "TemporarilyUnavailable", TemporarilyUnavailable: null } } : { __kind__: "Ok", Ok: 9n },
  icrc2_allowance: async () => ({ allowance: 0n }),
  icrc2_approve: async () => ({ __kind__: "Ok", Ok: 9n }),
  icrc2_transfer_from: async () => ({ __kind__: "Ok", Ok: 9n }),
  icrc3_get_archives: async () => [],
  icrc3_get_blocks: async (ranges) => mockGetBlocks(ranges),
  icrc3_get_tip_certificate: async () => {
    const { blocks, tipHash } = await sampleBlockLog();
    return {
      certificate: MOCK_CERTIFICATE,
      hash_tree: buildMockHashTree(BigInt(blocks.length - 1), tipHash)
    };
  },
  icrc3_supported_block_types: async () => [
    { block_type: "1xfer", url: "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1" },
    { block_type: "1mint", url: "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1" },
    { block_type: "1burn", url: "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1" },
    { block_type: "2approve", url: "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-2" }
  ],
  initializeAccessControl: async () => void 0,
  isCallerAdmin: async () => true,
  listTokens: async () => tokens(),
  mint: async () => ({ __kind__: "Ok", Ok: 9n }),
  prepareTransfer: async (canisterId, from, to, amount, memo) => ({
    __kind__: "Ok",
    Ok: { ledger: canisterId, from, to, amount, fee: findToken(canisterId).fee, memo: memo ?? void 0, createdAt: nowNs() }
  }),
  publishOriginalWhitePaper: async (document) => {
    state.originalWhitePaper = document;
  },
  quoteExactTtti: async (tttiAmount) => mockQuoteExact(tttiAmount),
  refreshIcpPrice: async () => ({ __kind__: "Ok", Ok: mockPrice() }),
  retryTreasuryForward: async (conversionId) => {
    const conversion = state.conversions.find((c) => c.id === conversionId);
    if (!conversion) return { __kind__: "err", err: `Conversion #${conversionId} not found` };
    if (conversion.forward.__kind__ !== "failed") {
      return { __kind__: "err", err: `Conversion #${conversionId} has no failed forward to retry` };
    }
    const blockIndex = nextIcpBlockIndex++;
    conversion.forward = { __kind__: "forwarded", forwarded: blockIndex };
    return { __kind__: "ok", ok: blockIndex };
  },
  saveCallerUserProfile: async () => void 0,
  schema: async () => JSON.stringify({ tables: [] }),
  setDeliveryAddress: async (principalText) => {
    const result = validateDeliveryAddress(principalText);
    if (!result.ok) {
      return { __kind__: "Err", Err: { code: result.code, message: result.message } };
    }
    state.deliveryAddress = { owner: result.principal };
    return { __kind__: "Ok", Ok: state.deliveryAddress };
  },
  setFallbackEnabled: async (enabled) => {
    state.fallbackEnabled = enabled;
  },
  setOnRampLinks: async () => void 0,
  setSalesPaused: async (paused) => {
    state.salesPaused = paused;
  },
  setTransfersFrozen: async (frozen) => {
    state.transfersFrozen = frozen;
  },
  setTreasuryConfig: async (config) => {
    if (config.marginBps > MAX_MARGIN_BPS) {
      return { __kind__: "Err", Err: `Margin must be at most ${MAX_MARGIN_BPS} bps (20%)` };
    }
    if (config.rate === 0n) {
      return { __kind__: "Err", Err: "Fallback rate must be greater than 0" };
    }
    state.treasuryConfig = { ...config };
    return { __kind__: "Ok", Ok: state.treasuryConfig };
  },
  set_fee: async (newFee) => {
    if (newFee < FEE_BOUNDS.min || newFee > FEE_BOUNDS.max) {
      return {
        __kind__: "err",
        err: `Fee must be between ${FEE_BOUNDS.min} and ${FEE_BOUNDS.max} base units`
      };
    }
    state.fee = newFee;
    return { __kind__: "ok", ok: null };
  },
  transform: async () => ({ status: 200n, body: new Uint8Array(), headers: [] })
};
export {
  mockBackend
};
