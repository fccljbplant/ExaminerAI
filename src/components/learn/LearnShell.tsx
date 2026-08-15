"use client";

// src/components/learn/LearnShell.tsx — h-screen session shell for /learn/[courseId].
// Status strip + activity bar + slide canvas + chat pane + slide-over panels.

import { useEffect, useState, useCallback, useRef } from "react";
import { logger } from "@/lib/logger";
import { api, AI_TIMEOUT_MS, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import {
 Map as MapIcon, Target, TrendingUp, BookOpen, Sparkles, Flame, Star,
 ChevronRight, ChevronLeft, Send, Loader2, Volume2, VolumeX, Focus,
 X, GraduationCap, MessageSquare, StickyNote, CheckCircle2, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tutor } from "@/modules/learn/lib/tutor-bus";
import { prepareForTTS, speakTTS, stopTTS } from "@/modules/learn/lib/tts-filter";
import type { SlideData, TopicContext } from "@/modules/learn/types";
import { JourneyPanel } from "@/components/learn/panels/JourneyPanel";
import { ProjectPanel } from "@/components/learn/panels/ProjectPanel";
import { GrowPanel } from "@/components/learn/panels/GrowPanel";
import { LibraryPanel } from "@/components/learn/panels/LibraryPanel";

interface NowData {
 nextStep: { label: string; kind: string; week: number | null; day: number | null; slidesViewed: number; totalSlides: number };
 profile: { totalXP: number; learnerLevel: string; streakCurrent: number };
 dailyTest: { status: string };
 project: { id: string; title: string; activeMilestone: { id: string; title: string } | null } | null;
}

interface TodayData {
 topic: TopicContext;
 slidesViewed: number;
 totalSlides: number;
 completed: boolean;
 resourcesShown: boolean;
 nextTopic: { week: number; day: number } | null;
 prevTopic: { week: number; day: number } | null;
 isLastTopicInCourse: boolean;
 slides: SlideData[];
 courseCompleted?: boolean;
}

interface ChatMessage {
 id: string;
 role: "tutor" | "student";
 content: string;
 citation?: string | null;
}

type PanelKey = "journey" | "project" | "grow" | "library";

interface Props {
 courseId: string;
 courseName: string;
}

/** Helper: speak text via the avatar with TTS, syncing lip-sync gestures. */
function useSpeakWithAvatar(ttsOn: boolean) {
 return useCallback((text: string) => {
 if (!text) return;
 tutor.caption(text);
 tutor.emit("tts", "start");
 if (ttsOn) {
 speakTTS(prepareForTTS(text));
 }
 // Approximate duration: ~55ms per character, capped at 9s.
 const estimated = Math.min(9000, Math.max(2000, text.length * 55));
 setTimeout(() => tutor.emit("tts:end"), estimated);
 }, [ttsOn]);
}

export function LearnShell({ courseId, courseName }: Props) {
 // ── State ─────────────────────────────────────────────────────────
 const [now, setNow] = useState<NowData | null>(null);
 const [today, setToday] = useState<TodayData | null>(null);
 const [slides, setSlides] = useState<SlideData[]>([]);
 const [slideIdx, setSlideIdx] = useState(0);
 const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
 const [ttsOn, setTtsOn] = useState(true);
 const [focusMode, setFocusMode] = useState(false);
 const [sessionId, setSessionId] = useState<string | null>(null);
 const [messages, setMessages] = useState<ChatMessage[]>([]);
 const [chatInput, setChatInput] = useState("");
 const [chatLoading, setChatLoading] = useState(false);
 const [loadingSlide, setLoadingSlide] = useState(false);
 const [completing, setCompleting] = useState(false);
 const [topicComplete, setTopicComplete] = useState(false);
 const [showCoachMarks, setShowCoachMarks] = useState(false);
 const transcriptRef = useRef<HTMLDivElement>(null);

 const speakWithAvatar = useSpeakWithAvatar(ttsOn);

 // ── Focus mode sync ───────────────────────────────────────────────
 useEffect(() => {
 if (focusMode) document.body.dataset.focus = "on";
 else delete document.body.dataset.focus;
 }, [focusMode]);

 // ── Coach marks (first visit) ─────────────────────────────────────
 useEffect(() => {
 try {
 const seen = localStorage.getItem(`learn-coach-${courseId}`);
 if (!seen) {
 setShowCoachMarks(true);
 localStorage.setItem(`learn-coach-${courseId}`, "1");
 }
 } catch (err) {
 // localStorage may throw in private browsing mode — non-fatal.
 logger.warn("Coach-marks localStorage check failed", { err });
 }
 }, [courseId]);

 // ── Fetchers ──────────────────────────────────────────────────────
 const fetchNow = useCallback(async () => {
 try {
 const res = await api.get<{ data: NowData }>(`/api/learn/now?courseId=${courseId}`);
 setNow(res.data);
 } catch (e) {
 if (e instanceof ApiError && e.status === 401) {
 // Token expired or invalid — redirect to login.
 window.location.href = "/login";
 return;
 }
 toast.error("Couldn't load your progress", { description: e instanceof Error ? e.message : undefined });
 }
 }, [courseId]);

 const fetchToday = useCallback(async () => {
 try {
 const res = await api.get<{ data: TodayData }>(`/api/learn/today?courseId=${courseId}`);
 const data = res.data;
 setToday(data);
 setSlides(data.slides ?? []);
 setSlideIdx(Math.max(0, (data.slides?.length ?? 1) - 1));
 setTopicComplete(false);
 } catch (e) {
 if (e instanceof ApiError && e.status === 401) {
 window.location.href = "/login";
 return;
 }
 toast.error("Couldn't load today's topic", { description: e instanceof Error ? e.message : undefined });
 }
 }, [courseId]);

 const fetchSession = useCallback(async () => {
 try {
 const res = await api.post<{ data: { sessionId: string } }>(
 `/api/learn/sessions?courseId=${courseId}`,
 );
 setSessionId(res.data.sessionId);
 // Seed an initial tutor greeting.
 setMessages([{
 id: `m-${Date.now()}`,
 role: "tutor",
 content: `Hi! I'm your AI tutor for ${courseName}. Ask me anything about today's topic, or click "Next Slide" to start learning.`,
 }]);
 } catch (e) {
 if (e instanceof ApiError && e.status === 401) {
 window.location.href = "/login";
 return;
 }
 toast.error("Couldn't start tutor session", { description: e instanceof Error ? e.message : undefined });
 }
 }, [courseId, courseName]);

 // ── Mount ─────────────────────────────────────────────────────────
 useEffect(() => {
 fetchNow();
 fetchToday();
 fetchSession();
 // Welcome wave.
 tutor.play("hello");
 const t = setTimeout(() => {
 speakWithAvatar("Welcome back. Let's pick up where you left off.");
 }, 800);
 return () => {
 clearTimeout(t);
 stopTTS();
 tutor.emit("tts", "end");
 };
 }, [courseId, fetchNow, fetchToday, fetchSession, speakWithAvatar]);

 // ── Auto-scroll transcript ────────────────────────────────────────
 useEffect(() => {
 if (transcriptRef.current) {
 transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
 }
 }, [messages]);

 // ── Handlers ──────────────────────────────────────────────────────
 async function handleNextSlide() {
 if (loadingSlide || topicComplete) return;
 setLoadingSlide(true);
 try {
 const res = await api.post<{
 data: {
 slide: SlideData;
 narration: string;
 message: string;
 slideNumber: number;
 totalSlides: number;
 isLastSlide: boolean;
 slidesViewed: number;
 } | { topicComplete: true; resources: { label: string; url: string }[]; message: string };
 }>(`/api/learn/today/next-slide?courseId=${courseId}`, {}, AI_TIMEOUT_MS);

 if ("topicComplete" in res.data) {
 setTopicComplete(true);
 tutor.play("cheer");
 speakWithAvatar("You've completed all the slides for this topic. Take a look at the resources, then mark the topic complete to advance.");
 fetchNow();
 return;
 }

 const { slide, narration, message } = res.data;
 setSlides(prev => [...prev, slide]);
 setSlideIdx(prev => prev + 1);
 tutor.play("idea");
 speakWithAvatar(narration || message);
 fetchNow();
 } catch (e) {
 toast.error("Couldn't generate the next slide", { description: e instanceof Error ? e.message : undefined });
 } finally {
 setLoadingSlide(false);
 }
 }

 async function handleCompleteTopic() {
 if (completing) return;
 setCompleting(true);
 try {
 const res = await api.post<{
 data: {
 completedTopic: { week: number; day: number };
 nextTopic: { week: number; day: number } | null;
 xpAwarded: number;
 courseCompleted: boolean;
 };
 }>(`/api/learn/today/complete?courseId=${courseId}`);
 const { nextTopic, xpAwarded, courseCompleted } = res.data;
 if (courseCompleted) {
 tutor.play("levelup");
 speakWithAvatar("Congratulations! You've finished the entire course. That's a huge achievement.");
 toast.success("Course complete!", { description: `+${xpAwarded} XP` });
 } else if (nextTopic) {
 tutor.play("cheer");
 speakWithAvatar(`Topic complete. Plus ${xpAwarded} XP. Onto the next topic!`);
 toast.success("Topic complete", { description: `+${xpAwarded} XP` });
 }
 // Refetch everything for the new topic.
 await fetchToday();
 await fetchNow();
 } catch (e) {
 toast.error("Couldn't complete the topic", { description: e instanceof Error ? e.message : undefined });
 } finally {
 setCompleting(false);
 }
 }

 async function handleAsk() {
 if (!sessionId || !chatInput.trim() || chatLoading) return;
 const q = chatInput.trim();
 setChatInput("");
 setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "student", content: q }]);
 setChatLoading(true);
 tutor.play("think");
 try {
 const res = await api.post<{ data: { answer: string; citation: string | null } }>(
 `/api/learn/sessions/${sessionId}/ask`,
 { question: q },
 AI_TIMEOUT_MS,
 );
 setMessages(prev => [...prev, {
 id: `t-${Date.now()}`,
 role: "tutor",
 content: res.data.answer,
 citation: res.data.citation,
 }]);
 tutor.play("idea");
 speakWithAvatar(res.data.answer);
 } catch (e) {
 const msg = e instanceof Error ? e.message : "Couldn't reach the tutor.";
 setMessages(prev => [...prev, {
 id: `t-${Date.now()}`,
 role: "tutor",
 content: `I'm sorry — I couldn't generate an answer just now. ${msg}`,
 }]);
 } finally {
 setChatLoading(false);
 }
 }

 function toggleTTS() {
 setTtsOn(prev => {
 const next = !prev;
 if (!next) stopTTS();
 toast.success(next ? "Voice on" : "Voice off");
 return next;
 });
 }

 function jumpToSlide(idx: number) {
 setSlideIdx(idx);
 tutor.play("slide:highlight");
 }

 // ── Render ────────────────────────────────────────────────────────
 const currentSlide = slides[slideIdx];
 const isFirstSlide = slideIdx === 0 && slides.length > 0;
 const isLastSlideOfTopic = slideIdx >= slides.length - 1 && slides.length > 0;
 const allSlidesGenerated = slides.length >= (today?.totalSlides ?? 4);

 return (
 <div className="h-screen overflow-hidden flex flex-col bg-background text-foreground">

 {/* ── Status strip ─────────────────────────────────────────── */}
 <header className="h-12 border-b flex items-center gap-2 px-3 flex-shrink-0 bg-card">
 {/* Today's Topic breadcrumb chip */}
 <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium">
 <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
 <span className="text-primary">
 {today
 ? `W${today.topic.week} D${today.topic.day}: ${today.topic.title}`
 : "Loading…"}
 </span>
 </div>

 {/* XP chip */}
 {now && (
 <div className="inline-flex items-center gap-1.5 rounded-full bg-growth-amber/10 px-3 py-1 text-xs font-medium text-growth-amber dark:text-growth-amber">
 <Star className="h-3 w-3" />
 {now.profile.totalXP} XP
 </div>
 )}

 {/* Streak chip */}
 {now && (
 <div className="inline-flex items-center gap-1.5 rounded-full bg-growth-amber/10 px-3 py-1 text-xs font-medium text-growth-amber dark:text-growth-amber">
 <Flame className="h-3 w-3" />
 {now.profile.streakCurrent}d streak
 </div>
 )}

 {/* Level chip */}
 {now && (
 <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
 <GraduationCap className="h-3 w-3" />
 {now.profile.learnerLevel}
 </div>
 )}

 <div className="ml-auto flex items-center gap-2">
 <button
 onClick={() => setFocusMode(f => !f)}
 className={cn(
 "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
 focusMode ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
 )}
 title="Focus mode dims the tutor and the chat for distraction-free reading."
 >
 <Focus className="h-3.5 w-3.5" />
 Focus
 </button>
 <a
 href="/learn"
 className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
 title="Back to /learn"
 >
 <X className="h-3.5 w-3.5" />
 Exit
 </a>
 </div>
 </header>

 {/* ── Main area ────────────────────────────────────────────── */}
 <div className="flex-1 flex overflow-hidden">
 {/* Activity Bar (left, 72px) */}
 <nav className="w-[72px] border-r flex flex-col items-center py-3 gap-1.5 flex-shrink-0 bg-card">
 <ActivityBarButton icon={MapIcon} label="Journey" active={activePanel === "journey"} onClick={() => setActivePanel(activePanel === "journey" ? null : "journey")} />
 <ActivityBarButton icon={Target} label="Project" active={activePanel === "project"} onClick={() => setActivePanel(activePanel === "project" ? null : "project")} />
 <ActivityBarButton icon={TrendingUp} label="Grow" active={activePanel === "grow"} onClick={() => setActivePanel(activePanel === "grow" ? null : "grow")} />
 <ActivityBarButton icon={BookOpen} label="Library" active={activePanel === "library"} onClick={() => setActivePanel(activePanel === "library" ? null : "library")} />
 <div className="flex-1" />
 {/* Daily-test quick badge */}
 {now?.dailyTest.status === "in_progress" && (
 <div className="text-[9px] text-center text-growth-amber font-medium px-1">test<br/>open</div>
 )}
 </nav>

 {/* Slide Canvas (center) */}
 <main className="flex-1 flex flex-col overflow-hidden">
 <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl w-full mx-auto">
 {!today && (
 <div className="flex items-center justify-center h-full">
 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
 </div>
 )}

 {today && today.courseCompleted && (
 <div className="text-center py-20">
 <CheckCircle2 className="h-12 w-12 mx-auto text-growth-sage" />
 <h1 className="mt-4 text-2xl font-bold">Course complete</h1>
 <p className="text-muted-foreground mt-2">You've finished every topic. Browse the Library for resources or start a new course.</p>
 </div>
 )}

 {today && !today.courseCompleted && (
 <>
 {/* Today's topic banner */}
 <div className="mb-4">
 <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
 Week {today.topic.week} Day {today.topic.day} · {today.topic.phase}
 </div>
 <h1 className="text-2xl font-bold leading-tight">{today.topic.title}</h1>
 <p className="text-sm text-muted-foreground mt-1">{today.topic.objective}</p>
 </div>

 {/* Slide progress dots */}
 <div className="flex items-center gap-1.5 mb-5">
 {Array.from({ length: today.totalSlides }).map((_, i) => {
 const generated = i < slides.length;
 const isCurrent = i === slideIdx && generated;
 return (
 <button
 key={i}
 onClick={() => generated && jumpToSlide(i)}
 disabled={!generated}
 className={cn(
 "h-1.5 rounded-full transition-all",
 isCurrent ? "w-8 bg-primary" : generated ? "w-6 bg-primary/60 hover:bg-primary/80" : "w-6 bg-muted cursor-not-allowed",
 )}
 title={`Slide ${i + 1}${generated ? "" : " (not generated yet)"}`}
 />
 );
 })}
 <span className="ml-2 text-[10px] text-muted-foreground">
 {slides.length} / {today.totalSlides} prepared
 </span>
 </div>

 {/* Slide content */}
 {currentSlide ? (
 <article className="space-y-4">
 <div className="text-[11px] font-medium text-muted-foreground">Slide {slideIdx + 1}</div>
 <h2 className="text-xl font-semibold leading-tight">{currentSlide.title}</h2>

 {currentSlide.bullets.length > 0 && (
 <ul className="space-y-2">
 {currentSlide.bullets.map((b, i) => (
 <li key={i} className="flex gap-2 text-sm leading-relaxed">
 <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
 <span>{b}</span>
 </li>
 ))}
 </ul>
 )}

 {currentSlide.keyTerms.length > 0 && (
 <div className="flex flex-wrap gap-1.5">
 {currentSlide.keyTerms.map((t, i) => (
 <span key={i} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{t}</span>
 ))}
 </div>
 )}

 {currentSlide.analogy && (
 <div className="rounded-md border-l-4 border-growth-amber bg-growth-amber dark:bg-growth-amber/30 p-3 text-sm">
 <div className="text-[10px] font-semibold uppercase tracking-wide text-growth-amber dark:text-growth-amber mb-1">Analogy</div>
 <p className="leading-relaxed">{currentSlide.analogy}</p>
 </div>
 )}

 {currentSlide.realWorldExample && (
 <div className="rounded-md border-l-4 border-growth-sage bg-growth-sage dark:bg-growth-sage/30 p-3 text-sm">
 <div className="text-[10px] font-semibold uppercase tracking-wide text-growth-sage dark:text-growth-sage mb-1">Real-world example</div>
 <p className="leading-relaxed">{currentSlide.realWorldExample}</p>
 </div>
 )}

 {currentSlide.checkQuestion && (
 <div className="rounded-md border p-3 text-sm">
 <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Check your understanding</div>
 <p className="font-medium">{currentSlide.checkQuestion}</p>
 <p className="text-xs text-muted-foreground mt-1">Tip: ask the tutor (right pane) to evaluate your answer.</p>
 </div>
 )}
 </article>
 ) : (
 <div className="text-center py-16 rounded-lg border-2 border-dashed">
 <Sparkles className="h-8 w-8 mx-auto text-primary" />
 <p className="mt-3 text-sm font-medium">Ready to start learning</p>
 <p className="text-xs text-muted-foreground mt-1">Click "Next Slide" below and I'll teach this topic to you, one slide at a time.</p>
 </div>
 )}

 {/* Topic-complete resources panel */}
 {topicComplete && (
 <div className="mt-6 rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
 <div className="flex items-center gap-2 mb-2">
 <ListChecks className="h-4 w-4 text-primary" />
 <h3 className="font-semibold">Topic resources</h3>
 </div>
 <p className="text-sm text-muted-foreground mb-3">Review these before moving on. The next topic builds on what you learned here.</p>
 <ul className="space-y-1.5">
 {today.topic.resources.map((r, i) => (
 <li key={i}>
 <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
 → {r.label}
 </a>
 </li>
 ))}
 </ul>
 </div>
 )}
 </>
 )}
 </div>

 {/* Quick Bar */}
 <div className="h-16 border-t flex items-center gap-2 px-4 flex-shrink-0 bg-card">
 <button
 onClick={() => jumpToSlide(Math.max(0, slideIdx - 1))}
 disabled={isFirstSlide || slides.length === 0}
 className="inline-flex items-center justify-center h-9 w-9 rounded-md border disabled:opacity-40 hover:bg-muted"
 title="Previous slide"
 >
 <ChevronLeft className="h-4 w-4" />
 </button>

 {/* Contextual CTA */}
 {topicComplete ? (
 <button
 onClick={handleCompleteTopic}
 disabled={completing}
 className="inline-flex items-center gap-2 rounded-md bg-growth-sage px-4 py-2 text-sm font-medium text-white hover:bg-growth-sage disabled:opacity-50"
 >
 {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
 {today?.isLastTopicInCourse ? "Complete course" : "Complete & next topic"}
 </button>
 ) : allSlidesGenerated ? (
 <button
 onClick={handleCompleteTopic}
 disabled={completing}
 className="inline-flex items-center gap-2 rounded-md bg-growth-sage px-4 py-2 text-sm font-medium text-white hover:bg-growth-sage disabled:opacity-50"
 >
 {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
 {today?.isLastTopicInCourse ? "Complete course" : "Complete & next topic"}
 </button>
 ) : (
 <button
 onClick={handleNextSlide}
 disabled={loadingSlide}
 className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {loadingSlide ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
 {slides.length === 0 ? "Start learning" : isLastSlideOfTopic ? "Generate final slide" : "Next slide"}
 </button>
 )}

 <button
 onClick={() => jumpToSlide(Math.min(slides.length - 1, slideIdx + 1))}
 disabled={isLastSlideOfTopic || slides.length === 0}
 className="inline-flex items-center justify-center h-9 w-9 rounded-md border disabled:opacity-40 hover:bg-muted"
 title="Next slide"
 >
 <ChevronRight className="h-4 w-4" />
 </button>

 <div className="ml-auto flex items-center gap-2">
 <button
 onClick={() => { setChatInput(currentSlide?.checkQuestion ?? ""); document.getElementById("chat-input")?.focus(); }}
 className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
 title="Ask the AI tutor about this slide"
 >
 <MessageSquare className="h-3.5 w-3.5" /> Ask AI
 </button>
 <button
 onClick={() => setActivePanel("library")}
 className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
 title="Open the Library panel"
 >
 <StickyNote className="h-3.5 w-3.5" /> Notes
 </button>
 </div>
 </div>
 </main>

 {/* Chat Pane (right) */}
 <aside className={cn(
 "w-80 border-l flex-col flex-shrink-0 bg-card transition-opacity",
 focusMode ? "hidden lg:flex opacity-40 hover:opacity-100" : "flex",
 )}>
 {/* Chat header */}
 <div className="h-12 border-b flex items-center gap-2 px-3 flex-shrink-0">
 <Sparkles className="h-4 w-4 text-primary" />
 <span className="text-sm font-semibold">AI Tutor</span>
 <span className="text-[10px] text-muted-foreground">· {courseName}</span>
 <button
 onClick={toggleTTS}
 className="ml-auto inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted"
 title={ttsOn ? "Mute voice" : "Unmute voice"}
 >
 {ttsOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
 </button>
 </div>

 {/* Transcript */}
 <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3 space-y-3">
 {messages.map(m => (
 <div key={m.id} className={cn("flex flex-col gap-1", m.role === "student" ? "items-end" : "items-start")}>
 <div className={cn(
 "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
 m.role === "student"
 ? "bg-primary text-primary-foreground"
 : "bg-muted text-foreground",
 )}>
 <p className="whitespace-pre-wrap">{m.content}</p>
 {m.citation && (
 <p className="mt-1.5 text-[10px] opacity-70 font-mono">{m.citation}</p>
 )}
 </div>
 </div>
 ))}
 {chatLoading && (
 <div className="flex items-start">
 <div className="bg-muted rounded-lg px-3 py-2 text-sm">
 <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" />
 Thinking…
 </div>
 </div>
 )}
 </div>

 {/* Input */}
 <div className="border-t p-3 flex-shrink-0">
 <div className="flex items-end gap-2">
 <textarea
 id="chat-input"
 value={chatInput}
 onChange={e => setChatInput(e.target.value)}
 onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
 placeholder="Ask about today's topic…"
 rows={1}
 className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-32"
 maxLength={2000}
 />
 <button
 onClick={handleAsk}
 disabled={!chatInput.trim() || chatLoading}
 className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 <Send className="h-4 w-4" />
 </button>
 </div>
 <p className="mt-1 text-[10px] text-muted-foreground">Enter to send · Shift+Enter for newline</p>
 </div>
 </aside>
 </div>

 {/* ── Panel drawer (slide-over) ────────────────────────────── */}
 {activePanel && (
 <div className="fixed inset-0 z-[var(--p-z-drawer)] flex">
 {/* Backdrop */}
 <div
 className="absolute inset-0 bg-black/30"
 onClick={() => setActivePanel(null)}
 />
 {/* Drawer */}
 <div className="relative z-10 w-full sm:w-[480px] max-w-full bg-background border-r shadow-xl flex flex-col animate-in slide-in-from-left">
 <div className="h-12 border-b flex items-center justify-between px-4 flex-shrink-0">
 <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
 {activePanel}
 </h2>
 <button
 onClick={() => setActivePanel(null)}
 className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 <div className="flex-1 overflow-hidden">
 {activePanel === "journey" && (
 <JourneyPanel courseId={courseId} onClose={() => setActivePanel(null)} />
 )}
 {activePanel === "project" && (
 <ProjectPanel courseId={courseId} onMilestoneComplete={fetchNow} />
 )}
 {activePanel === "grow" && (
 <GrowPanel
 courseId={courseId}
 xpTotal={now?.profile.totalXP ?? 0}
 learnerLevel={now?.profile.learnerLevel ?? "Rookie"}
 streak={now?.profile.streakCurrent ?? 0}
 onXPChange={fetchNow}
 />
 )}
 {activePanel === "library" && (
 <LibraryPanel
 courseId={courseId}
 slideId={null}
 />
 )}
 </div>
 </div>
 </div>
 )}

 {/* ── Coach marks (first visit) ───────────────────────────── */}
 {showCoachMarks && (
 <CoachMarks onClose={() => setShowCoachMarks(false)} />
 )}
 </div>
 );
}

// ── Sub-components ────────────────────────────────────────────────

function ActivityBarButton({
 icon: Icon, label, active, onClick,
}: {
 icon: React.ComponentType<{ className?: string }>;
 label: string;
 active: boolean;
 onClick: () => void;
}) {
 return (
 <button
 onClick={onClick}
 title={label}
 className={cn(
 "w-14 h-14 rounded-md flex flex-col items-center justify-center gap-1 transition-colors",
 active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
 )}
 >
 <Icon className="h-5 w-5" />
 <span className="text-[10px] font-medium">{label}</span>
 </button>
 );
}

function CoachMarks({ onClose }: { onClose: () => void }) {
 return (
 <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4">
 <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6">
 <div className="flex items-center gap-2 mb-3">
 <Sparkles className="h-5 w-5 text-primary" />
 <h3 className="text-lg font-semibold">Welcome to your learning session</h3>
 </div>
 <ul className="space-y-2 text-sm text-muted-foreground">
 <li className="flex gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" /> The <b>left rail</b> opens your journey, project, daily test, and notes.</li>
 <li className="flex gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" /> The <b>center canvas</b> shows today's slides. Click <b>Next Slide</b> to learn one idea at a time.</li>
 <li className="flex gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" /> The <b>right pane</b> is your AI tutor — ask anything about the current topic.</li>
 <li className="flex gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" /> The <b>floating tutor</b> (bottom-right) narrates each slide. Click it to mute or move it.</li>
 <li className="flex gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" /> Use <b>Focus mode</b> (top-right) to dim distractions while you read.</li>
 </ul>
 <button
 onClick={onClose}
 className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Got it
 </button>
 </div>
 </div>
 );
}
