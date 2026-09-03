import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageCircle, Library, ShieldCheck } from "lucide-react";
import readerBoy from "@/assets/hero-reading.jpg";
import logoAsset from "@/assets/selamkids-logo.png.asset.json";

const logoUrl = logoAsset.url;

const navItems = [
  { label: "Home", icon: Home, to: "/home" as const },
  { label: "Messages", icon: MessageCircle, to: "/messages" as const },
  { label: "My Library", icon: Library, to: "/library" as const },
  { label: "Kids Profile", icon: ShieldCheck, to: "/profile" as const },
];

export function Sidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const activeLabel = navItems.find((item) => item.to === currentPath)?.label ?? null;

  const baseClass =
    "group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all hover:translate-x-1";
  const activeClass = "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]";
  const inactiveClass =
    "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  const itemClass = (label: string) =>
    `${baseClass} ${activeLabel === label ? activeClass : inactiveClass}`;

  return (
    <aside className="fixed left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] w-60 flex-col gap-6 rounded-4xl bg-sidebar p-5 shadow-[var(--shadow-soft)] lg:flex">
      <Link to="/home" className="flex items-center justify-center">
        <img
          src={logoUrl}
          alt="Selam Kids logo"
          className="h-12 w-auto rounded-2xl transition-transform hover:rotate-2 hover:scale-105"
        />
      </Link>

      <nav className="flex flex-col gap-1">
        {navItems.map(({ label, icon: Icon, to }) => (
          <Link key={label} to={to} className={itemClass(label)}>
            <Icon className="size-5 transition-transform group-hover:scale-125 group-hover:-rotate-12" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto rounded-3xl bg-sidebar-accent p-4 text-center">
        <img
          src={readerBoy}
          alt="Child happily reading a book"
          loading="lazy"
          width={1280}
          height={640}
          className="mx-auto h-24 w-full rounded-2xl object-cover"
        />
        <p className="mt-3 font-display text-sm font-extrabold text-sidebar-accent-foreground">
          Small reader, big dreams
        </p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around gap-1 border-t border-border bg-sidebar px-2 py-2 shadow-[var(--shadow-soft)] lg:hidden">
      {navItems.map(({ label, icon: Icon, to }) => {
        const active = currentPath === to;
        return (
          <Link
            key={label}
            to={to}
            aria-label={label}
            className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all ${
              active
                ? "bg-primary text-primary-foreground scale-105"
                : "text-muted-foreground active:scale-95"
            }`}
          >
            <Icon className="size-5" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileHeader() {
  return (
    <Link to="/home" className="mb-4 flex items-center lg:hidden">
      <img src={logoUrl} alt="Selam Kids logo" className="h-10 w-auto rounded-xl" />
    </Link>
  );
}
