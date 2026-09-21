/**
 * # NOTE: index.tsx
 * Role: Landing Splash Route
 * Layer: Presentation / Page
 * Description: Public landing page introducing Selam Kids with visual brand illustrations.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Selam Kids" }],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
  component: () => null,
});
