"use client";

// src/modules/learn/components/classroom/ClassroomShell.tsx — Modern Class session shell.
// h-screen classroom for /learn/[courseId]: PageHeader + activity rail +
// on-stage avatar + lesson stage + tutor chat with voice Q&A.
// Replaces LearnShell — same APIs, new classroom layout.

import { useEffect, useState, useCallback, useRef } from "react";
import { logger } from "@/lib/logger";
import { api, AI_TIMEOUT_MS, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Map as MapIcon, Target, TrendingUp, BookOpen, Sparkles, Flame, Star,
  ChevronRight, ChevronLeft, Send, Loader2, Volume2, VolumeX, Focus,
  X, GraduationCap, MessageSquare, StickyNote, CheckCircle2, ArrowRight, MonitorPlay,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/modules/ui/PageHeader";
import { prepareForTTS, speakTTS, stopTTS, warmVoices } from "@/modules/learn/lib/tts-filter";
import type { SlideData, TopicContext } from "@/modules/learn/types";
import { tutor } from "@/modules/learn/components/avatar/avatar-rig";
import { AvatarStage } from "@/modules/learn/components/avatar/AvatarStage";
import { LessonStage } from "@/modules/learn/components/classroom/LessonStage";
import { VideoStage } from "@/modules/learn/components/classroom/VideoStage";
import { VoiceBar } from "@/modules/learn/components/classroom/VoiceBar";
import type { LessonMedia } from "@/modules/learn/lib/lesson-media";
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
  /** Classroom stage media — video lesson when curated/discovered. */
  media?: LessonMedia;
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

/**
 * Helper: speak text via the avatar with TTS, syncing lip-sync gestures.
 * The callback is STABLE (ttsOn lives in a ref) so toggling the voice
 * never re-runs effects that depend on it — the chat window survives
 * voice on/off (user requirement 2026-08-15).
 */
function useSpeakWithAvatar(ttsOn: boolean) {
  const ttsRef = useRef(ttsOn);
  useEffect(() => {
    ttsRef.current = ttsOn;
  }, [ttsOn]);
  return useCallback((text: string) => {
    if (!text) return;
    tutor.caption(text);
    tutor.emit("tts", "start");
    if (ttsRef.current) {
      speakTTS(prepareForTTS(text));
    }
    // Approximate duration: ~55ms per character, capped at 9s.
    const estimated = Math.min(9000, Math.max(2000, text.length * 55));
    setTimeout(() => tutor.emit("tts:end"), estimated);
  }, []);
}

/**
 * Caption-only narration for SLIDES: the avatar bubble + lip-sync show
 * the content, but slides never speak aloud — only the AI tutor does
 * (user requirement 2026-08-15).
 */
function useCaptionOnly() {
  return useCallback((text: string) => {
    if (!text) return;
    tutor.caption(text);
    tutor.emit("tts", "start");
    const estimated = Math.min(9000, Math.max(2000, text.length * 55));
    setTimeout(() => tutor.emit("tts:end"), estimated);
  }, []);
}

export function ClassroomShell({ courseId, courseName }: Props) {
  // ── State ─────────────────────────────────────────────────────────
  const [now, setNow] = useState<NowData | null>(null);
  const [today, setToday] = useState<TodayData | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  // Sound is OFF by default — learners opt in via the voice toggle
  // (user requirement 2026-08-15).
  const [ttsOn, setTtsOn] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  // xs: chat renders as an overlay sheet — the FAB toggles it.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [loadingSlide, setLoadingSlide] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [topicComplete, setTopicComplete] = useState(false);
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  // Stage: video lesson first (when the topic has one), then slides.
  const [stageMode, setStageMode] = useState<"video" | "slides">("slides");
  const videoIntroRef = useRef<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const speakWithAvatar = useSpeakWithAvatar(ttsOn);
  const captionOnly = useCaptionOnly();
  // Auto-generate the first slide on page load — the learner never sees
  // a "Start learning" generation button (user requirement 2026-08-15).
  const autoStartedRef = useRef(false);

  // Warm the browser voice list on mount so the male-voice picker is
  // ready when the learner opts in (getVoices populates asynchronously).
  useEffect(() => {
    warmVoices();
  }, []);

  // ── Focus mode sync ───────────────────────────────────────────────
  useEffect(() => {
    if (focusMode) document.body.dataset.focus = "on";
    else delete document.body.dataset.focus;
  }, [focusMode]);

  // ── Coach marks (first visit) ─────────────────────────────────────
  useEffect(() => {
    try {
      const seen = localStorage.getItem(`classroom-coach-${courseId}`);
      if (!seen) {
        setShowCoachMarks(true);
        localStorage.setItem(`classroom-coach-${courseId}`, "1");
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
      // Video lesson leads when one exists for the new topic.
      setStageMode(data.media?.kind === "video" ? "video" : "slides");
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
        content: `Hi! I'm your AI tutor for ${courseName}. Ask me anything about today's topic — type below or tap the mic and just speak.`,
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
      speakWithAvatar("Welcome back to class. Let's pick up where you left off.");
    }, 800);
    return () => {
      clearTimeout(t);
      stopTTS();
      tutor.emit("tts", "end");
    };
  }, [courseId, fetchNow, fetchToday, fetchSession, speakWithAvatar]);

  // ── Auto-generate the first slide once the topic is loaded ────────
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!today || slides.length > 0 || topicComplete || loadingSlide) return;
    autoStartedRef.current = true;
    void handleNextSlide();
  }, [today, slides.length, topicComplete, loadingSlide, handleNextSlide]);

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
      captionOnly(narration || message);
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

  /** Send a question to the tutor. Used by both the text input and voice. */
  async function askQuestion(q: string) {
    const question = q.trim();
    if (!sessionId || !question || chatLoading) return;
    setChatInput("");
    setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: "student", content: question }]);
    setChatLoading(true);
    tutor.play("think");
    try {
      const res = await api.post<{ data: { answer: string; citation: string | null } }>(
        `/api/learn/sessions/${sessionId}/ask`,
        { question },
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

  // ── Video lesson ────────────────────────────────────────────────
  // Avatar introduces the video once per topic; recaps when it ends.
  useEffect(() => {
    if (stageMode !== "video" || !today?.media?.video) return;
    const key = `${today.topic.week}-${today.topic.day}`;
    if (videoIntroRef.current === key) return;
    videoIntroRef.current = key;
    speakWithAvatar(`Before the slides, let's watch a short video: ${today.media.video.title}. I'll recap the key points afterwards.`);
  }, [stageMode, today, speakWithAvatar]);

  function handleVideoEnded() {
    setStageMode("slides");
    tutor.play("idea");
    speakWithAvatar(
      today
        ? `That covered the heart of today's topic — ${today.topic.title}. Now let's go through it slide by slide. Ask me anything along the way.`
        : "Now let's go through the slides.",
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  const currentSlide = slides[slideIdx];
  const isFirstSlide = slideIdx === 0 && slides.length > 0;
  const isLastSlideOfTopic = slideIdx >= slides.length - 1 && slides.length > 0;
  const allSlidesGenerated = slides.length >= (today?.totalSlides ?? 4);
  const slideProgress = today
    ? Math.round((Math.min(slides.length, today.totalSlides) / today.totalSlides) * 100)
    : 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg pt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* ── Classroom header (96px PageHeader rule) ─────────────── */}
      <PageHeader
        crumbs={[
          { label: "Home", href: "/learner" },
          { label: courseName },
          ...(today ? [{ label: `Week ${today.topic.week} · Day ${today.topic.day}` }] : []),
        ]}
        title={today ? today.topic.title : "Loading today's class…"}
        subtitle={today ? today.topic.objective : undefined}
        progress={slideProgress}
        chips={
          <>
            {now && (
              <span className="badge-pill badge-pill-amber">
                <Star className="mr-1 h-3 w-3" aria-hidden />
                {now.profile.totalXP} XP
              </span>
            )}
            {now && (
              <span className="badge-pill badge-pill-amber">
                <Flame className="mr-1 h-3 w-3" aria-hidden />
                {now.profile.streakCurrent}d streak
              </span>
            )}
            {now && (
              <span className="badge-pill hidden bg-primary/10 text-primary sm:inline-flex">
                <GraduationCap className="mr-1 h-3 w-3" aria-hidden />
                {now.profile.learnerLevel}
              </span>
            )}
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setFocusMode(f => !f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                focusMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
              title="Focus mode dims the tutor and the chat for distraction-free reading."
            >
              <Focus className="h-3.5 w-3.5" />
              Focus
            </button>
            <a
              href="/learner"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-bg-subtle"
              title="Back to dashboard"
            >
              <X className="h-3.5 w-3.5" />
              Exit
            </a>
          </>
        }
      />

      {/* ── Main classroom area ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity rail (left) */}
        <nav className="flex w-[72px] flex-shrink-0 flex-col items-center gap-1.5 border-r bg-card py-3" aria-label="Classroom panels">
          <ActivityRailButton icon={MapIcon} label="Journey" active={activePanel === "journey"} onClick={() => setActivePanel(activePanel === "journey" ? null : "journey")} />
          <ActivityRailButton icon={Target} label="Project" active={activePanel === "project"} onClick={() => setActivePanel(activePanel === "project" ? null : "project")} />
          <ActivityRailButton icon={TrendingUp} label="Grow" active={activePanel === "grow"} onClick={() => setActivePanel(activePanel === "grow" ? null : "grow")} />
          <ActivityRailButton icon={BookOpen} label="Library" active={activePanel === "library"} onClick={() => setActivePanel(activePanel === "library" ? null : "library")} />
          <div className="flex-1" />
          {/* Daily-test quick badge */}
          {now?.dailyTest.status === "in_progress" && (
            <div className="px-1 text-center text-[9px] font-medium text-growth-amber">test<br />open</div>
          )}
        </nav>

        {/* Teacher avatar — on stage beside the lesson (desktop only) */}
        <div
          className={cn(
            "hidden w-60 flex-shrink-0 flex-col items-center justify-center border-r bg-card px-4 transition-opacity lg:flex",
            focusMode && "opacity-30 hover:opacity-100",
          )}
        >
          <AvatarStage size={168} />
        </div>

        {/* Lesson stage (center) */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Media switcher — only when this topic has a video lesson */}
            {today?.media?.video && !today.courseCompleted && (
              <div className="mx-auto mb-5 flex w-full max-w-3xl items-center gap-1 rounded-lg border bg-card p-1">
                <button
                  type="button"
                  onClick={() => setStageMode("video")}
                  aria-pressed={stageMode === "video"}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    stageMode === "video" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <MonitorPlay className="h-3.5 w-3.5" aria-hidden />
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => setStageMode("slides")}
                  aria-pressed={stageMode === "slides"}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    stageMode === "slides" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Presentation className="h-3.5 w-3.5" aria-hidden />
                  Slides
                </button>
              </div>
            )}

            {stageMode === "video" && today?.media?.video ? (
              <VideoStage
                video={today.media.video}
                onEnded={handleVideoEnded}
                onSkipToSlides={() => setStageMode("slides")}
              />
            ) : (
              <LessonStage
                topic={today?.topic ?? null}
                loading={!today}
                courseCompleted={Boolean(today?.courseCompleted)}
                slides={slides}
                slideIdx={slideIdx}
                totalSlides={today?.totalSlides ?? 4}
                topicComplete={topicComplete}
                onJumpToSlide={jumpToSlide}
              />
            )}
          </div>

          {/* Quick bar */}
          <div className="flex h-16 flex-shrink-0 items-center gap-2 border-t bg-surface px-4">
            <button
              type="button"
              onClick={() => jumpToSlide(Math.max(0, slideIdx - 1))}
              disabled={isFirstSlide || slides.length === 0}
              aria-label="Previous slide"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border hover:bg-bg-subtle disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Contextual CTA — clean navigation. Slides generate on load
                and on Next; no generation buttons are ever shown. */}
            {topicComplete || allSlidesGenerated ? (
              <button
                type="button"
                onClick={handleCompleteTopic}
                disabled={completing}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {today?.isLastTopicInCourse ? "Complete course" : "Complete & next topic"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextSlide}
                disabled={loadingSlide || slides.length === 0}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
              >
                {loadingSlide ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {slides.length === 0 ? "Loading lesson…" : "Next slide"}
              </button>
            )}

            <button
              type="button"
              onClick={() => jumpToSlide(Math.min(slides.length - 1, slideIdx + 1))}
              disabled={isLastSlideOfTopic || slides.length === 0}
              aria-label="Next slide"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border hover:bg-bg-subtle disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setChatInput(currentSlide?.checkQuestion ?? ""); document.getElementById("chat-input")?.focus(); }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-bg-subtle"
                title="Ask the AI tutor about this slide"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Ask AI
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("library")}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-bg-subtle"
                title="Open the Library panel"
              >
                <StickyNote className="h-3.5 w-3.5" /> Notes
              </button>
            </div>
          </div>
        </main>

        {/* Tutor chat (right) — xs: full-screen overlay sheet opened by
            the chat FAB; md+: static rail beside the stage. */}
        <aside
          className={cn(
            "bg-surface",
            chatOpen &&
              "fixed inset-x-0 top-14 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[var(--p-z-drawer)] flex w-full flex-col md:static md:bottom-auto md:top-auto md:z-auto md:w-80 md:flex-shrink-0 md:border-l",
            !chatOpen && "hidden md:flex md:w-80 md:flex-shrink-0 md:flex-col md:border-l",
            focusMode && "md:hidden md:opacity-40 md:hover:opacity-100 lg:md:flex",
          )}
        >
          {/* Chat header */}
          <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b px-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-fg">AI Tutor</span>
            <span className="text-[10px] text-fg-muted">· {courseName}</span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-bg-subtle md:hidden"
              aria-label="Close chat"
              title="Close chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleTTS}
              className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-bg-subtle"
              title={ttsOn ? "Mute voice" : "Unmute voice"}
              aria-label={ttsOn ? "Mute tutor voice" : "Unmute tutor voice"}
            >
              {ttsOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Transcript */}
          <div ref={transcriptRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map(m => (
              <div key={m.id} className={cn("flex flex-col gap-1", m.role === "student" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    m.role === "student" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.citation && (
                    <p className="mt-1.5 font-mono text-[10px] opacity-70">{m.citation}</p>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-start">
                <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Input — text + voice */}
          <div className="flex-shrink-0 border-t p-3">
            <div className="flex items-end gap-2">
              <textarea
                id="chat-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(chatInput); } }}
                placeholder="Ask about today's topic…"
                rows={1}
                className="max-h-32 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={2000}
              />
              {/* Voice: interim words mirror into the textarea; the final
                  utterance auto-sends — asking feels like talking to a teacher. */}
              <VoiceBar
                onInterim={setChatInput}
                onFinal={askQuestion}
                disabled={chatLoading}
              />
              <button
                type="button"
                onClick={() => askQuestion(chatInput)}
                disabled={!chatInput.trim() || chatLoading}
                aria-label="Send question"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[10px] text-fg-muted">Enter to send · tap the mic to ask by voice</p>
          </div>
        </aside>
      </div>

      {/* ── Panel drawer (slide-over) ───────────────────────────── */}
        {/* Chat FAB — xs only; opens the chat sheet above the bottom nav */}
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Open tutor chat"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-[var(--p-z-raised)] flex h-12 w-12 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg transition-transform hover:scale-105 md:hidden"
        >
          <MessageSquare className="h-5 w-5" aria-hidden />
        </button>
      {activePanel && (
        <div className="fixed inset-0 z-30 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setActivePanel(null)}
          />
          {/* Drawer */}
          <div className="relative z-10 flex w-full max-w-full flex-col border-r bg-background shadow-xl animate-in slide-in-from-left sm:w-[480px]">
            <div className="flex h-12 flex-shrink-0 items-center justify-between border-b px-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {activePanel}
              </h2>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                aria-label="Close panel"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
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

function ActivityRailButton({
  icon: Icon, label, active, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={cn(
        "flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-md transition-colors",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Welcome to your classroom</h3>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> Your <b>AI teacher</b> stands beside the board and narrates every slide.</li>
          <li className="flex gap-2"><ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> The <b>center board</b> shows today&apos;s lesson. Click <b>Start learning</b> to begin.</li>
          <li className="flex gap-2"><ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> <b>Ask by voice</b> — tap the mic in the chat and just speak your question.</li>
          <li className="flex gap-2"><ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> The <b>left rail</b> opens your journey, project, growth, and notes.</li>
          <li className="flex gap-2"><ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> Use <b>Focus mode</b> (top-right) to dim distractions while you read.</li>
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
