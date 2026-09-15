import { createClient } from "@supabase/supabase-js";

// Read environment variables supplied by Vite
const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] || "";
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] || "";

/**
 * Returns true if both the Supabase URL and Anon Key are configured
 * and not set to dummy placeholder values.
 */
export function isSupabaseConfigured(): boolean {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes("your-project-id") &&
    !supabaseAnonKey.includes("your-anon-key")
  );
}

// Fallback dummy values to prevent createClient from crashing during initial setup/build
const safeUrl = supabaseUrl || "https://placeholder-project.supabase.co";
const safeKey = supabaseAnonKey || "placeholder-anon-key";

/**
 * Supabase client instance for client-side queries, auth, and database operations.
 */
export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
