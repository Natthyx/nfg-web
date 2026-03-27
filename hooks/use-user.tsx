"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

type UserContextType = {
  user: User | null;
  loading: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: User | null;
}) {
  // Instantly loaded from Server-Side session injection!
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log("Auth state change:", event, session?.user?.id);

      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setLoading(false);
        return;
      }

      // If a user signs in dynamically on the client without SSR, fetch profile
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        try {
          const { data } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (data) {
            setUser(data);
          } else {
            const meta = session.user.user_metadata ?? {};
            setUser({
              id: session.user.id,
              company_id: (meta.company_id as string) ?? "",
              role: ((meta.role as string) ?? "admin") as User["role"],
              full_name:
                (meta.full_name as string) ??
                session.user.email?.split("@")[0] ??
                "User",
              email: session.user.email ?? "",
              phone: (meta.phone as string) ?? undefined,
              avatar_url: (meta.avatar_url as string) ?? undefined,
              is_active: true,
              availability_status: "available",
              created_at: "",
              updated_at: "",
            });
          }
        } catch (err) {
          console.error("Profile fetch failed:", err);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    // Graceful fallback during hydration mismatches to prevent crashes
    return { user: null, loading: true };
  }
  return context;
}
