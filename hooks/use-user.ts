"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types";

function fallbackUser(su: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): User {
  const meta = su.user_metadata ?? {};
  return {
    id: su.id,
    company_id: (meta.company_id as string) ?? "",
    role: ((meta.role as string) ?? "admin") as User["role"],
    full_name:
      (meta.full_name as string) ??
      su.email?.split("@")[0] ??
      "User",
    email: su.email ?? "",
    phone: (meta.phone as string) ?? undefined,
    avatar_url: (meta.avatar_url as string) ?? undefined,
    is_active: true,
    availability_status: "available",
    created_at: "",
    updated_at: "",
  };
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);

  const loadProfile = useCallback(
    async (
      supabase: ReturnType<typeof createClient>,
      sessionUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }
    ) => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", sessionUser.id)
          .single();

        if (data && !error) {
          setUser(data);
        } else {
          setUser(fallbackUser(sessionUser));
        }
      } catch {
        setUser(fallbackUser(sessionUser));
      }
    },
    []
  );

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const supabase = createClient();

    async function init() {
      try {
        // getUser() validates the JWT with the Supabase Auth server.
        // Unlike getSession(), it forces a proper token refresh when
        // the access-token is expired — critical after a full page
        // refresh where the middleware may have written new cookies
        // that the browser client hasn't seen yet.
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        await loadProfile(supabase, authUser);
      } catch (err) {
        console.error("useUser init error:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setLoading(false);
        return;
      }

      await loadProfile(supabase, session.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  return { user, loading };
}
