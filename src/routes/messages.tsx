import { type ChangeEvent, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { Heart, ImageUp, MessageCircle, Send, Smile } from "lucide-react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/kids/Sidebar";
import { LoginModal } from "@/components/kids/LoginModal";
import { useAuth } from "@/hooks/useAuth";

// ── Telegram SVG icon ──────────────────────────────────────────────────────
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

// ── Reusable Telegram mini-box ─────────────────────────────────────────────
function TelegramBox({
  open,
  text,
  onTextChange,
  onSend,
  onClose,
}: {
  open: boolean;
  text: string;
  onTextChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute right-0 top-14 z-50 w-[calc(100%-1.5rem)] max-w-xs rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:right-6 sm:w-72">
      <p className="mb-2 text-xs font-bold text-muted-foreground">Send via Telegram</p>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:shadow-[var(--shadow-soft)]"
        placeholder="Type your message..."
        aria-label="Telegram message"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSend}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#229ED9] px-4 py-2 font-display text-xs font-extrabold text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
        >
          <TelegramIcon className="size-4" /> Send
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Telegram icon button ───────────────────────────────────────────────────
function TelegramBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#229ED9] text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-110"
      aria-label="Open Telegram message box"
    >
      <TelegramIcon className="size-5" />
    </button>
  );
}

// ── Route ──────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages & Family Feedback | Little Read" },
      {
        name: "description",
        content:
          "Send a message to the Little Read team and share family feedback about the stories your kids love.",
      },
      { property: "og:title", content: "Messages & Family Feedback | Little Read" },
      {
        property: "og:description",
        content: "Write us a message and tell us how your family enjoys Little Read.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

const inputClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:shadow-[var(--shadow-soft)]";

const sendTelegramFeedback = createServerFn({ method: "POST" })
  .validator((data: { familyName: string; kidUsername: string; message: string }) => ({
    familyName: data.familyName.trim(),
    kidUsername: data.kidUsername.trim(),
    message: data.message.trim(),
  }))
  .handler(async ({ data }) => {
    if (!data.familyName || !data.kidUsername || !data.message) {
      throw new Error("Please fill in every family feedback field.");
    }

    const botToken = process.env["TELEGRAM_BOT_TOKEN"];
    const chatId = process.env["TELEGRAM_CHAT_ID"];

    if (!botToken || !chatId) {
      throw new Error("Telegram is not configured yet.");
    }

    const text = [
      "New Family Feedback",
      `Family name: ${data.familyName}`,
      `Kid username: ${data.kidUsername}`,
      `Message: ${data.message}`,
    ].join("\n");

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!response.ok) {
      throw new Error("Telegram could not send the message.");
    }

    return { success: true };
  });

// ── Page ───────────────────────────────────────────────────────────────────
function MessagesPage() {
  const { isLoggedIn } = useAuth();
  const [sent, setSent] = useState<null | "message" | "feedback">(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const sendTelegramFeedbackFn = useServerFn(sendTelegramFeedback);

  // ── Message to God state ─────────────────────────────────────────────────
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [tg1Open, setTg1Open] = useState(false);
  const [tg1Text, setTg1Text] = useState("");

  // ── Drawing & Feedback state ─────────────────────────────────────────────
  const [drawingImagePreview, setDrawingImagePreview] = useState<string | null>(null);
  const [drawingImageName, setDrawingImageName] = useState("");
  const [drawingMessageSent, setDrawingMessageSent] = useState(false);
  const [tg2Open, setTg2Open] = useState(false);
  const [tg2Text, setTg2Text] = useState("");

  // ── Family Feedback state ────────────────────────────────────────────────
  const [tg3Open, setTg3Open] = useState(false);
  const [tg3Text, setTg3Text] = useState("");

  const openTelegram = (text: string) => {
    if (!text.trim()) return;
    const encoded = encodeURIComponent(text.trim());
    window.open(`https://t.me/share/url?url=${encoded}`, "_blank");
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) { setImagePreview(null); setImageName(""); return; }
    setImagePreview(URL.createObjectURL(file));
    setImageName(file.name);
  };

  const handleDrawingImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) { setDrawingImagePreview(null); setDrawingImageName(""); return; }
    setDrawingImagePreview(URL.createObjectURL(file));
    setDrawingImageName(file.name);
  };

  return (
    <div className="relative min-h-screen bg-background p-3 pb-24 font-sans sm:p-4 lg:p-8 lg:pb-8">
      {!isLoggedIn && <LoginModal />}
      <Sidebar />

      <main className="min-w-0 flex-1 lg:pl-72">
        <MobileHeader />

        <header className="rounded-3xl bg-primary/10 p-4 shadow-[var(--shadow-card)] sm:rounded-4xl sm:p-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-bold text-primary">
            <MessageCircle className="size-4" /> Messages
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">Say Hello to Little Read</h1>
          <p className="mt-2 text-sm font-bold text-muted-foreground">
            Write us a message — and don&apos;t forget the family feedback at the end!
          </p>
        </header>

        {/* ── Cards grid: 1 col on mobile, 2 col on lg ── */}
        <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">

          {/* ── Message to God ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent("message");
              setImagePreview(null);
              setImageName("");
              (e.currentTarget as HTMLFormElement).reset();
            }}
            className="relative rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] sm:rounded-4xl sm:p-6"
          >
            {/* Header row with title + Telegram btn */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-extrabold sm:text-xl">Message to God</h2>
                <p className="mt-1 text-sm text-muted-foreground">Upload an image, then write your big message.</p>
              </div>
              <TelegramBtn onClick={() => { setTg1Open((v) => !v); setTg2Open(false); setTg3Open(false); }} />
            </div>
            <TelegramBox
              open={tg1Open}
              text={tg1Text}
              onTextChange={setTg1Text}
              onSend={() => { openTelegram(tg1Text); setTg1Text(""); setTg1Open(false); }}
              onClose={() => setTg1Open(false)}
            />

            <div className="mt-4 grid gap-4">
              <label
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-primary/35 bg-primary/5 p-4 text-center transition hover:border-primary hover:bg-primary/10 sm:min-h-48"
                aria-label="Upload image"
              >
                <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
                {imagePreview ? (
                  <img src={imagePreview} alt="Uploaded preview" className="h-36 w-full rounded-2xl object-cover sm:h-40" />
                ) : (
                  <>
                    <span className="flex size-14 items-center justify-center rounded-full bg-card text-primary shadow-[var(--shadow-soft)] sm:size-16">
                      <ImageUp className="size-7 sm:size-8" />
                    </span>
                    <span className="mt-3 font-display text-base font-extrabold text-primary sm:text-lg">Upload Image</span>
                    <span className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">Click the box to choose a picture</span>
                  </>
                )}
                {imageName && <span className="mt-3 max-w-full truncate text-xs font-bold text-muted-foreground">{imageName}</span>}
              </label>
              <textarea
                required
                rows={8}
                className={inputClass}
                placeholder="Message to God..."
                aria-label="Message to God"
              />
            </div>
            <button
              type="submit"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-display text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 sm:px-6 sm:py-3"
            >
              <Send className="size-4" /> Send Message
            </button>
            {sent === "message" && (
              <p className="mt-3 text-sm font-bold text-primary">Your message has been sent.</p>
            )}
          </form>

          {/* ── Drawing and Feedback ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setDrawingMessageSent(true);
              setDrawingImagePreview(null);
              setDrawingImageName("");
              (e.currentTarget as HTMLFormElement).reset();
            }}
            className="relative rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] sm:rounded-4xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-extrabold sm:text-xl">Drawing and Feedback</h2>
                <p className="mt-1 text-sm text-muted-foreground">Upload a drawing, then write your feedback.</p>
              </div>
              <TelegramBtn onClick={() => { setTg2Open((v) => !v); setTg1Open(false); setTg3Open(false); }} />
            </div>
            <TelegramBox
              open={tg2Open}
              text={tg2Text}
              onTextChange={setTg2Text}
              onSend={() => { openTelegram(tg2Text); setTg2Text(""); setTg2Open(false); }}
              onClose={() => setTg2Open(false)}
            />

            <div className="mt-4 grid gap-4">
              <label
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-primary/35 bg-primary/5 p-4 text-center transition hover:border-primary hover:bg-primary/10 sm:min-h-48"
                aria-label="Upload drawing"
              >
                <input type="file" accept="image/*" className="sr-only" onChange={handleDrawingImageChange} />
                {drawingImagePreview ? (
                  <img src={drawingImagePreview} alt="Drawing preview" className="h-36 w-full rounded-2xl object-cover sm:h-40" />
                ) : (
                  <>
                    <span className="flex size-14 items-center justify-center rounded-full bg-card text-primary shadow-[var(--shadow-soft)] sm:size-16">
                      <ImageUp className="size-7 sm:size-8" />
                    </span>
                    <span className="mt-3 font-display text-base font-extrabold text-primary sm:text-lg">Upload Drawing</span>
                    <span className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">Click the box to choose a picture</span>
                  </>
                )}
                {drawingImageName && <span className="mt-3 max-w-full truncate text-xs font-bold text-muted-foreground">{drawingImageName}</span>}
              </label>
              <textarea
                required
                rows={8}
                className={inputClass}
                placeholder="Your feedback..."
                aria-label="Drawing feedback"
              />
            </div>
            <button
              type="submit"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-display text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 sm:px-6 sm:py-3"
            >
              <Send className="size-4" /> Send Message
            </button>
            {drawingMessageSent && (
              <p className="mt-3 text-sm font-bold text-primary">Your drawing and feedback has been sent.</p>
            )}
          </form>

          {/* ── Family Feedback ── */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setFeedbackError("");
              setIsSendingFeedback(true);
              const form = e.currentTarget as HTMLFormElement;
              const formData = new FormData(form);
              try {
                await sendTelegramFeedbackFn({
                  data: {
                    familyName: String(formData.get("familyName") ?? ""),
                    kidUsername: String(formData.get("kidUsername") ?? ""),
                    message: String(formData.get("message") ?? ""),
                  },
                });
                setSent("feedback");
                form.reset();
              } catch (error) {
                setSent(null);
                setFeedbackError(
                  error instanceof Error ? error.message : "Telegram could not send the message.",
                );
              } finally {
                setIsSendingFeedback(false);
              }
            }}
            className="relative rounded-3xl bg-secondary/25 p-4 shadow-[var(--shadow-card)] sm:rounded-4xl sm:p-6 lg:col-span-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 font-display text-lg font-extrabold sm:text-xl">
                  <Heart className="size-5 text-accent" /> Family Feedback
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add family name, kid username, and send the message to Telegram.
                </p>
              </div>
              <TelegramBtn onClick={() => { setTg3Open((v) => !v); setTg1Open(false); setTg2Open(false); }} />
            </div>
            <TelegramBox
              open={tg3Open}
              text={tg3Text}
              onTextChange={setTg3Text}
              onSend={() => { openTelegram(tg3Text); setTg3Text(""); setTg3Open(false); }}
              onClose={() => setTg3Open(false)}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input
                required
                name="familyName"
                className={inputClass}
                placeholder="Family name"
                aria-label="Family name"
              />
              <input
                required
                name="kidUsername"
                className={inputClass}
                placeholder="Kid username"
                aria-label="Kid username"
              />
              <textarea
                required
                name="message"
                rows={4}
                className={`${inputClass} sm:col-span-2 lg:col-span-1`}
                placeholder="Family message..."
                aria-label="Family message"
              />
            </div>
            <button
              type="submit"
              disabled={isSendingFeedback}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-sm font-extrabold text-accent-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 sm:px-6 sm:py-3"
            >
              <Smile className="size-4" /> {isSendingFeedback ? "Sending..." : "Send to Telegram"}
            </button>
            {feedbackError && (
              <p className="mt-3 text-sm font-bold text-destructive">{feedbackError}</p>
            )}
            {sent === "feedback" && (
              <p className="mt-3 text-sm font-bold text-accent">
                Thank you! Your family message was sent to Telegram.
              </p>
            )}
          </form>

        </div>
      </main>
      <MobileNav />
    </div>
  );
}
