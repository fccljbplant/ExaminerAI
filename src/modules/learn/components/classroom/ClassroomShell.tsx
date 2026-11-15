"use client";

// src/modules/learn/components/classroom/ClassroomShell.tsx — the classroom
// session orchestrator for /learn/[courseId]: header + activity rail +
// lesson stage (video → slides) + post-lesson flow + tutor chat.
//
// Redesigned 2026-11-15 (docs/UPGRADE-2026-11/CLASSROOM-AUDIT-2026-11-15.md):
// this file used to be a 1446-line monolith with a dead avatar bus, two
// duplicate topic maps and duplicate controls. It is now the orchestrator
// only — every stage, bar, drawer and chat lives in its own file:
//   ActivityRail · QuickBar · PostFlow · TutorChat · CoachMarks
// plus the shared PanelDrawer (modules/ui) for every slide-over panel.

import { useEffect, useState, useCallback, useRef } from "react";
import { logger } from "@/lib/logger";
import { api, AI_TIMEOUT_MS, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { Flame, GraduationCap, Star, Focus, MonitorPlay, Presentation, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/modules/ui/PageHeader";
import { prepareForTTS, speakTTS, stopTTS, warmVoices } from "@/modules/learn/lib/tts-filter";
import type { SlideData, TopicContext } from "@/modules/learn/types";
import { getCachedSlides, cacheSlides } from "@/modules/learn/lib/slide-cache";
import { LessonStage } from "./LessonStage";
import { VideoStage } from "./VideoStage";
import { ActivityRail, panelLabel } from "./ActivityRail";
import { QuickBar } from "./QuickBar";
import { CoachMarks } from "./CoachMarks";
import {
  CheckinStage, NextStage, ProjectStage, ResultsStage, TestStage, WeeklyStage,
  type PostStage,
} from "./PostFlow";
import { TutorChat, type ChatMessage } from "./TutorChat";
import type { PanelKey } from "./panel-keys";
import { UnifiedThemeToggle } from "@/modules/shell";
import { PanelDrawer } from "@/modules/ui/panel-drawer";
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

interface Props {
  courseId: string;
  courseName: string;
}

/**
 * The tutor voice. Narration is HONEST: every spoken line also lands in
 * the chat transcript as a tutor message, so the narration is always
 * visible even with sound off (the on-stage avatar was removed in W16 —
 * an invisible narrator is a broken promise). TTS speaks only when the
 * learner opted in via the voice toggle.
 */
function useTutorVoice(
  ttsOn: boolean,
  setTranscript: (text: string) => void,
) {
  const ttsRef = useRef(ttsOn);
  useEffect(() => {
    ttsRef.current = ttsOn;
  }, [ttsOn]);
  return useCallback((text: string) => {
    if (!text) return;
    setTranscript(text);
    if (ttsRef.current) {
      speakTTS(prepareForTTS(text));
    }
  }, [setTranscript]);
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
  const [postStage, setPostStage] = useState<PostStage>("slides");
  const [dailyScore, setDailyScore] = useState<number | null>(null);
  const [weeklyScore, setWeeklyScore] = useState<number | null>(null);
  // Sound is OFF by default — learners opt in via the voice toggle.
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
  // Stage: video lesson first (when the topic has one), then slides.
  const [stageMode, setStageMode] = useState<"video" | "slides">("slides");
  const videoIntroRef = useRef<string | null>(null);

  // The weekly test is due on the LAST day of each course week: the next
  // topic either belongs to a later week or the course is complete.
  const weeklyDue = Boolean(
    today?.topic && !today.courseCompleted &&
    (today.nextTopic === null || today.nextTopic.week > today.topic.week),
  );

  // Tutor speech appends to the chat transcript so narration is always
  // visible — the honest replacement for the removed on-stage avatar.
  const speak = useTutorVoice(ttsOn, useCallback((text: string) => {
    setMessages(prev => [...prev, { id: `n-${Date.now()}`, role: "tutor", content: text }]);
  }, []));

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

  // ── Deep link (?panel=journey from /learn) ────────────────────────
  useEffect(() => {
    const panel = new URLSearchParams(window.location.search).get("panel");
    if (panel === "journey" || panel === "project" || panel === "grow" || panel === "library") {
      setActivePanel(panel);
    }
  }, []);

  // ── Fetchers ──────────────────────────────────────────────────────
  const fetchNow = useCallback(async () => {
    try {
      const res = await api.get<{ data: NowData }>(`/api/learn/now?courseId=${courseId}`);
      setNow(res.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
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
    const t = setTimeout(() => {
      speak("Welcome back to class. Let's pick up where you left off.");
    }, 800);
    return () => {
      clearTimeout(t);
      stopTTS();
    };
  }, [courseId, fetchNow, fetchToday, fetchSession, speak]);

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
        speak("Teaching complete! The daily Socratic test is now open — answer, and the examiner will probe your understanding. Your results unlock what comes next.");
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
      speak(narration || message);
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
        speak("Congratulations! You've finished the entire course. That's a huge achievement.");
        toast.success("Course complete!", { description: `+${xpAwarded} XP` });
      } else if (nextTopic) {
        speak(`Topic complete. Plus ${xpAwarded} XP. Onto the next topic!`);
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
      speak(res.data.answer);
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
  // The tutor introduces the video once per topic; recaps when it ends.
  useEffect(() => {
    if (stageMode !== "video" || !today?.media?.video) return;
    const key = `${today.topic.week}-${today.topic.day}`;
    if (videoIntroRef.current === key) return;
    videoIntroRef.current = key;
    speak(`Before the slides, let's watch a short video: ${today.media.video.title}. I'll recap the key points afterwards.`);
  }, [stageMode, today, speak]);

  function handleVideoEnded() {
    setStageMode("slides");
    speak(
      today
        ? `That covered the heart of today's topic — ${today.topic.title}. Now let's go through it slide by slide. Ask me anything along the way.`
        : "Now let's go through the slides.",
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  const slideProgress = today
    ? Math.round((Math.min(slides.length, today.totalSlides) / today.totalSlides) * 100)
    : 0;
  const currentSlide = slides[slideIdx];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg pt-[env(safe-area-inset-top)] md:pt-14 pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] md:pb-0">
      {/* ── Classroom header ─────────────────────────────────────── */}
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
              <span className="badge-pill hidden bg-brand-subtle text-brand sm:inline-flex">
                <GraduationCap className="mr-1 h-3 w-3" aria-hidden />
                {now.profile.learnerLevel}
              </span>
            )}
          </>
        }
        actions={
          <>
            {/* Theme + focus + exit. The topic map lives in the rail's
                Journey panel — one map, one entry point (audit A1). */}
            <UnifiedThemeToggle />
            <button
              type="button"
              onClick={() => setFocusMode(f => !f)}
              aria-pressed={focusMode}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                focusMode
                  ? "bg-brand text-on-brand"
                  : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
              )}
              title="Focus mode hides the chat for distraction-free reading."
            >
              <Focus className="h-3.5 w-3.5" aria-hidden />
              Focus
            </button>
            <a
              href="/learner"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              title="Back to dashboard"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Exit
            </a>
          </>
        }
      />

      {/* ── Main classroom area ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <ActivityRail
          activePanel={activePanel}
          onSelect={(key) => setActivePanel(activePanel === key ? null : key)}
        />

        {/* Lesson stage (center) */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div data-main-scroll className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-6">
            {/* Media switcher — only when this topic has a video lesson */}
            {today?.media?.video && !today.courseCompleted && (
              <div className="mx-auto mb-5 flex w-full max-w-3xl items-center gap-1 rounded-lg border border-line bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setStageMode("video")}
                  aria-pressed={stageMode === "video"}
                  className={cn(
                    "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                    stageMode === "video" ? "bg-brand text-on-brand" : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
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
                    "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                    stageMode === "slides" ? "bg-brand text-on-brand" : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                  )}
                >
                  <Presentation className="h-3.5 w-3.5" aria-hidden />
                  Slides
                </button>
              </div>
            )}

            {postStage === "test" ? (
              <TestStage
                courseId={courseId}
                topicLabel={
                  today?.topic
                    ? `Week ${today.topic.week} · Day ${today.topic.day} — ${today.topic.title}`
                    : undefined
                }
                hasProject={Boolean(now?.project)}
                onScore={(score) => {
                  setDailyScore(score);
                  setPostStage("results");
                  speak("Test complete! Your result is on the board. Let's check your project and today's check-in.");
                }}
                onStage={setPostStage}
              />
            ) : postStage === "results" ? (
              <ResultsStage
                score={dailyScore}
                weeklyDue={weeklyDue}
                hasProject={Boolean(now?.project)}
                onStage={setPostStage}
              />
            ) : postStage === "weekly" ? (
              <WeeklyStage
                courseId={courseId}
                week={today?.topic.week ?? 1}
                weekLabel={today?.topic ? `Week ${today.topic.week} — end-of-week test` : undefined}
                hasProject={Boolean(now?.project)}
                onScore={(score) => setWeeklyScore(score)}
                onContinue={() => setPostStage(now?.project ? "project" : "checkin")}
                score={weeklyScore}
                onStage={setPostStage}
              />
            ) : postStage === "project" && now?.project ? (
              <ProjectStage
                project={now.project}
                courseId={courseId}
                week={today?.topic.week ?? 1}
                hasProject
                onDone={() => setPostStage("checkin")}
                onBack={() => setPostStage("results")}
                onStage={setPostStage}
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
              <NextStage
                isLastTopic={Boolean(today?.isLastTopicInCourse)}
                completing={completing}
                onComplete={handleCompleteTopic}
                hasProject={Boolean(now?.project)}
                onStage={setPostStage}
              />
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

          <QuickBar
            postStage={postStage}
            slides={slides}
            slideIdx={slideIdx}
            totalSlides={today?.totalSlides ?? 4}
            loadingSlide={loadingSlide}
            topicComplete={topicComplete}
            completing={completing}
            isLastTopicInCourse={Boolean(today?.isLastTopicInCourse)}
            hasPrevTopic={Boolean(today?.prevTopic)}
            onPrevSlide={() => jumpToSlide(Math.max(0, slideIdx - 1))}
            onNextSlide={handleNextSlide}
            onPrevTopic={() => today?.prevTopic && void jumpTopic(today.prevTopic.week, today.prevTopic.day)}
            onJumpSlide={jumpToSlide}
            onPostStage={setPostStage}
            onCompleteTopic={handleCompleteTopic}
            onAskAboutSlide={() => {
              setChatInput(currentSlide?.checkQuestion ?? "");
              setChatOpen(true);
              document.getElementById("chat-input")?.focus();
            }}
          />
        </main>

        <TutorChat
          courseName={courseName}
          messages={messages}
          input={chatInput}
          onInputChange={setChatInput}
          onAsk={askQuestion}
          loading={chatLoading}
          ttsOn={ttsOn}
          onToggleTTS={toggleTTS}
          open={chatOpen}
          onOpenChange={setChatOpen}
          focusMode={focusMode}
        />
      </div>

      {/* ── Panel drawer (slide-over) — one shell for every panel ── */}
      <PanelDrawer
        title={activePanel ? panelLabel(activePanel) : ""}
        open={activePanel !== null}
        onClose={() => setActivePanel(null)}
      >
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
          <LibraryPanel courseId={courseId} slideId={null} />
        )}
      </PanelDrawer>

      {/* ── Coach marks (first visit) ───────────────────────────── */}
      {showCoachMarks && (
        <CoachMarks onClose={() => setShowCoachMarks(false)} />
      )}
    </div>
  );
}
