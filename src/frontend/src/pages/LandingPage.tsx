import { MotionConfig } from "motion/react";
import { ClosingCta } from "../components/landing/ClosingCta";
import { FaqSection } from "../components/landing/FaqSection";
import { HeroSection } from "../components/landing/HeroSection";
import { HowItWorks } from "../components/landing/HowItWorks";
import { MobileBuyBar } from "../components/landing/MobileBuyBar";
import { PresaleSection } from "../components/landing/PresaleSection";
import { StorySection } from "../components/landing/StorySection";
import { TokenDetailsSection } from "../components/landing/TokenDetailsSection";

const HERO_ID = "top";
const CLOSING_ID = "join";

function Divider() {
  return (
    <div aria-hidden="true" className="container mx-auto px-4">
      <div className="divider-gold" />
    </div>
  );
}

export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative" data-ocid="landing.page">
        <HeroSection id={HERO_ID} />
        <PresaleSection />
        <StorySection />
        <Divider />
        <HowItWorks />
        <TokenDetailsSection />
        <FaqSection />
        <Divider />
        <ClosingCta id={CLOSING_ID} />
        <MobileBuyBar heroId={HERO_ID} endId={CLOSING_ID} />
      </div>
    </MotionConfig>
  );
}
