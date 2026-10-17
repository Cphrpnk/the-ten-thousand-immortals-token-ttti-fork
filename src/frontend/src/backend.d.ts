import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
import type { ExternalBlob } from "@caffeineai/object-storage";
export type { ExternalBlob } from "@caffeineai/object-storage";
export interface Account {
    owner: Principal;
    subaccount?: Subaccount;
}
export interface AdminSwitches {
    salesPaused: boolean;
    fallbackEnabled: boolean;
    transfersFrozen: boolean;
}
export interface Allowance {
    allowance: bigint;
    expires_at?: Timestamp;
}
export interface AllowanceArgs {
    account: Account;
    spender: Account;
}
export interface ApproveArgs {
    fee?: bigint;
    memo?: Uint8Array;
    from_subaccount?: Subaccount;
    created_at_time?: Timestamp;
    amount: bigint;
    expected_allowance?: bigint;
    expires_at?: Timestamp;
    spender: Account;
}
export type ApproveError = {
    __kind__: "GenericError";
    GenericError: {
        message: string;
        error_code: bigint;
    };
} | {
    __kind__: "TemporarilyUnavailable";
    TemporarilyUnavailable: null;
} | {
    __kind__: "Duplicate";
    Duplicate: {
        duplicate_of: bigint;
    };
} | {
    __kind__: "ExpiredFrom";
    ExpiredFrom: {
        ledger_time: Timestamp;
    };
} | {
    __kind__: "BadFee";
    BadFee: {
        expected_fee: bigint;
    };
} | {
    __kind__: "AllowanceChanged";
    AllowanceChanged: {
        current_allowance: bigint;
    };
} | {
    __kind__: "CreatedInFuture";
    CreatedInFuture: {
        ledger_time: Timestamp;
    };
} | {
    __kind__: "TooOld";
    TooOld: null;
} | {
    __kind__: "Expired";
    Expired: {
        ledger_time: Timestamp;
    };
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        balance: bigint;
    };
};
export type ApproveResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: ApproveError;
};
export interface ArchiveInfo {
    end: bigint;
    canister_id: Principal;
    start: bigint;
}
export type BalanceResult = {
    __kind__: "Ok";
    Ok: TokenBalance;
} | {
    __kind__: "Err";
    Err: WalletError;
};
export interface BalanceSnapshot {
    decimals: number;
    totalSupply: bigint;
    exportedAt: Timestamp;
    holders: Array<SnapshotEntry>;
}
export interface Block {
    id: bigint;
    block: Value__1;
}
export type BurnResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: TransferError;
};
export interface Cell {
    value: Value__2;
    name: string;
}
export interface Conversion {
    id: bigint;
    status: ConversionStatus;
    depositor: Principal;
    usedFallback: boolean;
    priceUsdE8: bigint;
    minted: bigint;
    recipient: Account;
    message?: string;
    timestamp: Timestamp;
    tttiAmount: bigint;
    icpAmount: bigint;
    forward: ForwardStatus;
    fromCollector: bigint;
}
export interface DataCertificate {
    certificate: Uint8Array;
    hash_tree: Uint8Array;
}
export interface DeliveryAddressError {
    code: DeliveryAddressErrorCode;
    message: string;
}
export type DeliveryAddressResult = {
    __kind__: "Ok";
    Ok: Account;
} | {
    __kind__: "Err";
    Err: DeliveryAddressError;
};
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export interface ExactQuote {
    priceStale: boolean;
    protectionBps: bigint;
    usedFallback: boolean;
    priceUsdE8: bigint;
    icpCostE8s: bigint;
    maxIcpE8s: bigint;
    tttiAmount: bigint;
}
export type ExactQuoteResult = {
    __kind__: "Ok";
    Ok: ExactQuote;
} | {
    __kind__: "Err";
    Err: PurchaseError;
};
export interface FeeBounds {
    max: bigint;
    min: bigint;
}
export interface FeeCollectorInfo {
    balance: bigint;
    account: Account;
}
export type ForwardRetryResult = {
    __kind__: "ok";
    ok: bigint;
} | {
    __kind__: "err";
    err: string;
};
export type ForwardStatus = {
    __kind__: "forwarded";
    forwarded: bigint;
} | {
    __kind__: "pending";
    pending: null;
} | {
    __kind__: "notRequired";
    notRequired: null;
} | {
    __kind__: "failed";
    failed: string;
};
export interface GetArchivesArgs {
    from?: Principal;
}
export interface GetBlocksArgs {
    start: bigint;
    length: bigint;
}
export interface GetBlocksResult {
    log_length: bigint;
    blocks: Array<Block>;
    archived_blocks: Array<{
        args: Array<GetBlocksArgs>;
        callback: [Principal, string];
    }>;
}
export interface HttpHeader {
    value: string;
    name: string;
}
export interface HttpRequestResult {
    status: bigint;
    body: Uint8Array;
    headers: Array<HttpHeader>;
}
export interface IcpPrice {
    status: OracleStatus;
    source: PriceSource;
    usdMicro: bigint;
    updatedAt: Timestamp;
    stale: boolean;
    usdE8: bigint;
}
export interface LegacyBlockInfo {
    boundaryIndex: bigint;
    currentDecimals: number;
    legacyDecimals: number;
}
export type MetadataValue = {
    __kind__: "Int";
    Int: bigint;
} | {
    __kind__: "Nat";
    Nat: bigint;
} | {
    __kind__: "Blob";
    Blob: Uint8Array;
} | {
    __kind__: "Text";
    Text: string;
};
export type MintResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: TransferError;
};
export interface OnRampLink {
    url: string;
    name: string;
}
export interface OriginalDocument {
    blob: ExternalBlob;
    mimeType: string;
    filename: string;
}
export interface PreparedTransfer {
    to: Account;
    fee: bigint;
    from: Account;
    memo?: Uint8Array;
    createdAt: Timestamp;
    ledger: Principal;
    amount: bigint;
}
export interface PresaleStatus {
    priceUpdatedAt: Timestamp;
    priceStale: boolean;
    minPurchase: bigint;
    tokenPriceUsd: bigint;
    salesPaused: boolean;
    fallbackRate: bigint;
    priceUsdE8: bigint;
    fallbackEnabled: boolean;
    sold: bigint;
    reserved: bigint;
    priceSource: PriceSource;
    complete: boolean;
    transfersFrozen: boolean;
    liveRate?: bigint;
    remaining: bigint;
    allocation: bigint;
}
export type PriceResult = {
    __kind__: "Ok";
    Ok: IcpPrice;
} | {
    __kind__: "Err";
    Err: string;
};
export interface PublicTreasuryInfo {
    mode: TreasuryMode;
    icpAccount: Account;
    marginBps: bigint;
}
export interface PurchaseError {
    code: PurchaseErrorCode;
    message: string;
    conversion?: Conversion;
}
export type PurchaseErrorCode = {
    __kind__: "salesPaused";
    salesPaused: null;
} | {
    __kind__: "priceUnavailable";
    priceUnavailable: null;
} | {
    __kind__: "icpLedgerError";
    icpLedgerError: null;
} | {
    __kind__: "deliveryFailedRefunded";
    deliveryFailedRefunded: null;
} | {
    __kind__: "belowMinimum";
    belowMinimum: {
        minimumTtti: bigint;
        requestedTtti: bigint;
    };
} | {
    __kind__: "notConfigured";
    notConfigured: null;
} | {
    __kind__: "deliveryFailedRefundFailed";
    deliveryFailedRefundFailed: null;
} | {
    __kind__: "presaleComplete";
    presaleComplete: null;
} | {
    __kind__: "anonymousCaller";
    anonymousCaller: null;
} | {
    __kind__: "aboveRemaining";
    aboveRemaining: {
        maximumIcpE8s: bigint;
        maximumTtti: bigint;
        requestedTtti: bigint;
    };
} | {
    __kind__: "priceMoved";
    priceMoved: {
        requiredIcpE8s: bigint;
        maxIcpE8s: bigint;
    };
} | {
    __kind__: "transfersFrozen";
    transfersFrozen: null;
} | {
    __kind__: "insufficientIcp";
    insufficientIcp: {
        balance: bigint;
    };
} | {
    __kind__: "invalidAmount";
    invalidAmount: null;
} | {
    __kind__: "autoDepositsDisabled";
    autoDepositsDisabled: null;
} | {
    __kind__: "approvalMissing";
    approvalMissing: {
        allowance: bigint;
    };
};
export type PurchaseResult = {
    __kind__: "Ok";
    Ok: Conversion;
} | {
    __kind__: "Err";
    Err: PurchaseError;
};
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export type Result__1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export type SetFeeResult = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: string;
};
export interface SnapshotEntry {
    deliveryAddress?: Account;
    balance: bigint;
    needsMigration: boolean;
    kind: HolderKind;
    account: Account;
}
export type Subaccount = Uint8Array;
export interface SupportedBlockType {
    url: string;
    block_type: string;
}
export interface SupportedStandard {
    url: string;
    name: string;
}
export type Timestamp = bigint;
export interface TokenBalance {
    token: TokenDescriptor;
    balance?: bigint;
}
export interface TokenDescriptor {
    fee: bigint;
    decimals: number;
    name: string;
    symbol: string;
    canisterId: Principal;
}
export type TokenResult = {
    __kind__: "Ok";
    Ok: TokenDescriptor;
} | {
    __kind__: "Err";
    Err: WalletError;
};
export interface TransferArgs {
    to: Account;
    fee?: bigint;
    memo?: Uint8Array;
    from_subaccount?: Subaccount;
    created_at_time?: Timestamp;
    amount: bigint;
}
export type TransferError = {
    __kind__: "GenericError";
    GenericError: {
        message: string;
        error_code: bigint;
    };
} | {
    __kind__: "TemporarilyUnavailable";
    TemporarilyUnavailable: null;
} | {
    __kind__: "BadBurn";
    BadBurn: {
        min_burn_amount: bigint;
    };
} | {
    __kind__: "Duplicate";
    Duplicate: {
        duplicate_of: bigint;
    };
} | {
    __kind__: "BadFee";
    BadFee: {
        expected_fee: bigint;
    };
} | {
    __kind__: "CreatedInFuture";
    CreatedInFuture: {
        ledger_time: Timestamp;
    };
} | {
    __kind__: "TooOld";
    TooOld: null;
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        balance: bigint;
    };
};
export interface TransferFromArgs {
    to: Account;
    fee?: bigint;
    spender_subaccount?: Subaccount;
    from: Account;
    memo?: Uint8Array;
    created_at_time?: Timestamp;
    amount: bigint;
}
export type TransferFromError = {
    __kind__: "GenericError";
    GenericError: {
        message: string;
        error_code: bigint;
    };
} | {
    __kind__: "TemporarilyUnavailable";
    TemporarilyUnavailable: null;
} | {
    __kind__: "InsufficientAllowance";
    InsufficientAllowance: {
        allowance: bigint;
    };
} | {
    __kind__: "BadBurn";
    BadBurn: {
        min_burn_amount: bigint;
    };
} | {
    __kind__: "Duplicate";
    Duplicate: {
        duplicate_of: bigint;
    };
} | {
    __kind__: "BadFee";
    BadFee: {
        expected_fee: bigint;
    };
} | {
    __kind__: "CreatedInFuture";
    CreatedInFuture: {
        ledger_time: Timestamp;
    };
} | {
    __kind__: "TooOld";
    TooOld: null;
} | {
    __kind__: "InsufficientFunds";
    InsufficientFunds: {
        balance: bigint;
    };
};
export type TransferFromResult = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: TransferFromError;
};
export type TransferResult = {
    __kind__: "Ok";
    Ok: PreparedTransfer;
} | {
    __kind__: "Err";
    Err: WalletError;
};
export type TransferResult__1 = {
    __kind__: "Ok";
    Ok: bigint;
} | {
    __kind__: "Err";
    Err: TransferError;
};
export interface TransformationInput {
    context: Uint8Array;
    response: HttpRequestResult;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<HttpHeader>;
}
export interface TreasuryConfig {
    mode: TreasuryMode;
    rate: bigint;
    icpAccount: Account;
    marginBps: bigint;
}
export type TreasuryConfigResult = {
    __kind__: "Ok";
    Ok: TreasuryConfig;
} | {
    __kind__: "Err";
    Err: string;
};
export interface TreasuryState {
    mode: TreasuryMode;
    rate: bigint;
    icpBalance: bigint;
    liveRate?: bigint;
}
export interface UserProfile {
    name: string;
}
export type Value__1 = {
    __kind__: "Int";
    Int: bigint;
} | {
    __kind__: "Map";
    Map: Array<[string, Value__1]>;
} | {
    __kind__: "Nat";
    Nat: bigint;
} | {
    __kind__: "Blob";
    Blob: Uint8Array;
} | {
    __kind__: "Text";
    Text: string;
} | {
    __kind__: "Array";
    Array: Array<Value__1>;
};
export type Value__2 = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export type WalletError = {
    __kind__: "InvalidAmount";
    InvalidAmount: null;
} | {
    __kind__: "InvalidPrincipal";
    InvalidPrincipal: null;
} | {
    __kind__: "LedgerUnavailable";
    LedgerUnavailable: Principal;
} | {
    __kind__: "TransferFailed";
    TransferFailed: string;
} | {
    __kind__: "UnknownToken";
    UnknownToken: Principal;
};
export enum ConversionStatus {
    refundFailed = "refundFailed",
    completed = "completed",
    refunded = "refunded",
    failed = "failed"
}
export enum DeliveryAddressErrorCode {
    invalidPrincipal = "invalidPrincipal",
    empty = "empty",
    anonymousCaller = "anonymousCaller",
    anonymousPrincipal = "anonymousPrincipal",
    accountIdentifier = "accountIdentifier"
}
export enum HolderKind {
    feeCollector = "feeCollector",
    holder = "holder"
}
export enum OracleStatus {
    ok = "ok",
    stale = "stale",
    unavailable = "unavailable"
}
export enum PriceSource {
    none = "none",
    coinbase = "coinbase",
    coingecko = "coingecko"
}
export enum TreasuryMode {
    auto = "auto",
    manual = "manual"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    burn(from: Account, amount: bigint): Promise<BurnResult>;
    buyExactTtti(recipient: Account | null, tttiAmount: bigint, maxIcpE8s: bigint): Promise<PurchaseResult>;
    clearDeliveryAddress(): Promise<boolean>;
    convertDeposit(recipient: Account | null, icpAmount: bigint): Promise<PurchaseResult>;
    execute(qJson: string): Promise<Result>;
    exportBalanceSnapshot(): Promise<BalanceSnapshot>;
    getAdminSwitches(): Promise<AdminSwitches>;
    getApiDoc(): Promise<string>;
    getBalance(canisterId: Principal, account: Account): Promise<BalanceResult>;
    getBurnAccount(): Promise<Account>;
    getCallerIcpBalance(): Promise<bigint>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCanisterPrincipal(): Promise<Principal>;
    getConversions(): Promise<Array<Conversion>>;
    getDeliveryAddress(): Promise<Account | null>;
    getFailedForwards(): Promise<Array<Conversion>>;
    getFeeCollector(): Promise<FeeCollectorInfo>;
    getIcpPrice(): Promise<IcpPrice>;
    getLegacyBlockInfo(): Promise<LegacyBlockInfo>;
    getOnRampLinks(): Promise<Array<OnRampLink>>;
    getOriginalWhitePaper(): Promise<OriginalDocument | null>;
    getPresaleStatus(): Promise<PresaleStatus>;
    getPublicTreasuryInfo(): Promise<PublicTreasuryInfo | null>;
    getTokenMetadata(canisterId: Principal): Promise<TokenResult>;
    getTreasuryConfig(): Promise<TreasuryConfig | null>;
    getTreasuryState(): Promise<TreasuryState>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    get_fee(): Promise<bigint>;
    get_fee_bounds(): Promise<FeeBounds>;
    get_max_supply(): Promise<bigint>;
    handleDeposit(icpAmount: bigint): Promise<PurchaseResult>;
    icrc10_supported_standards(): Promise<Array<SupportedStandard>>;
    icrc1_balance_of(account: Account): Promise<bigint>;
    icrc1_decimals(): Promise<number>;
    icrc1_fee(): Promise<bigint>;
    icrc1_metadata(): Promise<Array<[string, MetadataValue]>>;
    icrc1_minting_account(): Promise<Account | null>;
    icrc1_name(): Promise<string>;
    icrc1_supported_standards(): Promise<Array<SupportedStandard>>;
    icrc1_symbol(): Promise<string>;
    icrc1_total_supply(): Promise<bigint>;
    icrc1_transfer(args: TransferArgs): Promise<TransferResult__1>;
    icrc2_allowance(args: AllowanceArgs): Promise<Allowance>;
    icrc2_approve(args: ApproveArgs): Promise<ApproveResult>;
    icrc2_transfer_from(args: TransferFromArgs): Promise<TransferFromResult>;
    icrc3_get_archives(args: GetArchivesArgs): Promise<Array<ArchiveInfo>>;
    icrc3_get_blocks(args: Array<GetBlocksArgs>): Promise<GetBlocksResult>;
    icrc3_get_tip_certificate(): Promise<DataCertificate | null>;
    icrc3_supported_block_types(): Promise<Array<SupportedBlockType>>;
    initializeAccessControl(): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    listTokens(): Promise<Array<TokenDescriptor>>;
    mint(to: Account, amount: bigint): Promise<MintResult>;
    prepareTransfer(canisterId: Principal, from: Account, to: Account, amount: bigint, memo: Uint8Array | null): Promise<TransferResult>;
    publishOriginalWhitePaper(document_: OriginalDocument): Promise<void>;
    quoteExactTtti(tttiAmount: bigint): Promise<ExactQuoteResult>;
    refreshIcpPrice(): Promise<PriceResult>;
    retryTreasuryForward(conversionId: bigint): Promise<ForwardRetryResult>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    schema(): Promise<string>;
    setDeliveryAddress(principalText: string): Promise<DeliveryAddressResult>;
    setFallbackEnabled(enabled: boolean): Promise<void>;
    setOnRampLinks(links: Array<OnRampLink>): Promise<void>;
    setSalesPaused(paused: boolean): Promise<void>;
    setTransfersFrozen(frozen: boolean): Promise<void>;
    setTreasuryConfig(config: TreasuryConfig): Promise<TreasuryConfigResult>;
    set_fee(newFee: bigint): Promise<SetFeeResult>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
