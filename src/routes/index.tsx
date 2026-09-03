import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import heroKidsMagazine from "@/assets/hero-kids-magazine.jpg";
import logoAsset from "@/assets/selamkids-logo.png.asset.json";

const logoUrl = logoAsset.url;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Selam Kids — Stories for Bright Young Readers" },
      {
        name: "description",
        content: "A cheerful reading space for kids to enjoy stories, messages, and family fun.",
      },
      { property: "og:title", content: "Selam Kids — Stories for Bright Young Readers" },
      {
        property: "og:description",
        content: "Start reading colorful kids stories with Selam Kids.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <main className="min-h-screen bg-background p-4 font-sans">
      <section className="relative flex min-h-[calc(100vh-2rem)] overflow-hidden rounded-4xl shadow-[var(--shadow-card)]">
        <img
          src={heroKidsMagazine}
          alt="Kids reading Selam Kids magazines together"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.34_0.11_255/0.92),oklch(0.46_0.13_255/0.58),oklch(0.88_0.12_90/0.18))]" />

        <div className="relative z-10 flex w-full flex-col justify-between p-5 sm:p-8 lg:p-10">
          <img
            src={logoUrl}
            alt="Selam Kids logo"
            className="h-12 w-fit rounded-2xl bg-card/90 p-1"
          />

          <div className="max-w-xl pb-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 font-display text-xs font-extrabold text-secondary-foreground shadow-[var(--shadow-soft)]">
              <BookOpen className="size-4" /> Stories, learning, and joy
            </span>
            <h1 className="mt-5 font-display text-5xl leading-none font-extrabold text-primary-foreground sm:text-6xl">
              Selam Kids
            </h1>
            <p className="mt-4 max-w-md text-base font-bold text-primary-foreground/90 sm:text-lg">
              A colorful place where kids read stories, share messages, and grow with happy
              learning.
            </p>
            <Link
              to="/auth"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-secondary px-7 py-3 font-display text-base font-extrabold text-secondary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
            >
              Get Started <ArrowRight className="size-5" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
