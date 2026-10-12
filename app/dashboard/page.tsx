"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Download, RefreshCw, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "../_components/app-shell";
import { StatusBadge } from "../_components/status-badge";
import Link from "next/link";
import { DayDisplay } from "@/components/dashboard/time-display";
import { toast } from "sonner";
import { Donut } from "@/components/dashboard/donut";
import { useAuth } from "@/lib/auth/auth";

// export const Route = createFileRoute("/")({
//   head: () => ({
//     meta: [
//       { title: "CEEMS Dashboard — Electricity Enumeration Management" },
//       {
//         name: "description",
//         content:
//           "Operational dashboard for customer and electricity enumeration: coverage, metering gaps, data quality and field batches.",
//       },
//       { property: "og:title", content: "CEEMS Dashboard — Electricity Enumeration Management" },
//       {
//         property: "og:description",
//         content: "Track enumeration coverage, metering gaps and data quality across the distribution network.",
//       },
//     ],
//   }),
//   component: Dashboard,
// });

const toneClass = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning-foreground",
  destructive: "text-destructive",
} as const;

type DashboardKpi = {
  label: string;
  value: string;
  delta: string;
  tone: keyof typeof toneClass;
};

type DashboardTrendPoint = {
  month: string;
  captured: number;
  verified: number;
};

type DashboardBandSplit = {
  band: string;
  customers: number;
};

type DashboardBatch = {
  id: string;
  hub: string;
  enumerator: string;
  records: number;
  status: string;
  progress: number;
  updated: string;
};

type DashboardActivity = {
  id: number;
  actorName: string;
  actorUsername: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  beforeValue: string | null;
  afterValue: string | null;
  occurredAt: string;
};

type DashboardData = {
  kpis: DashboardKpi[];
  trend: DashboardTrendPoint[];
  feederBandSplit: DashboardBandSplit[];
  enumerationBatches: DashboardBatch[];
  recentActivity: DashboardActivity[];
  lastUpdated: string;
};

export default function Dashboard() {
  const { adminAccess } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/dashboard", {
        credentials: "include",
      });

      const json = (await response.json().catch(() => null)) as
        | DashboardData
        | { error?: string }
        | null;

      if (!response.ok || !json || "error" in json) {
        setError(
          json && "error" in json
            ? (json.error ?? "Failed to load dashboard")
            : "Failed to load dashboard",
        );
        setData(null);
        return;
      }

      setData(json as DashboardData);
    } catch {
      setError("Failed to load dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const feederBandSegments =
    data?.feederBandSplit?.map((item, index) => ({
      label: item.band,
      value: item.customers,
      color: [
        "var(--color-primary)",
        "var(--color-success)",
        "var(--color-warning)",
        "var(--color-info)",
        "var(--color-destructive)",
      ][index % 5],
    })) ?? [];

  return (
    <>
      <PageHeader
        title="Operations dashboard"
        description={
          <div className="flex flex-row items-center">
            <p>Osun Distribution · Data as of today</p>
            <DayDisplay />
          </div>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDashboard()}
              disabled={loading}
            >
              <RefreshCw className="size-4" /> Refresh
            </Button>

            {adminAccess && (
              <Button
                onClick={() =>
                  toast.message("Coming soon", {
                    position: "top-right",
                  })
                }
                size="sm"
              >
                <Download className="size-4" /> Export snapshot
              </Button>
            )}
          </>
        }
      />

      {/* migration fixes push */}
      {error ? (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(data?.kpis ?? []).map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle
                className={`text-numeric text-3xl ${toneClass[kpi.tone]}`}
              >
                {kpi.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{kpi.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Enumeration throughput</CardTitle>
            <CardDescription>
              Records captured vs supervisor-verified
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {loading && !data ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data?.trend ?? []}
                  margin={{ left: -18, right: 8, top: 8 }}
                >
                  <defs>
                    <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="captured"
                    stroke="var(--color-primary)"
                    fill="url(#cap)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="verified"
                    stroke="var(--color-accent)"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Customers by feeder band
            </CardTitle>
            <CardDescription>Distribution across tariff bands</CardDescription>
          </CardHeader>

          <CardContent className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:gap-6">
            {loading && !data ? (
              <div className="flex h-40 w-full items-center justify-center text-sm text-muted-foreground">
                Loading chart...
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6 2xl:gap-12 lg:items-center">
                <div className="shrink-0">
                  <Donut
                    segments={feederBandSegments}
                    centerTop={feederBandSegments
                      .reduce((total, segment) => total + segment.value, 0)
                      .toLocaleString()}
                    centerBottom="Total Customers"
                  />
                </div>

                <div className="min-w-0 max-w-fit space-y-1.5 text-sm">
                  {feederBandSegments.map((segment) => (
                    <div
                      key={segment.label}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: segment.color }}
                      />

                      <span className="min-w-0 mr-2 truncate text-foreground">
                        {segment.label}
                      </span>

                      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                        {segment.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="w-full flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Active enumeration batches</CardTitle>
              <CardDescription>
                Field capture and supervisor review
              </CardDescription>
            </div>

            <Button variant="ghost" size="sm">
              <Link
                className="flex flex-row items-center gap-2"
                href="/enumeration"
              >
                View all <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Hub</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Enumerator
                    </TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead className="w-40">Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.enumerationBatches ?? []).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-numeric font-medium">
                        {b.id}
                      </TableCell>
                      <TableCell>{b.hub}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {b.enumerator}
                      </TableCell>
                      <TableCell className="text-numeric text-right">
                        {b.records.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Progress value={b.progress} className="h-2" />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={b.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Audit trail highlights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(data?.recentActivity ?? []).map((entry, i) => (
              <div
                key={i}
                className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" />
                <div className="text-sm">
                  <p className="font-medium">
                    {entry.actorName} ·{" "}
                    <span className="font-normal text-muted-foreground">
                      {entry.action}
                    </span>
                  </p>
                  <p className="text-numeric text-xs text-muted-foreground">
                    {entry.entityLabel} —{" "}
                    {new Date(entry.occurredAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {!(data?.recentActivity?.length ?? 0) && !loading ? (
              <p className="text-sm text-muted-foreground">
                No recent activity yet.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
