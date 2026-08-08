"use client";
// src/components/examiner/admin/OrgCourseAssigner.tsx
// Inline course assignment widget for the OrgAdminDashboard.
// Lets org admins assign marketplace courses to their team members.

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, UserPlus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  user: { id: string; name: string; email: string };
}

interface Course {
  id: string;
  name: string;
}

export function OrgCourseAssigner({ members }: { members: Member[] }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ courses: Course[] }>("/api/courses?published=true&pageSize=100")
      .then((res) => setCourses(res.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  const assign = async () => {
    if (!selectedMember || !selectedCourse) return;
    setBusy(true);
    try {
      await api.post("/api/org/assign-course", {
        userId: selectedMember,
        courseId: selectedCourse,
      });
      const member = members.find(m => m.user.id === selectedMember);
      const course = courses.find(c => c.id === selectedCourse);
      toast.success(`Assigned "${course?.name}" to ${member?.user.name}`);
      setSelectedMember("");
      setSelectedCourse("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to assign course";
      if (msg.includes("409") || msg.includes("Already enrolled")) {
        toast.error("Already enrolled in this course");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No published courses available. Create courses via Course Planner first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Assignment form */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Learner</label>
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger><SelectValue placeholder="Select learner..." /></SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user.id} value={m.user.id}>
                  {m.user.name} ({m.user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Course</label>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={assign} disabled={busy || !selectedMember || !selectedCourse}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Assign
        </Button>
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> {courses.length} courses available
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> {members.length} learners
        </span>
      </div>
    </div>
  );
}
