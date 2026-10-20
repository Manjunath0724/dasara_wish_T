import { useState, type MouseEvent } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { DussehraScene } from "@/components/DussehraScene";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "wish to Tanii" },
      {
        name: "description",
        content: "A small, golden keepsake for someone special this Vijayadashami.",
      },
      { property: "og:title", content: "wish to Tanii" },
      {
        property: "og:description",
        content: "A small, golden keepsake for someone special this Vijayadashami.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntroPage,
});

function IntroPage() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => false);

  useState(() => {
    if (typeof window !== "undefined") {
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
    return null;
  });

  const unveil = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (reducedMotion) {
      void navigate({ to: "/wish" });
      return;
    }
    setLeaving(true);
    window.setTimeout(() => void navigate({ to: "/wish" }), 520);
  };

  return (
    <main className={`dussehra-page dussehra-intro${leaving ? " dussehra-page--leaving" : ""}`}>
      <div className="dussehra-scene" aria-hidden="true">
        <DussehraScene variant="intro" isLeaving={leaving} />
      </div>
      <div className="dussehra-frame" aria-hidden="true" />

      <header className="dussehra-masthead">
        <span className="dussehra-masthead__mark" aria-hidden="true">
          <Sparkles size={16} strokeWidth={1.4} />
        </span>
        <span lang="mr">विजयादशमी विशेष</span>
        <span className="dussehra-masthead__year">A FESTIVAL OF GOLD</span>
      </header>

      <section className="dussehra-intro__content" aria-labelledby="intro-title">
        <p className="dussehra-kicker">
          <span className="dussehra-kicker__rule" aria-hidden="true" />A little tradition, made just
          for you
        </p>
        <h1 id="intro-title" className="dussehra-intro__title">
          Ready for your
          <br />
          <em>Dussehra wish?</em>
        </h1>
        <p className="dussehra-intro__copy">
          Some traditions are more than rituals. They&apos;re little ways of wishing happiness,
          prosperity, and a golden year ahead.
        </p>
        <Button asChild size="lg" className="dussehra-action">
          <Link to="/wish" onClick={unveil} aria-label="Unveil your Dussehra wish">
            <span>Unveil Your Wish</span>
            <ArrowRight className="dussehra-action__arrow" size={18} strokeWidth={1.7} />
          </Link>
        </Button>
      </section>

      <footer className="dussehra-intro__footer">
        <span className="dussehra-footer__ornament" aria-hidden="true" />
        May your year be filled with golden moments.
        <span className="dussehra-footer__ornament" aria-hidden="true" />
      </footer>
    </main>
  );
}
