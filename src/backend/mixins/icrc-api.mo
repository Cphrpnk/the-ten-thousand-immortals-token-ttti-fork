import Common "../types/common";
import Icrc "../types/icrc";
import Token "../types/token";
import IcrcLib "../lib/icrc";

mixin (ledger : IcrcLib.Ledger, canisterPrincipal : Principal) {
  // --- ICRC-1 ----------------------------------------------------------------

  public query func icrc1_name() : async Text {
    IcrcLib.name();
  };

  public query func icrc1_symbol() : async Text {
    IcrcLib.symbol();
  };

  public query func icrc1_decimals() : async Nat8 {
    IcrcLib.decimals();
  };

  public query func icrc1_fee() : async Nat {
    IcrcLib.fee(ledger);
  };

  public query func icrc1_total_supply() : async Nat {
    IcrcLib.totalSupply(ledger);
  };

  public query func icrc1_balance_of(account : Common.Account) : async Nat {
    IcrcLib.balanceOf(ledger, account);
  };

  public query func icrc1_metadata() : async [(Text, Icrc.MetadataValue)] {
    IcrcLib.metadata(ledger);
  };

  public query func icrc1_supported_standards() : async [Icrc.SupportedStandard] {
    IcrcLib.supportedStandards();
  };

  // The ICRC-1 minting account (= burn account): canister, null subaccount.
  public query func icrc1_minting_account() : async ?Common.Account {
    IcrcLib.mintingAccount(canisterPrincipal);
  };

  // --- ICRC-10 ---------------------------------------------------------------

  public query func icrc10_supported_standards() : async [Icrc.SupportedStandard] {
    IcrcLib.supportedStandards();
  };

  public shared ({ caller }) func icrc1_transfer(args : Icrc.TransferArgs) : async Icrc.TransferResult {
    IcrcLib.transfer(ledger, canisterPrincipal, caller, args);
  };

  // --- ICRC-2 ----------------------------------------------------------------

  public shared ({ caller }) func icrc2_approve(args : Icrc.ApproveArgs) : async Icrc.ApproveResult {
    IcrcLib.approve(ledger, canisterPrincipal, caller, args);
  };

  public query func icrc2_allowance(args : Icrc.AllowanceArgs) : async Icrc.Allowance {
    IcrcLib.allowance(ledger, args);
  };

  public shared ({ caller }) func icrc2_transfer_from(args : Icrc.TransferFromArgs) : async Icrc.TransferFromResult {
    IcrcLib.transferFrom(ledger, canisterPrincipal, caller, args);
  };

  // --- ICRC-3 ----------------------------------------------------------------

  public query func icrc3_get_blocks(args : [Icrc.GetBlocksArgs]) : async Icrc.GetBlocksResult {
    IcrcLib.getBlocks(ledger, args);
  };

  // No archive canisters: always [].
  public query func icrc3_get_archives(args : Icrc.GetArchivesArgs) : async [Icrc.ArchiveInfo] {
    ignore args;
    IcrcLib.getArchives();
  };

  public query func icrc3_get_tip_certificate() : async ?Icrc.DataCertificate {
    IcrcLib.getTipCertificate(ledger);
  };

  public query func icrc3_supported_block_types() : async [Icrc.SupportedBlockType] {
    IcrcLib.supportedBlockTypes();
  };

  // --- Fee collector, burn account, legacy history ---------------------------

  // The fee collector account and its TTTI-P balance. Public.
  public query func getFeeCollector() : async Token.FeeCollectorInfo {
    IcrcLib.feeCollectorInfo(ledger, canisterPrincipal);
  };

  // The burn account (ICRC-1 minting account). Public.
  public query func getBurnAccount() : async Common.Account {
    IcrcLib.burnAccount(canisterPrincipal);
  };

  // Legacy decimals boundary for the History page. Public.
  public query func getLegacyBlockInfo() : async Token.LegacyBlockInfo {
    IcrcLib.legacyBlockInfo(ledger);
  };
};
