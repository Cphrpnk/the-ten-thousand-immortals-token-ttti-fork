import { useEffect, useState } from "react";
import { TOKEN_PRICE_USD, TTTI_SYMBOL } from "../../lib/token";
import { BuyTttiButton } from "../funnel/BuyTttiButton";

interface MobileBuyBarProps {
  /** Element id the bar waits to scroll past before appearing. */
  heroId: string;
  /** Element id at which the bar hides again (it carries its own CTA). */
  endId: string;
}

export function MobileBuyBar({ heroId, endId }: MobileBuyBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const hero = document.getElementById(heroId);
      const end = document.getElementById(endId);
      const heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
      const endTop = end
        ? end.getBoundingClientRect().top
        : Number.POSITIVE_INFINITY;
      setVisible(heroBottom < 0 && endTop > window.innerHeight);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [heroId, endId]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-gold bg-card/95 shadow-elevated backdrop-blur-md transition-smooth motion-reduce:transition-none md:hidden ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0"
      }`}
      aria-hidden={!visible}
      inert={!visible}
      data-ocid="landing.mobile_buy_bar.panel"
    >
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm text-foreground">
            Join the Ten Thousand
          </p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            TTTI-T (Test) · {TTTI_SYMBOL} ledger ·{" "}
            {TOKEN_PRICE_USD.toLocaleString("en-US")} USD/token
          </p>
        </div>
        <BuyTttiButton
          showIcon
          className="shrink-0"
          ocid="landing.mobile_buy_bar.primary_button"
        />
      </div>
    </div>
  );
}
