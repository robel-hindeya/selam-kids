import { type ChangeEvent, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { Heart, ImageUp, MessageCircle, Send, Smile } from "lucide-react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/kids/Sidebar";
import { LoginModal } from "@/components/kids/LoginModal";
import { useAuth } from "@/hooks/useAuth";

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
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error("Telegram could not send the message.");
    }

    return { success: true };
  });

function MessagesPage() {
  const { isLoggedIn } = useAuth();
  const [sent, setSent] = useState<null | "message" | "feedback">(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const sendTelegramFeedbackFn = useServerFn(sendTelegramFeedback);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setImagePreview(null);
      setImageName("");
      return;
    }

    setImagePreview(URL.createObjectURL(file));
    setImageName(file.name);
  };

  return (
    <div className="relative min-h-screen bg-background p-4 pb-24 font-sans lg:p-8 lg:pb-8">
      {!isLoggedIn && <LoginModal />}
      <Sidebar />

      <main className="min-w-0 flex-1 lg:pl-72">
        <MobileHeader />

        <header className="rounded-4xl bg-primary/10 p-6 shadow-[var(--shadow-card)]">
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-bold text-primary">
            <MessageCircle className="size-4" /> Messages
          </span>
          <h1 className="mt-3 font-display text-3xl font-extrabold">Say Hello to Little Read</h1>
          <p className="mt-2 text-sm font-bold text-muted-foreground">
            Write us a message — and don&apos;t forget the family feedback at the end!
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent("message");
              setImagePreview(null);
              setImageName("");
              (e.currentTarget as HTMLFormElement).reset();
            }}
            className="rounded-4xl bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <h2 className="font-display text-xl font-extrabold">Message to God</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload an image, then write your big message.
            </p>
            <div className="mt-4 grid gap-4">
              <label
                className="flex min-h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-primary/35 bg-primary/5 p-4 text-center transition hover:border-primary hover:bg-primary/10"
                aria-label="Upload image"
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImageChange}
                />
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Uploaded preview"
                    className="h-40 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <>
                    <span className="flex size-16 items-center justify-center rounded-full bg-card text-primary shadow-[var(--shadow-soft)]">
                      <ImageUp className="size-8" />
                    </span>
                    <span className="mt-3 font-display text-lg font-extrabold text-primary">
                      Upload Image
                    </span>
                    <span className="mt-1 text-sm font-bold text-muted-foreground">
                      Click the box to choose a picture
                    </span>
                  </>
                )}
                {imageName && (
                  <span className="mt-3 max-w-full truncate text-xs font-bold text-muted-foreground">
                    {imageName}
                  </span>
                )}
              </label>
              <textarea
                required
                rows={10}
                className={inputClass}
                placeholder="Message to God..."
                aria-label="Message to God"
              />
            </div>
            <button
              type="submit"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-display text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
            >
              <Send className="size-4" /> Send Message
            </button>
            {sent === "message" && (
              <p className="mt-3 text-sm font-bold text-primary">Your message has been sent.</p>
            )}
          </form>

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
            className="rounded-4xl bg-secondary/25 p-6 shadow-[var(--shadow-card)]"
          >
            <h2 className="inline-flex items-center gap-2 font-display text-xl font-extrabold">
              <Heart className="size-5 text-accent" /> Family Feedback
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add family name, kid username, and send the message to Telegram.
            </p>
            <div className="mt-4 grid gap-3">
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
                rows={7}
                className={inputClass}
                placeholder="Family message..."
                aria-label="Family message"
              />
            </div>
            <button
              type="submit"
              disabled={isSendingFeedback}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-display text-sm font-extrabold text-accent-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
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
