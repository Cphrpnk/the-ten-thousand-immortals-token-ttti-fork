import { useNavigate } from "@tanstack/react-router";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { SignInChoiceDialog } from "../components/funnel/SignInChoiceDialog";
import { useInternetIdentity } from "./useInternetIdentity";
import { usePlug } from "./usePlug";

export interface BuyFunnelContextValue {
  /** Signed in → /exchange; signed out → open the sign-in choice dialog. */
  startBuy: () => void;
  /** True when an Internet Identity session or a Plug connection is present. */
  isSignedIn: boolean;
}

const BuyFunnelContext = createContext<BuyFunnelContextValue | undefined>(
  undefined,
);

type PendingMethod = "ii" | "plug" | null;

/**
 * Shared Buy TTTI funnel. Must be rendered inside the router so it can
 * navigate. Renders the sign-in choice dialog once for the whole app.
 */
export function BuyFunnelProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { login, loginStatus, identity } = useInternetIdentity();
  const { principal, isAvailable, connect } = usePlug();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingMethod>(null);

  const isSignedIn = !!identity || !!principal;

  // Once a sign-in started from the dialog succeeds, continue to the purchase.
  useEffect(() => {
    if (!pending || !isSignedIn) return;
    setPending(null);
    setOpen(false);
    void navigate({ to: "/exchange" });
  }, [pending, isSignedIn, navigate]);

  useEffect(() => {
    if (loginStatus === "loginError") {
      setPending((current) => (current === "ii" ? null : current));
    }
  }, [loginStatus]);

  const startBuy = useCallback(() => {
    if (isSignedIn) {
      void navigate({ to: "/exchange" });
      return;
    }
    setOpen(true);
  }, [isSignedIn, navigate]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPending(null);
  }, []);

  const handleInternetIdentity = useCallback(() => {
    setPending("ii");
    try {
      login();
    } catch (error) {
      setPending(null);
      toast.error(
        error instanceof Error
          ? error.message
          : "Internet Identity sign-in failed",
      );
    }
  }, [login]);

  const handleConnectPlug = useCallback(async () => {
    setPending("plug");
    try {
      await connect();
    } catch (error) {
      setPending(null);
      toast.error(
        error instanceof Error
          ? error.message
          : "Plug connection was not completed",
      );
    }
  }, [connect]);

  const value = useMemo<BuyFunnelContextValue>(
    () => ({ startBuy, isSignedIn }),
    [startBuy, isSignedIn],
  );

  return createElement(
    BuyFunnelContext.Provider,
    { value },
    children,
    createElement(SignInChoiceDialog, {
      open,
      onOpenChange: handleOpenChange,
      onInternetIdentity: handleInternetIdentity,
      onConnectPlug: () => {
        void handleConnectPlug();
      },
      isPlugAvailable: isAvailable,
      isIiPending: pending === "ii" && loginStatus === "logging-in",
      isPlugPending: pending === "plug",
    }),
  );
}

export function useBuyFunnel(): BuyFunnelContextValue {
  const context = useContext(BuyFunnelContext);
  if (!context) {
    throw new Error("useBuyFunnel must be used within a BuyFunnelProvider");
  }
  return context;
}
