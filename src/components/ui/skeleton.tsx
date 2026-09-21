/**
 * # NOTE: skeleton.tsx
 * Role: Skeleton UI Primitive Component
 * Layer: Presentation / UI Primitives
 * Description: Accessible skeleton primitive built with Radix UI and styled with Tailwind CSS.
 */

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}

export { Skeleton };
