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
  ChevronRight, ChevronLeft, ArrowLeft, Send, Loader2, Volume2, VolumeX, Focus,
  X, GraduationCap, MessageSquare, StickyNote, CheckCircle2, ArrowRight, MonitorPlay,
  Presentation, Brain, Trophy, ClipboardList, CalendarCheck, ListTree,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/modules/ui/PageHeader";
import { prepareForTTS, speakTTS, stopTTS, warmVoices } from "@/modules/learn/lib/tts-filter";
import type { SlideData, TopicContext } from "@/modules/learn/types";
import { tutor } from "@/modules/learn/lib/tutor-bus";
import { getCachedSlides, cacheSlides } from "@/modules/learn/lib/slide-cache";
import { LessonStage } from "@/modules/learn/components/classroom/LessonStage";
import { VideoStage } from "@/modules/learn/components/classroom/VideoStage";
import { TopicPicker } from "@/modules/learn/components/classroom/TopicPicker";
import { UnifiedThemeToggle } from "@/modules/shell";
import { DailyTestPanel } from "@/modules/assessment/components/DailyTestPanel";
import { WeeklyTestPanel } from "@/modules/assessment/components/WeeklyTestPanel";
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
  // Post-lesson flow (W12): after the slides, the daily Socratic test
  // launches in place of the stage; results unlock "complete & next topic".
  const [postStage, setPostStage] = useState<"slides" | "test" | "results" | "weekly" | "project" | "checkin" | "next">("slides");
  const [dailyScore, setDailyScore] = useState<number | null>(null);
  const [weeklyScore, setWeeklyScore] = useState<number | null>(null);
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
  // Incremented to re-arm the auto-gen effect after a failed attempt
  // (with a short backoff) — see the retry block in handleNextSlide.
  const [genRetryTick, setGenRetryTick] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [topicComplete, setTopicComplete] = useState(false);
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  // Topic map drawer (re-learn previously learned topics).
  const [showTopics, setShowTopics] = useState(false);
  // Stage: video lesson first (when the topic has one), then slides.
  const [stageMode, setStageMode] = useState<"video" | "slides">("slides");
  const videoIntroRef = useRef<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // The weekly test is due on the LAST day of each course week: the next
  // topic either belongs to a later week or the course is complete.
  const weeklyDue = Boolean(
    today?.topic && !today.courseCompleted &&
    (today.nextTopic === null || today.nextTopic.week > today.topic.week),
  );

  const speakWithAvatar = useSpeakWithAvatar(ttsOn);
  const captionOnly = useCaptionOnly();
  // Auto-generate the first slide for each NEW topic on load — the
  // learner never sees a "Start learning" generation button. Keyed by
  // topic so every topic advance regenerates fresh slides for that day.
  const autoStartedForRef = useRef<string | null>(null);
  // Bounded auto-retry for failed slide generation (transient AI errors
  // would otherwise strand the learner on an empty board forever).
  const autoGenAttemptsRef = useRef<{ key: string | null; attempts: number }>({ key: null, attempts: 0 });
  // Generation + fetch sequence numbers: any slide POST or today GET in
  // flight is invalidated the moment a newer one starts, so a slow
  // response from the PREVIOUS topic can never overwrite the current
  // topic's board with its old slides (2026-08-16 audit).
  const genSeqRef = useRef(0);
  const fetchSeqRef = useRef(0);
  const currentTopicKeyRef = useRef<string | null>(null);

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
    const seq = ++fetchSeqRef.current;
    try {
      const res = await api.get<{ data: TodayData }>(`/api/learn/today?courseId=${courseId}`);
      if (seq !== fetchSeqRef.current) return; // a newer fetch superseded this one
      const data = res.data;
      setToday(data);
      // Browser-memory slide cache: server slides hydrate the cache; a
      // cache hit makes re-learning a topic instant (and keeps the board
      // alive if the server copy is slow to arrive).
      let nextSlides: SlideData[] = data.slides ?? [];
      if (data.topic) {
        if (nextSlides.length > 0) {
          cacheSlides(courseId, data.topic.week, data.topic.day, nextSlides);
        } else {
          const cached = getCachedSlides(courseId, data.topic.week, data.topic.day);
          if (cached && cached.length > 0) nextSlides = cached;
        }
      }
      setSlides(nextSlides);
      // Resume mid-topic at the last generated slide; a re-learned
      // (completed) topic always starts fresh at slide 1.
      setSlideIdx(data.completed ? 0 : Math.max(0, nextSlides.length - 1));
      setTopicComplete(false);
      setPostStage("slides");
      setDailyScore(null);
      setWeeklyScore(null);
      // Any in-flight slide generation belongs to the previous topic —
      // drop it and clear the auto-start keys so the new topic starts clean.
      genSeqRef.current++;
      autoStartedForRef.current = null;
      autoGenAttemptsRef.current = { key: null, attempts: 0 };
      currentTopicKeyRef.current = data.topic ? `${data.topic.week}-${data.topic.day}` : null;
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

  // ── Auto-generate the first slide for each NEW topic ──────────────
  const topicKey = today ? `${today.topic.week}-${today.topic.day}` : null;
  useEffect(() => {
    if (!today || !topicKey || topicComplete || loadingSlide) return;
    if (slides.length > 0) return; // cached or already generated
    if (autoStartedForRef.current === topicKey) return;
    autoStartedForRef.current = topicKey;
    void handleNextSlide();
    // genRetryTick re-arms this effect after a failed attempt (bounded).
  }, [today, topicKey, slides.length, topicComplete, loadingSlide, handleNextSlide, genRetryTick]);

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
    const seq = ++genSeqRef.current;
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

      // The learner advanced / jumped topics while this was generating —
      // this response belongs to the old topic and must not touch the board.
      if (seq !== genSeqRef.current) return;

      if ("topicComplete" in res.data) {
        setTopicComplete(true);
        setPostStage("test");
        tutor.play("cheer");
        speakWithAvatar("Teaching complete! The daily Socratic test is now open — answer, and the examiner will probe your understanding. Your results unlock what comes next.");
        fetchNow();
        return;
      }

      const { slide, narration, message } = res.data;
      const next = [...slides, slide];
      setSlides(next);
      if (today) cacheSlides(courseId, today.topic.week, today.topic.day, next);
      // Point at the slide that was JUST generated (next.length - 1).
      // The old `prev + 1` was off by one for a fresh topic (idx 0 with
      // 0 slides → idx 1 with 1 slide), which rendered an empty board
      // after every generated slide.
      setSlideIdx(next.length - 1);
      tutor.play("idea");
      captionOnly(narration || message);
      fetchNow();
    } catch (e) {
      if (seq !== genSeqRef.current) return; // stale — the newer flow owns the board
      toast.error("Couldn't generate the next slide", { description: e instanceof Error ? e.message : undefined });
      // Auto-retry a failed FIRST slide up to 2 more times (transient AI
      // errors); after that the "Start learning" CTA acts as manual retry.
      const attempts = autoGenAttemptsRef.current.key === currentTopicKeyRef.current
        ? autoGenAttemptsRef.current.attempts + 1
        : 1;
      if (attempts < 3) {
        autoGenAttemptsRef.current = { key: currentTopicKeyRef.current, attempts };
        // Back off briefly, then re-arm the auto-gen effect. The tick is
        // a state dep so the effect re-runs with a fresh closure (the
        // timeout alone would capture a stale handleNextSlide).
        setTimeout(() => {
          autoStartedForRef.current = null;
          setGenRetryTick((t) => t + 1);
        }, 900);
      }
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
      // Refetch everything for the new topic — fetchToday drops any
      // in-flight generation and resets the board to the new topic.
      setPostStage("slides");
      setDailyScore(null);
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

  /** Jump to another topic (re-learn a completed one, or the previous
   *  one in sequence). Refetches the classroom for the new topic. */
  async function jumpTopic(week: number, day: number) {
    try {
      await api.post(`/api/learn/topics/jump?courseId=${courseId}`, { week, day });
      setPostStage("slides");
      setTopicComplete(false);
      setDailyScore(null);
      await fetchToday();
      await fetchNow();
    } catch (e) {
      toast.error("Couldn't switch topic", { description: e instanceof Error ? e.message : undefined });
    }
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
    <div className="flex h-full flex-col overflow-hidden bg-bg text-fg">
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
            {/* Old theme menu — available on mobile AND desktop */}
            <UnifiedThemeToggle />
            <button
              type="button"
              onClick={() => setShowTopics(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
              title="Browse all topics — re-learn any completed topic"
            >
              <ListTree className="h-3.5 w-3.5" />
              Topics
            </button>
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
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Activity rail — top horizontal bar on mobile, left rail on
            desktop (user request: mobile rail moves to the top) */}
        <nav
          className="flex w-full flex-shrink-0 items-center justify-start gap-1 overflow-x-auto border-b bg-card px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:w-[72px] lg:flex-col lg:items-center lg:gap-1.5 lg:overflow-visible lg:border-b-0 lg:border-r lg:px-0 lg:py-3"
          aria-label="Classroom panels"
        >
          <ActivityRailButton icon={MapIcon} label="Journey" active={activePanel === "journey"} onClick={() => setActivePanel(activePanel === "journey" ? null : "journey")} />
          <ActivityRailButton icon={Target} label="Project" active={activePanel === "project"} onClick={() => setActivePanel(activePanel === "project" ? null : "project")} />
          <ActivityRailButton icon={TrendingUp} label="Grow" active={activePanel === "grow"} onClick={() => setActivePanel(activePanel === "grow" ? null : "grow")} />
          <ActivityRailButton icon={BookOpen} label="Library" active={activePanel === "library"} onClick={() => setActivePanel(activePanel === "library" ? null : "library")} />
          <div className="hidden flex-1 lg:block" />
          {/* Daily-test quick badge (desktop only) */}
          {now?.dailyTest.status === "in_progress" && (
            <div className="hidden px-1 text-center text-[9px] font-medium text-growth-amber lg:block">
              test<br />open
            </div>
          )}
        </nav>

        {/* Lesson stage (center) — the old static "AI Tutor" side card
            was removed (2026-08-16, user request); the real tutor lives
            in the chat rail, so the placeholder duplicated it. */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div data-main-scroll className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-6">
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

            {postStage === "test" ? (
              <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                <PostFlowStepper stage="test" hasProject={Boolean(now?.project)} onStage={setPostStage} />
                <div className="mx-auto max-w-2xl">
                  <DailyTestPanel
                    courseId={courseId}
                    topicLabel={
                      today?.topic
                        ? `Week ${today.topic.week} · Day ${today.topic.day} — ${today.topic.title}`
                        : undefined
                    }
                    onComplete={(score) => {
                      setDailyScore(score);
                      setPostStage("results");
                      tutor.play("cheer");
                      speakWithAvatar(
                        "Test complete! Your result is on the board. Let's check your project and today's check-in."
                      );
                    }}
                  />
                </div>
              </div>
            ) : postStage === "results" ? (
              <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                <PostFlowStepper stage="results" hasProject={Boolean(now?.project)} onStage={setPostStage} />
                <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center shadow-sm md:p-8">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle text-success-on">
                    <Trophy className="h-8 w-8" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-fg">Daily test complete</h3>
                  <p className="mt-2 text-4xl font-bold tabular-nums text-fg">
                    {dailyScore != null ? `${dailyScore}%` : "—"}
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
                    {dailyScore != null && dailyScore >= 60
                      ? "Strong work — the concept is locked in."
                      : "The examiner's explanations below show what to review before moving on."}
                  </p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={() => setPostStage(weeklyDue ? "weekly" : now?.project ? "project" : "checkin")}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostStage("slides")}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
                    >
                      <Presentation className="h-4 w-4" aria-hidden />
                      Review slides
                    </button>
                  </div>
                </div>
              </div>
            ) : postStage === "weekly" ? (
              <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                <PostFlowStepper stage="weekly" hasProject={Boolean(now?.project)} onStage={setPostStage} />
                <div className="mx-auto max-w-2xl">
                  <WeeklyTestPanel
                    courseId={courseId}
                    week={today?.topic.week ?? 1}
                    weekLabel={
                      today?.topic
                        ? `Week ${today.topic.week} — end-of-week test`
                        : undefined
                    }
                    onComplete={(score) => {
                      setWeeklyScore(score);
                      tutor.play("cheer");
                      speakWithAvatar("Week complete! Great work on the weekly test.");
                    }}
                  />
                  {weeklyScore !== null && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setPostStage(now?.project ? "project" : "checkin")}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
                      >
                        Continue
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : postStage === "project" && now?.project ? (
              <ProjectStage
                project={now.project}
                courseId={courseId}
                week={today?.topic.week ?? 1}
                onDone={() => setPostStage("checkin")}
                onBack={() => setPostStage("results")}
                onStage={setPostStage}
                hasProject
              />
            ) : postStage === "checkin" ? (
              <CheckinStage
                courseId={courseId}
                hasProject={Boolean(now?.project)}
                onDone={() => setPostStage("next")}
                onBack={() => setPostStage(now?.project ? "project" : "results")}
                onStage={setPostStage}
              />
            ) : postStage === "next" ? (
              <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                <PostFlowStepper stage="next" hasProject={Boolean(now?.project)} onStage={setPostStage} />
                <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center shadow-sm md:p-8">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-subtle text-fg">
                    <CheckCircle2 className="h-8 w-8" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-fg">All steps complete</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
                    Slides, Socratic test, project and check-in are all done for this topic.
                    Ready for the next one?
                  </p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={handleCompleteTopic}
                      disabled={completing}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-success px-5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                    >
                      {completing ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                      )}
                      {today?.isLastTopicInCourse ? "Complete course" : "Proceed to next topic"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostStage("slides")}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
                    >
                      <Presentation className="h-4 w-4" aria-hidden />
                      Review slides
                    </button>
                  </div>
                </div>
              </div>
            ) : stageMode === "video" && today?.media?.video ? (
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
          <div className="flex h-14 flex-shrink-0 items-center gap-1.5 border-t bg-surface px-2.5 md:h-16 md:gap-2 md:px-4">
            {postStage === "slides" && (
              <button
                type="button"
                onClick={() => jumpToSlide(Math.max(0, slideIdx - 1))}
                disabled={isFirstSlide || slides.length === 0}
                aria-label="Previous slide"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border hover:bg-bg-subtle disabled:opacity-40 md:h-11 md:w-11"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Re-learn the previous topic in the course sequence */}
            {postStage === "slides" && today?.prevTopic && (
              <button
                type="button"
                onClick={() => void jumpTopic(today.prevTopic!.week, today.prevTopic!.day)}
                aria-label="Previous topic"
                title="Go back to the previous topic"
                className="inline-flex min-h-10 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-bg-subtle md:min-h-11 md:px-3"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden md:inline">Prev topic</span>
              </button>
            )}

            {/* Contextual CTA — clean navigation. Slides generate on load
                and on Next; no generation buttons are ever shown. After
                the slides, the daily Socratic test takes the stage — and
                the topic can be finished right away, which advances the
                learner to the next topic (fresh slides next day). */}
            {topicComplete && postStage === "slides" ? (
              <>
                <button
                  type="button"
                  onClick={() => setPostStage("test")}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-bg-subtle md:min-h-11 md:gap-2 md:px-4 md:py-2 md:text-sm"
                >
                  <Brain className="h-4 w-4" />
                  Daily test
                </button>
                <button
                  type="button"
                  onClick={handleCompleteTopic}
                  disabled={completing}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 md:min-h-11 md:gap-2 md:px-4 md:py-2 md:text-sm"
                >
                  {completing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {today?.isLastTopicInCourse ? "Finish course" : "Finish topic"}
                </button>
              </>
            ) : postStage !== "slides" ? (
              <button
                type="button"
                onClick={() => setPostStage("slides")}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-bg-subtle md:min-h-11 md:gap-2 md:px-4 md:py-2 md:text-sm"
              >
                <Presentation className="h-4 w-4" />
                Slides
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextSlide}
                disabled={loadingSlide}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50 md:min-h-11 md:gap-2 md:px-4 md:py-2 md:text-sm"
              >
                {loadingSlide ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {loadingSlide ? "Generating…" : slides.length === 0 ? "Start learning" : "Next slide"}
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
              "fixed inset-x-0 top-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-[var(--p-z-drawer)] flex w-full flex-col md:static md:bottom-auto md:top-auto md:z-auto md:w-80 md:flex-shrink-0 md:border-l",
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
          className="fixed bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] right-4 z-[var(--p-z-raised)] flex h-12 w-12 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg transition-transform hover:scale-105 md:hidden"
        >
          <MessageSquare className="h-5 w-5" aria-hidden />
        </button>
      {activePanel && (
        <div className="fixed inset-0 z-[var(--p-z-drawer)] flex">
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
                <JourneyPanel
                  courseId={courseId}
                  onClose={() => setActivePanel(null)}
                  onJump={(week, day) => {
                    setActivePanel(null);
                    void jumpTopic(week, day);
                  }}
                />
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

      {/* ── Topic map drawer — browse + re-learn topics ─────────── */}
      {showTopics && (
        <div className="fixed inset-0 z-[var(--p-z-drawer)] flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowTopics(false)}
          />
          <div className="relative z-10 flex h-full w-full max-w-full flex-col border-r bg-background shadow-xl animate-in slide-in-from-left sm:w-[480px]">
            <div className="flex h-12 flex-shrink-0 items-center justify-between border-b px-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Course topics
              </h2>
              <button
                type="button"
                onClick={() => setShowTopics(false)}
                aria-label="Close topics"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <TopicPicker
                courseId={courseId}
                onJump={(week, day) => {
                  setShowTopics(false);
                  setPostStage("slides");
                  setTopicComplete(false);
                  setDailyScore(null);
                  void fetchToday();
                  void fetchNow();
                }}
              />
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
        "flex h-10 flex-shrink-0 items-center justify-center gap-1.5 rounded-md px-3 transition-colors lg:h-14 lg:w-14 lg:flex-col lg:px-0",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function CoachMarks({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4">
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

/* ── Post-lesson flow stage components (W13) ─────────────────────────── */

function PostFlowStepper({
  stage,
  hasProject,
  onStage,
}: {
  stage: "test" | "results" | "weekly" | "project" | "checkin" | "next";
  hasProject: boolean;
  onStage: (s: "slides" | "test" | "results" | "weekly" | "project" | "checkin" | "next") => void;
}) {
  const steps = [
    { key: "test" as const, label: "Test" },
    { key: "weekly" as const, label: "Weekly" },
    ...(hasProject ? [{ key: "project" as const, label: "Project" }] : []),
    { key: "checkin" as const, label: "Check-in" },
    { key: "next" as const, label: "Next topic" },
  ];
  const currentIdx = stage === "results" ? 0 : steps.findIndex((x) => x.key === stage);
  return (
    <ol className="mx-auto mb-4 flex max-w-2xl items-center gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <li className="shrink-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-subtle px-3 py-1 text-[11px] font-semibold text-success-on">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Slides
        </span>
      </li>
      {steps.map((x, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={x.key} className="flex shrink-0 items-center gap-1">
            <span className="text-fg-muted" aria-hidden>
              <ChevronRight className="h-3 w-3" />
            </span>
            <button
              type="button"
              onClick={() => (done ? onStage(x.key) : undefined)}
              disabled={!done}
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                done
                  ? "bg-bg-subtle text-fg-muted hover:text-fg"
                  : active
                    ? "bg-brand text-on-brand"
                    : "bg-bg-subtle text-fg-muted/60"
              )}
            >
              {done && <CheckCircle2 className="h-3 w-3" aria-hidden />}
              {x.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ProjectStage({
  project,
  courseId,
  week,
  onDone,
  onBack,
  onStage,
  hasProject,
}: {
  project: { id: string; title: string; activeMilestone: { id: string; title: string } | null };
  courseId: string;
  week: number;
  onDone: () => void;
  onBack: () => void;
  onStage: (s: "slides" | "test" | "results" | "weekly" | "project" | "checkin" | "next") => void;
  hasProject: boolean;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function continueFlow() {
    if (!note.trim()) {
      onDone();
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/tasks", {
        description: `[Topic update] ${note.trim()}`,
        week,
        courseId,
        projectId: project.id,
      });
      toast.success("Project updated", { description: "The note is attached to your project tasks." });
      onDone();
    } catch (e) {
      toast.error("Couldn't save the project note", {
        description: e instanceof Error ? e.message : undefined,
      });
      setSaving(false);
    }
  }

  return (
    <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <PostFlowStepper stage="project" hasProject={hasProject} onStage={onStage} />
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-info-subtle text-info-on">
          <Target className="h-7 w-7" aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-fg">Your project</h3>
        <p className="mt-1 text-sm font-medium text-fg">{project.title}</p>
        <p className="mt-1 text-xs text-fg-muted">
          {project.activeMilestone
            ? `Active milestone: ${project.activeMilestone.title}`
            : "All milestones complete 🎉"}
        </p>
        <label htmlFor="project-note" className="mt-4 block text-xs font-medium text-fg-secondary">
          Quick update (optional) — what did you do for the project today?
        </label>
        <textarea
          id="project-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Wrote the requirements section for my capstone brief…"
          className="mt-1.5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-bg px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <button
            type="button"
            onClick={() => void continueFlow()}
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden />
            )}
            Continue to check-in
          </button>
        </div>
      </div>
    </div>
  );
}

const CHECKIN_CONFIDENCE = [
  { value: 1, label: "Lost" },
  { value: 2, label: "Struggling" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

function CheckinStage({
  courseId,
  hasProject,
  onDone,
  onBack,
  onStage,
}: {
  courseId: string;
  hasProject: boolean;
  onDone: () => void;
  onBack: () => void;
  onStage: (s: "slides" | "test" | "results" | "weekly" | "project" | "checkin" | "next") => void;
}) {
  const [confidence, setConfidence] = useState(3);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/v2/learn/checkin", {
        courseId,
        whatDidYouDo: note.trim(),
        confidence,
      });
      toast.success("Check-in saved", { description: "Your instructor can see today's update." });
      onDone();
    } catch (err) {
      toast.error("Couldn't save check-in", {
        description: err instanceof Error ? err.message : undefined,
      });
      setSaving(false);
    }
  }

  return (
    <div className="data-main-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <PostFlowStepper stage="checkin" hasProject={hasProject} onStage={onStage} />
      <form onSubmit={submit} className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-subtle text-warning-on">
          <CalendarCheck className="h-7 w-7" aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-fg">Daily check-in</h3>
        <p className="mt-1 text-xs text-fg-muted">
          A quick stand-up for your mentor — how did today&apos;s topic feel?
        </p>
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-fg-secondary">How did it go today?</legend>
          <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Confidence">
            {CHECKIN_CONFIDENCE.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={confidence === c.value}
                onClick={() => setConfidence(c.value)}
                className={cn(
                  "min-h-11 flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                  confidence === c.value
                    ? "border-brand bg-brand-subtle text-fg"
                    : "border-line bg-bg-subtle text-fg-secondary hover:border-line-strong"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label htmlFor="flow-checkin-note" className="mt-4 block text-xs font-medium text-fg-secondary">
          What did you work on today?
        </label>
        <textarea
          id="flow-checkin-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required
          placeholder="Today I learned…"
          className="mt-1.5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-bg px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <button
            type="submit"
            disabled={saving || !note.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
            Save check-in
          </button>
        </div>
      </form>
    </div>
  );
}
