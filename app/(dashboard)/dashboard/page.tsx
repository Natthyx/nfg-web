import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, DollarSign, Users2, FileText, Activity } from "lucide-react";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  let userName = authUser?.user_metadata?.full_name?.split(" ")[0];
  if (!userName && authUser?.id) {
    const { data: profile } = await supabase.from("users").select("full_name").eq("id", authUser.id).single();
    userName = profile?.full_name?.split(" ")[0] ?? "there";
  }
  if (!userName) userName = "there";

  // Fetch KPIs in parallel
  const [loadsRes, driversRes, deliveredRes, revenueRes] = await Promise.all([
    supabase.from("loads").select("id", { count: "exact", head: true }).not("status", "in", '("delivered","cancelled")'),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "driver").eq("is_active", true),
    supabase.from("loads").select("id", { count: "exact", head: true }).eq("status", "delivered"),
    supabase.from("loads").select("rate").eq("status", "delivered"),
  ]);

  const activeLoadCount = loadsRes.count || 0;
  const driverCount = driversRes.count || 0;
  const deliveredCount = deliveredRes.count || 0;
  const totalRevenue = (revenueRes.data || []).reduce((sum, l) => sum + (l.rate || 0), 0);

  const kpis = [
    { title: "Active Loads", value: activeLoadCount, icon: Package, color: "text-primary" },
    { title: "Active Drivers", value: driverCount, icon: Truck, color: "text-primary" },
    { title: "Delivered", value: deliveredCount, icon: CheckCircle2, color: "text-primary" },
    { title: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-primary" },
  ];

  const quickActions = [
    { title: "Manage Drivers", href: "/drivers", icon: Users2, description: "View, add, or dispatch drivers" },
    { title: "View Receipts", href: "/receipts", icon: FileText, description: "Review submitted receipts" },
    { title: "Status Updates", href: "/status-updates", icon: Activity, description: "Monitor driver statuses" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {userName}!</h1>
        <p className="text-sm text-muted-foreground mt-1">Here&apos;s what&apos;s happening with your logistics operations today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="h-full min-h-0 transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 py-3 px-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{action.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
