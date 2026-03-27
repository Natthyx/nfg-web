import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { UserProvider } from "@/hooks/use-user";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  // CRITICAL: Use getSession instead of getUser for better reliability
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const authUser = session?.user;

  // Debug log for layout
  console.log('Dashboard layout session check:', {
    hasSession: !!session,
    userId: authUser?.id,
    error: sessionError?.message
  });

  if (!authUser || sessionError) {
    redirect("/login");
  }

  // Fetch the full profile from the database for Client-Side hydration
  // This solves the Vercel refresh bug natively.
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  const meta = authUser.user_metadata ?? {};
  
  // Construct the comprehensive User object exactly as the client expects
  const initialUser = profile || {
    id: authUser.id,
    company_id: (meta.company_id as string) ?? "",
    role: ((meta.role as string) ?? "admin"),
    full_name: (meta.full_name as string) ?? authUser.email?.split("@")[0] ?? "User",
    email: authUser.email ?? "",
    phone: (meta.phone as string) ?? undefined,
    avatar_url: (meta.avatar_url as string) ?? undefined,
    is_active: true,
    availability_status: "available",
    created_at: "",
    updated_at: "",
  };

  return (
    <UserProvider initialUser={initialUser}>
      <DashboardShell>{children}</DashboardShell>
    </UserProvider>
  );
}
