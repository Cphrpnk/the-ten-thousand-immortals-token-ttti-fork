import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { useGetPresaleStatus } from "../../hooks/useQueries";
import { CrestLogo } from "../Footer";
import { BuyTttiButton } from "../funnel/BuyTttiButton";
import { Skeleton } from "../ui/skeleton";

interface HeroSectionProps {
  id: string;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroSection({ id }: HeroSectionProps) {
  const { data: status, isLoading } = useGetPresaleStatus();

  const eyebrow = status?.complete
    ? "Test allocation complete"
    : status?.salesPaused
      ? "Test purchases paused"
      : "TTTI-T (Test) is open";
  const eyebrowDot = status?.complete
    ? "bg-primary"
    : status?.salesPaused
      ? "bg-warning"
      : "bg-success animate-pulse-subtle";

  return (
    <section
      id={id}
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-background"
      data-ocid="landing.hero.section"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-pattern-imperial [mask-image:radial-gradient(ellipse_at_70%_30%,black,transparent_75%)]"
      />
      <div className="container relative mx-auto grid min-h-[calc(100svh-4rem)] items-center gap-10 px-4 py-14 md:min-h-[calc(100svh-4.5rem)] md:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <motion.div
          className="relative order-1 mx-auto flex aspect-square w-64 items-center justify-center sm:w-80 lg:order-2 lg:w-full lg:max-w-[30rem]"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease }}
        >
          <div
            aria-hidden="true"
            className="absolute -inset-[30%] glow-crest motion-safe:animate-glow-pulse"
          />
          <div
            aria-hidden="true"
            className="absolute inset-[6%] rounded-full border border-gold"
          />
          <div
            aria-hidden="true"
            className="absolute inset-[1%] rounded-full border border-gold opacity-40"
          />
          <CrestLogo
            alt="The Ten Thousand Immortals emblem: a gold winged helmet above the TTTI wordmark"
            className="h-[84%] w-[84%] shadow-gold-lg"
          />
        </motion.div>

        <div className="order-2 flex flex-col items-start gap-6 lg:order-1">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.1 }}
            className="min-h-5"
          >
            {isLoading ? (
              <Skeleton
                className="h-4 w-44"
                data-ocid="landing.hero.loading_state"
              />
            ) : (
              <p
                className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-primary"
                data-ocid="landing.hero.status"
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${eyebrowDot}`}
                />
                {eyebrow}
              </p>
            )}
          </motion.div>

          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.18 }}
            className="text-imperial text-balance text-[2.6rem] leading-[1.02] tracking-[0.06em] text-foreground sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
          >
            Join the <span className="text-gradient-gold">Ten Thousand</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.28 }}
            className="max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            A legend of discipline and honor, minted on the Internet Computer.
            Ten thousand tokens, never more — claim your place among the ranks
            of the Immortals.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.38 }}
            className="flex w-full flex-col gap-4 pt-2 sm:w-auto sm:flex-row sm:items-center sm:gap-6"
          >
            <BuyTttiButton
              size="lg"
              showIcon
              className="w-full sm:w-auto"
              ocid="landing.hero.primary_button"
            />
            <Link
              to="/buy-icp"
              className="group inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-smooth hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              data-ocid="landing.hero.secondary_button"
            >
              Need ICP?{" "}
              <span className="text-foreground underline decoration-primary/50 underline-offset-4 transition-smooth group-hover:text-primary group-hover:decoration-primary">
                Get ICP first
              </span>
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
