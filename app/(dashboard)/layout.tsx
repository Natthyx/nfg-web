import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";

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

  const user = session?.user;

  // Debug log for layout
  console.log('Dashboard layout session check:', {
    hasSession: !!session,
    userId: user?.id,
    error: sessionError?.message
  });

  if (!user || sessionError) {
    redirect("/login");
  }

  // Only require a valid session; profile is optional.
  return <DashboardShell>{children}</DashboardShell>;
}
