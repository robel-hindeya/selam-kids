import { useAuth } from "@/hooks/useAuth";

const logoUrl = "/selamkids-logo.png";

interface LoginModalProps {
    /** Called only when user explicitly dismisses via the ✕ button */
    onClose?: () => void;
    /** Called after a successful social login */
    onLogin?: () => void;
}

export function LoginModal({ onClose }: LoginModalProps) {
    const { login } = useAuth();

    return (
        /* Full-screen backdrop — NOT clickable to dismiss */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                backgroundColor: "oklch(0.15 0.05 255 / 0.60)",
            }}
        >
            {/* Card */}
            <div
                className="relative w-full max-w-sm rounded-4xl p-8 shadow-[var(--shadow-card)]"
                style={{
                    background: "oklch(1 0 0 / 0.12)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: "1px solid oklch(1 0 0 / 0.22)",
                }}
            >
                {/* Close button — only visible if onClose is provided */}
                {onClose && (
                    <button
                        aria-label="Close login"
                        onClick={onClose}
                        className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}

                <div className="flex flex-col items-center text-center">
                    <img src={logoUrl} alt="Selam Kids logo" className="h-14 w-auto rounded-2xl" />

                    <h2 className="mt-5 font-display text-2xl font-extrabold text-white">
                        Welcome to Selam Kids
                    </h2>
                    <p className="mt-2 text-sm font-bold text-white/70">Sign in to access this page</p>

                    <div className="mt-7 flex w-full flex-col gap-3">
                        {/* Google — only option */}
                        <button
                            onClick={login}
                            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 font-display text-sm font-extrabold text-gray-800 shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <GoogleIcon />
                            Continue with Google
                        </button>
                    </div>

                    <p className="mt-5 text-xs text-white/50">
                        By continuing you agree to our Terms &amp; Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
                d="M17.64 9.205c0-.638-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
                fill="#4285F4"
            />
            <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18L12.048 13.562C11.247 14.101 10.22 14.418 9 14.418c-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
            />
            <path
                d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A9.003 9.003 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
                fill="#FBBC05"
            />
            <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.346l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58z"
                fill="#EA4335"
            />
        </svg>
    );
}
