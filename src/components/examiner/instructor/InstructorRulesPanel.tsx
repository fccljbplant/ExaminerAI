"use client";

/**
 * InstructorRulesPanel — configurable personal rules.
 *
 * Dropdown-based builder (not free-text parsing). Fixed set of
 * composable predicates + actions.
 */

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Zap } from "lucide-react";

interface Rule {
  id: string;
  condition: string;
  action: string;
  enabled: boolean;
  createdAt: string;
}

const CONDITIONS = [
  { value: "days_missed >= 2", label: "Student misses 2+ days" },
  { value: "days_missed >= 3", label: "Student misses 3+ days" },
  { value: "days_since_contact >= 5", label: "No contact for 5+ days" },
  { value: "days_since_contact >= 7", label: "No contact for 7+ days" },
  { value: "tier_change_to_amber", label: "Wellbeing drops to Amber" },
  { value: "tier_change_to_red", label: "Wellbeing drops to Red" },
  { value: "confidence_gap > 20", label: "Overconfidence gap > 20%" },
];

const ACTIONS = [
  { value: "draft_checkin", label: "Draft a check-in message" },
  { value: "flag_in_today", label: "Flag in Today view" },
  { value: "notify", label: "Notify me" },
];

export function InstructorRulesPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [condition, setCondition] = useState(CONDITIONS[0].value);
  const [action, setAction] = useState(ACTIONS[0].value);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<{ rules: Rule[] }>("/api/instructor/rules")
      .then(res => setRules(res.rules || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      await api.post("/api/instructor/rules", { condition, action });
      load();
    } catch { }
    finally { setCreating(false); }
  };

  const remove = async (id: string) => {
    try {
      await api.del(`/api/instructor/rules?id=${id}`);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch { }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Personal Rules
        </CardTitle>
        <CardDescription className="text-xs">
          When a condition is met, an action runs automatically. Only you see these.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Create rule */}
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={condition}
            onChange={e => setCondition(e.target.value)}
            className="px-2 py-1 text-xs rounded-md bg-background border border-border flex-1"
          >
            {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            className="px-2 py-1 text-xs rounded-md bg-background border border-border flex-1"
          >
            {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <Button onClick={create} disabled={creating} size="sm" className="bg-primary text-primary-foreground">
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add
          </Button>
        </div>

        {/* Existing rules */}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!loading && rules.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No rules yet. Create one above.</p>
        )}
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
            <div className="flex-1">
              <p className="text-xs text-foreground">
                <span className="font-medium">{CONDITIONS.find(c => c.value === rule.condition)?.label || rule.condition}</span>
                {" → "}
                <span className="text-primary">{ACTIONS.find(a => a.value === rule.action)?.label || rule.action}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={rule.enabled ? "default" : "outline"} className="text-[9px]">
                {rule.enabled ? "active" : "disabled"}
              </Badge>
              <Button onClick={() => remove(rule.id)} size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
