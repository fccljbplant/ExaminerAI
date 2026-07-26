"use client";

/**
 * AdminPrincipalTab — Institution management dashboard for principals.
 *
 * The principal is the institution admin — they manage everything about
 * their institution: courses, batches, teachers, students, settings,
 * branding (logo), and institutional oversight.
 *
 * Admin role (platform-level) is separate — admin manages the platform
 * itself (system health, AI config, feature flags, global settings).
 * Principal manages THEIR institution.
 *
 * This tab gives the principal:
 * 1. Institution overview (name, logo, stats)
 * 2. Institution settings (name, contact, logo URL — editable)
 * 3. Courses management (create, edit, assign to batches)
 * 4. Batches management (create, duplicate, assign teachers)
 * 5. Staff overview (teachers, counselors, coordinators)
 * 6. Student wellbeing overview (alerts, health summary)
 * 7. Teacher behavior monitoring
 * 8. Audit log (institution-level actions)
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users, ShieldAlert, Loader2, RefreshCw, Database, Key,
  CheckCircle2, TrendingUp, AlertTriangle, Activity, Clock, Ban, UserCheck,
  Settings as SettingsIcon, Server, BookOpen, Plus, GraduationCap, ClipboardList,
  ShieldCheck, Save, Building2, Image as ImageIcon, Layers, Copy, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRow } from "@/components/examiner/admin/types";

interface Institution {
  id: string;
  name: string;
  logoUrl: string | null;
  contactEmail: string;
  _count?: { users: number; courses: number; certificates: number };
}

interface BatchWithTeachers {
  id: string;
  name: string;
  startDate: string | null;
  deliveryMode: string;
  courseId: string | null;
  course: { name: string } | null;
  _count: { users: number };
}

export function AdminPrincipalTab({ users, students, teachers, pending, blocked }: {
  users: UserRow[]; students: UserRow[]; teachers: UserRow[]; pending: UserRow[]; blocked: UserRow[];
}) {
  const [activeSection, setActiveSection] = useState<"overview" | "settings" | "courses" | "batches" | "staff" | "wellbeing">("overview");
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [batches, setBatches] = useState<BatchWithTeachers[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings form state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, batchRes] = await Promise.allSettled([
        api.get<{ institutions: Institution[] }>("/api/institutions"),
        api.get<{ batches: BatchWithTeachers[] }>("/api/batches"),
      ]);
      if (instRes.status === "fulfilled" && instRes.value.institutions?.[0]) {
        setInstitution(instRes.value.institutions[0]);
        setEditName(instRes.value.institutions[0].name);
        setEditEmail(instRes.value.institutions[0].contactEmail);
        setEditLogo(instRes.value.institutions[0].logoUrl || "");
      }
      if (batchRes.status === "fulfilled") setBatches(batchRes.value.batches || []);
    } catch { /* non-blocking */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    if (!institution) return;
    setSaving(true);
    try {
      await api.patch(`/api/institutions/${institution.id}`, {
        name: editName,
        contactEmail: editEmail,
        logoUrl: editLogo || null,
      });
      setShowEditForm(false);
      load();
    } catch { /* non-blocking */ }
    finally { setSaving(false); }
  };

  const duplicateBatch = async (batchId: string) => {
    const name = prompt("New batch name:");
    if (!name) return;
    const startDate = prompt("Start date (YYYY-MM-DD):");
    try {
      await api.post(`/api/batches/${batchId}/duplicate`, { name, startDate });
      load();
    } catch { /* non-blocking */ }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const sections = [
    { key: "overview" as const, label: "Overview", icon: Building2 },
    { key: "settings" as const, label: "Settings", icon: SettingsIcon },
    { key: "courses" as const, label: "Courses", icon: BookOpen },
    { key: "batches" as const, label: "Batches", icon: Layers },
    { key: "staff" as const, label: "Staff", icon: Users },
    { key: "wellbeing" as const, label: "Wellbeing", icon: ShieldAlert },
  ];

  return (
    <div className="space-y-4">
      {/* Institution header with logo */}
      {institution && (
        <Card className="border-primary/30 bg-card">
          <CardContent className="flex items-center gap-4 p-4">
            {institution.logoUrl ? (
              <img src={institution.logoUrl} alt={institution.name} className="h-12 w-12 object-contain rounded-lg border border-border" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">{institution.name}</h2>
              <p className="text-xs text-muted-foreground">{institution.contactEmail}</p>
            </div>
            <Button onClick={() => setShowEditForm(!showEditForm)} variant="outline" size="sm" className="text-xs">
              <SettingsIcon className="h-3 w-3" /> Edit
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Settings edit form */}
      {showEditForm && institution && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Institution Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Institution Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-muted border-border mt-1" />
            </div>
            <div>
              <Label className="text-xs">Contact Email</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="bg-muted border-border mt-1" />
            </div>
            <div>
              <Label className="text-xs">Logo URL</Label>
              <Input value={editLogo} onChange={(e) => setEditLogo(e.target.value)} className="bg-muted border-border mt-1" placeholder="https://..." />
              {editLogo && <img src={editLogo} alt="Logo preview" className="h-10 w-10 object-contain mt-2 rounded border border-border" />}
            </div>
            <div className="flex gap-2">
              <Button onClick={saveSettings} disabled={saving} size="sm" className="bg-primary text-primary-foreground">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
              </Button>
              <Button onClick={() => setShowEditForm(false)} variant="outline" size="sm">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <Button key={s.key} onClick={() => setActiveSection(s.key)}
              variant={activeSection === s.key ? "default" : "outline"}
              className={activeSection === s.key ? "bg-primary text-primary-foreground text-xs" : "border-border text-xs"}
              size="sm"
            >
              <Icon className="h-3 w-3" /> {s.label}
            </Button>
          );
        })}
      </div>

      {/* === OVERVIEW === */}
      {activeSection === "overview" && (
        <div className="space-y-4">
          {/* Enrollment funnel */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" /> Enrollment Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: "Total", count: users.length, color: "bg-blue-500" },
                  { label: "Pending", count: pending.length, color: "bg-amber-500" },
                  { label: "Students", count: students.length, color: "bg-emerald-500" },
                  { label: "Teachers", count: teachers.length, color: "bg-violet-500" },
                  { label: "Blocked", count: blocked.length, color: "bg-red-500" },
                ].map((stage, i, arr) => (
                  <div key={stage.label} className="flex items-center gap-2">
                    <div className={`rounded-lg ${stage.color} text-white px-4 py-2 text-center min-w-[80px]`}>
                      <div className="text-xl font-bold">{stage.count}</div>
                      <div className="text-[9px] opacity-90">{stage.label}</div>
                    </div>
                    {i < arr.length - 1 && <span className="text-muted-foreground text-lg">→</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border bg-card"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Students</span></div>
              <p className="text-2xl font-bold text-foreground">{students.length}</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><UserCheck className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Teachers</span></div>
              <p className="text-2xl font-bold text-foreground">{teachers.length}</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><BookOpen className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Courses</span></div>
              <p className="text-2xl font-bold text-foreground">{institution?._count?.courses ?? 0}</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Layers className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Batches</span></div>
              <p className="text-2xl font-bold text-foreground">{batches.length}</p>
            </CardContent></Card>
          </div>

          {/* Student progress distribution */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Student Progress Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active students yet.</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    // LO-2 fix: was hardcoded 6 weeks — now uses dynamic max week from student data
                    const maxWeek = Math.max(...students.map(s => s.currentWeek || 1), 6);
                    const weekBuckets: Record<string, number> = {};
                    for (const s of students) {
                      const third = Math.ceil((s.currentWeek || 1) / Math.max(Math.ceil(maxWeek / 3), 1));
                      const bucket = third <= 1 ? "Early (Onboarding)" : third === 2 ? "Mid-course" : "Late (Final stretch)";
                      weekBuckets[bucket] = (weekBuckets[bucket] || 0) + 1;
                    }
                    return Object.entries(weekBuckets).map(([bucket, count]) => (
                      <div key={bucket} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{bucket}</span>
                        <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                          <div className="h-full bg-primary flex items-center justify-end px-2" style={{ width: `${(count / students.length) * 100}%` }}>
                            <span className="text-[10px] text-primary-foreground font-bold">{count}</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* === SETTINGS === */}
      {activeSection === "settings" && institution && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><SettingsIcon className="h-4 w-4 text-primary" /> Institution Settings</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Manage your institution profile, branding, and contact information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Institution Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-muted border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs">Contact Email</Label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="bg-muted border-border mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Logo URL</Label>
              <Input value={editLogo} onChange={(e) => setEditLogo(e.target.value)} className="bg-muted border-border mt-1" placeholder="https://example.com/logo.png" />
              <p className="text-[10px] text-muted-foreground mt-1">Hosted image URL. Recommended size: 256x256px, transparent background.</p>
              {editLogo && <img src={editLogo} alt="Logo preview" className="h-16 w-16 object-contain mt-2 rounded-lg border border-border" />}
            </div>
            <Button onClick={saveSettings} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* === COURSES === */}
      {activeSection === "courses" && (
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Courses</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Manage course outlines for your institution.</CardDescription>
              </div>
              <a href="/app?view=course-planner" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground">
                <Plus className="h-3 w-3" /> New Course
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Course management is handled via the Course Planner. Click &quot;New Course&quot; to create or edit course outlines, assign them to batches, and generate AI-powered curriculum.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/app?view=course-planner" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70">
                <BookOpen className="h-3 w-3" /> Open Course Planner
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === BATCHES === */}
      {activeSection === "batches" && (
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Batches</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Manage intakes. Duplicate a batch to start a new rolling-admission intake with the same course + teachers.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No batches yet. Create one from the Course Planner.</p>
            ) : (
              batches.map(batch => (
                <div key={batch.id} className="rounded-lg border border-border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{batch.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[9px]">{batch.deliveryMode}</Badge>
                      {batch.course && <Badge variant="outline" className="text-[9px] bg-primary/5">{batch.course.name}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{batch._count?.users ?? 0} students</span>
                      {batch.startDate && <span className="text-[10px] text-muted-foreground">Starts: {new Date(batch.startDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button onClick={() => duplicateBatch(batch.id)} variant="outline" size="sm" className="text-[10px] h-7" title="Duplicate this batch (new intake)">
                      <Copy className="h-3 w-3" /> Duplicate
                    </Button>
                    <a href={`/app?view=course-planner`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-muted text-muted-foreground hover:bg-muted/70 h-7">
                      <Users className="h-3 w-3" /> Manage
                    </a>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* === STAFF === */}
      {activeSection === "staff" && (
        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Staff Overview</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Teachers, counselors, and coordinators in your institution.</CardDescription>
            </CardHeader>
            <CardContent>
              {teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No staff members yet. Approve pending users or assign roles from the Users tab.</p>
              ) : (
                <div className="space-y-2">
                  {teachers.map(t => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">{t.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] capitalize">{t.role.replace("_", " ")}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Teacher behavior monitoring */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Teacher AI Assistant Usage</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Monitor how your staff uses the AI Assistant.</CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/app?view=admin-system" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70">
                <Activity className="h-3 w-3" /> View Teacher Behavior Tab
              </a>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === WELLBEING === */}
      {activeSection === "wellbeing" && (
        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" /> Student Wellbeing Overview</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Institution-wide view of student health signals and alerts.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-emerald-600">{students.filter(s => !s.needsAttention).length}</p>
                  <p className="text-[10px] text-muted-foreground">On Track</p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-amber-600">{students.filter(s => s.needsAttention).length}</p>
                  <p className="text-[10px] text-muted-foreground">Need Attention</p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
                  <Ban className="h-5 w-5 text-red-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-red-600">{blocked.length}</p>
                  <p className="text-[10px] text-muted-foreground">Blocked</p>
                </div>
              </div>
              <div className="mt-3">
                <a href="/app?view=admin-system" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground">
                  <ShieldAlert className="h-3 w-3" /> Run Struggle Detection
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Students needing attention */}
          {students.filter(s => s.needsAttention).length > 0 && (
            <Card className="border-amber-500/30 bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Students Needing Attention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {students.filter(s => s.needsAttention).slice(0, 10).map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.attentionReasons?.join(", ") || "Needs attention"}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600">Attention score: {s.attentionScore ?? 0}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
