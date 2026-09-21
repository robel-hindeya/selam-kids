/**
 * # NOTE: router.tsx
 * Role: Client Router Setup
 * Layer: Presentation / Routing
 * Description: Initializes TanStack Router with type-safe route tree and preloading configuration.
 */

import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
