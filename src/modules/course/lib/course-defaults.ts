/**
 * Course Defaults — the SINGLE source of truth for the default bootcamp course.
 *
 * This file contains all course-specific data that was previously hardcoded
 * across multiple files (StudentDashboard.tsx, constants.ts, ai-prompts.ts).
 *
 * When an admin clicks "Seed Default" in the Course Planner, ALL of this data
 * is written to the Course model's JSON fields in the database.
 *
 * When a student's batch has a course assigned, the app reads from the DB.
 * If a config field is null, the app falls back to the values in this file.
 *
 * This file should ONLY be imported by:
 * - src/lib/course-config.ts (fallback values)
 * - src/app/api/courses/seed-default/route.ts (seed source)
 */

import { PILLARS } from "@/lib/constants";

// ---- Journey Steps (was hardcoded in StudentDashboard.tsx) ----

export const DEFAULT_JOURNEY_STEPS = [
  {
    id: "welcome",
    week: 1,
    title: "Welcome to your 6-week journey!",
    description: "Over the next 6 weeks, you'll build a real, deployed, AI-powered website — from idea to live project. This wizard will guide you step by step. Click 'Start' when you're ready.",
    why: "Every great project starts with a clear understanding of where you're going. Taking 2 minutes to read this means you'll never feel lost.",
    action: { label: "Start", mode: "journey" },
    completedWhen: "manual",
  },
  {
    id: "read-outline",
    week: 1,
    title: "Read your course outline",
    description: "Your course outline has the full 6-week plan — every day, every topic, every tool you'll learn. Read it so you know what's coming.",
    why: "Knowing the full journey helps you stay motivated. You'll see how each week connects and why each topic matters.",
    action: { label: "Open Course Outline", mode: "course-outline" },
    completedWhen: "manual",
  },
  {
    id: "plan-project",
    week: 1,
    title: "Plan your project",
    description: "Think about what you want to build. You can pick one of the 12 ideas below for inspiration, or define your own project. Type your project name + details, then click Create. Your project definition will be saved — in the next step you'll choose how many weeks your project will take and generate a tailored task list with AI.",
    why: "Your project is the thread through all 6 weeks. Pick something you're genuinely interested in — you'll work on it every day. The 12 ideas below are just for reference; you can build whatever you want.",
    action: { label: "Create Project", mode: "journey" },
    completedWhen: "manual",
  },
  {
    id: "configure-timeline",
    week: 1,
    title: "Choose your project duration & generate tasks",
    description: "How many weeks do you want to spend on this project? Pick a duration (3-20 weeks), then click Generate Tasks. The AI will read your project definition and create a tailored task list — one task per weekday, with key milestones marked. This takes 10-60 seconds depending on the duration.",
    why: "A realistic timeline keeps you accountable. 3 weeks = intense sprint, 6 weeks = standard pace, 12+ weeks = thorough deep-dive. The AI tasks give you a starting point — you can edit, delete, or add more anytime in the Project tab.",
    action: { label: "Configure Timeline", mode: "journey" },
    completedWhen: "db:tasks",
  },
  {
    id: "review-plan",
    week: 1,
    title: "Review your project plan",
    description: "Open the Project tab. You'll see your project definition at the top, then a Gantt chart with your AI-generated tasks, and a task manager. Edit any task, add new ones, or mark milestones as you progress.",
    why: "Reviewing your plan keeps you on track. The Gantt chart shows progress at a glance. Checking off tasks feels good and builds momentum.",
    action: { label: "Open Project Plan", mode: "gantt" },
    completedWhen: "manual",
    aiTutorTopic: "Project planning and breaking work into small tasks",
  },
  {
    id: "setup-dev",
    week: 1,
    title: "Set up your development environment",
    description: "Install VS Code, Git, and LocalWP. These are your tools for the next 6 weeks.",
    why: "A professional dev environment is your foundation. Setting it up correctly now prevents hours of frustration later.",
    action: { label: "Ask AI Tutor for help", mode: "ai-tutor", topic: "Setting up VS Code, Git, and LocalWP for web development" },
    completedWhen: "manual",
    aiTutorTopic: "Setting up VS Code, Git, and LocalWP",
  },
  {
    id: "first-checkin",
    week: 1,
    title: "Do your first daily check-in",
    description: "Tell us what you worked on today. This builds your streak and lets your teacher see your progress.",
    why: "Daily check-ins build consistency. A 7-day streak means you're building a real habit.",
    action: { label: "Do Check-In", mode: "checkin" },
    completedWhen: "db:logs",
  },
  {
    id: "first-question",
    week: 1,
    title: "Answer your first question",
    description: "Type a topic you want to be tested on. The AI will ask you a question about it and evaluate your answer.",
    why: "Testing your understanding catches gaps early. The AI grades on concepts, not just correctness.",
    action: { label: "Get a Question", mode: "question" },
    completedWhen: "db:interactions",
  },
  {
    id: "week1-test",
    week: 1,
    title: "Take your first weekly test",
    description: "A 10-question Socratic test. The AI examiner guides you, grades you, and gives behavioral feedback.",
    why: "Weekly tests show your teacher what you've understood. The final result tells you what to focus on next.",
    action: { label: "Take Weekly Test", mode: "weekly-test" },
    completedWhen: "db:test",
  },
  {
    id: "week2",
    week: 2,
    title: "Week 2: Build your website + database",
    description: "Homepage, WordPress, databases, SQL. Your project starts taking shape.",
    why: "Week 2 is where your project becomes real. Consistent progress here sets up the rest of the bootcamp.",
    action: { label: "Plan Week 2", mode: "gantt" },
    completedWhen: "db:week2",
    aiTutorTopic: "Building a homepage with WordPress and MySQL database fundamentals",
  },
  {
    id: "week3",
    week: 3,
    title: "Week 3: APIs, automation + AI agents",
    description: "REST APIs, Make.com automation, building your first AI agent.",
    why: "APIs and automation are core skills employers look for. This is where things get real.",
    action: { label: "Plan Week 3", mode: "gantt" },
    completedWhen: "db:week3",
    aiTutorTopic: "REST APIs, Make.com automation, and building AI agents",
  },
  {
    id: "week4",
    week: 4,
    title: "Week 4: Add AI to your project",
    description: "Prompt engineering, Gemini API, adding an AI feature to your project.",
    why: "AI integration is what makes your project stand out. This is your differentiator.",
    action: { label: "Plan Week 4", mode: "gantt" },
    completedWhen: "db:week4",
    aiTutorTopic: "Prompt engineering and integrating the Gemini API into a website",
  },
  {
    id: "week5",
    week: 5,
    title: "Week 5: Test, secure + deploy",
    description: "Testing, performance, security, and deploying to live hosting.",
    why: "A deployed project is a portfolio piece. This is what you'll show employers.",
    action: { label: "Plan Week 5", mode: "gantt" },
    completedWhen: "db:week5",
    aiTutorTopic: "Software testing, security hardening, and deploying WordPress to live hosting",
  },
  {
    id: "week6",
    week: 6,
    title: "Week 6: Polish + present your capstone",
    description: "Final audit, GitHub portfolio, interview prep, capstone presentation. You made it!",
    why: "This is the finish line. Your capstone is your proof of skill.",
    action: { label: "Plan Week 6", mode: "gantt" },
    completedWhen: "db:week6",
    aiTutorTopic: "Building a professional GitHub portfolio and preparing for technical interviews",
  },
];

// ---- Capstone Ideas (was hardcoded in StudentDashboard.tsx) ----

export const DEFAULT_CAPSTONE_IDEAS = [
  { name: "AI Resume Builder", desc: "Users enter work history; AI formats it into a professional resume", ai: "Gemini rewrites weak bullet points into strong, achievement-focused language" },
  { name: "Smart Restaurant Website", desc: "Menu, table reservations, location/hours for a restaurant", ai: "Gemini recommends dishes based on customer preferences" },
  { name: "Clinic Appointment System", desc: "Patients view doctors and book appointments online", ai: "Gemini suggests which department based on symptoms" },
  { name: "Real Estate Portal", desc: "Property listings with photos, price, and location filters", ai: "Gemini turns plain-English requests into search filters" },
  { name: "Student Management System", desc: "Tracks student records, grades, and attendance", ai: "Gemini generates plain-language progress summaries" },
  { name: "AI Portfolio Website", desc: "Personal portfolio showcasing projects and skills", ai: "Gemini chatbot answers visitor questions about your work" },
  { name: "Event Booking Platform", desc: "Customers browse and book venues or event packages", ai: "Gemini recommends packages based on guest count + budget" },
  { name: "Freelancer Marketplace", desc: "Freelancers list services; clients post jobs", ai: "Gemini turns rough job descriptions into structured briefs" },
  { name: "Recipe & Meal Planner", desc: "Users browse recipes and build weekly meal plans", ai: "Gemini generates meal plans from available ingredients" },
  { name: "Job Portal / Career Site", desc: "Job seekers browse listings; employers post openings", ai: "Gemini compares resumes against job descriptions" },
  { name: "Small E-Commerce Store", desc: "Product catalog, cart, and checkout for small business", ai: "Gemini writes SEO-friendly product descriptions" },
  { name: "Non-Profit / Donation Website", desc: "Shares mission and collects donations", ai: "Gemini drafts personalized thank-you messages for donors" },
];

// ---- Test Config ----

export const DEFAULT_TEST_CONFIG = {
  totalQuestions: 15,
  maxRepliesPerQuestion: 5,
  pillars: [...PILLARS],
  minScoreFloor: 50,
  advanceOnComplete: true,
};

// ---- Report Card Template ----

export const DEFAULT_REPORT_CARD_TEMPLATE = {
  gradingScale: [
    { grade: "A", min: 90, max: 100 },
    { grade: "B", min: 80, max: 89 },
    { grade: "C", min: 70, max: 79 },
    { grade: "D", min: 60, max: 69 },
    { grade: "F", min: 0, max: 59 },
  ],
  weights: { weeklyTest: 80, practice: 20 },
  sections: ["strengths", "weaknesses", "progress", "nextSteps"],
};

// ---- Project Template ----

export const DEFAULT_PROJECT_TEMPLATE = {
  projectDurationWeeks: 6,
  capstoneIdeas: DEFAULT_CAPSTONE_IDEAS,
};

// ---- AI Prompts (extracted from ai-prompts.ts — used as defaults) ----

export const DEFAULT_AI_PROMPTS = {
  // System prompt for the weekly test Socratic examiner
  weeklyTestSystemPrompt: `You are a Socratic TraineesAI conducting a weekly assessment test for a web development bootcamp student. You are NOT a tutor — you are an EXAMINER.

YOUR ROLE:
- Ask ONE question at a time
- Wait for the student's answer before responding
- Evaluate the answer silently, then decide: probe deeper OR move to next question
- NEVER give the answer — guide the student to think

QUESTION STYLE:
- Beginner-friendly language (the student is a complete beginner)
- Conceptual, not coding — test understanding, not syntax memorization
- One clear question per message — no multi-part questions
- Keep questions short (1-3 sentences max)

RESPONSE STYLE:
- Brief acknowledgment of the student's answer (1 sentence max)
- Then either: a probing follow-up question OR "Let's move to the next question"
- Never say "correct" or "incorrect" — probe to check understanding
- Never give hints or partial answers
- Keep responses under 3 sentences total

CRITICAL RULES:
- Do NOT prefix messages with "Question N:" — just ask the question directly
- Do NOT use markdown formatting (no **, no #, no bullets)
- Do NOT repeat the question
- If the student says "I don't know" or gives a very short answer, ask ONE clarifying question, then move on
- If the student goes off-topic, redirect: "Let's stay focused on the test question."`,

  // Prompt for generating practice questions
  practiceSystemPrompt: `You are a Socratic AI tutor generating a single conceptual question for a web development bootcamp student. The question should be beginner-friendly and test understanding, not syntax memorization.`,

  // Prompt for evaluating student answers
  evaluationPrompt: `You are an AI examiner evaluating a student's answer to a Socratic question. Grade on conceptual understanding, not perfect syntax. Be encouraging but honest.`,

  // Prompt for final analysis at the end of a weekly test
  finalAnalysisPrompt: `You are an AI examiner writing a final analysis of a student's weekly test performance. Based on the conversation transcript, provide an examiner's observation and a score (0-100).`,
};
