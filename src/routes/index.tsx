import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/kids/Sidebar";
import { StoryCard } from "@/components/kids/StoryCard";
import heroReading from "@/assets/hero-reading.jpg";
import heroMagazine from "@/assets/hero-magazine.jpg";
import heroKidsMagazine from "@/assets/hero-kids-magazine.jpg";
import { stories } from "@/lib/stories";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Little Read — Fun Stories & Learning for Kids" },
      {
        name: "description",
        content:
          "Little Read is a colorful reading library for kids: illustrated stories about space, animals and nature, with short reads for every day.",
      },
      { property: "og:title", content: "Little Read — Fun Stories & Learning for Kids" },
      {
        property: "og:description",
        content: "Discover amazing illustrated stories and learn something new every day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});


const slides = [
  {
    image: heroMagazine,
    alt: "Open kids magazine lying on green grass",
    kicker: "September editions",
    title: "selamkids",
  },
  {
    image: heroKidsMagazine,
    alt: "Kids reading magazines together under a big autumn tree",
    kicker: "September editions",
    title: "selamkids",
  },
  {
    image: heroReading,
    alt: "Smiling child reading a magazine on a sunny hill",
    kicker: "September editions",
    title: "selamkids",
  },
];

function HeroSlider() {
  const [index, setIndex] = useState(0);
  const go = (dir: number) => setIndex((i) => (i + dir + slides.length) % slides.length);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative mt-6 overflow-hidden rounded-4xl shadow-[var(--shadow-card)]">
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s) => (
          <img
            key={s.image}
            src={s.image}
            alt={s.alt}
            width={1280}
            height={640}
            className="h-72 w-full shrink-0 object-cover sm:h-80"
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,oklch(0.45_0.14_255/0.92)_0%,oklch(0.45_0.14_255/0.55)_55%,transparent_85%)]" />
      <div className="absolute inset-y-0 left-0 flex max-w-sm flex-col justify-center gap-4 p-8">
        <span className="w-fit rounded-full bg-secondary px-4 py-1.5 font-display text-xs font-extrabold text-secondary-foreground">
          {slides[index]?.kicker}
        </span>
        <h1 className="font-display text-4xl leading-tight font-extrabold text-primary-foreground sm:text-5xl">
          {slides[index]?.title}
        </h1>
        <button className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-6 py-3 font-display text-sm font-extrabold text-secondary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105">
          <Sparkles className="size-4" />
          Read the magazine
        </button>
      </div>

      <button
        aria-label="Previous slide"
        onClick={() => go(-1)}
        className="absolute top-1/2 right-16 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-card/85 text-primary shadow-[var(--shadow-soft)] transition-transform hover:scale-110"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        aria-label="Next slide"
        onClick={() => go(1)}
        className="absolute top-1/2 right-4 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-card/85 text-primary shadow-[var(--shadow-soft)] transition-transform hover:scale-110"
      >
        <ChevronRight className="size-5" />
      </button>

      <div className="absolute bottom-4 left-8 flex gap-2">
        {slides.map((s, i) => (
          <button
            key={s.image}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-2.5 rounded-full transition-all ${
              i === index ? "w-7 bg-secondary" : "w-2.5 bg-card/70"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background p-4 pb-24 font-sans lg:p-8 lg:pb-8">
      <Sidebar />

      <main className="min-w-0 flex-1 lg:pl-72">
          <MobileHeader />
          <header className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-3 rounded-full bg-card px-5 py-3 shadow-[var(--shadow-soft)]">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search stories, topics, or keywords"
                aria-label="Search stories"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              aria-label="Notifications"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-muted-foreground shadow-[var(--shadow-soft)] transition-colors hover:text-primary"
            >
              <Bell className="size-5" />
            </button>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary font-display text-base font-extrabold text-secondary-foreground">
              A
            </span>
          </header>

          <HeroSlider />

          <section className="mt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-extrabold">Featured This Week</h2>
              <button className="text-sm font-bold text-primary hover:underline">See All</button>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((s) => (
                <StoryCard key={s.slug} {...s} />
              ))}
            </div>
          </section>
      </main>
      <MobileNav />
    </div>
  );
}
