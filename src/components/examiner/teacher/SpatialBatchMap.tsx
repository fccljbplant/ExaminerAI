"use client";

/**
 * SpatialBatchMap — visual batch view.
 *
 * Position = progress (X), color = wellbeing tier, size = attention needed.
 * Click a node → opens student detail panel.
 *
 * Pure frontend — consumes buildTeacherBatchSummary() data from the
 * existing batch summary. No new backend needed.
 *
 * Uses recharts ScatterChart (already in the stack).
 */

import { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { StudentRow } from "@/components/examiner/teacher/types";

interface SpatialBatchMapProps {
  students: StudentRow[];
  onStudentClick: (student: StudentRow) => void;
}

const TIER_COLORS: Record<string, string> = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  null: "#6b7280",
};

// CustomTooltip declared OUTSIDE the component so it doesn't reset state on each render.
 
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
      <p className="font-medium text-foreground">{d.name}</p>
      <p className="text-muted-foreground">Week {d.week} · {d.progress}% progress</p>
      <p className="text-muted-foreground">Tier: {d.tier} · {d.flags} flag(s)</p>
    </div>
  );
}

export function SpatialBatchMap({ students, onStudentClick }: SpatialBatchMapProps) {
  const data = useMemo(() => {
    return students.map(s => ({
      x: s.progress || 0,
       
      y: (s as any).wellbeingTier === "red" ? 3 : (s as any).wellbeingTier === "amber" ? 2 : 1,
       
      z: ((s as any).openCrisisFlags || 0) + 1, // size = flags + 1 (min size)
      name: s.name,
      id: s.id,
      week: s.currentWeek,
       
      tier: (s as any).wellbeingTier || "green",
      progress: s.progress || 0,
       
      flags: (s as any).openCrisisFlags || 0,
    }));
  }, [students]);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Batch Map</CardTitle>
        <CardDescription className="text-xs">
          Position = progress · Color = wellbeing · Size = attention needed
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No students to display.</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Progress"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  label={{ value: "Progress %", position: "bottom", fontSize: 10, fill: "currentColor" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Wellbeing"
                  domain={[0, 4]}
                  ticks={[1, 2, 3]}
                  tickFormatter={(v) => v === 1 ? "Green" : v === 2 ? "Amber" : v === 3 ? "Red" : ""}
                  tick={{ fontSize: 10, fill: "currentColor" }}
                />
                <ZAxis type="number" dataKey="z" range={[40, 400]} name="Attention" />
                <Tooltip content={<CustomTooltip />} />
                <Scatter
                  data={data}
                   
                  onClick={(data: any) => {
                    const student = students.find(s => s.id === data.id);
                    if (student) onStudentClick(student);
                  }}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={TIER_COLORS[entry.tier] || TIER_COLORS.null}
                      fillOpacity={0.7}
                      stroke={TIER_COLORS[entry.tier] || TIER_COLORS.null}
                      strokeWidth={1}
                      className="cursor-pointer"
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS.green }} /> Green
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS.amber }} /> Amber
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS.red }} /> Red
          </span>
          <span className="ml-auto">Click a node to view student detail</span>
        </div>
      </CardContent>
    </Card>
  );
}
