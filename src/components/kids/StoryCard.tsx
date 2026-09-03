import { Link } from "@tanstack/react-router";
import { Clock, Heart } from "lucide-react";

type Props = {
  image: string;
  title: string;
  description: string;
  minutes: number;
  likes: number;
  tint: string;
  slug: string;
};

export function StoryCard({ image, title, description, minutes, likes, tint, slug }: Props) {
  return (
    <Link
      to="/story/$slug"
      params={{ slug }}
      className="block focus:outline-none"
    >
    <article className="group cursor-pointer overflow-hidden rounded-4xl bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-2 hover:rotate-1 hover:shadow-[var(--shadow-soft)]">
      <div className={`p-3 ${tint}`}>
        <img
          src={image}
          alt={title}
          loading="lazy"
          width={768}
          height={576}
          className="h-44 w-full rounded-3xl object-cover transition-transform duration-500 group-hover:scale-105"
        />

      </div>
      <div className="px-5 pb-5">
        <h3 className="font-display text-lg font-extrabold text-card-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex items-center gap-3 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
            <Clock className="size-3.5" /> {minutes} min read
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-accent">
            <Heart className="size-3.5 fill-current" /> {likes}
          </span>
        </div>
      </div>
    </article>
    </Link>
  );
}
