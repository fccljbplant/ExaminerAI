/**
 * Weekly course topics — aligned with the course outline (course-plan.html).
 * Each week has 5 daily topics. The weekly test uses these to generate
 * questions that match what the student learned that week.
 *
 * This is the FIXED CURRICULUM — shared by all students. It is NOT the
 * student's project plan (which is custom and lives in the Project tab).
 *
 * Each daily topic includes:
 *  - title: short topic name
 *  - objective: what the student should be able to do after learning this
 *  - resources: 1-2 suggested resources (docs/videos) for self-study
 */

export interface DailyTopic {
  title: string;
  objective: string;
  resources: { label: string; url: string }[];
  // M6-fix: DB-backed fields (optional for backward compat with hardcoded topics)
  day?: number;
  whyItMatters?: string;
  topicsCovered?: string[];
  activity?: string;
  deliverable?: string;
}

export interface WeekTopic {
  week: number;
  phase: string;
  topics: DailyTopic[]; // 5 daily topics
}

export const WEEKLY_TOPICS: WeekTopic[] = [
  {
    week: 1,
    phase: "Planning & Dev Environment",
    topics: [
      {
        title: "Project planning and requirement analysis",
        objective: "Define project goals, target users, and key features in a one-page brief.",
        resources: [
          { label: "Atlassian: How to write a PRD", url: "https://www.atlassian.com/agile/product-management/requirements" },
          { label: "Mozilla: Project planning", url: "https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web" },
        ],
      },
      {
        title: "Setting up a development environment (VS Code, Git, LocalWP)",
        objective: "Install and configure all dev tools so you can build and commit code locally.",
        resources: [
          { label: "VS Code setup", url: "https://code.visualstudio.com/docs/setup/setup-overview" },
          { label: "Git first-time setup", url: "https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup" },
        ],
      },
      {
        title: "Version control with Git and GitHub — commits, branches, push",
        objective: "Create a repo, make commits, push to GitHub, and open a pull request.",
        resources: [
          { label: "GitHub Git tutorial", url: "https://docs.github.com/en/get-started/getting-started-with-git" },
          { label: "Git branching guide", url: "https://learngitbranching.js.org/" },
        ],
      },
      {
        title: "Local WordPress development with LocalWP",
        objective: "Spin up a local WordPress site and access wp-admin.",
        resources: [
          { label: "LocalWP docs", url: "https://localwp.com/help-docs/" },
          { label: "WordPress Codex: Getting Started", url: "https://wordpress.org/documentation/article/getting-started-with-wordpress/" },
        ],
      },
      {
        title: "Sprint review and documentation",
        objective: "Write a sprint retrospective and update your project README.",
        resources: [
          { label: "Atlassian: Sprint retrospectives", url: "https://www.atlassian.com/agile/scrum/sprint-retrospectives" },
          { label: "Make a README", url: "https://www.makeareadme.com/" },
        ],
      },
    ],
  },
  {
    week: 2,
    phase: "Website & Database Fundamentals",
    topics: [
      {
        title: "Building a homepage with WordPress blocks",
        objective: "Build a complete homepage using the block editor (Gutenberg).",
        resources: [
          { label: "WordPress Block Editor guide", url: "https://wordpress.org/documentation/article/wordpress-editor/" },
          { label: "Block patterns directory", url: "https://wordpress.org/patterns/" },
        ],
      },
      {
        title: "CSS styling and responsive web design basics",
        objective: "Apply custom CSS and make the site look good on mobile + desktop.",
        resources: [
          { label: "MDN: CSS basics", url: "https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web/CSS_basics" },
          { label: "web.dev: Responsive design", url: "https://web.dev/learn/design/" },
        ],
      },
      {
        title: "Understanding databases — tables, rows, columns in phpMyAdmin",
        objective: "Create a database table and insert rows using phpMyAdmin UI.",
        resources: [
          { label: "phpMyAdmin user guide", url: "https://docs.phpmyadmin.net/en/latest/user.html" },
          { label: "MDN: Databases overview", url: "https://developer.mozilla.org/en-US/docs/Glossary/Database" },
        ],
      },
      {
        title: "SQL basics — INSERT, SELECT, UPDATE, DELETE, and JOINs",
        objective: "Write basic SQL queries to read and modify data.",
        resources: [
          { label: "SQLBolt interactive tutorial", url: "https://sqlbolt.com/" },
          { label: "Mode: SQL JOINs", url: "https://mode.com/sql-tutorial/sql-joins/" },
        ],
      },
      {
        title: "Connecting WordPress to a MySQL database",
        objective: "Configure wp-config.php and verify the connection works.",
        resources: [
          { label: "WordPress: Editing wp-config.php", url: "https://wordpress.org/documentation/article/editing-wp-config-php/" },
          { label: "$wpdb reference", url: "https://developer.wordpress.org/reference/classes/wpdb/" },
        ],
      },
    ],
  },
  {
    week: 3,
    phase: "APIs, Automation & AI Agents",
    topics: [
      {
        title: "Understanding APIs — REST, endpoints, HTTP methods, and status codes",
        objective: "Explain what an API is and call a public REST API using curl/Postman.",
        resources: [
          { label: "MDN: HTTP overview", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview" },
          { label: "REST API Tutorial", url: "https://restfulapi.net/" },
        ],
      },
      {
        title: "Introduction to automation with Make.com",
        objective: "Create your first Make.com scenario that triggers on a schedule.",
        resources: [
          { label: "Make.com Academy", url: "https://academy.make.com/" },
          { label: "Make.com help center", url: "https://www.make.com/en/help" },
        ],
      },
      {
        title: "Building your first automation workflow",
        objective: "Connect two apps (e.g., Google Sheets + Gmail) in a Make scenario.",
        resources: [
          { label: "Make.com: Create a scenario", url: "https://www.make.com/en/help/scenarios/create-a-scenario" },
        ],
      },
      {
        title: "Understanding AI agents and how they work",
        objective: "Explain the difference between a chatbot and an AI agent.",
        resources: [
          { label: "OpenAI: Building AI agents", url: "https://platform.openai.com/docs/guides/agents" },
          { label: "LangChain: Agent concepts", url: "https://python.langchain.com/docs/concepts/agents/" },
        ],
      },
      {
        title: "Building an intelligent workflow with webhooks",
        objective: "Trigger a Make scenario from an external system via webhook.",
        resources: [
          { label: "Make.com: Webhooks", url: "https://www.make.com/en/help/tools/webhooks" },
          { label: "MDN: Webhooks concept", url: "https://developer.mozilla.org/en-US/docs/Glossary/Webhook" },
        ],
      },
    ],
  },
  {
    week: 4,
    phase: "Prompt Engineering & AI Fundamentals",
    topics: [
      {
        title: "Understanding AI, LLMs, and how they generate text",
        objective: "Explain in plain English how an LLM generates the next token.",
        resources: [
          { label: "Google: Introduction to LLMs", url: "https://www.cloudskillsboost.google/paths/118" },
          { label: "3Blue1Brown: GPT visual intro", url: "https://www.youtube.com/watch?v=wjZofJX0v4M" },
        ],
      },
      {
        title: "Prompt engineering — writing effective prompts",
        objective: "Write a structured prompt with role, context, task, and format.",
        resources: [
          { label: "Google: Prompt engineering guide", url: "https://ai.google.dev/gemini-api/docs/prompting-strategies" },
          { label: "OpenAI: Prompt engineering", url: "https://platform.openai.com/docs/guides/prompt-engineering" },
        ],
      },
      {
        title: "Connecting to the Gemini API — API keys and making calls",
        objective: "Get a Gemini API key and make a successful API call from Postman.",
        resources: [
          { label: "Gemini API quickstart", url: "https://ai.google.dev/gemini-api/docs/quickstart" },
          { label: "Get an API key", url: "https://aistudio.google.com/app/apikey" },
        ],
      },
      {
        title: "Your first Gemini API integration",
        objective: "Write a small script (Node or Python) that calls Gemini and prints the response.",
        resources: [
          { label: "Gemini API: Node quickstart", url: "https://ai.google.dev/gemini-api/docs/quickstart?lang=node" },
          { label: "Gemini API: Python quickstart", url: "https://ai.google.dev/gemini-api/docs/quickstart?lang=python" },
        ],
      },
      {
        title: "Building an AI-powered website feature",
        objective: "Add an AI feature (chatbot, summarizer, etc.) to your project.",
        resources: [
          { label: "Gemini API: Chat tutorial", url: "https://ai.google.dev/gemini-api/docs/chat" },
          { label: "WordPress: Add custom JS", url: "https://developer.wordpress.org/themes/basics/including-css-javascript/" },
        ],
      },
    ],
  },
  {
    week: 5,
    phase: "Testing, Security & Deployment",
    topics: [
      {
        title: "Software testing and debugging — finding and fixing bugs",
        objective: "Write a basic test plan and reproduce a bug systematically.",
        resources: [
          { label: "MDN: Cross-browser testing", url: "https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Cross_browser_testing/" },
          { label: "Google: Testing strategies", url: "https://testing.googleblog.com/" },
        ],
      },
      {
        title: "Website performance optimization basics",
        objective: "Run Lighthouse and improve the score by at least 20 points.",
        resources: [
          { label: "web.dev: Performance", url: "https://web.dev/learn/performance/" },
          { label: "Lighthouse documentation", url: "https://developer.chrome.com/docs/lighthouse/overview" },
        ],
      },
      {
        title: "WordPress security and backups",
        objective: "Install a security plugin and configure automated backups.",
        resources: [
          { label: "WordPress: Hardening WordPress", url: "https://wordpress.org/documentation/article/hardening-wordpress/" },
          { label: "Wordfence security guide", url: "https://www.wordfence.com/learn/" },
        ],
      },
      {
        title: "Deploying your website to live web hosting",
        objective: "Deploy your local WordPress site to a live host (Hostinger, Kinsta, etc.).",
        resources: [
          { label: "WordPress: Hosting WordPress", url: "https://wordpress.org/documentation/article/hosting-wordpress/" },
          { label: "Migrating from LocalWP", url: "https://localwp.com/help-docs/migrating-from-local-to-live/" },
        ],
      },
      {
        title: "Final testing and project handover preparation",
        objective: "Run a full QA pass and prepare a handover document for the client.",
        resources: [
          { label: "Atlassian: QA checklist", url: "https://www.atlassian.com/software-testing/qa-checklist" },
          { label: "Project handover template", url: "https://www.atlassian.com/resources/templates/project-handover" },
        ],
      },
    ],
  },
  {
    week: 6,
    phase: "Career Prep & Final Capstone",
    topics: [
      {
        title: "Final project audit and quality assurance",
        objective: "Audit your project against a checklist and fix all critical issues.",
        resources: [
          { label: "web.dev: Audits", url: "https://web.dev/explore/audits" },
        ],
      },
      {
        title: "Building a professional GitHub portfolio",
        objective: "Polish your GitHub profile: README, pinned repos, profile README.",
        resources: [
          { label: "GitHub: Setting up your profile", url: "https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile" },
          { label: "Awesome GitHub profile READMEs", url: "https://github.com/abhisheknaiidu/awesome-github-profile-readme" },
        ],
      },
      {
        title: "Technical interview preparation and communication skills",
        objective: "Answer 5 common technical interview questions out loud without freezing.",
        resources: [
          { label: "Tech Interview Handbook", url: "https://www.techinterviewhandbook.org/" },
          { label: "Pramp: Mock interviews", url: "https://www.pramp.com/" },
        ],
      },
      {
        title: "Final project presentation and graduation",
        objective: "Deliver a 5-minute demo of your project to an audience.",
        resources: [
          { label: "How to demo a project", url: "https://www.atlassian.com/resources/templates/product-demo" },
        ],
      },
      {
        title: "Next steps in your career as a developer",
        objective: "Write a 30-day career action plan (job applications, portfolio, networking).",
        resources: [
          { label: "LinkedIn: Job search tips", url: "https://www.linkedin.com/business/talent/blog/job-search-tips" },
          { label: "Roadmap.sh: Developer roadmaps", url: "https://roadmap.sh/" },
        ],
      },
    ],
  },
];

/** Get the topics for a specific week. Returns empty array if invalid. */
export function getWeekTopics(week: number): DailyTopic[] {
  const w = WEEKLY_TOPICS.find(t => t.week === week);
  return w?.topics || [];
}

/** Get the phase name for a specific week. */
export function getWeekPhase(week: number): string {
  const w = WEEKLY_TOPICS.find(t => t.week === week);
  return w?.phase || `Week ${week}`;
}

/** Build a topic context string for the AI prompt.
 *  Lists the 5 daily topics for the week so the AI asks questions
 *  about what the student actually learned. */
export function getWeekTopicContext(week: number): string {
  const topics = getWeekTopics(week);
  const phase = getWeekPhase(week);
  return `Week ${week}: ${phase}. Topics covered this week:\n${topics.map((t, i) => `Day ${i + 1}: ${t.title}`).join("\n")}`;
}

/** Get just the titles (for backward compatibility with places that expect string[]). */
export function getWeekTopicTitles(week: number): string[] {
  return getWeekTopics(week).map(t => t.title);
}

/**
 * Map a Date (or JS day-of-week 0=Sun..6=Sat) to the bootcamp day number 1-5
 * (Mon=1, Tue=2, Wed=3, Thu=4, Fri=5). Weekends fall back to the nearest
 * weekday: Sunday → 1 (Monday), Saturday → 5 (Friday).
 *
 * Shared by /api/daily-tasks, /api/curriculum/progress, and the Overview
 * + QuestionPanel components so they all agree on "what day is it today".
 */
export function getBootcampDayNumber(dateOrDow: Date | number = new Date()): number {
  const jsDow = dateOrDow instanceof Date ? dateOrDow.getDay() : dateOrDow;
  const dayMap: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7 };
  return dayMap[jsDow] ?? 1;
}

/** Human-readable label for a bootcamp day number (1-5). */
export function getBootcampDayLabel(day: number): string {
  return ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][day] || `Day ${day}`;
}

/** Phase 1.5: Is the given date a rest day (Saturday or Sunday)?
 *  Rest days don't count against the student's streak and the UI shows
 *  a "rest day" message instead of pending tasks. */
export function isRestDay(date: Date = new Date()): boolean {
  const jsDow = date.getDay();
  return jsDow === 0 || jsDow === 6; // Sunday = 0, Saturday = 6
}

/** Phase 1.5: Human-readable label for today's rest-day status.
 *  Returns "" on weekdays, "Saturday" / "Sunday" on weekends. */
export function getRestDayLabel(date: Date = new Date()): string {
  const jsDow = date.getDay();
  if (jsDow === 6) return "Saturday";
  if (jsDow === 0) return "Sunday";
  return "";
}
