import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Home,
  Library,
  Loader2,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { MobileHeader, MobileNav, Sidebar } from "@/components/kids/Sidebar";
import { LoginModal } from "@/components/kids/LoginModal";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchPaymentStatus,
  PaymentError,
  PaymentStatus,
  PaymentStatusResponse,
  formatBirr,
} from "@/lib/payments";

export const Route = createFileRoute("/payment/status/$txRef")({
  head: () => ({
    meta: [
      { title: "Payment Status — Selam Kids" },
      { name: "description", content: "Check the status of your Selam Kids payment." },
    ],
  }),
  component: PaymentStatusPage,
});

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 60;

function PaymentStatusPage() {
  const params = Route.useParams();
  // Chapa may return an encoded tx_ref; normalize so verify lookups succeed.
  const txRef = decodeURIComponent(params.txRef || "");
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [snapshot, setSnapshot] = useState<PaymentStatusResponse | null>(null);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      if (cancelled) return;
      try {
        const data = await fetchPaymentStatus(txRef);
        if (cancelled) return;
        setSnapshot(data);

        const finished =
          data.status === "SUCCESS" ||
          data.status === "FAILED" ||
          data.status === "CANCELLED" ||
          data.status === "EXPIRED" ||
          data.status === "REFUNDED";

        if (!finished && pollCount.current < MAX_POLLS) {
          pollCount.current += 1;
          setPolling(true);
          timer = setTimeout(check, POLL_INTERVAL_MS);
        } else {
          setPolling(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof PaymentError ? err.message : "Could not verify the payment.");
        setPolling(false);
      }
    }

    if (isLoggedIn) {
      void check();
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [txRef, isLoggedIn]);

  const status: PaymentStatus | "unverified" | "unknown" =
    snapshot?.status || (authLoading ? "unverified" : "unknown");

  const isSuccess = status === "SUCCESS";
  const isFailure = status === "FAILED" || status === "CANCELLED" || status === "EXPIRED";
  const isRefunded = status === "REFUNDED";

  return (
    <div className="relative min-h-screen bg-background p-4 pb-24 font-sans lg:p-8 lg:pb-8">
      {!authLoading && !isLoggedIn && <LoginModal />}
      <Sidebar />

      <main className="min-w-0 flex-1 lg:pl-72">
        <MobileHeader />

        <div className="mx-auto max-w-xl">
          <div className="mt-4 overflow-hidden rounded-4xl bg-card shadow-[var(--shadow-card)]">
            <div
              className={`h-2 ${isSuccess ? "bg-leaf" : isFailure || isRefunded ? "bg-destructive" : "bg-accent"}`}
            />

            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                {isSuccess ? (
                  <span className="grid size-16 place-items-center rounded-full bg-leaf/15">
                    <CheckCircle2 className="size-9 text-leaf" />
                  </span>
                ) : isFailure ? (
                  <span className="grid size-16 place-items-center rounded-full bg-destructive/10">
                    <ShieldAlert className="size-9 text-destructive" />
                  </span>
                ) : isRefunded ? (
                  <span className="grid size-16 place-items-center rounded-full bg-destructive/10">
                    <TriangleAlert className="size-9 text-destructive" />
                  </span>
                ) : (
                  <span className="grid size-16 place-items-center rounded-full bg-accent/15">
                    <Loader2 className="size-9 animate-spin text-accent" />
                  </span>
                )}

                <div>
                  <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
                    {isSuccess
                      ? "Payment Successful"
                      : isRefunded
                        ? "Payment Refunded"
                        : isFailure
                          ? "Payment Not Completed"
                          : "Payment Processing"}
                  </h1>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {isSuccess ? (
                      <>Your purchase is confirmed and has been added to your library.</>
                    ) : isRefunded ? (
                      <>This payment was refunded.</>
                    ) : isFailure ? (
                      snapshot?.failureReason || "The payment was not completed. You can try again."
                    ) : (
                      <>
                        We are verifying your payment with Chapa. This usually takes a few
                        seconds...
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-2 rounded-3xl bg-muted/50 p-4 text-sm">
                <Row label="Transaction reference" value={txRef} mono />
                {snapshot?.amount !== undefined && snapshot?.currency && (
                  <>
                    <Row label="Amount" value={formatBirr(snapshot.amount, snapshot.currency)} />
                    <Row label="Status" value={snapshot.status} />
                  </>
                )}
                {snapshot?.order?.productTitle && (
                  <Row label="Item" value={snapshot.order.productTitle} />
                )}
              </div>

              {error && (
                <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                  {error}
                </p>
              )}

              {(isSuccess || isFailure || isRefunded) && (
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <Link
                    to="/library"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-display text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02]"
                  >
                    <Library className="size-4" /> My Library
                  </Link>
                  <Link
                    to="/home"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3 font-display text-sm font-extrabold shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02]"
                  >
                    <Home className="size-4" /> Back to Home
                  </Link>
                </div>
              )}

              {isFailure && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  No money has been deducted for uncompleted payments.
                </p>
              )}

              <div className="mt-6 flex items-center justify-center gap-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
                <CreditCard className="size-3.5" />
                Securely processed by Chapa
              </div>
            </div>
          </div>

          {!isLoggedIn && !authLoading && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Sign in to see the full status for this payment.
            </p>
          )}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-xs font-bold text-muted-foreground">{label}</span>
      <span className={`truncate text-right text-xs font-bold ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
