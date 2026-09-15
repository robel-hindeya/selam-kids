import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface AuthUser {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  fullName?: string;
  gender: string;
  age?: number;
  avatarUrl: string;
  legacyPoints: number;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: AuthUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to load Supabase profile and ensure it is synced in public.profiles
  const fetchSupabaseUser = useCallback(async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setUser(null);
        return;
      }

      const supaUser = session.user;
      const meta = (supaUser.user_metadata || {}) as Record<string, unknown>;

      // Safely extract names & avatar from user metadata (Google OAuth or email signup)
      const fullName =
        (meta["full_name"] as string) ||
        (meta["name"] as string) ||
        (meta["display_name"] as string) ||
        supaUser.email?.split("@")[0] ||
        "Reader";

      const avatarUrl =
        (meta["avatar_url"] as string) ||
        (meta["picture"] as string) ||
        "";

      // Query profiles table
      let { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", supaUser.id)
        .maybeSingle();

      // If profile does not exist yet (e.g. before trigger finishes), create or update it
      if (!profile) {
        const cleanBase = (
          (meta["username"] as string) ||
          fullName ||
          supaUser.email?.split("@")[0] ||
          "reader"
        )
          .toLowerCase()
          .replace(/[^a-z0-9_.]/g, "")
          .slice(0, 20);

        const { data: newProfile } = await supabase
          .from("profiles")
          .upsert(
            {
              id: supaUser.id,
              username: cleanBase || "reader",
              full_name: fullName,
              display_name: fullName,
              email: supaUser.email,
              avatar_url: avatarUrl,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          )
          .select()
          .maybeSingle();

        if (newProfile) {
          profile = newProfile;
        }
      }

      const authUser: AuthUser = {
        _id: supaUser.id,
        username:
          profile?.username ||
          (meta["username"] as string) ||
          supaUser.email?.split("@")[0] ||
          "reader",
        email: supaUser.email || (profile?.email as string) || "",
        displayName:
          profile?.full_name ||
          profile?.display_name ||
          fullName,
        fullName:
          profile?.full_name ||
          fullName,
        gender: profile?.gender || (meta["gender"] as string) || "",
        age:
          profile?.age ??
          (meta["age"] ? Number(meta["age"]) : undefined),
        avatarUrl:
          profile?.avatar_url ||
          avatarUrl,
        legacyPoints: profile?.legacy_points ?? 0,
      };

      setUser(authUser);
    } catch (err) {
      console.error("Failed to load Supabase user:", err);
      setUser(null);
    }
  }, []);

  // Helper to load Legacy/Express backend user
  const fetchLegacyUser = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as AuthUser;
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (isSupabaseConfigured()) {
      await fetchSupabaseUser();
    } else {
      await fetchLegacyUser();
    }
  }, [fetchSupabaseUser, fetchLegacyUser]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured()) {
        await fetchSupabaseUser();
      } else {
        await fetchLegacyUser();
      }
      if (mounted) setLoading(false);
    }

    void initAuth();

    // Listen to real-time auth changes (sign in, sign out, token refresh)
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          await fetchSupabaseUser();
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      authListener = data;
    }

    return () => {
      mounted = false;
      if (authListener) authListener.subscription.unsubscribe();
    };
  }, [fetchSupabaseUser, fetchLegacyUser]);

  const login = useCallback(async () => {
    if (isSupabaseConfigured()) {
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth`
          : "http://localhost:8080/auth";

      // Supabase Google OAuth
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) {
        console.error("Google sign in error:", error.message);
      }
    } else {
      // Legacy Google OAuth
      window.location.href = "/api/auth/google";
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      } else {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      }
    } finally {
      setUser(null);
      window.location.href = "/auth";
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ isLoggedIn: !!user, user, loading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
