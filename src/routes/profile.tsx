import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award, BookOpen, Flame, Sparkles, Star, Trophy } from "lucide-react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/kids/Sidebar";
import readerBoy from "@/assets/hero-reading.jpg";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Kids Profile & Legacy Points | Little Read" },
      {
        name: "description",
        content:
          "See your reading badges, streak and Legacy Points on Little Read — earn stars every time you finish a story.",
      },
      { property: "og:title", content: "Kids Profile & Legacy Points" },
      {
        property: "og:description",
        content: "Track badges, streaks and Legacy Points for every story you read.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const STORAGE_KEY = "little-read-legacy-points";
const GOAL = 1000;

const badges = [
  { label: "Space Explorer", icon: Sparkles, tint: "bg-grape/20" },
  { label: "Animal Friend", icon: Star, tint: "bg-secondary/40" },
  { label: "Tree Hugger", icon: BookOpen, tint: "bg-leaf/20" },
  { label: "7 Day Streak", icon: Flame, tint: "bg-accent/20" },
];

function ProfilePage() {
  const [points, setPoints] = useState(0);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (!Number.isNaN(saved) && saved > 0) setPoints(saved);
    else setPoints(420);
  }, []);

  useEffect(() => {
    if (points > 0) localStorage.setItem(STORAGE_KEY, String(points));
  }, [points]);

  const addPoints = (amount: number) => {
    setPoints((p) => p + amount);
    setPop(true);
    window.setTimeout(() => setPop(false), 400);
  };

  const level = Math.floor(points / 250) + 1;
  const progress = Math.min(100, Math.round((points / GOAL) * 100));

  return (
    <div className="min-h-screen bg-background p-4 pb-24 font-sans lg:p-8 lg:pb-8">
      <Sidebar />
      <main className="min-w-0 flex-1 lg:pl-72">
          <MobileHeader />

          <section className="flex flex-col items-center gap-4 rounded-4xl bg-primary p-6 text-center text-primary-foreground shadow-[var(--shadow-card)] sm:flex-row sm:text-left">
            <img
              src={readerBoy}
              alt="Kid reader avatar"
              width={160}
              height={160}
              className="size-24 rounded-full border-4 border-secondary object-cover"
            />
            <div>
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Amira the Reader</h1>
              <p className="mt-1 text-sm opacity-90">Level {level} · Little Read Explorer</p>
            </div>
            <span className="rounded-full bg-secondary px-4 py-2 font-display text-sm font-extrabold text-secondary-foreground sm:ml-auto">
              🔥 7 day streak
            </span>
          </section>

          <section className="mt-6 rounded-4xl bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-3xl bg-accent/20">
                  <Trophy className="size-6 text-accent" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-extrabold">Legacy Points</h2>
                  <p className="text-xs font-bold text-muted-foreground">
                    Earn stars every time you finish a story
                  </p>
                </div>
              </div>
              <span
                className={`font-display text-4xl font-extrabold text-primary transition-transform duration-300 ${
                  pop ? "scale-125" : "scale-100"
                }`}
              >
                {points}
              </span>
            </div>

            <div className="mt-5 h-4 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-secondary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-bold text-muted-foreground">
              {Math.max(0, GOAL - points)} points to your next big badge
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => addPoints(10)}
                className="rounded-full bg-primary px-5 py-3 font-display text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 active:scale-95"
              >
                +10 Finished a story
              </button>
              <button
                onClick={() => addPoints(50)}
                className="rounded-full bg-secondary px-5 py-3 font-display text-sm font-extrabold text-secondary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 active:scale-95"
              >
                +50 Daily quiz
              </button>
              <button
                onClick={() => {
                  setPoints(0);
                  localStorage.setItem(STORAGE_KEY, "0");
                }}
                className="rounded-full bg-muted px-5 py-3 font-display text-sm font-extrabold text-muted-foreground transition-transform hover:scale-105 active:scale-95"
              >
                Reset
              </button>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-xl font-extrabold">My Badges</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {badges.map(({ label, icon: Icon, tint }) => (
                <div
                  key={label}
                  className={`flex flex-col items-center gap-2 rounded-4xl ${tint} p-5 text-center shadow-[var(--shadow-card)] transition-transform hover:-translate-y-2 hover:rotate-2`}
                >
                  <span className="grid size-14 place-items-center rounded-3xl bg-card shadow-[var(--shadow-soft)]">
                    <Icon className="size-7 text-primary" />
                  </span>
                  <span className="font-display text-sm font-extrabold">{label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 flex items-center gap-3 rounded-4xl bg-leaf/15 p-5 shadow-[var(--shadow-card)]">
            <Award className="size-8 shrink-0 text-leaf" />
            <p className="text-sm font-bold">
              Read one story every day this week to unlock the Golden Bookworm badge!
            </p>
          </section>
      </main>
      <MobileNav />
    </div>
  );
}
