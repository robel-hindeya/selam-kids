/**
 * # NOTE: collapsible.tsx
 * Role: Collapsible UI Primitive Component
 * Layer: Presentation / UI Primitives
 * Description: Accessible collapsible primitive built with Radix UI and styled with Tailwind CSS.
 */

"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
