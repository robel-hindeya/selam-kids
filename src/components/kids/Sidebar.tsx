import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageCircle, Library, ShieldCheck, Lock, Pencil, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { EditProfileModal } from "./EditProfileModal";
import logoUrl from "@/assets/logo.jpg";

const navItems = [
  { label: "Home", icon: Home, to: "/home" as const, protected: false },
  { label: "Messages", icon: MessageCircle, to: "/messages" as const, protected: true },
  { label: "My Library", icon: Library, to: "/library" as const, protected: true },
  { label: "Kids Profile", icon: ShieldCheck, to: "/profile" as const, protected: true },
];

export function Sidebar() {
  const { isLoggedIn, user, logout } = useAuth();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const activeLabel = navItems.find((item) => item.to === currentPath)?.label ?? null;
  const [editOpen, setEditOpen] = useState(false);

  const baseClass =
    "group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all hover:translate-x-1";
  const activeClass = "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]";
  const inactiveClass =
    "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  const lockedClass = "text-muted-foreground/50 hover:bg-sidebar-accent/50";

  const itemClass = (label: string, isProtected: boolean) => {
    if (activeLabel === label) return `${baseClass} ${activeClass}`;
    if (isProtected && !isLoggedIn) return `${baseClass} ${lockedClass}`;
    return `${baseClass} ${inactiveClass}`;
  };

  const initials = (user?.displayName || user?.email || "?")[0]?.toUpperCase() ?? "?";

  return (
    <>
      <aside className="fixed left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] w-60 flex-col gap-6 rounded-4xl bg-sidebar p-5 shadow-[var(--shadow-soft)] lg:flex">
        <Link to="/home" className="flex items-center justify-center">
          <img
            src={logoUrl}
            alt="Selam Kids logo"
            className="h-12 w-auto rounded-2xl transition-transform hover:rotate-2 hover:scale-105"
          />
        </Link>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ label, icon: Icon, to, protected: isProtected }) => (
            <Link key={label} to={to} className={itemClass(label, isProtected)}>
              <Icon className="size-5 transition-transform group-hover:scale-125 group-hover:-rotate-12" />
              {label}
              {isProtected && !isLoggedIn && <Lock className="ml-auto size-3.5 opacity-50" />}
            </Link>
          ))}
        </nav>

        {/* User profile card at bottom */}
        <div className="mt-auto">
          {isLoggedIn && user ? (
            <div className="rounded-3xl bg-sidebar-accent p-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative shrink-0">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName || "User"}
                      className="size-11 rounded-full object-cover ring-2 ring-primary/30"
                    />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-full bg-primary/30 ring-2 ring-primary/30">
                      <span className="font-display text-base font-extrabold text-primary">
                        {initials}
                      </span>
                    </div>
                  )}
                  {/* Legacy points badge */}
                  {(user.legacyPoints ?? 0) > 0 && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-extrabold text-secondary-foreground leading-none">
                      {user.legacyPoints}pt
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-extrabold text-sidebar-accent-foreground">
                    {user.displayName || "Reader"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{user.username || "unknown"}
                  </p>
                </div>

                {/* Edit + Logout */}
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => setEditOpen(true)}
                    aria-label="Edit profile"
                    className="grid size-7 place-items-center rounded-full bg-background/30 text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => void logout()}
                    aria-label="Sign out"
                    className="grid size-7 place-items-center rounded-full bg-background/30 text-muted-foreground transition hover:bg-destructive hover:text-white"
                  >
                    <LogOut className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-sidebar-accent p-4 text-center">
              <p className="font-display text-sm font-extrabold text-sidebar-accent-foreground">
                Small reader, big dreams
              </p>
              <Link
                to="/auth"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground transition hover:opacity-90"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </aside>

      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}
    </>
  );
}

export function MobileNav() {
  const { isLoggedIn } = useAuth();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around gap-1 border-t border-border bg-sidebar px-2 py-2 shadow-[var(--shadow-soft)] lg:hidden">
      {navItems.map(({ label, icon: Icon, to, protected: isProtected }) => {
        const active = currentPath === to;
        const locked = isProtected && !isLoggedIn;
        return (
          <Link
            key={label}
            to={to}
            aria-label={label}
            className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition-all ${active
                ? "bg-primary text-primary-foreground scale-105"
                : locked
                  ? "text-muted-foreground/50 active:scale-95"
                  : "text-muted-foreground active:scale-95"
              }`}
          >
            <Icon className="size-5" />
            <span className="truncate">{label}</span>
            {locked && (
              <span className="absolute -top-0.5 right-1.5 flex size-3.5 items-center justify-center rounded-full bg-muted">
                <Lock className="size-2.5 text-muted-foreground" />
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileHeader() {
  const { user, isLoggedIn } = useAuth();

  return (
    <div className="mb-4 flex items-center justify-between lg:hidden">
      <Link to="/home">
        <img src={logoUrl} alt="Selam Kids logo" className="h-10 w-auto rounded-xl" />
      </Link>
      {isLoggedIn && user && (
        <div className="flex items-center gap-2">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName || "User"}
              className="size-9 rounded-full object-cover ring-2 ring-primary/40"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/30 ring-2 ring-primary/40">
              <span className="font-display text-sm font-extrabold text-primary">
                {(user.displayName || user.email || "?")[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
