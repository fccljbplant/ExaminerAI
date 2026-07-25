"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Clock, CheckCircle2, Loader2, ShieldCheck, TrendingUp, Mail, UserCheck,
  Award, AlertCircle, RefreshCw, FolderOpen, MessageSquare, ClipboardList,
  CalendarCheck, Bug as BugIcon, Send, Inbox, ArrowLeft, HelpCircle,
  Lock, KeyRound, Edit3, Save, Trash2, Brain, FileText, LayoutDashboard, Activity,
  GraduationCap, HeartHandshake, Plus, Download,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, ReferenceLine, Cell,
} from "recharts";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";

export function CalibrationScatterCard({ confidenceRatings, chartColors: c }: {
  confidenceRatings: Array<{ id: string; source: string; rating: number; actualScore: number | null; context: string | null; week: number | null; createdAt: string }>;
  chartColors: ReturnType<typeof useChartColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  const scatterData = confidenceRatings
    .filter(r => r.actualScore !== null)
    .map(r => ({ confidence: r.rating * 20, actual: r.actualScore!, context: r.context || r.source, week: r.week }));
  const showChart = scatterData.length > 0;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <button onClick={() => setExpanded(!expanded)} className="text-left">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Calibration (Dunning-Kruger)
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Confidence vs. actual score. Diagonal = perfectly calibrated. Below-right = overconfident. Above-left = underconfident.
          </CardDescription>
        </button>
      </CardHeader>
      <CardContent>
        {showChart ? (
          <ResponsiveContainer width="100%" height={expanded ? 360 : 240}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
              <XAxis type="number" dataKey="confidence" name="Confidence" domain={[0, 100]} stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Confidence %", position: "bottom", fontSize: 11, fill: c.axis }} />
              <YAxis type="number" dataKey="actual" name="Actual" domain={[0, 100]} stroke={c.axis} tick={{ fontSize: 11 }} label={{ value: "Actual %", angle: -90, position: "insideLeft", fontSize: 11, fill: c.axis }} />
              <ZAxis type="number" range={[80, 80]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={tooltipStyle(c)} formatter={(value: number, name: string) => [`${value}%`, name]} labelFormatter={() => ""} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke={c.chart3} strokeDasharray="4 4" />
              <Scatter data={scatterData} fill={c.chart1} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No calibration data yet — needs confidence ratings captured alongside actual scores.
          </p>
        )}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            <p className="text-xs font-medium text-foreground">Evidence ({confidenceRatings.length} ratings):</p>
            {confidenceRatings.slice(0, 15).map(r => {
              const gap = r.actualScore !== null ? (r.rating * 20) - r.actualScore : null;
              return (
                <div key={r.id} className="flex items-center justify-between text-xs rounded-md bg-muted p-2">
                  <div>
                    <p className="text-foreground capitalize">{r.source} · {r.context || "no context"}</p>
                    {r.week !== null && <p className="text-[10px] text-muted-foreground">Week {r.week}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">Rated: {r.rating}/5</span>
                    {r.actualScore !== null && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-foreground">Actual: {r.actualScore}%</span>
                        {gap !== null && gap > 20 && <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">Overconfident</Badge>}
                        {gap !== null && gap < -20 && <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/30">Underconfident</Badge>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          {expanded ? "Click title to collapse" : "Click title to expand evidence"}
        </p>
      </CardContent>
    </Card>
  );
}
