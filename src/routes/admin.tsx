/**
 * # NOTE: admin.tsx
 * Role: Admin Management Dashboard Route
 * Layer: Presentation / Page
 * Description: Admin workspace for publishing magazines, managing banners, and tracking sales.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Download, ImagePlus, LogOut, Pencil, Shield, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { AdminPaymentItem, PaymentStatus } from "@/lib/payments";

export const Route = createFileRoute("/admin")({
    head: () => ({
        meta: [
            { title: "Admin Dashboard | Selam Kids" },
            {
                name: "description",
                content: "Public Selam Kids administration dashboard for managing magazines, banners, and feedback.",
            },
        ],
    }),
    component: AdminDashboard,
});

function AdminDashboard() {
    const { user, isLoggedIn, loading, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<"magazines" | "banners" | "feedback" | "payments">("magazines");

    useEffect(() => {
        if (!loading) {
            if (!isLoggedIn) {
                void navigate({ to: "/auth" });
            } else if (user && !user.isAdmin && !user.isSuperAdmin) {
                void navigate({ to: "/home" });
            }
        }
    }, [loading, isLoggedIn, user, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400 font-sans">
                <div className="flex items-center gap-3">
                    <span className="size-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading Admin Dashboard...</span>
                </div>
            </div>
        );
    }

    if (!isLoggedIn || (user && !user.isAdmin && !user.isSuperAdmin)) {
        return null;
    }

    return (
        <div className="min-h-screen bg-neutral-950 p-6 text-neutral-200 font-sans">
            <div className="mx-auto max-w-5xl">
                <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                        {user?.isSuperAdmin && (
                            <Link
                                to="/superadmin"
                                className="text-xs bg-violet-600/20 text-violet-400 border border-violet-500/30 px-3 py-1 rounded-full font-bold hover:bg-violet-600 hover:text-white transition-colors"
                            >
                                Super Admin →
                            </Link>
                        )}
                    </div>

                    {/* Top-Right Corner: Logged-in Admin username & role */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2">
                            <span className="grid size-7 place-items-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                                {(user?.username || user?.displayName || "A").slice(0, 1).toUpperCase()}
                            </span>
                            <div className="flex flex-col text-left">
                                <span className="text-xs font-bold text-white">
                                    @{user?.username || user?.displayName || "admin"}
                                </span>
                                <span className="text-[10px] font-semibold text-neutral-400">
                                    {user?.isSuperAdmin ? "Super Admin" : "Normal Admin"}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                await logout();
                                void navigate({ to: "/auth" });
                            }}
                            title="Log out"
                            className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-red-400 transition-colors"
                        >
                            <LogOut className="size-3.5" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </header>

                <div className="flex gap-4 mb-8 flex-wrap">
                    {(["magazines", "banners", "feedback", "payments"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg font-bold capitalize transition-colors ${activeTab === tab
                                ? "bg-blue-600 text-white"
                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                                }`}
                        >
                            {tab === "payments" ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <CreditCard className="size-4" /> {tab}
                                </span>
                            ) : (
                                tab
                            )}
                        </button>
                    ))}
                </div>

                <main>
                    {activeTab === "magazines" && <MagazinesTab />}
                    {activeTab === "banners" && <BannersTab />}
                    {activeTab === "feedback" && <FeedbackTab />}
                    {activeTab === "payments" && <PaymentsTab />}
                </main>
            </div>
        </div>
    );
}

// ─── Shared File Upload helper ───
async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", credentials: "include", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    return (await res.json()) as { url: string };
}

// ─── Shared File Download helper ───
async function downloadImage(url: string, fallbackName = "feedback-image") {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Download request failed");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        const cleanName = url.split("?")[0]?.split("#")[0]?.split("/").pop();
        let filename = cleanName || fallbackName;
        if (!filename.includes(".")) {
            const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
            filename = `${filename}.${ext}`;
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.download = url.split("?")[0]?.split("#")[0]?.split("/").pop() || fallbackName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// ─── Magazines Tab ───────────────────────────────────────────────────────────
function MagazinesTab() {
    const [magazines, setMagazines] = useState<any[]>([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [edition, setEdition] = useState("");
    const [minutes, setMinutes] = useState("5");
    const [paragraphs, setParagraphs] = useState("");
    const [fileName, setFileName] = useState("");
    const [storyFileName, setStoryFileName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const storyFileRef = useRef<HTMLInputElement>(null);

    const fetchMagazines = async () => {
        const res = await fetch("/api/admin/magazines", { credentials: "include" });
        if (res.ok) setMagazines(await res.json());
    };

    useEffect(() => {
        void fetchMagazines();
    }, []);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedFile = fileRef.current?.files?.[0];
        const selectedStoryFiles = Array.from(storyFileRef.current?.files || []);
        if (!title || (!editingId && (!selectedFile || selectedStoryFiles.length === 0))) {
            return alert("Title, cover, and story images required");
        }
        try {
            const imageUrl = selectedFile ? (await uploadFile(selectedFile)).url : undefined;
            const storyImages = selectedStoryFiles.length
                ? await Promise.all(selectedStoryFiles.map(async (file) => (await uploadFile(file)).url))
                : undefined;
            const response = await fetch(editingId ? `/api/admin/magazines/${editingId}` : "/api/admin/magazines", {
                method: editingId ? "PUT" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    edition,
                    minutes: Number(minutes) || 5,
                    paragraphs: paragraphs
                        .split(/\n+/)
                        .map((paragraph) => paragraph.trim())
                        .filter(Boolean),
                    ...(imageUrl ? { coverUrl: imageUrl } : {}),
                    ...(storyImages ? { storyImages } : {}),
                    active: true,
                }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(error?.error || (editingId ? "Failed to update magazine" : "Failed to create magazine"));
            }
            setTitle("");
            setDescription("");
            setEdition("");
            setMinutes("5");
            setParagraphs("");
            setFileName("");
            setStoryFileName("");
            setEditingId(null);
            if (fileRef.current) fileRef.current.value = "";
            if (storyFileRef.current) storyFileRef.current.value = "";
            void fetchMagazines();
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to upload magazine");
        }
    };

    const handleEdit = (magazine: any) => {
        setEditingId(magazine._id);
        setTitle(magazine.title || "");
        setDescription(magazine.description || "");
        setEdition(magazine.edition || "");
        setMinutes(String(magazine.minutes || 5));
        setParagraphs(Array.isArray(magazine.paragraphs) ? magazine.paragraphs.join("\n") : "");
        setFileName("");
        setStoryFileName(magazine.storyImages?.length ? `${magazine.storyImages.length} images saved` : "");
        if (fileRef.current) fileRef.current.value = "";
        if (storyFileRef.current) storyFileRef.current.value = "";
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTitle("");
        setDescription("");
        setEdition("");
        setMinutes("5");
        setParagraphs("");
        setFileName("");
        setStoryFileName("");
        if (fileRef.current) fileRef.current.value = "";
        if (storyFileRef.current) storyFileRef.current.value = "";
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete magazine?")) return;
        await fetch(`/api/admin/magazines/${id}`, { method: "DELETE", credentials: "include" });
        void fetchMagazines();
    };

    return (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 rounded-xl bg-neutral-900 border border-neutral-800 p-6">
                <h2 className="text-xl font-bold text-white mb-4">{editingId ? "Edit Magazine" : "Add Magazine"}</h2>
                <form onSubmit={handleUpload} className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="Magazine Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        required
                    />
                    <textarea
                        placeholder="Paragraph or magazine description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="min-h-24 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <input
                        type="text"
                        placeholder="Edition (e.g. September 2026)"
                        value={edition}
                        onChange={(e) => setEdition(e.target.value)}
                        className="rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <input
                        type="number"
                        min="1"
                        placeholder="Minutes to read"
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                        className="rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <textarea
                        placeholder="Story paragraphs, one paragraph per line"
                        value={paragraphs}
                        onChange={(e) => setParagraphs(e.target.value)}
                        className="min-h-32 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 bg-neutral-950 px-4 py-6 text-center transition-colors hover:border-blue-500 hover:bg-neutral-950/70">
                        <ImagePlus className="size-7 text-blue-400" />
                        <span className="text-sm font-bold text-white">{storyFileName || "Choose story images"}</span>
                        <span className="text-xs text-neutral-500">Select 10 or more images for the story</span>
                        <input
                            type="file"
                            accept="image/*"
                            ref={storyFileRef}
                            multiple
                            required={!editingId}
                            onChange={(e) => {
                                const count = e.target.files?.length || 0;
                                setStoryFileName(count ? `${count} story images selected` : "");
                            }}
                            className="sr-only"
                        />
                    </label>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 bg-neutral-950 px-4 py-6 text-center transition-colors hover:border-blue-500 hover:bg-neutral-950/70">
                        <ImagePlus className="size-7 text-blue-400" />
                        <span className="text-sm font-bold text-white">{fileName || "Choose magazine cover"}</span>
                        <span className="text-xs text-neutral-500">PNG, JPG, WEBP up to 5 MB</span>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileRef}
                            required={!editingId}
                            onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
                            className="sr-only"
                        />
                    </label>
                    <button type="submit" className="mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-bold">
                        {editingId ? "Save Changes" : "Upload Magazine"}
                    </button>
                    {editingId && <button type="button" onClick={cancelEdit} className="text-sm text-neutral-400 hover:text-white">Cancel Edit</button>}
                </form>
            </div>
            <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-white mb-4">Existing Magazines</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {magazines.map((m) => (
                        <div key={m._id} className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden flex flex-col">
                            <img src={m.coverUrl} alt={m.title} className="w-full h-40 object-cover" />
                            <div className="p-3 flex items-center justify-between mt-auto">
                                <span className="font-bold text-sm truncate pr-2">{m.title}</span>
                                <div className="flex items-center gap-3">
                                <button onClick={() => handleEdit(m)} aria-label={`Edit ${m.title}`} className="text-neutral-400 hover:text-white">
                                    <Pencil className="size-4" />
                                </button>
                                <button onClick={() => handleDelete(m._id)} aria-label={`Delete ${m.title}`} className="text-red-500 hover:text-red-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Banners Tab ───────────────────────────────────────────────────────────
function BannersTab() {
    const [banners, setBanners] = useState<any[]>([]);
    const [magazines, setMagazines] = useState<any[]>([]);
    const [title, setTitle] = useState("");
    const [kicker, setKicker] = useState("");
    const [selectedMagazineId, setSelectedMagazineId] = useState("");
    const [fileName, setFileName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const fetchBanners = async () => {
        const res = await fetch("/api/admin/banners", { credentials: "include" });
        if (res.ok) setBanners(await res.json());
    };

    const fetchMagazines = async () => {
        const res = await fetch("/api/admin/magazines", { credentials: "include" });
        if (res.ok) setMagazines(await res.json());
    };

    useEffect(() => {
        void fetchBanners();
        void fetchMagazines();
    }, []);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedFile = fileRef.current?.files?.[0];
        if (!title || (!editingId && !selectedFile)) return alert("Title and image required");
        try {
            const imageUrl = selectedFile ? (await uploadFile(selectedFile)).url : undefined;
            const response = await fetch(editingId ? `/api/admin/banners/${editingId}` : "/api/admin/banners", {
                method: editingId ? "PUT" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    kicker,
                    magazineId: selectedMagazineId || null,
                    ...(imageUrl ? { imageUrl } : {}),
                    active: true,
                }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(error?.error || (editingId ? "Failed to update banner" : "Banner creation failed"));
            }
            setTitle("");
            setKicker("");
            setSelectedMagazineId("");
            setFileName("");
            setEditingId(null);
            if (fileRef.current) fileRef.current.value = "";
            void fetchBanners();
        } catch (error) {
            alert(error instanceof Error ? error.message : "Failed to create banner");
        }
    };

    const handleEdit = (banner: any) => {
        setEditingId(banner._id);
        setTitle(banner.title || "");
        setKicker(banner.kicker || "");
        setSelectedMagazineId(banner.magazineId || "");
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTitle("");
        setKicker("");
        setSelectedMagazineId("");
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete banner?")) return;
        await fetch(`/api/admin/banners/${id}`, { method: "DELETE", credentials: "include" });
        void fetchBanners();
    };

    return (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 rounded-xl bg-neutral-900 border border-neutral-800 p-6">
                <h2 className="text-xl font-bold text-white mb-4">{editingId ? "Edit Banner" : "Add Banner"}</h2>
                <form onSubmit={handleUpload} className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="Banner Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Kicker (e.g. 'September editions')"
                        value={kicker}
                        onChange={(e) => setKicker(e.target.value)}
                        className="rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <select
                        value={selectedMagazineId}
                        onChange={(e) => setSelectedMagazineId(e.target.value)}
                        aria-label="Select Magazine"
                        className="rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-blue-500"
                    >
                        <option value="" className="bg-neutral-950 text-neutral-400">
                            -- Select a Magazine (Optional) --
                        </option>
                        {magazines.map((mag) => (
                            <option key={mag._id} value={mag._id} className="bg-neutral-950 text-white">
                                {mag.title || "Untitled Magazine"}
                            </option>
                        ))}
                    </select>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 bg-neutral-950 px-4 py-6 text-center transition-colors hover:border-blue-500 hover:bg-neutral-950/70">
                        <ImagePlus className="size-7 text-blue-400" />
                        <span className="text-sm font-bold text-white">{fileName || "Choose banner image"}</span>
                        <span className="text-xs text-neutral-500">PNG, JPG, WEBP up to 5 MB</span>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileRef}
                            required={!editingId}
                            onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
                            className="sr-only"
                        />
                    </label>
                    <button type="submit" className="mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-bold">
                        {editingId ? "Save Changes" : "Create Banner"}
                    </button>
                    {editingId && <button type="button" onClick={cancelEdit} className="text-sm text-neutral-400 hover:text-white">Cancel Edit</button>}
                </form>
            </div>
            <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-white mb-4">Active Banners</h2>
                <div className="flex flex-col gap-4">
                    {banners.map((b) => {
                        const linkedMagazine = magazines.find((m) => m._id === b.magazineId);
                        return (
                            <div key={b._id} className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden flex items-center pr-4">
                                <img src={b.imageUrl} alt={b.title} className="w-48 h-24 object-cover" />
                                <div className="p-4 flex-1">
                                    <p className="text-xs font-bold text-blue-400">{b.kicker}</p>
                                    <h3 className="font-bold text-lg text-white">{b.title}</h3>
                                    {linkedMagazine ? (
                                        <p className="text-xs text-neutral-400 mt-1">
                                            Magazine: <span className="text-neutral-200 font-semibold">{linkedMagazine.title}</span>
                                        </p>
                                    ) : (
                                        <p className="text-xs text-neutral-500 mt-1 italic">No magazine selected</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                <button onClick={() => handleEdit(b)} aria-label={`Edit ${b.title}`} className="text-neutral-400 hover:text-white p-2">
                                    <Pencil className="size-5" />
                                </button>
                                <button onClick={() => handleDelete(b._id)} aria-label={`Delete ${b.title}`} className="text-red-500 hover:text-red-400 p-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Feedback Tab ────────────────────────────────────────────────────────────
function FeedbackTab() {
    const [feedback, setFeedback] = useState<any[]>([]);

    const fetchFeedback = async () => {
        const res = await fetch("/api/admin/feedback", { credentials: "include" });
        if (res.ok) setFeedback(await res.json());
    };

    useEffect(() => {
        void fetchFeedback();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete feedback?")) return;
        await fetch(`/api/admin/feedback/${id}`, { method: "DELETE", credentials: "include" });
        void fetchFeedback();
    };

    const getBadgeColor = (type: string) => {
        return type === "God" ? "bg-purple-500/20 text-purple-400" : type === "Drawing" ? "bg-orange-500/20 text-orange-400" : "bg-emerald-500/20 text-emerald-400";
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "";
        try {
            const d = new Date(dateStr);
            return d.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div>
            <h2 className="text-xl font-bold text-white mb-4">User Feedback & Messages</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feedback.map((f) => {
                    const role = f.userId?.role || (f.type === "Family" ? "Family" : "Kid");
                    const username = f.userId?.username
                        ? `@${f.userId.username}`
                        : f.kidUsername
                        ? (f.kidUsername.startsWith("@") ? f.kidUsername : `@${f.kidUsername}`)
                        : (f.userId?.displayName || "Anonymous");

                    return (
                        <div key={f._id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getBadgeColor(f.type)}`}>
                                        {f.type}
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                            role.toLowerCase() === "family"
                                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                                : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                        }`}
                                    >
                                        {role}
                                    </span>
                                </div>
                                <button onClick={() => handleDelete(f._id)} className="text-neutral-500 hover:text-red-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                </button>
                            </div>

                            {f.imageUrl && (
                                <div className="relative mb-3 group overflow-hidden rounded-lg">
                                    <img src={f.imageUrl} alt="Attached" className="w-full h-32 object-cover rounded-lg" />
                                    <button
                                        type="button"
                                        onClick={() => downloadImage(f.imageUrl, `feedback-${f._id}`)}
                                        title="Download image"
                                        aria-label="Download image"
                                        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-neutral-950/80 text-neutral-300 backdrop-blur-xs border border-neutral-700/60 shadow-md hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all hover:scale-105 cursor-pointer"
                                    >
                                        <Download className="size-3.5" />
                                    </button>
                                </div>
                            )}

                            <p className="text-sm text-neutral-300 italic mb-4">"{f.message}"</p>

                            <div className="mt-auto pt-3 border-t border-neutral-800 space-y-1.5 text-xs text-neutral-400 font-semibold">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-neutral-500 font-normal">Username:</span>
                                        <span className="text-white font-bold truncate">{username}</span>
                                    </div>
                                    <div className="text-[11px] text-neutral-400 font-normal shrink-0">
                                        {formatDate(f.createdAt)}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                    <div>
                                        <span className="text-neutral-500 font-normal">Role: </span>
                                        <span className={role.toLowerCase() === "family" ? "text-amber-400 font-bold" : "text-sky-400 font-bold"}>
                                            {role}
                                        </span>
                                    </div>
                                    {f.type === "Family" && f.familyName && (
                                        <div className="text-neutral-400 font-normal truncate">
                                            <span className="text-neutral-500">Family:</span> {f.familyName}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Payments Tab ───────────────────────────────────────────────────────────
function PaymentsTab() {
    const [payments, setPayments] = useState<AdminPaymentItem[]>([]);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState("");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [limit] = useState(25);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setOffset(0);
    }, [statusFilter, debouncedSearch]);

    const fetchPayments = async (status: string, term: string, currentOffset: number) => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({ limit: String(limit), offset: String(currentOffset) });
            if (status) params.set("status", status);
            if (term) params.set("search", term);
            const res = await fetch(`/api/admin/payments?${params.toString()}`, { credentials: "include" });
            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(body.error || "Failed to load payments");
            }
            const data = (await res.json()) as { items: AdminPaymentItem[]; total: number; limit: number; offset: number };
            setPayments(data.items);
            setTotal(data.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load payments");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchPayments(statusFilter, debouncedSearch, offset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, debouncedSearch, offset, limit]);

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return "—";
        try {
            return new Date(dateStr).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    };

    const formatAmount = (amount: number, currency: string) => {
        const value = Number(amount || 0);
        return `${currency || "ETB"} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const badges: Partial<Record<PaymentStatus, string>> = {
        PENDING: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
        PROCESSING: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
        SUCCESS: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        FAILED: "bg-red-500/20 text-red-400 border border-red-500/30",
        CANCELLED: "bg-neutral-500/20 text-neutral-400 border border-neutral-500/30",
        EXPIRED: "bg-neutral-500/20 text-neutral-400 border border-neutral-500/30",
        REFUNDED: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    };

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.floor(offset / limit) + 1;

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-white">Chapa Payments</h2>
                <div className="text-sm text-neutral-400 font-semibold">
                    {total} total
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-5">
                <input
                    type="search"
                    placeholder="Search tx_ref, email, name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="min-w-52 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                    <option value="">All statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="REFUNDED">Refunded</option>
                </select>
            </div>

            {error && (
                <p className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-400">
                    {error}
                </p>
            )}

            <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
                            <th className="px-4 py-3">Payment</th>
                            <th className="px-4 py-3">Tx Ref</th>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Method</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Created</th>
                            <th className="px-4 py-3">Paid</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && payments.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                                    Loading payments...
                                </td>
                            </tr>
                        ) : payments.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                                    No payments found.
                                </td>
                            </tr>
                        ) : (
                            payments.map((p) => (
                                <tr key={p.id} className="border-b border-neutral-800/70 hover:bg-neutral-800/40">
                                    <td className="px-4 py-3 font-mono text-xs text-neutral-300">
                                        {p.paymentId.slice(0, 10)}…
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-white">
                                        {p.txRef}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-300">
                                        {p.productTitle || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-300">
                                        {p.customer?.displayName || p.customer?.username || p.customerEmail || "—"}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-neutral-100">
                                        {formatAmount(p.amount, p.currency)}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-400">
                                        {p.paymentMethod || "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${badges[p.status] || "bg-neutral-500/20 text-neutral-400 border border-neutral-500/30"}`}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-neutral-400">
                                        {formatDate(p.createdAt)}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-neutral-400">
                                        {formatDate(p.paidAt)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-neutral-500 font-semibold">
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={offset === 0}
                            onClick={() => setOffset((o) => Math.max(0, o - limit))}
                            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-bold text-neutral-300 hover:bg-neutral-700 disabled:opacity-40"
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            disabled={offset + limit >= total}
                            onClick={() => setOffset((o) => o + limit)}
                            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-bold text-neutral-300 hover:bg-neutral-700 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
