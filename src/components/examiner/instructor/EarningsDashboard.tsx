"use client";

/**
 * EarningsDashboard — instructor revenue dashboard.
 *
 * Pulls data from /api/instructor/earnings and renders:
 *   1. Revenue cards (Total / Platform Fees / Net = 80%).
 *   2. Monthly earnings bar chart (recharts).
 *   3. Top-courses table (sales count + earnings per course).
 *   4. Recent-sales list (student, course, amount, date).
 *
 * Dark theme. Uses shadcn/ui Card + Table + Progress + Badge, recharts
 * for the bar chart, lucide-react for icons.
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, RefreshCw, Loader2,
  AlertCircle, ShoppingBag, Users, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthlyDatum {
  month: string; // "YYYY-MM"
  earnings: number;
  sales: number;
}
interface TopCourse {
  courseId: string;
  courseName: string;
  sales: number;
  earnings: number;
}
interface RecentSale {
  studentName: string;
  courseName: string;
  amount: number;
  currency: string;
  date: string;
}
interface EarningsResponse {
  totalEarnings: number;
  platformFees: number;
  netEarnings: number;
  monthlyData: MonthlyDatum[];
  topCourses: TopCourse[];
  recentSales: RecentSale[];
}

export default function EarningsDashboard() {
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const c = useChartColors();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<EarningsResponse>("/api/instructor/earnings");
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load earnings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-semibold">Couldn&apos;t load earnings</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{error || "Unknown error"}</p>
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.totalEarnings > 0 || data.recentSales.length > 0;
  // Reverse monthly data so oldest is on the left, newest on the right.
  const chartData = [...data.monthlyData].reverse().map(d => ({
    ...d,
    label: d.month, // recharts x-axis key
  }));

  // Highest single-month earnings — used to scale the bars visually.
  const maxMonthly = chartData.length > 0
    ? Math.max(...chartData.map(d => d.earnings), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Earnings
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Revenue from your course sales. Platform fee is 20% — your net share is 80%.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setRefreshing(true); load(); }}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {!hasData && (
        <Card className="border-dashed border-border">
          <CardContent className="p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">No sales yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              When students enroll in your paid courses, your revenue will appear here
              with monthly charts, top courses, and recent sales.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Revenue cards */}
      {hasData && (
        <div className="grid gap-4 sm:grid-cols-3">
          <RevenueCard
            label="Total Earnings"
            value={data.totalEarnings}
            currency="USD"
            icon={DollarSign}
            tone="primary"
            sublabel="gross revenue"
          />
          <RevenueCard
            label="Platform Fees"
            value={data.platformFees}
            currency="USD"
            icon={TrendingDown}
            tone="muted"
            sublabel="20% platform cut"
          />
          <RevenueCard
            label="Net Earnings"
            value={data.netEarnings}
            currency="USD"
            icon={TrendingUp}
            tone="success"
            sublabel="your 80% share"
          />
        </div>
      )}

      {/* Monthly chart */}
      {hasData && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Monthly earnings
            </CardTitle>
            <CardDescription>
              Gross revenue per month. Hover a bar for the breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={c.axis}
                  style={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={c.axis}
                  style={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle(c)}
                  formatter={(value: unknown, name: unknown) => {
                    if (name === "earnings") return [`$${Number(value).toFixed(2)}`, "Earnings"];
                    return [String(value), String(name)];
                  }}
                  labelFormatter={(label: unknown) => {
                    const item = chartData.find(d => d.label === String(label));
                    return item ? `${label} · ${item.sales} sale${item.sales === 1 ? "" : "s"}` : String(label);
                  }}
                />
                <Bar
                  dataKey="earnings"
                  name="earnings"
                  fill={c.chart1}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
            {/* Tiny legend with sales counts */}
            <div className="mt-2 flex flex-wrap gap-2 justify-end">
              {chartData.map(d => (
                <Badge key={d.month} variant="outline" className="text-[10px]">
                  {d.month}: {d.sales} sale{d.sales === 1 ? "" : "s"} · ${d.earnings.toFixed(0)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top courses + recent sales side-by-side */}
      {hasData && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top courses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" /> Top courses
              </CardTitle>
              <CardDescription>By total earnings.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No course sales yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Earnings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topCourses.map(course => (
                      <TableRow key={course.courseId}>
                        <TableCell className="font-medium">{course.courseName}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="text-[10px]">
                            {course.sales}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${course.earnings.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {/* Visual share bar — each course's share of the top-10 total */}
              {data.topCourses.length > 0 && (
                <div className="mt-4 space-y-2">
                  {data.topCourses.slice(0, 5).map(course => {
                    const pct = Math.max(2, Math.round((course.earnings / maxMonthly) * 100));
                    return (
                      <div key={course.courseId} className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span className="truncate">{course.courseName}</span>
                          <span className="font-medium text-foreground">
                            ${course.earnings.toFixed(0)} · {course.sales}
                          </span>
                        </div>
                        <Progress value={pct} className="h-1" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent sales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" /> Recent sales
              </CardTitle>
              <CardDescription>Latest 10 enrollments.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.recentSales.map((sale, i) => (
                    <li
                      key={`${sale.studentName}-${sale.courseName}-${i}`}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate flex items-center gap-1.5">
                          <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          {sale.studentName}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {sale.courseName} · {new Date(sale.date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-medium">
                        ${sale.amount.toFixed(2)} {sale.currency}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================
// RevenueCard — single stat tile.
// ============================================================
function RevenueCard({
  label,
  value,
  currency,
  icon: Icon,
  tone,
  sublabel,
}: {
  label: string;
  value: number;
  currency: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "muted" | "success";
  sublabel: string;
}) {
  const toneClasses = {
    primary: "border-primary/30 bg-primary/5",
    muted: "border-border bg-muted/30",
    success: "border-growth-sage bg-growth-sage-soft",
  }[tone];
  const iconClass = {
    primary: "text-primary",
    muted: "text-muted-foreground",
    success: "text-growth-sage",
  }[tone];

  return (
    <Card className={cn("overflow-hidden", toneClasses)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={cn("h-4 w-4", iconClass)} />
        </div>
        <p className="mt-2 text-2xl font-bold text-foreground">
          {currency === "USD" ? "$" : ""}
          {value.toFixed(2)}
          {currency !== "USD" ? ` ${currency}` : ""}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">{sublabel}</p>
      </CardContent>
    </Card>
  );
}
