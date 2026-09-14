import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import heroReading from "@/assets/hero-reading.jpg";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({ component: AuthPage });
type Mode = "login" | "register";

function AuthPage() {
  const { isLoggedIn, login, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("register");
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
    age: "",
    gender: "",
    avatarUrl: "",
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const error = useMemo(
    () =>
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("error"),
    [],
  );
  useEffect(() => {
    if (isLoggedIn) void navigate({ to: "/home" });
  }, [isLoggedIn, navigate]);
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const selectPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setMessage("Please choose a photo smaller than 2 MB.");
    const reader = new FileReader();
    reader.onload = () => update("avatarUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (mode === "register" && form.password !== form.confirmPassword)
      return setMessage("Passwords do not match.");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Something went wrong.");
      await refreshUser();
      void navigate({ to: "/profile" });
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Cannot reach the account server. Please restart the app and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const passwordInput = (key: "password" | "confirmPassword", placeholder: string) => (
    <div className="relative">
      <input
        required
        type={showPassword ? "text" : "password"}
        minLength={8}
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        placeholder={placeholder}
        className="auth-input pr-12"
      />
      <button
        type="button"
        onClick={() => setShowPassword((visible) => !visible)}
        aria-label={showPassword ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      >
        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
  return (
    <main className="min-h-screen bg-background p-4 font-sans">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-4xl bg-card shadow-[var(--shadow-card)] lg:grid-cols-2">
        <div className="relative hidden lg:block">
          <img
            src={heroReading}
            alt="Child reading"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-primary/70" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-primary-foreground">
            <p className="font-display text-4xl font-extrabold">Read. Learn. Grow.</p>
            <p className="mt-3 font-bold opacity-90">
              Create a Selam Kids account and keep your reading adventure in one place.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-7 flex rounded-2xl bg-muted p-1">
              <button
                onClick={() => {
                  setMode("register");
                  setMessage("");
                }}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${mode === "register" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              >
                Create account
              </button>
              <button
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${mode === "login" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              >
                Log in
              </button>
            </div>
            <h1 className="font-display text-3xl font-extrabold">
              {mode === "register" ? "Join Selam Kids" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm font-bold text-muted-foreground">
              {mode === "register"
                ? "Fill in your profile to get started."
                : "Log in to continue your reading journey."}
            </p>
            <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-3">
              {mode === "register" && (
                <>
                  <input
                    required
                    value={form.displayName}
                    onChange={(e) => update("displayName", e.target.value)}
                    placeholder="Full name"
                    className="auth-input"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      required
                      type="number"
                      min="1"
                      max="120"
                      value={form.age}
                      onChange={(e) => update("age", e.target.value)}
                      placeholder="Age"
                      className="auth-input"
                    />
                    <select
                      required
                      value={form.gender}
                      onChange={(e) => update("gender", e.target.value)}
                      className="auth-input"
                    >
                      <option value="">Sex</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Prefer not to say</option>
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-primary/40 p-3 text-sm font-bold text-primary">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => selectPhoto(e.target.files?.[0])}
                    />
                    {form.avatarUrl ? (
                      <img
                        src={form.avatarUrl}
                        alt="Profile preview"
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full bg-primary/10">
                        +
                      </span>
                    )}{" "}
                    Add profile picture
                  </label>
                </>
              )}
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="Email address"
                className="auth-input"
              />
              {passwordInput("password", "Password")}
              {mode === "register" && passwordInput("confirmPassword", "Confirm password")}
              <button
                disabled={submitting}
                className="w-full rounded-2xl bg-primary py-4 font-display text-sm font-extrabold text-primary-foreground disabled:opacity-60"
              >
                {submitting ? "Please wait…" : mode === "register" ? "Create account" : "Log in"}
              </button>
            </form>
            {(message || error) && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive"
              >
                {message || error}
              </p>
            )}
            <div className="my-6 flex items-center gap-3 text-xs font-bold text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
              OR
            </div>
            <button
              onClick={login}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card py-4 font-display text-sm font-extrabold"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
function GoogleIcon() {
  return (
    <span className="grid size-5 place-items-center rounded-full bg-[#4285F4] text-xs font-black text-white">
      G
    </span>
  );
}
