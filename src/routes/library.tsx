/**
 * # NOTE: library.tsx
 * Role: Storybook Library Catalog Route
 * Layer: Presentation / Page
 * Description: Searchable and filterable catalog of all available magazines and stories.
 */

import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookMarked, Clock, Heart, ShoppingBag } from "lucide-react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/kids/Sidebar";
import { LoginModal } from "@/components/kids/LoginModal";
import { useAuth } from "@/hooks/useAuth";
import { StoryCard } from "@/components/kids/StoryCard";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "My Library — Paid Kids Books & Magazines | Selam Kids" },
      {
        name: "description",
        content:
          "Your personal bookshelf of purchased stories, magazines you are reading, and favorites.",
      },
      { property: "og:title", content: "My Library — Paid Kids Books" },
      {
        property: "og:description",
        content: "Every paid magazine you own, all in one cozy shelf.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { isLoggedIn } = useAuth();
  const [myMagazines, setMyMagazines] = useState<any[]>([]);
  const [stillReadingCount, setStillReadingCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      setMyMagazines([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch("/api/library", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setMyMagazines(data);
        } else {
          setMyMagazines([]);
        }
      })
      .catch((err) => {
        console.warn("Library fetch error:", err);
        setMyMagazines([]);
      })
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  useEffect(() => {
    try {
      const progress = JSON.parse(localStorage.getItem("selam_reading_progress") || "{}");
      const inProgressBooks = Object.keys(progress).length;
      setStillReadingCount(inProgressBooks);

      const favs = JSON.parse(localStorage.getItem("selam_favorites") || "[]");
      setFavoritesCount(Array.isArray(favs) ? favs.length : 0);
    } catch {
      setStillReadingCount(0);
      setFavoritesCount(0);
    }
  }, [myMagazines]);

  const stats = [
    { label: "Paid Books", value: myMagazines.length, icon: BookMarked, tint: "bg-grape/15" },
    { label: "Still reading", value: stillReadingCount, icon: Clock, tint: "bg-secondary/30" },
    { label: "Favorites", value: favoritesCount, icon: Heart, tint: "bg-accent/20" },
  ];

  return (
    <div className="relative min-h-screen bg-background p-4 pb-24 font-sans lg:p-8 lg:pb-8">
      {!isLoggedIn && <LoginModal />}
      <Sidebar />
      <main className="min-w-0 flex-1 lg:pl-72">
        <MobileHeader />
        <header className="rounded-4xl bg-primary/10 p-6 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">My Library</h1>
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            Every paid story you own, all in one cozy shelf.
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
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-extrabold">My Paid Books</h2>
            <span className="text-xs font-bold text-muted-foreground">
              {myMagazines.length} {myMagazines.length === 1 ? "magazine" : "magazines"} owned
            </span>
          </div>

          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p className="col-span-full rounded-3xl bg-card p-8 text-center text-sm font-bold text-muted-foreground">
                Loading your library...
              </p>
            ) : !isLoggedIn ? (
              <div className="col-span-full rounded-3xl bg-card p-8 text-center">
                <p className="text-sm font-bold text-muted-foreground">
                  Please log in to view your purchased books and saved reading library.
                </p>
              </div>
            ) : myMagazines.length > 0 ? (
              myMagazines.map((s) => (
                <StoryCard
                  key={s._id || s.slug}
                  slug={s._id ? `mag-${s._id}` : s.slug}
                  title={s.title}
                  description={s.description || "A wonderful read."}
                  image={s.coverUrl || s.image}
                  minutes={s.minutes || 5}
                  likes={s.likes || 0}
                  tint={s.tint || "bg-leaf/20"}
                  edition={s.edition || "Paid Edition"}
                />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center rounded-3xl bg-card p-10 text-center shadow-[var(--shadow-soft)]">
                <BookMarked className="size-12 text-muted-foreground/50 mb-3" />
                <h3 className="font-display text-lg font-extrabold">No Paid Books Yet</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  You haven&apos;t purchased any magazines yet. Explore our catalog on the home page to start your collection!
                </p>
                <Link
                  to="/home"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-display text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
                >
                  <ShoppingBag className="size-4" />
                  Explore Catalog
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <MobileNav />
    </div>
  );
}
