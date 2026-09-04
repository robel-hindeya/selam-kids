import { createFileRoute } from "@tanstack/react-router";
import { BookMarked, Clock, Heart } from "lucide-react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/kids/Sidebar";
import { LoginModal } from "@/components/kids/LoginModal";
import { useAuth } from "@/hooks/useAuth";
import { StoryCard } from "@/components/kids/StoryCard";
import cardSpace from "@/assets/card-space.jpg";

import cardTrees from "@/assets/card-trees.jpg";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "My Library — Saved Kids Stories | Little Read" },
      {
        name: "description",
        content:
          "Your own bookshelf on Little Read: saved stories, books you are still reading and all-time favorites for little readers.",
      },
      { property: "og:title", content: "My Library — Saved Kids Stories" },
      {
        property: "og:description",
        content: "Keep every favorite story in one cozy bookshelf.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

const reading = [
  {
    image: cardSpace,
    slug: "the-amazing-world-of-space",
    title: "The Amazing World of Space",
    description: "You stopped on page 6 — rockets are waiting!",
    minutes: 5,
    likes: 254,
    tint: "bg-grape/15",
    edition: "Aug edition",
  },
  {
    image: cardTrees,
    slug: "how-trees-help-our-planet",
    title: "How Trees Help Our Planet",
    description: "Half way through the forest adventure.",
    minutes: 4,
    likes: 143,
    tint: "bg-leaf/20",
    edition: "Sep edition",
  },
];

const stats = [
  { label: "Magazines saved", value: 12, icon: BookMarked, tint: "bg-grape/15" },
  { label: "Still reading", value: 2, icon: Clock, tint: "bg-secondary/30" },
  { label: "Favorites", value: 7, icon: Heart, tint: "bg-accent/20" },
];

function LibraryPage() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="relative min-h-screen bg-background p-4 pb-24 font-sans lg:p-8 lg:pb-8">
      {!isLoggedIn && <LoginModal />}
      <Sidebar />
      <main className="min-w-0 flex-1 lg:pl-72">
        <MobileHeader />
        <header className="rounded-4xl bg-primary/10 p-6 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">My Library</h1>
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            Every story you saved, all in one cozy shelf.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {stats.map(({ label, value, icon: Icon, tint }) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-3xl ${tint} p-4 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1`}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card">
                  <Icon className="size-5 text-primary" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-xl font-extrabold leading-none">
                    {value}
                  </span>
                  <span className="block truncate text-xs font-bold text-muted-foreground">
                    {label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </header>

        <section className="mt-8">
          <h2 className="font-display text-xl font-extrabold">My Magazines</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reading.map((s) => (
              <StoryCard key={s.slug} {...s} />
            ))}
          </div>
        </section>
      </main>
      <MobileNav />
    </div>
  );
}
