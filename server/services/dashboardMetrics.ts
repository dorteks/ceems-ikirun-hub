export type DashboardKpi = {
  label: string;
  value: string;
  delta: string;
  tone: "primary" | "success" | "warning" | "destructive";
};

export type DashboardKpiStats = {
  total_customers: number;
  enumerated_total: number;
  enumerated_today: number;
  unmetered_customers: number;
  quality_issues: number;
  created_this_month: number;
  created_last_month: number;
};

export function buildKpis(stats: DashboardKpiStats): DashboardKpi[] {
  const enumeratedTodayPct = stats.enumerated_total
    ? ((stats.enumerated_today / stats.enumerated_total) * 100).toFixed(2)
    : "0.00";

  const unmeteredPct = stats.total_customers
    ? ((stats.unmetered_customers / stats.total_customers) * 100).toFixed(2)
    : "0.00";

  const monthDelta = stats.created_this_month - stats.created_last_month;

  return [
    {
      label: "Total customers",
      value: stats.total_customers.toLocaleString(),
      delta: `${monthDelta >= 0 ? "+" : ""}${monthDelta.toLocaleString()} this month`,
      tone: "primary",
    },
    {
      label: "Total enumerated",
      value: stats.enumerated_total.toLocaleString(),
      delta: `${enumeratedTodayPct}% of total accounts`,
      tone: "success",
    },
    {
      label: "Enumerated today",
      value: stats.enumerated_today.toLocaleString(),
      delta: `${enumeratedTodayPct}% of total enumerated`,
      tone: "success",
    },
    {
      label: "Unmetered accounts",
      value: stats.unmetered_customers.toLocaleString(),
      delta: `${unmeteredPct}% of base`,
      tone: "warning",
    },
    {
      label: "Awaiting enumeration",
      value: stats.quality_issues.toLocaleString(),
      delta: "Needs to be enumerated",
      tone: "destructive",
    },
  ];
}
