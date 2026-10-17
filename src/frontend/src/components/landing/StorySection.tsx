import { Landmark, Shield, Swords, Users } from "lucide-react";
import { motion } from "motion/react";

const pillars = [
  {
    icon: Swords,
    title: "Discipline",
    text: "The guard held its line as one. Every TTTI-P is issued by the same open rules, enforced by code on the Internet Computer.",
  },
  {
    icon: Landmark,
    title: "Legacy",
    text: "Their name outlived their empire. A ledger on-chain keeps every transfer on record, open for anyone to verify.",
  },
  {
    icon: Shield,
    title: "Honor",
    text: "An Immortal kept his word. No hidden mint, no silent supply — ten thousand is the ceiling, written into the token.",
  },
  {
    icon: Users,
    title: "Brotherhood",
    text: "When one fell, another stepped forward. TTTI gathers a company of holders who carry the standard together.",
  },
];

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
};

export function StorySection() {
  return (
    <section
      id="story"
      aria-labelledby="story-title"
      className="scroll-mt-20 bg-background py-20 md:py-28"
      data-ocid="landing.story.section"
    >
      <div className="container mx-auto grid gap-12 px-4 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
        <motion.div
          {...reveal}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            The legend
          </p>
          <h2
            id="story-title"
            className="text-imperial text-balance text-3xl leading-tight text-foreground md:text-5xl"
          >
            The Ten Thousand Immortals
          </h2>
          <div className="divider-gold max-w-24" />
          <div className="space-y-5 text-base leading-relaxed text-muted-foreground md:text-lg">
            <p>
              History remembers an elite guard of exactly ten thousand. Their
              ranks never thinned: the moment one warrior fell, another stood in
              his place. They were called the{" "}
              <em className="font-display not-italic text-foreground">
                Immortals
              </em>
              — not because they could not die, but because their order could
              not be broken.
            </p>
            <p>
              TTTI carries that idea onto the Internet Computer. A fixed company
              of ten thousand tokens, governed by transparent rules rather than
              promises, for people who value discipline, legacy and honor.
            </p>
          </div>
          <blockquote className="border-l-2 border-gold-strong pl-5 font-display text-xl italic leading-snug text-foreground md:text-2xl">
            “Ten thousand stood. Ten thousand stand.”
          </blockquote>
        </motion.div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {pillars.map((pillar, index) => (
            <motion.li
              key={pillar.title}
              {...reveal}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.08 * index,
              }}
              className="group rounded-lg border border-gold bg-gradient-surface p-6 shadow-inset-gold transition-smooth hover:-translate-y-1 hover:border-gold-strong hover:shadow-gold"
              data-ocid={`landing.story.item.${index + 1}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold bg-primary/10 text-primary transition-smooth group-hover:bg-primary/20">
                <pillar.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-imperial text-lg text-foreground">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {pillar.text}
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
      <p className="container mx-auto mt-12 px-4 text-xs text-muted-foreground">
        TTTI-P is a community token. It does not offer yield, returns or profit,
        and nothing on this page is financial advice.
      </p>
    </section>
  );
}
