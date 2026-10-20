import { ArrowLeft, Sparkles } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { DussehraScene } from "@/components/DussehraScene";

export const Route = createFileRoute("/wish")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "wish to Tanii" },
      {
        name: "description",
        content: "A golden Apta leaf and a heartfelt Marathi Vijayadashami wish, made for you.",
      },
      { property: "og:title", content: "wish to Tanii" },
      {
        property: "og:description",
        content: "A golden Apta leaf and a heartfelt Marathi Vijayadashami wish, made for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WishPage,
});

function WishPage() {
  return (
    <main className="dussehra-page dussehra-wish">
      <div className="dussehra-scene" aria-hidden="true">
        <DussehraScene variant="reveal" />
      </div>
      <div className="dussehra-frame" aria-hidden="true" />

      <header className="dussehra-masthead">
        <span className="dussehra-masthead__mark" aria-hidden="true">
          <Sparkles size={16} strokeWidth={1.4} />
        </span>
        <span lang="mr">विजयादशमी विशेष</span>
        <span className="dussehra-masthead__year">A WISH FOR YOU</span>
      </header>

      <section className="dussehra-wish__content" aria-labelledby="wish-title">
        <p className="dussehra-kicker dussehra-wish__kicker">
          <span className="dussehra-kicker__rule" aria-hidden="true" />A little gold, for someone
          golden
        </p>
        <h1 id="wish-title" className="dussehra-wish__greeting" lang="mr">
          <span className="dussehra-wish__first">सोन्यासारख्या माणसाला माझ्याकडून...</span>
          <span className="dussehra-wish__second">सोना घे... आणि नेहमी सोन्यासारखीच राह!</span>
        </h1>
        <p className="dussehra-wish__blessing" lang="mr">
          तुझ्या आयुष्यात सुख, समृद्धी आणि आनंद सदैव नांदो.
        </p>
        <p className="dussehra-wish__signoff">
          Happy Dussehra <span aria-hidden="true">•</span> शुभ विजयादशमी
        </p>
      </section>

      <footer className="dussehra-wish__footer">
        <Button asChild variant="ghost" className="dussehra-replay">
          <Link to="/" aria-label="Replay the Dussehra wish">
            <ArrowLeft size={15} strokeWidth={1.6} />
            <span>Replay</span>
          </Link>
        </Button>
        <span className="dussehra-footer__ornament" aria-hidden="true" />
        <span className="dussehra-wish__footer-note" lang="mr">
          सोने घ्या, सोने द्या
        </span>
      </footer>
    </main>
  );
}
