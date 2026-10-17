mixin () {
  public query func getApiDoc() : async Text {
    "# TTTI-T (Test) Backend API\n\n" #
    "## Purpose\n\n" #
    "The public test offering is called TTTI-T (Test). Its existing on-chain\n" #
    "ledger name is TTTI Presale and its ICRC symbol remains TTTI-P; TTTI-T\n" #
    "is the public test-offering name, not a change to the ledger symbol.\n" #
    "This canister hosts that token ledger and its presale.\n" #
    "TTTI-P is an ICRC-1 / ICRC-2 / ICRC-3 / ICRC-10 token with 8 decimals and a\n" #
    "maximum supply of 10 000 TTTI-P (1_000_000_000_000 base units). Reference\n" #
    "price: 1 TTTI-P = 10 000 USD. The same canister also runs the ICP -> TTTI-P\n" #
    "presale, the ICP/USD price oracle, optional delivery addresses, the treasury\n" #
    "forwarding of collected ICP, a read-only multi-token wallet helper and user\n" #
    "profiles.\n\n" #

    "## Authentication and identity\n\n" #
    "- Users sign in through the app frontend with Internet Identity or the Plug\n" #
    "  wallet. Every call is identified only by its caller principal. An Internet\n" #
    "  Identity principal and a Plug principal are different principals: balances,\n" #
    "  delivery addresses, profiles and roles never carry over between them.\n" #
    "- The app's frontend pins an Internet Identity derivation origin, published at\n" #
    "  `/.well-known/ii-derivation-origin` when available. An agent already holding\n" #
    "  the user's Internet Identity authorization derives the correct per-app\n" #
    "  principal against that origin (for example\n" #
    "  `icp identity link web <name> --app <host>`). Warning: such a delegation acts\n" #
    "  with the user's full authority in this app (it can spend the user's TTTI-P\n" #
    "  and buy with their ICP approval) until it expires.\n" #
    "- Signed (non-anonymous) caller required: `icrc1_transfer`, `icrc2_approve`,\n" #
    "  `icrc2_transfer_from` (they act on the caller's own accounts),\n" #
    "  `convertDeposit`, `handleDeposit`, `buyExactTtti` (anonymous -> `#Err` code\n" #
    "  `#anonymousCaller`), `setDeliveryAddress` (anonymous -> `#Err` code\n" #
    "  `#anonymousCaller`), `saveCallerUserProfile` (anonymous traps with\n" #
    "  `Unauthorized: please sign in to save a profile`), `burn` (own accounts).\n" #
    "- None of these need registration. Registration (a role) matters only for\n" #
    "  admin-only endpoints.\n\n" #

    "### Registration and roles\n\n" #
    "- Roles are `#admin` or `#user`. Registration happens only when a caller signs\n" #
    "  in through this app's own frontend (the frontend calls the authorization\n" #
    "  library's sign-in hooks). A principal that never did so is unregistered even\n" #
    "  when it belongs to the app's owner, and a caller derived against a different\n" #
    "  origin is a different principal than the one the frontend registered.\n" #
    "- A direct API caller registers by calling `_initialize_access_control` once\n" #
    "  as a signed-in caller. It grants `#admin` only while no admin has been\n" #
    "  assigned yet; every later caller becomes `#user`.\n" #
    "- `initializeAccessControl()` (this app's own variant): while no admin exists\n" #
    "  only a canister controller may call it (others trap with\n" #
    "  `Unauthorized: only a controller can initialize access control`) and the\n" #
    "  controller becomes admin; afterwards it registers the caller as `#user`.\n" #
    "- `getCallerUserRole`, `isCallerAdmin`, `assignCallerUserRole` come from the\n" #
    "  authorization library.\n" #
    "- Admin-only endpoints trap for any other caller. A registered non-admin gets\n" #
    "  `Unauthorized: only admins ...` (the exact message is listed per endpoint).\n" #
    "  An unregistered caller may get the library trap `User is not registered`\n" #
    "  instead. Treat any trap from an admin endpoint as \"not authorized\".\n\n" #

    "### Public vs admin reads\n\n" #
    "- Public (anyone, including anonymous): all ICRC-1/2/3/10 queries,\n" #
    "  `getFeeCollector`, `getBurnAccount`, `getLegacyBlockInfo`, `get_fee`,\n" #
    "  `get_fee_bounds`, `get_max_supply`, `getPresaleStatus`, `getAdminSwitches`,\n" #
    "  `getIcpPrice`, `quoteExactTtti`, `getPublicTreasuryInfo`,\n" #
    "  `getTreasuryState`, `getCanisterPrincipal`, `getOnRampLinks`, the wallet\n" #
    "  endpoints, `getOriginalWhitePaper` and `getApiDoc`.\n" #
    "- Caller-scoped: `getDeliveryAddress`, `clearDeliveryAddress`,\n" #
    "  `getCallerUserProfile`, `getCallerIcpBalance`, `getUserProfile` (own profile,\n" #
    "  or any profile for an admin; `null` otherwise, never traps).\n" #
    "- Admin-only reads: `getTreasuryConfig`, `getConversions`,\n" #
    "  `getFailedForwards`, `exportBalanceSnapshot`.\n" #
    "- Admin-only writes: `mint`, `set_fee`, `setTransfersFrozen`, burning another\n" #
    "  account, `setTreasuryConfig`, `setOnRampLinks`, `retryTreasuryForward`,\n" #
    "  `refreshIcpPrice`, `setSalesPaused`, `setFallbackEnabled`,\n" #
    "  `publishOriginalWhitePaper`.\n\n" #

    "## Units and encodings\n\n" #
    "- TTTI-P amounts are base units, 8 decimals (1 TTTI-P = 100_000_000; the\n" #
    "  minimum purchase 0.0001 TTTI-P = 10_000). Exception: legacy blocks below the\n" #
    "  legacy boundary (see ICRC-3) use 4 decimals.\n" #
    "- ICP amounts are e8s (1 ICP = 100_000_000). ICP ledger fee: 10_000 e8s.\n" #
    "- Prices: `usdE8` / `priceUsdE8` = USD per whole ICP * 10^8;\n" #
    "  `usdMicro` = USD * 10^6. Rates (`rate`, `liveRate`, `fallbackRate`) are\n" #
    "  TTTI-P base units per whole ICP. Margins are basis points (10_000 = 100%).\n" #
    "- Timestamps: nanoseconds since the Unix epoch (`Nat64` in Candid records,\n" #
    "  `Nat` inside ICRC-3 blocks); 0 means never.\n" #
    "- Accounts: ICRC-1 `{ owner : Principal; subaccount : ?Blob }` (32-byte\n" #
    "  subaccount). An all-zero subaccount is treated as `null`. Textual form\n" #
    "  (OQL, UI) is the standard ICRC-1 account text: the principal text alone for\n" #
    "  the default subaccount, otherwise `<principal>-<checksum>.<hex subaccount\n" #
    "  without leading zeros>`.\n" #
    "- Optional values are Candid `opt`; variants are Candid variants.\n\n" #

    "## Special accounts\n\n" #
    "- Fee collector: `{ owner = <this canister>; subaccount =\n" #
    "  \"FEE-COLLECTOR-TTTI-P-00000000001\" }` (32 ASCII bytes). Every charged\n" #
    "  transfer / transfer_from / approve fee is credited here.\n" #
    "  `getFeeCollector() : { account; balance }`.\n" #
    "- Minting account = burn account: `{ owner = <this canister>; subaccount =\n" #
    "  null }`, returned by `icrc1_minting_account()` and `getBurnAccount()`. A\n" #
    "  transfer to it is a fee-less burn that reduces total supply. Transfers and\n" #
    "  approvals from it are refused.\n\n" #

    "## ICRC-1 / ICRC-2\n\n" #
    "- Metadata: `icrc1_name` = \"TTTI Presale\", `icrc1_symbol` = \"TTTI-P\",\n" #
    "  `icrc1_decimals` = 8, `icrc1_fee` (default 100 base units = 0.000001 TTTI-P),\n" #
    "  `icrc1_total_supply`, `icrc1_balance_of`, `icrc1_metadata` (`icrc1:name`,\n" #
    "  `icrc1:symbol`, `icrc1:decimals`, `icrc1:fee`, `icrc1:max_memo_length` = 32,\n" #
    "  `icrc1:max_supply`).\n" #
    "- `icrc1_supported_standards` and `icrc10_supported_standards` both return\n" #
    "  ICRC-1, ICRC-2, ICRC-3 and ICRC-10 as `{ name; url }`.\n" #
    "- `icrc1_transfer`, `icrc2_approve`, `icrc2_allowance`, `icrc2_transfer_from`.\n\n" #
    "Rules (checked in this order: freeze, memo, created_at_time, then the rest):\n\n" #
    "- `memo` is at most 32 bytes, else `#GenericError { error_code = 4; message =\n" #
    "  \"Memo exceeds 32 bytes\" }`.\n" #
    "- Zero amounts: transfer and transfer_from with `amount = 0` return\n" #
    "  `#GenericError { error_code = 5 }`. `icrc2_approve` with `amount = 0` is\n" #
    "  accepted: it charges the fee, writes a block and removes the allowance.\n" #
    "- `fee`: pass `null` or exactly the current fee, else\n" #
    "  `#BadFee { expected_fee }`. Burns (to the minting account) are fee-less:\n" #
    "  pass `null` or `?0`.\n" #
    "- Burns need `amount >= 100` base units, else `#BadBurn { min_burn_amount =\n" #
    "  100 }`.\n" #
    "- From the minting account -> `#GenericError { error_code = 6 }`. Approving\n" #
    "  a spender with the same owner principal -> `#GenericError { error_code = 7 }`.\n" #
    "- Insufficient balance -> `#InsufficientFunds { balance }` (amount + fee for\n" #
    "  transfers; only the fee for approve).\n\n" #
    "Deduplication (only when `created_at_time` is set):\n\n" #
    "- Window 24 h, permitted drift 2 min. `created_at_time + 24 h + 2 min < now`\n" #
    "  -> `#TooOld`; `created_at_time > now + 2 min` -> `#CreatedInFuture {\n" #
    "  ledger_time }`.\n" #
    "- An identical request (same block type and same transaction fields,\n" #
    "  including memo, fee and created_at_time) inside the window returns\n" #
    "  `#Duplicate { duplicate_of = <original block index> }` and changes nothing.\n" #
    "  Set `created_at_time` to make retries of a transfer/approve safe. Without it\n" #
    "  every call is a new transaction.\n" #
    "- Expired entries are pruned at most 50 per ICRC update call.\n\n" #
    "Approvals (ICRC-2):\n\n" #
    "- `expires_at <= now` -> `#Expired { ledger_time }`.\n" #
    "  `expected_allowance` that differs from the current (non-expired) allowance\n" #
    "  -> `#AllowanceChanged { current_allowance }`. A new approve replaces the\n" #
    "  amount and the expiry.\n" #
    "- `icrc2_allowance` reports `{ allowance = 0; expires_at = null }` for a\n" #
    "  missing or expired approval.\n" #
    "- `icrc2_transfer_from` needs allowance >= amount + fee (else\n" #
    "  `#InsufficientAllowance { allowance }`). After a partial spend the remaining\n" #
    "  allowance keeps its original `expires_at` (expiry preservation); it is\n" #
    "  removed when it reaches 0. A transfer_from to the minting account is a\n" #
    "  fee-less burn.\n\n" #

    "## ICRC-3 block log\n\n" #
    "- `icrc3_get_blocks(vec { record { start; length } })` ->\n" #
    "  `{ log_length; blocks = vec { record { id; block } }; archived_blocks }`.\n" #
    "  Several ranges may be passed. They are served in request order, each\n" #
    "  ascending and clipped to `log_length`, with at most 100 blocks in total per\n" #
    "  call. Blocks beyond the cap are silently omitted, so request again from the\n" #
    "  last returned `id + 1`.\n" #
    "- There are no archives: `archived_blocks = []`, `icrc3_get_archives` returns\n" #
    "  `[]`, and the whole history stays in this canister. The log is append-only.\n" #
    "- `icrc3_supported_block_types` -> `1xfer`, `2approve`, `1mint`, `1burn`.\n\n" #
    "Standard blocks are ICRC-3 `Value` maps:\n\n" #
    "- `btype` (Text), `ts` (Nat, ns), optional `fee` (Nat; the effective fee,\n" #
    "  present only when the caller omitted `tx.fee`), optional `fee_col` (account,\n" #
    "  present only when a fee > 0 was credited to the fee collector), optional\n" #
    "  `phash` (Blob), and `tx` (Map).\n" #
    "- `tx` fields: `from`, `to`, `spender` (accounts as `Array [Blob owner,\n" #
    "  Blob subaccount?]`), `amt`, optional `fee`, `memo`, `created_at_time`,\n" #
    "  `expires_at`, `expected_allowance`.\n" #
    "- `1xfer`: from, to, amt (+ spender for transfer_from). `2approve`: from,\n" #
    "  spender, amt. `1mint`: to, amt. `1burn`: from, amt (+ spender for\n" #
    "  transfer_from).\n" #
    "- Presale deliveries from the fee collector are `1xfer` blocks with top-level\n" #
    "  `fee = 0` and no `fee_col`. The minted remainder is a `1mint` block.\n\n" #
    "Legacy blocks:\n\n" #
    "- History written before the ICRC-3 upgrade is preserved at the same indexes\n" #
    "  as `Text` values in colon-separated form. Examples:\n" #
    "  `legacy:<index>:<amount>`, `1:from:to:amount:fee:timestamp[:feeCollector]`,\n" #
    "  `2:from:spender:amount:fee:expires:timestamp[:feeCollector]`,\n" #
    "  `3:to:amount:timestamp`, `4:from:amount:timestamp`.\n" #
    "- `getLegacyBlockInfo() : { boundaryIndex; legacyDecimals = 4;\n" #
    "  currentDecimals = 8 }`. Amounts in blocks with index < `boundaryIndex` use 4\n" #
    "  decimals; later blocks use 8. Decimals depend on the index, not on the block\n" #
    "  shape. All balances were rescaled by 10^4 at that upgrade, so no holder lost\n" #
    "  value.\n\n" #
    "Hashing and certification:\n\n" #
    "- Block hashes use the ICRC-3 representation-independent hash (SHA-256: Nat\n" #
    "  as LEB128, Int as SLEB128, Text as UTF-8, Blob raw, Array = hash of the\n" #
    "  concatenated item hashes, Map = hash of the sorted concatenated\n" #
    "  `hash(key) || hash(value)` pairs).\n" #
    "- `phash` is the hash of the previous block. The first standard block chains\n" #
    "  to the hash of the last legacy text block (the SHA-256 of its UTF-8 text).\n" #
    "  Legacy text blocks carry no `phash`.\n" #
    "- `icrc3_get_tip_certificate()` -> `opt { certificate; hash_tree }`. The\n" #
    "  `hash_tree` is a CBOR IC hash tree with `last_block_hash` (32 bytes) and\n" #
    "  `last_block_index` (LEB128). It returns `null` for an empty log or when the\n" #
    "  certificate does not embed the current root (for example when called as an\n" #
    "  update). Verify it against the IC root key.\n\n" #

    "## Supply management and freeze\n\n" #
    "- `mint(to, amount) : MintResult` (admin; trap `Unauthorized: only admins can\n" #
    "  mint`) writes a `1mint` block. It is refused with `#GenericError` when\n" #
    "  frozen (3), when amount = 0 (5), when sent to the minting account (6), or\n" #
    "  when it would exceed max supply (1).\n" #
    "- `burn(from, amount) : BurnResult`: the owner of `from`, or an admin for any\n" #
    "  account (others trap with `Unauthorized: only admins can burn another\n" #
    "  account's tokens`). It writes a `1burn` block. Refused when frozen (3), for\n" #
    "  0 (5), below 100 (`#BadBurn`), from the minting account (6), or with\n" #
    "  insufficient balance.\n" #
    "- `set_fee(newFee) : { #ok; #err : Text }` (admin; trap `Unauthorized: only\n" #
    "  admins can set the fee`). Accepted range: `get_fee_bounds() = { min = 0;\n" #
    "  max = 10_000 }`. `get_fee()`, `get_max_supply()`.\n" #
    "- `setTransfersFrozen(Bool)` (admin; trap `Unauthorized: only admins can\n" #
    "  freeze transfers`). Freeze scope:\n" #
    "  - `icrc1_transfer`, `icrc2_approve`, `icrc2_transfer_from`, `mint` and\n" #
    "    `burn` return `#GenericError { error_code = 3; message = \"Transfers are\n" #
    "    frozen\" }` for everyone.\n" #
    "  - Purchases are refused with code `#transfersFrozen` before any ICP is\n" #
    "    taken, and presale delivery is refused.\n" #
    "  - Reads and admin configuration still work.\n\n" #
    "GenericError codes: 1 max supply, 2 unauthorized burn, 3 frozen, 4 memo too\n" #
    "long, 5 zero amount, 6 minting account, 7 self-approve.\n\n" #

    "## ICP/USD price oracle\n\n" #
    "- `getIcpPrice() : IcpPrice` (query, never an outcall):\n" #
    "  `{ usdE8; usdMicro; updatedAt; status (#ok/#stale/#unavailable); source\n" #
    "  (#none/#coinbase/#coingecko); stale }`. `stale` is true when the price is\n" #
    "  older than 5 minutes or was never fetched.\n" #
    "- `refreshIcpPrice() : PriceResult` (admin; trap `Unauthorized: only admins\n" #
    "  can refresh the ICP price`) tries Coinbase spot first, then CoinGecko. If\n" #
    "  both fail it returns `#Err(Text)` and keeps the last price.\n" #
    "- Purchases refresh a stale price themselves.\n" #
    "- `transform` is the outcall transform callback and is not for clients.\n\n" #

    "## Presale\n\n" #
    "- `getPresaleStatus() : PresaleStatus` returns `{ allocation (100_000_000 =\n" #
    "  1 TTTI-P); sold; reserved; remaining = allocation - sold - reserved;\n" #
    "  complete (sold >= allocation, \"Presale complete\"); minPurchase (10_000);\n" #
    "  tokenPriceUsd (10_000); salesPaused; transfersFrozen; fallbackEnabled;\n" #
    "  fallbackRate; priceUsdE8; priceUpdatedAt; priceSource; priceStale;\n" #
    "  liveRate }`.\n" #
    "- `getAdminSwitches() : { salesPaused; transfersFrozen; fallbackEnabled }`.\n" #
    "- `setSalesPaused(Bool)`, `setFallbackEnabled(Bool)` (admin; trap\n" #
    "  `Unauthorized: only admins can manage the presale`).\n" #
    "- The minimum purchase is 10_000 base units (1 USD). A buyer may always take\n" #
    "  the whole remainder when it is smaller than the minimum.\n\n" #
    "### Two purchase modes, one pipeline\n\n" #
    "- ICP amount: `convertDeposit(recipient : ?Account, icpAmount : Nat)`, or\n" #
    "  `handleDeposit(icpAmount)` (recipient = null; refused with\n" #
    "  `#autoDepositsDisabled` when the treasury mode is `#manual`). Exactly\n" #
    "  `icpAmount` e8s are collected, and TTTI-P = floor(icpE8s * usdE8 *\n" #
    "  (10_000 - marginBps) / 10^16), or floor(icpE8s * rate / 10^8) with the\n" #
    "  fallback rate.\n" #
    "- Exact TTTI-P: `quoteExactTtti(tttiAmount) : ExactQuoteResult` (query, no\n" #
    "  outcall, reserves nothing), then `buyExactTtti(recipient, tttiAmount,\n" #
    "  maxIcpE8s)`. Exactly `tttiAmount` is delivered. Cost = ceil(T * 10^16 /\n" #
    "  (usdE8 * (10_000 - marginBps))), or ceil(T * 10^8 / rate) with the fallback\n" #
    "  rate. `ExactQuote` is `{ tttiAmount; icpCostE8s; maxIcpE8s = ceil(cost *\n" #
    "  10_200 / 10_000); priceUsdE8 (0 with fallback); usedFallback; priceStale;\n" #
    "  protectionBps = 200 }`.\n" #
    "- Server-side 2% protection: the effective limit is min(`maxIcpE8s`, ceil(\n" #
    "  backend quote at the stored pre-refresh price * 1.02)). A larger\n" #
    "  `maxIcpE8s` never widens it. If the purchase-time cost exceeds the limit,\n" #
    "  the call returns `#priceMoved { requiredIcpE8s; maxIcpE8s = <limit> }` and\n" #
    "  no ICP is taken. Quote again and retry.\n\n" #
    "### Steps\n\n" #
    "1. On the ICP ledger call `icrc2_approve` with\n" #
    "   spender `{ owner = getCanisterPrincipal(); subaccount = null }`. Approve\n" #
    "   at least `icpAmount` + 10_000 e8s, or `maxIcpE8s` + 10_000 e8s in exact\n" #
    "   mode.\n" #
    "2. Call the purchase as the signed-in buyer. ICP is pulled from the caller's\n" #
    "   default ICP account.\n" #
    "3. Refusals before any ICP is taken (`conversion = null`), in order:\n" #
    "   `#anonymousCaller`, `#notConfigured`, `#invalidAmount` (0), `#salesPaused`,\n" #
    "   `#presaleComplete`, `#transfersFrozen`. Then the price is refreshed when\n" #
    "   stale; the gate and freeze checks run again; then `#priceUnavailable`\n" #
    "   (still stale and the fallback is not enabled with rate > 0),\n" #
    "   `#belowMinimum { minimumTtti; requestedTtti }`, `#aboveRemaining {\n" #
    "   maximumTtti; maximumIcpE8s; requestedTtti }`, and `#priceMoved` (exact\n" #
    "   mode).\n" #
    "4. The TTTI-P amount is reserved before the first ledger await, so the\n" #
    "   allocation can never be oversold. The reservation is released on every\n" #
    "   failure.\n" #
    "5. ICP is collected with `icrc2_transfer_from` into the canister's own\n" #
    "   account. In exact mode only the cost is collected, never the cap. Ledger\n" #
    "   refusals return `#approvalMissing { allowance }`, `#insufficientIcp {\n" #
    "   balance }` or `#icpLedgerError`, and nothing is taken.\n" #
    "6. Delivery goes to `recipient`, else the stored delivery address, else\n" #
    "   `{ owner = caller; subaccount = null }`. It is paid from the fee collector\n" #
    "   balance first, and the rest is minted. No TTTI-P fee is charged.\n" #
    "7. Refunds: if delivery fails (for example a freeze set mid-purchase), the ICP\n" #
    "   is refunded minus the 0.0001 ICP fee. The record is `#refunded` (code\n" #
    "   `#deliveryFailedRefunded`) or, if the refund also fails, `#refundFailed`\n" #
    "   (code `#deliveryFailedRefundFailed`, which needs manual follow-up). Both\n" #
    "   return `#Err` with `conversion = ?<record>`.\n" #
    "8. Success: the reserved amount moves to `sold` and a `#completed` conversion\n" #
    "   is recorded and returned. The ICP is then forwarded to the treasury (see\n" #
    "   Treasury).\n\n" #
    "`PurchaseResult` is `#Ok(Conversion)` or `#Err({ code; message; conversion })`.\n" #
    "`Conversion` is `{ id; depositor; recipient; icpAmount (e8s collected);\n" #
    "tttiAmount (delivered); status; timestamp; priceUsdE8 (0 with fallback);\n" #
    "usedFallback; fromCollector; minted; forward; message }`. Purchases never\n" #
    "trap. `message` is user-facing English text.\n\n" #
    "### Purchase retry safety\n\n" #
    "Purchases are NOT idempotent: every successful call is a new purchase, up to\n" #
    "the remaining ICP approval. After a timeout or lost response do not blindly\n" #
    "retry. First check `icrc1_balance_of` for the delivery account, recent\n" #
    "`icrc3_get_blocks` entries crediting it, or (admin) `getConversions`.\n" #
    "Refusals with `conversion = null` (including `#priceMoved` and\n" #
    "`#transfersFrozen`) took nothing and are safe to retry once the cause is\n" #
    "fixed. In exact mode the unused part of the approval (cap minus cost) stays on\n" #
    "the ICP ledger and a later purchase can consume it.\n\n" #

    "## Delivery address (optional)\n\n" #
    "- `setDeliveryAddress(principalText) : DeliveryAddressResult` stores\n" #
    "  `{ owner; subaccount = null }` for the caller, replacing any previous\n" #
    "  address; whitespace is trimmed. Error codes: `#anonymousCaller`, `#empty`,\n" #
    "  `#accountIdentifier` (a 64-hex account ID was pasted), `#invalidPrincipal`,\n" #
    "  `#anonymousPrincipal`.\n" #
    "- `getDeliveryAddress() : ?Account`. `clearDeliveryAddress() : Bool` returns\n" #
    "  true when an address was removed. All three are safe to repeat.\n\n" #

    "## Treasury\n\n" #
    "- `setTreasuryConfig(config) : { #Ok : TreasuryConfig; #Err : Text }` (admin;\n" #
    "  trap `Unauthorized: only admins can manage the treasury`). `TreasuryConfig =\n" #
    "  { icpAccount; rate; mode (#auto/#manual); marginBps }`. Refused when\n" #
    "  `marginBps > 2000` or `rate = 0`, and nothing is stored.\n" #
    "- Admin-only: `getTreasuryConfig() : ?TreasuryConfig`, `getConversions()`,\n" #
    "  `getFailedForwards()` (conversions whose `forward` is `#failed`),\n" #
    "  `retryTreasuryForward(conversionId)`, `setOnRampLinks(links)`.\n" #
    "- Public: `getPublicTreasuryInfo() : ?{ mode; marginBps; icpAccount }` (null\n" #
    "  until configured), `getTreasuryState()` (update call that reads the ICP\n" #
    "  ledger: `{ icpBalance; mode; rate; liveRate }`, with icpBalance 0 on\n" #
    "  failure), `getCanisterPrincipal()`, `getOnRampLinks()` (defaults when none\n" #
    "  are set). `getCallerIcpBalance()` (update) returns the caller's ICP e8s, 0\n" #
    "  on failure.\n\n" #
    "Forwarding: after a successful purchase, `icpAmount - 10_000` e8s are sent to\n" #
    "`icpAccount` when it differs from the canister's own account. `forward` is\n" #
    "`#notRequired`, `#pending`, `#forwarded(icpBlockIndex)` or\n" #
    "`#failed(reason)`. A failed forward never undoes the buyer's credit.\n\n" #
    "`retryTreasuryForward(conversionId) : { #ok : Nat; #err : Text }` and its\n" #
    "retry safety:\n\n" #
    "- Only a `#failed` forward is retried, with the same amount to the current\n" #
    "  `icpAccount`. The conversion is marked `#pending` and locked before the\n" #
    "  ledger call, so it can never forward twice concurrently. A second\n" #
    "  concurrent call returns `#err(\"A retry for this conversion is already in\n" #
    "  progress\")`. A call after success returns `#err(\"Only a failed treasury\n" #
    "  forward can be retried\")`.\n" #
    "- Forward transfers carry no `created_at_time`, so the ICP ledger does not\n" #
    "  deduplicate them. A `#failed` reason saying the ICP ledger could not be\n" #
    "  reached is ambiguous: check the treasury account's ICP history before\n" #
    "  retrying.\n" #
    "- A forward interrupted by an upgrade can stay `#pending`. It is not\n" #
    "  retryable and needs manual reconciliation.\n\n" #

    "## Other endpoints\n\n" #
    "- `getOriginalWhitePaper() : ?OriginalDocument` is public and returns\n" #
    "  `null` until an admin publishes a document. `OriginalDocument` contains\n" #
    "  `{ blob : ExternalBlob; filename : Text; mimeType : Text }`. The blob is\n" #
    "  an object-storage reference, not inline DOCX bytes. Download it through\n" #
    "  the object-storage client. No automatic bundled upload occurs on install.\n" #
    "  The original DOCX may also be bundled separately by the frontend; that\n" #
    "  download is independent of this optional published canister reference.\n" #
    "- `publishOriginalWhitePaper(document)` is an admin-only update; other\n" #
    "  callers trap with `Unauthorized: only admins can publish the original\n" #
    "  white paper`. Upload the exact bytes through object storage first and\n" #
    "  pass the resulting ExternalBlob reference; this method does not verify\n" #
    "  its contents or availability. It replaces the previous reference, so\n" #
    "  repeating it is safe only with the same uploaded reference.\n" #
    "- `exportBalanceSnapshot() : { exportedAt; totalSupply; decimals; holders }`\n" #
    "  (admin; trap `Unauthorized: only admins can manage the presale`). Each\n" #
    "  holder is `{ account; balance; deliveryAddress; needsMigration; kind\n" #
    "  (#holder/#feeCollector) }`; zero balances are excluded.\n" #
    "- Profiles: `getCallerUserProfile() : ?UserProfile`,\n" #
    "  `saveCallerUserProfile({ name })` (signed-in callers),\n" #
    "  `getUserProfile(user)` (own or admin, else null).\n" #
    "- Wallet (non-custodial, update calls): fixed registry ICP, TTTI-P (this\n" #
    "  canister), ckBTC and ckUSDC.\n" #
    "  `listTokens`, `getTokenMetadata`, `getBalance` and `prepareTransfer`\n" #
    "  (prepares the arguments only; it never submits, and the user signs the\n" #
    "  transfer on the token ledger).\n" #
    "- Data intelligence (OQL): `schema()` and `execute(qJson)`. Every entity is\n" #
    "  controller-only; other callers get no rows. Entities:\n" #
    "  - `conversion` (pk `id`, plus recipientAccount, forward, forwardBlockIndex,\n" #
    "    forwardError)\n" #
    "  - `profile`, `icpPrice`, `deliveryAddress`, `presaleStatus`,\n" #
    "    `treasuryConfig`\n" #
    "  - `tttiBalance` (pk = account text)\n" #
    "  - `ledgerBlock` (pk `index`: btype or `legacy`, ts, amount, fee, from, to,\n" #
    "    spender, feeCollector, expiresAt, decimals, legacyText)\n" #
    "  - `allowance` (pk `owner|spender`: amount, expiresAt, expired)\n" #
    "  - `ledgerState` (supply, fee, blockCount, legacyBlockBoundary,\n" #
    "    transfersFrozen)\n" #
    "  - `onRampLink`\n" #
    "  - `originalWhitePaper` (controller-only: published, filename and MIME\n" #
    "    type; empty metadata until a reference has been published)\n\n" #

    "## Polling guidance\n\n" #
    "- Purchases, transfers and approvals are synchronous: the reply is final.\n" #
    "  There is no background job to poll, except an admin watching treasury\n" #
    "  forwards through `getFailedForwards`.\n" #
    "- Poll cheap queries (`getPresaleStatus`, `getIcpPrice`, `icrc1_balance_of`)\n" #
    "  every 10-30 s at most. The price only changes when a purchase or an admin\n" #
    "  refresh runs.\n" #
    "- Follow the block log by calling `icrc3_get_blocks` from the last known\n" #
    "  `log_length`, in pages of up to 100.\n" #
    "- Avoid polling update calls (`getTreasuryState`, `getCallerIcpBalance`,\n" #
    "  wallet `getBalance`). They are slower and make inter-canister calls.\n\n" #

    "## Gotchas\n\n" #
    "- `quoteExactTtti` uses the stored price, while the purchase may refresh it,\n" #
    "  so the charged cost can differ from the quote within the 2% limit.\n" #
    "- `getPresaleStatus().remaining` already subtracts in-flight reservations.\n" #
    "- Legacy blocks are text and use 4 decimals below `boundaryIndex`. Decode by\n" #
    "  index, not by shape.\n" #
    "- An all-zero subaccount is the same account as `null`.\n" #
    "- Admin endpoints trap (reject) instead of returning `#Err`; ICRC, purchase\n" #
    "  and delivery-address endpoints return typed errors.\n";
  };
};
