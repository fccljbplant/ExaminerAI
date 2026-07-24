"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  CalendarCheck, ClipboardList, HelpCircle, TrendingUp, FileText,
  Loader2, Send, CheckCircle2, Circle, AlertTriangle, Sparkles, Brain, AlertCircle, RefreshCw,
  Sun, Moon, Monitor, Plus, Edit3, Save, Trash2, X, BookOpen, ArrowLeft, MessageSquare,
  ChevronDown, ChevronRight, Bot, ShieldAlert, Award, ExternalLink,
} from "lucide-react";
import { redirectToView } from "@/components/examiner/student/shared";

export function CourseOutlineRedirect() {
  useEffect(() => { redirectToView("course-outline"); }, []);
  return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}
