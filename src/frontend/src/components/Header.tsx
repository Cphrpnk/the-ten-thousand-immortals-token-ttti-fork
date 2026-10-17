import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  BookOpen,
  Coins,
  History,
  Home,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
  Swords,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { usePlug } from "../hooks/usePlug";
import { useIsCallerAdmin } from "../hooks/useQueries";
import { CrestLogo } from "./Footer";
import { BuyTttiButton } from "./funnel/BuyTttiButton";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ocid: string;
  exact?: boolean;
}

const BASE_NAV: Array<NavItem> = [
  { to: "/", label: "Home", icon: Home, ocid: "header.home_link", exact: true },
  {
    to: "/white-paper",
    label: "White Paper",
    icon: BookOpen,
    ocid: "header.white_paper_link",
  },
  {
    to: "/exchange",
    label: "Exchange",
    icon: Swords,
    ocid: "header.exchange_link",
  },
  {
    to: "/buy-icp",
    label: "Get ICP",
    icon: Coins,
    ocid: "header.buy_icp_link",
  },
  { to: "/wallet", label: "Wallet", icon: Wallet, ocid: "header.wallet_link" },
  {
    to: "/transfer",
    label: "Transfer",
    icon: ArrowRightLeft,
    ocid: "header.transfer_link",
  },
  {
    to: "/history",
    label: "History",
    icon: History,
    ocid: "header.history_link",
  },
];

const ADMIN_NAV: NavItem = {
  to: "/admin",
  label: "Admin",
  icon: ShieldCheck,
  ocid: "header.admin_link",
};

const desktopLinkClass =
  "relative rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-smooth hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-x-3 after:-bottom-px after:h-px after:origin-center after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 hover:after:scale-x-100 data-[status=active]:text-primary data-[status=active]:after:scale-x-100";

const mobileLinkClass =
  "flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:bg-secondary data-[status=active]:text-primary";

const authButtonClass =
  "gap-2 border-border bg-transparent text-foreground transition-smooth hover:border-primary/50 hover:bg-secondary hover:text-foreground";

export function Header() {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const { principal: plugPrincipal, disconnect: disconnectPlug } = usePlug();
  const { data: isAdmin } = useIsCallerAdmin();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAuthenticated = !!identity || !!plugPrincipal;
  const isLoggingIn = loginStatus === "logging-in";
  const navItems = isAdmin ? [...BASE_NAV, ADMIN_NAV] : BASE_NAV;

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      if (plugPrincipal) {
        await disconnectPlug();
      }
      queryClient.clear();
    } else {
      try {
        await login();
      } catch (error) {
        console.error("Login error:", error);
        if (
          error instanceof Error &&
          error.message === "User is already authenticated"
        ) {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  const authLabel = isLoggingIn
    ? "Signing in…"
    : isAuthenticated
      ? "Sign out"
      : "Sign in";
  const AuthIcon = isAuthenticated ? LogOut : LogIn;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 shadow-subtle backdrop-blur-md supports-[backdrop-filter]:bg-card/85">
      <div className="container mx-auto flex h-[4.5rem] items-center justify-between gap-4 px-4 md:h-20">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-3 rounded-md transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-ocid="header.link"
        >
          <CrestLogo
            alt="The Ten Thousand Immortals crest"
            className="h-10 w-10 transition-transform duration-300 group-hover:scale-105 md:h-11 md:w-11"
          />
          <span className="min-w-0">
            <span className="text-imperial block truncate text-lg leading-none text-gradient-gold 2xl:hidden">
              TTTI
            </span>
            <span className="text-imperial hidden truncate text-[0.95rem] leading-none text-gradient-gold 2xl:block">
              The Ten Thousand Immortals
            </span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 xl:flex"
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              className={desktopLinkClass}
              data-ocid={item.ocid}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            onClick={handleAuth}
            disabled={isLoggingIn}
            variant="outline"
            size="sm"
            className={`${authButtonClass} hidden h-9 xl:inline-flex`}
            data-ocid="header.auth_button"
          >
            <AuthIcon className="h-4 w-4" />
            <span>{authLabel}</span>
          </Button>
          <BuyTttiButton size="sm" ocid="header.buy_ttti_button" />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open navigation menu"
                className="h-11 w-11 text-foreground transition-smooth hover:bg-secondary hover:text-primary xl:hidden"
                data-ocid="header.menu_button"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-80 border-l border-border bg-card"
              data-ocid="header.sheet"
            >
              <SheetHeader className="border-b border-border pb-4">
                <SheetTitle className="flex items-center gap-3">
                  <CrestLogo className="h-9 w-9" />
                  <span className="text-imperial text-sm leading-tight text-gradient-gold">
                    The Ten Thousand Immortals
                  </span>
                </SheetTitle>
              </SheetHeader>
              <nav
                className="flex flex-col gap-1 px-4 pt-5"
                aria-label="Mobile navigation"
              >
                {navItems.map((item) => (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      activeOptions={{ exact: item.exact ?? false }}
                      className={mobileLinkClass}
                      data-ocid={`mobile_${item.ocid}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-3 border-t border-border p-4">
                <BuyTttiButton
                  className="w-full"
                  showIcon
                  ocid="header.mobile_buy_ttti_button"
                  onClick={() => setMenuOpen(false)}
                />
                <Button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleAuth();
                  }}
                  disabled={isLoggingIn}
                  variant="outline"
                  className={`${authButtonClass} h-11 w-full`}
                  data-ocid="header.mobile_auth_button"
                >
                  <AuthIcon className="h-4 w-4" />
                  <span>{authLabel}</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
