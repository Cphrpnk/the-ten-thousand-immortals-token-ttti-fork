import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ExternalLink,
  Fingerprint,
  Loader2,
  Plug,
} from "lucide-react";
import { CrestLogo } from "../Footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

export interface SignInChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start Internet Identity sign-in. */
  onInternetIdentity: () => void;
  /** Start the Plug wallet connection. */
  onConnectPlug: () => void;
  /** True when the Plug extension is detected in this browser. */
  isPlugAvailable: boolean;
  /** True while Internet Identity sign-in is in progress. */
  isIiPending: boolean;
  /** True while Plug is connecting. */
  isPlugPending: boolean;
}

const optionClass =
  "group flex w-full min-h-16 items-center gap-4 rounded-lg border border-gold bg-gradient-surface px-4 py-3 text-left transition-smooth hover:border-gold-strong hover:shadow-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none";

export function SignInChoiceDialog({
  open,
  onOpenChange,
  onInternetIdentity,
  onConnectPlug,
  isPlugAvailable,
  isIiPending,
  isPlugPending,
}: SignInChoiceDialogProps) {
  const busy = isIiPending || isPlugPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-gold bg-card shadow-gold-lg sm:max-w-md"
        data-ocid="signin_choice.dialog"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px divider-gold"
        />
        <DialogHeader className="items-center text-center sm:text-center">
          <CrestLogo className="mb-2 h-14 w-14" />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Step into the ranks
          </p>
          <DialogTitle className="text-imperial text-2xl text-foreground">
            Sign in to buy TTTI
          </DialogTitle>
          <DialogDescription className="text-balance text-muted-foreground">
            Choose how you enter. Your wallet signs every transfer — the presale
            never holds your keys.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onInternetIdentity}
            disabled={busy}
            className={optionClass}
            data-ocid="signin_choice.ii_button"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold bg-secondary text-primary">
              {isIiPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Fingerprint className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">
                {isIiPending
                  ? "Waiting for Internet Identity…"
                  : "Sign in with Internet Identity"}
              </span>
              <span className="block text-sm text-muted-foreground">
                Passkey sign-in, native to the Internet Computer
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={onConnectPlug}
            disabled={busy || !isPlugAvailable}
            className={optionClass}
            data-ocid="signin_choice.plug_button"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold bg-secondary text-primary">
              {isPlugPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plug className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">
                {isPlugPending ? "Connecting Plug…" : "Connect Plug"}
              </span>
              <span className="block text-sm text-muted-foreground">
                {isPlugAvailable
                  ? "Use your Plug wallet browser extension"
                  : "Plug extension not detected in this browser"}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-1" />
          </button>

          {!isPlugAvailable && (
            <p
              className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
              data-ocid="signin_choice.plug_install_hint"
            >
              Prefer Plug?{" "}
              <a
                href="https://plugwallet.ooo/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 transition-smooth hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                data-ocid="signin_choice.plug_install_link"
              >
                Install the extension
                <ExternalLink className="h-3.5 w-3.5" />
              </a>{" "}
              and reload this page.
            </p>
          )}
        </div>

        <div className="divider-gold" />

        <p className="text-center text-sm text-muted-foreground">
          Need ICP?{" "}
          <Link
            to="/buy-icp"
            onClick={() => onOpenChange(false)}
            className="font-medium text-primary underline-offset-4 transition-smooth hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            data-ocid="signin_choice.get_icp_link"
          >
            Get ICP first
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
