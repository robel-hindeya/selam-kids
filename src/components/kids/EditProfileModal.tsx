import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

interface EditProfileModalProps {
    onClose: () => void;
}

export function EditProfileModal({ onClose }: EditProfileModalProps) {
    const { user, refreshUser } = useAuth();
    const [displayName, setDisplayName] = useState(user?.displayName ?? "");
    const [username, setUsername] = useState(user?.username ?? "");
    const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl ?? "");
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
            if (!res.ok) throw new Error("Upload failed");
            const { url } = (await res.json()) as { url: string };
            setAvatarPreview(url);
        } catch {
            setError("Image upload failed. Max 5 MB.");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const body: Record<string, string> = {
                displayName,
                username,
                avatarUrl: avatarPreview,
            };
            const res = await fetch("/api/me", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.status === 409) {
                setError("Username already taken. Choose another.");
                return;
            }
            if (!res.ok) throw new Error("Save failed");
            await refreshUser();
            onClose();
        } catch {
            setError("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    const initials = (displayName || user?.email || "?")[0]?.toUpperCase() ?? "?";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                backgroundColor: "oklch(0.1 0.05 255 / 0.65)",
            }}
        >
            <div
                className="relative w-full max-w-sm rounded-4xl p-7 shadow-[var(--shadow-card)]"
                style={{
                    background: "oklch(0.18 0.04 255 / 0.92)",
                    backdropFilter: "blur(28px)",
                    WebkitBackdropFilter: "blur(28px)",
                    border: "1px solid oklch(1 0 0 / 0.12)",
                }}
            >
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="font-display text-lg font-extrabold text-white">Edit Profile</h2>
                    <button
                        aria-label="Close"
                        onClick={onClose}
                        className="grid size-8 place-items-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
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
                </div>

                {/* Avatar picker */}
                <div className="mb-6 flex flex-col items-center gap-3">
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="group relative size-20 overflow-hidden rounded-full border-2 border-white/20 transition hover:border-primary"
                        aria-label="Change profile picture"
                    >
                        {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                            <span className="flex h-full w-full items-center justify-center bg-primary/40 font-display text-2xl font-extrabold text-white">
                                {initials}
                            </span>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    {uploading && <p className="text-xs text-white/50">Uploading…</p>}
                </div>

                {/* Fields */}
                <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-white/60">Display Name</span>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your name"
                            className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white placeholder:text-white/30 outline-none transition focus:border-primary"
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-white/60">Username</span>
                        <div className="flex items-center rounded-2xl border border-white/10 bg-white/8 px-4 py-3 focus-within:border-primary">
                            <span className="mr-1 text-sm text-white/40">@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                                placeholder="username"
                                className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-white/30 outline-none"
                            />
                        </div>
                    </label>

                    {error && <p className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-bold text-red-300">{error}</p>}

                    <button
                        onClick={handleSave}
                        disabled={saving || uploading}
                        className="mt-1 rounded-2xl bg-primary px-6 py-3 font-display text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                    >
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}
