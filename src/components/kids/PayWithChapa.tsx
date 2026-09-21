/**
 * # NOTE: PayWithChapa.tsx
 * Role: Chapa Payment Action Component
 * Layer: Presentation / Component
 * Description: Branded checkout button connecting readers to Chapa payment portal.
 */

import { useState } from "react";
import { Lock, ShoppingBag, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { createChapaPayment, PaymentError, formatBirr } from "@/lib/payments";

export interface ChapaProduct {
  id: string;
  title: string;
  description?: string;
  priceCents: number;
  currency?: string;
  coverUrl?: string;
}

type CheckoutState = "idle" | "creating" | "redirecting" | "error";

interface PayWithChapaProps {
  product: ChapaProduct;
  className?: string;
  triggerLabel?: string;
}

export function PayWithChapa({ product, className, triggerLabel = "Buy now" }: PayWithChapaProps) {
  const { isLoggedIn, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CheckoutState>("idle");
  const [error, setError] = useState("");
  const currency = product.currency || "ETB";

  const handlePay = async () => {
    setState("creating");
    setError("");
    try {
      const payment = await createChapaPayment(product.id);
      setState("redirecting");
      // Give the UI a moment to show "Redirecting to secure Chapa checkout..."
      // before leaving the page.
      await new Promise((resolve) => setTimeout(resolve, 700));
      window.location.href = payment.checkoutUrl;
    } catch (err) {
      setState("error");
      setError(
        err instanceof PaymentError
          ? err.message
          : "Could not start the payment. Please try again.",
      );
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          if (!isLoggedIn) {
            void login();
            return;
          }
          setOpen(true);
          setState("idle");
          setError("");
        }}
        className={cn("inline-flex items-center gap-2", className)}
      >
        <ShoppingBag className="size-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-xl font-extrabold">
              <Sparkles className="size-5 text-primary" />
              Order Summary
            </DialogTitle>
            <DialogDescription>Complete your purchase securely with Chapa (ETB).</DialogDescription>
          </DialogHeader>

          <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-4">
              {product.coverUrl && (
                <img
                  src={product.coverUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-2xl object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-extrabold">{product.title}</p>
                {product.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {product.description}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-1.5 border-t border-border/60 pt-4 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Item price</span>
                <span>{formatBirr(product.priceCents / 100, currency)}</span>
              </div>
              <div className="flex items-center justify-between font-display text-base font-extrabold">
                <span>TOTAL</span>
                <span className="text-primary">
                  {formatBirr(product.priceCents / 100, currency)}
                </span>
              </div>
            </div>
          </div>

          {state === "error" && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}

          {state === "redirecting" ? (
            <div className="flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-4">
              <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm font-bold">Redirecting to secure Chapa checkout...</p>
            </div>
          ) : (
            <Button
              type="button"
              onClick={() => void handlePay()}
              disabled={state !== "idle"}
              className="w-full"
            >
              {state === "creating" ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Contacting Chapa...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="size-4" />
                  Pay with Chapa
                </span>
              )}
            </Button>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            Payments are processed by Chapa. We never store your card or PIN details.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
