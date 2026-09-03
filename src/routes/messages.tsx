import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, MessageCircle, Send, Smile } from "lucide-react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/kids/Sidebar";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages & Family Feedback | Little Read" },
      {
        name: "description",
        content:
          "Send a message to the Little Read team and share family feedback about the stories your kids love.",
      },
      { property: "og:title", content: "Messages & Family Feedback | Little Read" },
      {
        property: "og:description",
        content: "Write us a message and tell us how your family enjoys Little Read.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

const inputClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:shadow-[var(--shadow-soft)]";

function MessagesPage() {
  const [sent, setSent] = useState<null | "message" | "feedback">(null);

  return (
    <div className="min-h-screen bg-background p-4 pb-24 font-sans lg:p-8 lg:pb-8">
      <Sidebar />

      <main className="min-w-0 flex-1 lg:pl-72">
        <MobileHeader />

        <header className="rounded-4xl bg-primary/10 p-6 shadow-[var(--shadow-card)]">
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-bold text-primary">
            <MessageCircle className="size-4" /> Messages
          </span>
          <h1 className="mt-3 font-display text-3xl font-extrabold">Say Hello to Little Read</h1>
          <p className="mt-2 text-sm font-bold text-muted-foreground">
            Write us a message — and don&apos;t forget the family feedback at the end!
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent("message");
              (e.currentTarget as HTMLFormElement).reset();
            }}
            className="rounded-4xl bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <h2 className="font-display text-xl font-extrabold">Send a Message</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Questions, story ideas or a big thank you.
            </p>
            <div className="mt-4 grid gap-3">
              <input required className={inputClass} placeholder="Your name" aria-label="Your name" />
              <input
                required
                type="email"
                className={inputClass}
                placeholder="Email address"
                aria-label="Email address"
              />
              <input className={inputClass} placeholder="Subject" aria-label="Subject" />
              <textarea
                required
                rows={5}
                className={inputClass}
                placeholder="Type your message..."
                aria-label="Your message"
              />
            </div>
            <button
              type="submit"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-display text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
            >
              <Send className="size-4" /> Send Message
            </button>
            {sent === "message" && (
              <p className="mt-3 text-sm font-bold text-primary">Thanks! Your message is on its way.</p>
            )}
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent("feedback");
              (e.currentTarget as HTMLFormElement).reset();
            }}
            className="rounded-4xl bg-secondary/25 p-6 shadow-[var(--shadow-card)]"
          >
            <h2 className="inline-flex items-center gap-2 font-display text-xl font-extrabold">
              <Heart className="size-5 text-accent" /> Family Feedback
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              How does your family enjoy reading together?
            </p>
            <div className="mt-4 grid gap-3">
              <input
                required
                className={inputClass}
                placeholder="Family name"
                aria-label="Family name"
              />
              <input
                className={inputClass}
                placeholder="Child's age"
                aria-label="Child's age"
              />
              <select className={inputClass} aria-label="Favorite kind of story" defaultValue="">
                <option value="" disabled>
                  Favorite kind of story
                </option>
                <option>Space</option>
                <option>Animals</option>
                <option>Nature</option>
                <option>Fairy tales</option>
              </select>
              <textarea
                required
                rows={4}
                className={inputClass}
                placeholder="Tell us what your family loved..."
                aria-label="Family feedback"
              />
            </div>
            <button
              type="submit"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-display text-sm font-extrabold text-accent-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
            >
              <Smile className="size-4" /> Share Feedback
            </button>
            {sent === "feedback" && (
              <p className="mt-3 text-sm font-bold text-accent">
                Thank you! Your family feedback made our day.
              </p>
            )}
          </form>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
