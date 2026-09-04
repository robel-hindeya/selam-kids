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
