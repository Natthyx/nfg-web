"use client";

import { useUserContext } from "@/contexts/user-context";

/**
 * Convenience hook — returns the authenticated user from the nearest
 * UserProvider.  All the heavy lifting (profile fetch, auth listener)
 * lives in `contexts/user-context.tsx`.
 */
export function useUser() {
  return useUserContext();
}
