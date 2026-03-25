"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { STATUS_CONFIG } from "@/lib/constants";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Package,
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  isSameWeek,
  isWithinInterval,
  parseISO,
  eachDayOfInterval,
} from "date-fns";
import type { Load, LoadStatus, Stop, Receipt, StatusUpdate } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LoadRow extends Load {
  driver: { full_name: string; phone?: string } | null;
  dispatcher: { full_name: string } | null;
  stops: Stop[];
  receipts: Receipt[];
  status_updates: StatusUpdate[];
  reviewer: { full_name: string } | null;
}

// ---------------------------------------------------------------------------
// Week helpers — weeks always start Monday
// ---------------------------------------------------------------------------
const WEEK_OPTIONS = { weekStartsOn: 1 as const };

function getWeekStart(date: Date): Date {
  return startOfWeek(date, WEEK_OPTIONS);
}

function getWeekEnd(date: Date): Date {
  return endOfWeek(date, WEEK_OPTIONS);
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  const startMonth = format(weekStart, "MMM");
  const endMonth = format(weekEnd, "MMM");
  const startDay = format(weekStart, "d");
  const endDay = format(weekEnd, "d");

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

function weekKey(date: Date): string {
  return format(getWeekStart(date), "yyyy-MM-dd");
}

function getPickupStop(stops: Stop[]): Stop | null {
  const sorted = [...stops].sort(
    (a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0)
  );
  return sorted.find((s) => s.type === "pickup") ?? null;
}

function getDeliveryStop(stops: Stop[]): Stop | null {
  const sorted = [...stops].sort(
    (a, b) => (b.stop_order ?? 0) - (a.stop_order ?? 0)
  );
  return sorted.find((s) => s.type === "delivery") ?? null;
}

function fmtCityState(stop: Stop | null): string {
  if (!stop) return "—";
  return [stop.city, stop.state].filter(Boolean).join(", ");
}

function fmtStopDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Group loads by pickup day within the selected week
// ---------------------------------------------------------------------------
function groupLoadsByPickupDay(
  loads: LoadRow[],
  weekStart: Date
): { date: Date; dateLabel: string; loads: LoadRow[] }[] {
  const weekEnd = getWeekEnd(weekStart);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const groups: Map<string, LoadRow[]> = new Map();
  for (const day of days) {
    groups.set(format(day, "yyyy-MM-dd"), []);
  }

  for (const load of loads) {
    const pickup = getPickupStop(load.stops ?? []);
    if (!pickup?.appointment_date) continue;
    const pickupDate = parseISO(pickup.appointment_date);
    if (!isWithinInterval(pickupDate, { start: weekStart, end: weekEnd }))
      continue;
    const key = format(pickupDate, "yyyy-MM-dd");
    const bucket = groups.get(key);
    if (bucket) bucket.push(load);
  }

  return days
    .map((day) => {
      const key = format(day, "yyyy-MM-dd");
      return {
        date: day,
        dateLabel: format(day, "EEEE, MMMM d, yyyy"),
        loads: groups.get(key) ?? [],
      };
    })
    .filter((g) => g.loads.length > 0);
}

// ============================================================================
// PAGE
// ============================================================================
export default function DriverSchedulePage() {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useUser();

  const [allLoads, setAllLoads] = useState<LoadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(
    getWeekStart(new Date())
  );
  const [detailLoad, setDetailLoad] = useState<LoadRow | null>(null);

  // ── Fetch all loads with stops ────────────────────────────────────────
  const fetchLoads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("loads")
        .select(
          `
          *,
          driver:users!loads_driver_id_fkey(full_name, phone),
          dispatcher:users!loads_dispatcher_id_fkey(full_name),
          stops(*),
          receipts(*),
          status_updates(*)
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Driver schedule fetch error:", error);
        const { data: simple } = await supabase
          .from("loads")
          .select("*")
          .order("created_at", { ascending: false });
        setAllLoads(
          ((simple as unknown as LoadRow[]) ?? []).map((l) => ({
            ...l,
            driver: null,
            dispatcher: null,
            reviewer: null,
            stops: [],
            receipts: [],
            status_updates: [],
          }))
        );
      } else {
        setAllLoads(
          ((data as unknown as LoadRow[]) ?? []).map((l) => ({
            ...l,
            reviewer: null,
          }))
        );
      }
    } catch (err) {
      console.error("Driver schedule exception:", err);
      toast.error("Failed to load schedule data");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  // ── Real-time subscription ────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("driver-schedule-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loads" },
        () => fetchLoads()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stops" },
        () => fetchLoads()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "status_updates" },
        () => fetchLoads()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchLoads]);

  // ── Compute available weeks from all loads' pickup dates ──────────────
  const availableWeeks = useMemo(() => {
    const weekSet = new Map<string, Date>();

    // Always include the current week
    const now = new Date();
    const currentWs = getWeekStart(now);
    weekSet.set(weekKey(now), currentWs);

    for (const load of allLoads) {
      const pickup = getPickupStop(load.stops ?? []);
      if (!pickup?.appointment_date) continue;
      const pickupDate = parseISO(pickup.appointment_date);
      const ws = getWeekStart(pickupDate);
      const k = weekKey(pickupDate);
      if (!weekSet.has(k)) weekSet.set(k, ws);
    }

    return Array.from(weekSet.values()).sort(
      (a, b) => b.getTime() - a.getTime()
    );
  }, [allLoads]);

  // ── Loads grouped by day for the selected week ────────────────────────
  const dayGroups = useMemo(
    () => groupLoadsByPickupDay(allLoads, selectedWeekStart),
    [allLoads, selectedWeekStart]
  );

  const totalLoadsThisWeek = useMemo(
    () => dayGroups.reduce((sum, g) => sum + g.loads.length, 0),
    [dayGroups]
  );

  const isCurrentWeek = isSameWeek(selectedWeekStart, new Date(), WEEK_OPTIONS);

  // ── Navigate weeks ────────────────────────────────────────────────────
  const goToPrevWeek = () =>
    setSelectedWeekStart(getWeekStart(subWeeks(selectedWeekStart, 1)));
  const goToNextWeek = () =>
    setSelectedWeekStart(getWeekStart(addWeeks(selectedWeekStart, 1)));
  const goToCurrentWeek = () => setSelectedWeekStart(getWeekStart(new Date()));

  // ── Open detail with fresh data ───────────────────────────────────────
  const openDetail = useCallback(
    async (load: LoadRow) => {
      setDetailLoad(load);
      const { data } = await supabase
        .from("loads")
        .select(
          `*, driver:users!loads_driver_id_fkey(full_name, phone),
          dispatcher:users!loads_dispatcher_id_fkey(full_name),
          stops(*), receipts(*), status_updates(*)`
        )
        .eq("id", load.id)
        .single();
      if (data) {
        let reviewer: { full_name: string } | null = null;
        if ((data as any).reviewed_by) {
          const { data: rev } = await supabase
            .from("users")
            .select("full_name")
            .eq("id", (data as any).reviewed_by)
            .single();
          reviewer = rev;
        }
        setDetailLoad({ ...(data as unknown as LoadRow), reviewer });
      }
    },
    [supabase]
  );

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="Driver's Schedule"
        description="Weekly dispatch schedule — automatically generated from dispatched loads"
      >
        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              Today
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── Week navigation bar ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">
              {formatWeekLabel(selectedWeekStart)}
            </span>
            {isCurrentWeek && (
              <Badge variant="info" className="text-[10px] px-1.5 py-0">
                Current Week
              </Badge>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <span className="text-sm text-muted-foreground ml-2">
            {totalLoadsThisWeek} load{totalLoadsThisWeek !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Select Week dropdown */}
        <Select
          value={weekKey(selectedWeekStart)}
          onValueChange={(v) => setSelectedWeekStart(parseISO(v))}
        >
          <SelectTrigger className="w-[200px]">
            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Select Week" />
          </SelectTrigger>
          <SelectContent>
            {availableWeeks.map((ws) => {
              const k = weekKey(ws);
              const isCurrent = isSameWeek(ws, new Date(), WEEK_OPTIONS);
              return (
                <SelectItem key={k} value={k}>
                  {formatWeekLabel(ws)}
                  {isCurrent ? " (Current)" : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* ── Schedule content ───────────────────────────────────────────── */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : dayGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarDays className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">
              No loads scheduled for {formatWeekLabel(selectedWeekStart)}
            </p>
            <p className="text-xs mt-1">
              Loads appear here automatically once dispatched with a pickup date in this week.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {dayGroups.map((group) => (
            <div key={group.dateLabel}>
              {/* Day header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                <h3 className="text-sm font-semibold">{group.dateLabel}</h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {group.loads.length} load{group.loads.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Day table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Pickup Date</TableHead>
                        <TableHead className="font-semibold">Delivery Date</TableHead>
                        <TableHead className="font-semibold">Company Name</TableHead>
                        <TableHead className="font-semibold">Load Number</TableHead>
                        <TableHead className="font-semibold">Pickup City, State</TableHead>
                        <TableHead className="font-semibold">Delivery City, State</TableHead>
                        <TableHead className="font-semibold">Driver</TableHead>
                        <TableHead className="font-semibold text-right">Rate</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.loads.map((load) => {
                        const sCfg = STATUS_CONFIG[load.status as LoadStatus];
                        const pickup = getPickupStop(load.stops ?? []);
                        const delivery = getDeliveryStop(load.stops ?? []);

                        return (
                          <TableRow key={load.id}>
                            <TableCell>
                              <Badge variant={sCfg?.variant}>
                                {sCfg?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {fmtDateShort(pickup?.appointment_date)}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {fmtDateShort(delivery?.appointment_date)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {load.client_name || "—"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {load.reference_number}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {fmtCityState(pickup)}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {fmtCityState(delivery)}
                            </TableCell>
                            <TableCell>
                              {load.driver?.full_name || "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${Number(load.rate).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDetail(load)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Dialog ──────────────────────────────────────────────── */}
      <LoadDetailDialog
        load={detailLoad}
        open={!!detailLoad}
        onClose={() => setDetailLoad(null)}
      />
    </div>
  );
}

// ============================================================================
// LOAD DETAIL DIALOG (same as loads page)
// ============================================================================
function LoadDetailDialog({
  load,
  open,
  onClose,
}: {
  load: LoadRow | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!load) return null;

  const stops = [...(load.stops ?? [])].sort(
    (a, b) => a.stop_order - b.stop_order
  );
  const updates = [...(load.status_updates ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const receipts = load.receipts ?? [];
  const hasReview =
    load.reviewed_by || load.reviewed_at || load.review_feedback;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Load {load.reference_number}
          </DialogTitle>
          <DialogDescription>Full load details and history.</DialogDescription>
        </DialogHeader>

        <Separator />

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-6 py-4 space-y-5">
            {/* Overview */}
            <div className="grid grid-cols-2 gap-4">
              <DetailItem
                icon={<Truck className="h-4 w-4" />}
                label="Status"
                value={
                  <Badge variant={STATUS_CONFIG[load.status]?.variant}>
                    {STATUS_CONFIG[load.status]?.label}
                  </Badge>
                }
              />
              <DetailItem
                icon={<UserIcon className="h-4 w-4" />}
                label="Driver"
                value={load.driver?.full_name ?? "Unassigned"}
              />
              <DetailItem
                icon={<UserIcon className="h-4 w-4" />}
                label="Dispatcher"
                value={load.dispatcher?.full_name ?? "—"}
              />
              <DetailItem
                icon={<Package className="h-4 w-4" />}
                label="Rate"
                value={`$${Number(load.rate).toLocaleString()}`}
              />
              {load.equipment_type && (
                <DetailItem
                  icon={<Truck className="h-4 w-4" />}
                  label="Equipment"
                  value={load.equipment_type}
                />
              )}
              {load.weight_lbs != null && (
                <DetailItem
                  icon={<Package className="h-4 w-4" />}
                  label="Weight"
                  value={`${load.weight_lbs.toLocaleString()} lbs`}
                />
              )}
              <DetailItem
                icon={<Clock className="h-4 w-4" />}
                label="Dispatched"
                value={fmtDateTime(load.dispatched_at)}
              />
              {load.completed_at && (
                <DetailItem
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  label="Completed"
                  value={fmtDateTime(load.completed_at)}
                />
              )}
            </div>

            {load.special_instructions && (
              <div className="rounded-lg border bg-blue-50/50 p-3 dark:bg-blue-950/20">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Special Instructions
                </p>
                <p className="text-sm">{load.special_instructions}</p>
              </div>
            )}

            {/* Review Section */}
            {hasReview && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Admin Review
                  </h4>
                  <div className="rounded-lg border bg-slate-50/50 p-4 dark:bg-slate-950/20 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {load.reviewer?.full_name && (
                        <div>
                          <p className="text-xs text-muted-foreground">Reviewed By</p>
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                            {load.reviewer.full_name}
                          </p>
                        </div>
                      )}
                      {load.reviewed_at && (
                        <div>
                          <p className="text-xs text-muted-foreground">Reviewed At</p>
                          <p className="text-sm font-medium">{fmtDateTime(load.reviewed_at)}</p>
                        </div>
                      )}
                    </div>
                    {load.review_feedback && (
                      <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Review Feedback
                        </p>
                        <p className="text-sm">{load.review_feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Cancel reason */}
            {load.cancel_reason && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900 dark:bg-red-950/20">
                <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Cancel Reason
                </p>
                <p className="text-sm">{load.cancel_reason}</p>
              </div>
            )}

            {/* Stops */}
            {stops.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Stops
                  </h4>
                  <div className="space-y-0">
                    {stops.map((stop, idx) => {
                      const isPickup = stop.type === "pickup";
                      const dotColor = isPickup ? "bg-emerald-500" : "bg-red-500";
                      const isLast = idx === stops.length - 1;
                      return (
                        <div key={stop.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={`h-3 w-3 rounded-full ${dotColor} mt-1.5 ring-2 ring-white dark:ring-card`}
                            />
                            {!isLast && <div className="w-0.5 flex-1 bg-border" />}
                          </div>
                          <div className="pb-4 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={isPickup ? "success" : "destructive"}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {isPickup ? "Pickup" : "Delivery"}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Stop {stop.stop_order}
                              </Badge>
                              <Badge
                                variant={
                                  stop.status === "completed"
                                    ? "success"
                                    : stop.status === "arrived"
                                    ? "warning"
                                    : "secondary"
                                }
                                className="text-[10px] px-1.5 py-0"
                              >
                                {stop.status}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium mt-1">
                              {stop.facility_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {stop.address}, {stop.city}, {stop.state} {stop.zip}
                            </p>
                            {(stop.arrival_at || stop.departure_at) && (
                              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                {stop.arrival_at && (
                                  <span>Arrived: {fmtDateTime(stop.arrival_at)}</span>
                                )}
                                {stop.departure_at && (
                                  <span>Departed: {fmtDateTime(stop.departure_at)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Receipts / PODs */}
            {receipts.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Receipts / PODs
                  </h4>
                  <div className="space-y-2">
                    {receipts.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {r.no_pod_available ? "No POD Available" : r.file_name ?? "POD Document"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.signed_by && `Signed by: ${r.signed_by} · `}
                            {fmtDateTime(r.created_at)}
                          </p>
                        </div>
                        {r.file_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={r.file_url} target="_blank" rel="noopener noreferrer">
                              View
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Status History */}
            {updates.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Status History
                  </h4>
                  <div className="space-y-2">
                    {updates.map((u) => {
                      const prevCfg = u.previous_status
                        ? STATUS_CONFIG[u.previous_status]
                        : null;
                      const newCfg = STATUS_CONFIG[u.new_status];
                      return (
                        <div
                          key={u.id}
                          className="flex items-start gap-3 rounded-lg border p-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {prevCfg && (
                                <>
                                  <Badge
                                    variant={prevCfg.variant}
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    {prevCfg.label}
                                  </Badge>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                </>
                              )}
                              {newCfg ? (
                                <Badge
                                  variant={newCfg.variant}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {newCfg.label}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {u.new_status ?? "Unknown"}
                                </Badge>
                              )}
                            </div>
                            {u.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                {u.notes}
                              </p>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {fmtDateTime(u.created_at)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Small detail item helper
// ---------------------------------------------------------------------------
function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
