import { createFileRoute, useNavigate } from "@tanstack/react-router";
import heroReading from "@/assets/hero-reading.jpg";
import logoAsset from "@/assets/selamkids-logo.png.asset.json";
import { useAuth } from "@/hooks/useAuth";

const logoUrl = logoAsset.url;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In | Selam Kids" },
      {
        name: "description",
        content: "Sign in to start reading Selam Kids stories.",
      },
      { property: "og:title", content: "Sign In | Selam Kids" },
      { property: "og:description", content: "Start your Selam Kids reading journey." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    login();
    void navigate({ to: "/home" });
  };

  return (
    <main className="min-h-screen bg-background p-4 font-sans">
      <section className="relative grid min-h-[calc(100vh-2rem)] overflow-hidden rounded-4xl shadow-[var(--shadow-card)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left side image */}
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
              Sign in and jump into the Selam Kids world of stories and fun.
            </p>
          </div>
        </div>

        {/* Right side: blurred glass box */}
        <div className="flex items-center justify-center bg-background/60 p-5 sm:p-8" style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
          <div
            className="w-full max-w-md rounded-4xl p-8 shadow-[var(--shadow-card)]"
            style={{
              background: "oklch(1 0 0 / 0.10)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              border: "1px solid oklch(1 0 0 / 0.18)",
            }}
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={logoUrl}
                alt="Selam Kids logo"
                className="h-14 w-auto rounded-2xl"
              />
              <h2 className="mt-5 font-display text-3xl font-extrabold">Sign in</h2>
              <p className="mt-2 text-sm font-bold text-muted-foreground">
                Choose how you'd like to continue
              </p>

              <div className="mt-8 flex w-full flex-col gap-3">
                {/* Google */}
                <button
                  onClick={handleLogin}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 font-display text-sm font-extrabold text-gray-800 shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                {/* Apple */}
                <button
                  onClick={handleLogin}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black px-5 py-4 font-display text-sm font-extrabold text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <AppleIcon />
                  Continue with Apple
                </button>
              </div>

              <p className="mt-6 text-xs text-muted-foreground">
                By continuing you agree to our Terms &amp; Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.205c0-.638-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18L12.048 13.562C11.247 14.101 10.22 14.418 9 14.418c-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A9.003 9.003 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.346l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <path d="M13.012 9.38c-.015-1.573.856-2.765 2.605-3.643-.98-1.408-2.461-2.185-4.424-2.333-1.862-.144-3.893 1.095-4.63 1.095-.782 0-2.618-1.044-4.025-1.044C.073 3.501-.995 6.17.235 9.76c.438 1.264 1.18 2.668 2.23 4.209.897 1.298 1.889 2.753 3.255 2.766 1.307.013 1.774-.833 3.32-.833 1.54 0 1.965.833 3.33.806 1.4-.026 2.44-1.6 3.328-2.903.588-.853.996-1.543 1.302-2.098-3.396-1.328-3.99-3.302-3.988-6.328zM10.34.896c1.296-.146 2.565.717 3.354 1.713-.773.045-2.604.884-3.51 2.64-.853 1.667-.526 3.285-.434 3.435-.636-.12-2.965-3.195-2.966-5.277C7.386 1.84 8.947 1.051 10.34.896z" />
    </svg>
  );
}
