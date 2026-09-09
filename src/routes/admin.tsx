import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { ImagePlus, Pencil } from "lucide-react";

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
    const [activeTab, setActiveTab] = useState<"magazines" | "banners" | "feedback">("magazines");

    return (
        <div className="min-h-screen bg-neutral-950 p-6 text-neutral-200 font-sans">
            <div className="mx-auto max-w-5xl">
                <header className="mb-8 flex items-center justify-between border-b border-neutral-800 pb-4">
                    <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                </header>

                <div className="flex gap-4 mb-8">
                    {(["magazines", "banners", "feedback"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg font-bold capitalize transition-colors ${activeTab === tab
                                ? "bg-blue-600 text-white"
                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <main>
                    {activeTab === "magazines" && <MagazinesTab />}
                    {activeTab === "banners" && <BannersTab />}
                    {activeTab === "feedback" && <FeedbackTab />}
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
    const [title, setTitle] = useState("");
    const [kicker, setKicker] = useState("");
    const [fileName, setFileName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const fetchBanners = async () => {
        const res = await fetch("/api/admin/banners", { credentials: "include" });
        if (res.ok) setBanners(await res.json());
    };

    useEffect(() => {
        void fetchBanners();
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
                body: JSON.stringify({ title, kicker, ...(imageUrl ? { imageUrl } : {}), active: true }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(error?.error || (editingId ? "Failed to update banner" : "Banner creation failed"));
            }
            setTitle("");
            setKicker("");
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
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTitle("");
        setKicker("");
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
                    {banners.map((b) => (
                        <div key={b._id} className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden flex items-center pr-4">
                            <img src={b.imageUrl} alt={b.title} className="w-48 h-24 object-cover" />
                            <div className="p-4 flex-1">
                                <p className="text-xs font-bold text-blue-400">{b.kicker}</p>
                                <h3 className="font-bold text-lg text-white">{b.title}</h3>
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
                    ))}
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

    return (
        <div>
            <h2 className="text-xl font-bold text-white mb-4">User Feedback & Messages</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feedback.map((f) => (
                    <div key={f._id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getBadgeColor(f.type)}`}>
                                {f.type}
                            </span>
                            <button onClick={() => handleDelete(f._id)} className="text-neutral-500 hover:text-red-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                            </button>
                        </div>

                        {f.imageUrl && (
                            <img src={f.imageUrl} alt="Attached" className="w-full h-32 object-cover rounded-lg mb-3" />
                        )}

                        <p className="text-sm text-neutral-300 italic mb-4">"{f.message}"</p>

                        <div className="mt-auto pt-3 border-t border-neutral-800 text-xs text-neutral-500 font-semibold">
                            {f.type === "Family" ? (
                                <>Family: {f.familyName} (Kid: {f.kidUsername})</>
                            ) : f.userId ? (
                                <>Sent by {f.userId.displayName}</>
                            ) : (
                                <>Anonymous</>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
