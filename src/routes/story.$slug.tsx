import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Lightbulb,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/kids/Sidebar";
import { getStory } from "@/lib/stories";

export const Route = createFileRoute("/story/$slug")({
  loader: ({ params }) => {
    const story = getStory(params.slug);
    if (!story) throw notFound();
    return { story };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Story not found — Little Read" }, { name: "robots", content: "noindex" }],
      };
    }
    const { title, description } = loaderData.story;
    return {
      meta: [
        { title: `${title} — Little Read` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: StoryNotFound,
  component: StoryPage,
});

function StoryNotFound() {
  return (
    <div className="min-h-screen bg-background p-4 pb-24 font-sans lg:p-8 lg:pb-8">
      <Sidebar />
      <main className="min-w-0 flex-1 lg:pl-72">
        <MobileHeader />
        <h1 className="font-display text-2xl font-extrabold">Oops! Story not found</h1>
        <Link to="/home" className="mt-4 inline-block font-bold text-primary hover:underline">
          Back to home
        </Link>
      </main>
      <MobileNav />
    </div>
  );
}

const PARAGRAPHS_PER_PAGE = 2;

function StoryPage() {
  const { story } = Route.useLoaderData();
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(story.paragraphs.length / PARAGRAPHS_PER_PAGE));
  const pageParagraphs = story.paragraphs.slice(
    page * PARAGRAPHS_PER_PAGE,
    page * PARAGRAPHS_PER_PAGE + PARAGRAPHS_PER_PAGE,
  );

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const goNext = () => {
    setPage((p) => Math.min(p + 1, totalPages - 1));
    scrollTop();
  };
  const goPrev = () => {
    setPage((p) => Math.max(p - 1, 0));
    scrollTop();
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24 font-sans lg:p-8 lg:pb-8">
      <Sidebar />

      <main className="min-w-0 flex-1 lg:pl-72">
        <MobileHeader />

        <div className="mx-auto max-w-2xl">
          <header className="flex items-center justify-between">
            <Link
              to="/home"
              className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-bold shadow-[var(--shadow-soft)] transition-transform hover:-translate-x-1"
            >
              <ArrowLeft className="size-4" /> Back
            </Link>
            <div className="flex items-center gap-2">
              <button
                aria-label="Save story"
                className="grid size-10 place-items-center rounded-full bg-card text-muted-foreground shadow-[var(--shadow-soft)] transition-colors hover:text-primary"
              >
                <Bookmark className="size-5" />
              </button>
              <button
                aria-label="More options"
                className="grid size-10 place-items-center rounded-full bg-card text-muted-foreground shadow-[var(--shadow-soft)] transition-colors hover:text-primary"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </div>
          </header>

          <article className="mt-4 overflow-hidden rounded-4xl bg-card shadow-[var(--shadow-card)]">
            <div className={`relative ${story.tint} p-3`}>
              <img
                src={story.image}
                alt={story.title}
                width={1024}
                height={640}
                className="h-56 w-full rounded-3xl object-cover sm:h-72"
              />
              <div className="absolute bottom-6 left-6 flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1 rounded-full bg-card/90 px-3 py-1">
                  <Clock className="size-3.5" /> {story.minutes} min read
                </span>
                <span className="rounded-full bg-card/90 px-3 py-1 text-muted-foreground">
                  {story.date}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-card/90 px-3 py-1 text-accent">
                  <Heart className="size-3.5 fill-current" /> {story.likes}
                </span>
              </div>
            </div>

            <div className="p-6">
              <span className="inline-block rounded-full bg-grape px-3 py-1 font-display text-xs font-extrabold text-primary-foreground">
                {story.category}
              </span>
              <h1 className="mt-3 font-display text-2xl leading-tight font-extrabold sm:text-3xl">
                {story.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{story.description}</p>

              <div className="mt-5 space-y-4 text-[15px] leading-relaxed">
                {pageParagraphs.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={goPrev}
                    disabled={page === 0}
                    className="inline-flex items-center gap-1 rounded-3xl bg-muted px-4 py-2 font-display text-sm font-extrabold text-muted-foreground transition-transform enabled:hover:-translate-x-1 disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" /> Back
                  </button>

                  <span className="rounded-full bg-secondary/40 px-3 py-1 font-display text-xs font-extrabold">
                    Page {page + 1} of {totalPages}
                  </span>

                  {page < totalPages - 1 ? (
                    <button
                      onClick={goNext}
                      className="group inline-flex items-center gap-1 rounded-3xl border-2 border-dashed border-primary/30 bg-primary/10 px-4 py-2 font-display text-sm font-extrabold text-primary transition-all hover:bg-primary/20"
                    >
                      <Sparkles className="size-4 transition-transform group-hover:rotate-12" />
                      Read more
                      <ChevronRight className="size-4 animate-bounce" />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-3xl bg-secondary/40 px-4 py-2 font-display text-sm font-extrabold text-accent">
                      The End
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-4xl bg-secondary/30 p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-card">
                  <Lightbulb className="size-5 text-accent" />
                </span>
                <div>
                  <p className="font-display text-sm font-extrabold text-accent">Did you know?</p>
                  <p className="mt-1 text-sm">{story.funFact}</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
