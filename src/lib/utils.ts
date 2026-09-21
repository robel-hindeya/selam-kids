/**
 * # NOTE: utils.ts
 * Role: Styling Utilities
 * Layer: Presentation / Helpers
 * Description: Provides cn() helper combining clsx and tailwind-merge for clean class composition.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
