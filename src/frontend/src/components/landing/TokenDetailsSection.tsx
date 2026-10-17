import { TokenInfo } from "../TokenInfo";

export function TokenDetailsSection() {
  return (
    <section
      id="token"
      aria-labelledby="token-title"
      className="scroll-mt-20 bg-background section-breathing"
      data-ocid="landing.token.section"
    >
      <div className="container mx-auto grid items-start gap-12 px-4 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
        <div className="space-y-6 lg:pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            The token
          </p>
          <h2
            id="token-title"
            className="font-display text-balance text-4xl leading-tight text-foreground md:text-5xl"
          >
            TTTI-T (Test).
            <br />
            The ledger stays intact.
          </h2>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            TTTI-T is the public Test name. The existing ledger still reports
            TTTI-P as its symbol, so balances and earlier transactions remain
            identifiable under that symbol. Explore the live supply and fees
            alongside the reference price.
          </p>
        </div>
        <div className="min-w-0">
          <TokenInfo />
        </div>
      </div>
      <div className="container mx-auto mt-10 px-4">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-5 border-t border-border/70 pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ledger standards
          </p>
          <img
            src="/assets/badges/icrc1-token-standard.png"
            alt="ICRC-1 token standard badge"
            loading="lazy"
            className="h-10 w-auto rounded object-contain"
          />
          <img
            src="/assets/badges/icrc2-token-standard.png"
            alt="ICRC-2 token standard badge"
            loading="lazy"
            className="h-10 w-auto rounded object-contain"
          />
          <span className="text-sm text-muted-foreground">
            ICRC-3 · transaction history
          </span>
        </div>
      </div>
    </section>
  );
}
