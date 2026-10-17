import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import OutCall "mo:caffeineai-http-outcalls/outcall";
import AccessControl "mo:caffeineai-authorization/access-control";
import Oracle "../types/oracle";
import OracleLib "../lib/oracle";

mixin (
  oracle : OracleLib.OracleStore,
  accessControlState : AccessControl.AccessControlState
) {
  // Returns the cached ICP/USD price and its status. Callable by anyone,
  // including anonymous. Never performs an outcall.
  public query func getIcpPrice() : async Oracle.IcpPrice {
    OracleLib.getPrice(oracle);
  };

  // Refreshes the cached ICP/USD price (Coinbase, then CoinGecko). Admin-only.
  public shared ({ caller }) func refreshIcpPrice() : async Oracle.PriceResult {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: only admins can refresh the ICP price");
    };
    await OracleLib.refreshPrice(oracle, transform);
  };

  // The transform callback the IC requires for the CoinGecko outcall.
  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };
};
