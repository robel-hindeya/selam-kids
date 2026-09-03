import { type FormEvent, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, LogIn, UserPlus } from "lucide-react";
import heroReading from "@/assets/hero-reading.jpg";
import logoAsset from "@/assets/selamkids-logo.png.asset.json";

const logoUrl = logoAsset.url;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In | Selam Kids" },
      {
        name: "description",
        content: "Sign up or sign in to start reading Selam Kids stories.",
      },
      { property: "og:title", content: "Sign In | Selam Kids" },
      { property: "og:description", content: "Start your Selam Kids reading journey." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:shadow-[var(--shadow-soft)]";

function AuthPage() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const navigate = useNavigate();

  const submitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("selamKidsStarted", "true");
    void navigate({ to: "/home" });
  };

  return (
    <main className="min-h-screen bg-background p-4 font-sans">
      <section className="grid min-h-[calc(100vh-2rem)] overflow-hidden rounded-4xl bg-card shadow-[var(--shadow-card)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative min-h-72 lg:min-h-full">
          <img
            src={heroReading}
            alt="Child reading a Selam Kids story"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,oklch(0.33_0.11_255/0.82),transparent_65%)]" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground sm:p-8">
            <img
              src={logoUrl}
              alt="Selam Kids logo"
              className="mb-4 h-12 rounded-2xl bg-card/90 p-1"
            />
            <h1 className="font-display text-4xl leading-tight font-extrabold">Welcome reader</h1>
            <p className="mt-2 max-w-md text-sm font-bold text-primary-foreground/90">
              Sign up or sign in, then jump into the Selam Kids home page.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center p-5 sm:p-8">
          <form onSubmit={submitAuth} className="w-full max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 font-display text-xs font-extrabold text-primary">
              <LockKeyhole className="size-4" /> Kids account
            </span>

            <h2 className="mt-4 font-display text-3xl font-extrabold">
              {mode === "signup" ? "Create account" : "Sign in"}
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-xl px-4 py-2 font-display text-sm font-extrabold transition ${
                  mode === "signup"
                    ? "bg-card text-primary shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground"
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-xl px-4 py-2 font-display text-sm font-extrabold transition ${
                  mode === "signin"
                    ? "bg-card text-primary shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground"
                }`}
              >
                Sign In
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {mode === "signup" && (
                <input
                  required
                  className={inputClass}
                  placeholder="Kid name"
                  aria-label="Kid name"
                />
              )}
              <input
                required
                type="email"
                className={inputClass}
                placeholder="Email address"
                aria-label="Email address"
              />
              <input
                required
                type="password"
                className={inputClass}
                placeholder="Password"
                aria-label="Password"
              />
            </div>

            <button
              type="submit"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-display text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02]"
            >
              {mode === "signup" ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
              {mode === "signup" ? "Sign Up" : "Sign In"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
