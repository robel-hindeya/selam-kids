/**
 * # NOTE: useAuth.tsx
 * Role: Authentication State Hook & Provider
 * Layer: Application / State Management
 * Description: Provides reactive authentication state bridging PostgreSQL backend and Supabase.
 */

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
  role?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  accountType?: string;
  isDisabled?: boolean;
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

  // Helper to load Legacy/Express backend user
  const fetchLegacyUser = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as AuthUser;
        setUser(data);
        return data;
      } else {
        setUser(null);
        return null;
      }
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Helper to load Supabase profile and ensure it is synced in backend & postgres
  const fetchSupabaseUser = useCallback(async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        return await fetchLegacyUser();
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

      const cleanBase = (
        (meta["username"] as string) ||
        fullName ||
        supaUser.email?.split("@")[0] ||
        "reader"
      )
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, "")
        .slice(0, 20);

      const isGoogle = Boolean(
        avatarUrl.includes("googleusercontent.com") ||
        avatarUrl.includes("lh3.google") ||
        meta["iss"] === "https://accounts.google.com" ||
        supaUser.app_metadata?.provider === "google"
      );

      // Query profiles table in Supabase
      let { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", supaUser.id)
        .maybeSingle();

      if (!profile) {
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

      // Synchronize with Express backend to establish token cookie & get real PostgreSQL permissions
      try {
        const syncRes = await fetch("/api/auth/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: supaUser.id,
            email: supaUser.email,
            displayName: fullName,
            avatarUrl: profile?.avatar_url || avatarUrl,
            username: profile?.username || cleanBase || "reader",
            accountType: isGoogle ? "Google" : "Email",
          }),
        });

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData?.user) {
            setUser(syncData.user);
            return syncData.user;
          }
        }
      } catch (syncErr) {
        console.warn("Backend session sync warning:", syncErr);
      }

      const authUser: AuthUser = {
        _id: supaUser.id,
        username:
          profile?.username ||
          (meta["username"] as string) ||
          cleanBase ||
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
        role: (profile?.role as string) || (meta["role"] as string) || "Kid",
        isAdmin: Boolean(profile?.is_admin),
        isSuperAdmin: Boolean(profile?.is_super_admin),
        accountType: isGoogle ? "Google" : "Email",
      };

      setUser(authUser);
      return authUser;
    } catch (err) {
      console.error("Failed to load Supabase user:", err);
      return await fetchLegacyUser();
    }
  }, [fetchLegacyUser]);

  const refreshUser = useCallback(async () => {
    if (isSupabaseConfigured()) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchSupabaseUser();
      } else {
        await fetchLegacyUser();
      }
    } else {
      await fetchLegacyUser();
    }
  }, [fetchSupabaseUser, fetchLegacyUser]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setLoading(true);
      try {
        if (isSupabaseConfigured()) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            await fetchSupabaseUser();
          } else {
            await fetchLegacyUser();
          }
        } else {
          await fetchLegacyUser();
        }
      } catch (err) {
        console.error("initAuth error:", err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void initAuth();

    // Listen to real-time auth changes (sign in, sign out, token refresh)
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
          return;
        }
        if (session?.user) {
          await fetchSupabaseUser();
        } else {
          await fetchLegacyUser();
        }
        if (mounted) setLoading(false);
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
        await supabase.auth.signOut().catch(() => {});
      }
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
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
