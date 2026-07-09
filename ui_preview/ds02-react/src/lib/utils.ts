import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn helper used by every UI primitive. Combining clsx and
// tailwind-merge keeps Tailwind classes composable without conflicts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
