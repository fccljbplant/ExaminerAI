/**
 * Seed marketplace demo courses so the platform has visible content.
 * Run: node scripts/seed-marketplace-courses.js
 */
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const DEMO_COURSES = [
  {
    name: "Modern Web Development & AI Integration",
    subtitle: "From zero to full-stack developer in 6 weeks",
    description: "A comprehensive 6-week bootcamp covering HTML, CSS, JavaScript, React, APIs, databases, and AI integration. Students build a real capstone project and earn a verified credential.",
    category: "technology",
    level: "beginner",
    price: 299,
    durationWeeks: 6,
    featured: true,
    published: true,
    instructorName: "FCCL Engineering Team",
    instructorBio: "Senior engineers from FCCL with 10+ years of industry experience in web development and AI integration.",
    whatYouWillLearn: JSON.stringify([
      "Build responsive websites with HTML, CSS, and JavaScript",
      "Create React components and manage application state",
      "Design and query relational databases with SQL",
      "Integrate AI APIs (Gemini, OpenAI) into web applications",
      "Deploy a full-stack application to production",
      "Use Git & GitHub for professional version control"
    ]),
    prerequisites: JSON.stringify([
      "Basic computer literacy",
      "A laptop with internet connection",
      "No prior coding experience required"
    ]),
    skillsVerified: JSON.stringify([
      "HTML/CSS", "JavaScript (ES6+)", "React", "API Integration",
      "Database Design", "Git Workflow", "AI API Integration", "Deployment"
    ]),
    thumbnailUrl: "https://picsum.photos/seed/web-development,coding&sig=1/600/400",
    trailerVideoUrl: null,
  },
  {
    name: "Python for Data Engineering",
    subtitle: "Master data pipelines, ETL, and analytics",
    description: "Learn Python from basics to advanced data engineering. Build ETL pipelines, work with Pandas, create data visualizations, and deploy data-driven applications.",
    category: "data",
    level: "intermediate",
    price: 249,
    durationWeeks: 5,
    featured: true,
    published: true,
    instructorName: "FCCL Engineering Team",
    instructorBio: "Data engineers with expertise in Python, Pandas, and production data pipelines.",
    whatYouWillLearn: JSON.stringify([
      "Write clean, idiomatic Python code",
      "Build ETL pipelines with Pandas and NumPy",
      "Create data visualizations with Matplotlib and Seaborn",
      "Work with REST APIs for data collection",
      "Deploy data applications to the cloud"
    ]),
    prerequisites: JSON.stringify([
      "Basic programming knowledge (any language)",
      "Familiarity with spreadsheets or databases"
    ]),
    skillsVerified: JSON.stringify([
      "Python", "Pandas", "NumPy", "Data Visualization",
      "ETL Pipelines", "API Integration"
    ]),
    thumbnailUrl: "https://picsum.photos/seed/python,data,analytics&sig=2/600/400",
    trailerVideoUrl: null,
  },
  {
    name: "DevOps Fundamentals with Cloud Labs",
    subtitle: "Docker, CI/CD, and cloud deployment essentials",
    description: "Hands-on DevOps training covering Docker containers, CI/CD pipelines, Kubernetes basics, and cloud deployment. Build real infrastructure, not just theory.",
    category: "technology",
    level: "intermediate",
    price: 349,
    durationWeeks: 5,
    featured: true,
    published: true,
    instructorName: "FCCL Engineering Team",
    instructorBio: "DevOps engineers managing production infrastructure for 500+ applications.",
    whatYouWillLearn: JSON.stringify([
      "Containerize applications with Docker",
      "Build CI/CD pipelines with GitHub Actions",
      "Deploy to AWS/Azure/GCP",
      "Monitor and log production systems",
      "Implement infrastructure as code"
    ]),
    prerequisites: JSON.stringify([
      "Basic Linux command line",
      "Some programming experience",
      "Understanding of web applications"
    ]),
    skillsVerified: JSON.stringify([
      "Docker", "CI/CD", "Cloud Deployment", "Linux",
      "Infrastructure as Code", "Monitoring"
    ]),
    thumbnailUrl: "https://picsum.photos/seed/devops,cloud,servers&sig=3/600/400",
    trailerVideoUrl: null,
  },
  {
    name: "Git & Version Control Essentials",
    subtitle: "Master the #1 developer tool — free course",
    description: "Learn Git from basics to advanced. Understand branching, merging, pull requests, and collaboration workflows used by professional engineering teams worldwide.",
    category: "technology",
    level: "beginner",
    price: 0,
    durationWeeks: 1,
    featured: false,
    published: true,
    instructorName: "FCCL Engineering Team",
    instructorBio: "Senior engineers who use Git daily in production environments.",
    whatYouWillLearn: JSON.stringify([
      "Initialize and manage Git repositories",
      "Use branches, merges, and pull requests",
      "Resolve merge conflicts",
      "Collaborate on GitHub like a professional",
      "Write meaningful commit messages"
    ]),
    prerequisites: JSON.stringify([
      "Basic computer literacy",
      "A laptop with internet connection"
    ]),
    skillsVerified: JSON.stringify([
      "Git", "GitHub", "Version Control", "Branching", "Collaboration"
    ]),
    thumbnailUrl: "https://picsum.photos/seed/git,version-control,code&sig=4/600/400",
    trailerVideoUrl: null,
  },
  {
    name: "SQL Fundamentals for Engineers",
    subtitle: "Database design and querying — free course",
    description: "Master SQL from basics to advanced queries. Learn database design, normalization, joins, aggregations, and performance optimization.",
    category: "data",
    level: "beginner",
    price: 0,
    durationWeeks: 2,
    featured: false,
    published: true,
    instructorName: "FCCL Engineering Team",
    instructorBio: "Database engineers with experience in PostgreSQL, MySQL, and SQL Server.",
    whatYouWillLearn: JSON.stringify([
      "Write basic to advanced SQL queries",
      "Design normalized database schemas",
      "Use JOINs, subqueries, and window functions",
      "Optimize query performance",
      "Understand transactions and ACID properties"
    ]),
    prerequisites: JSON.stringify([
      "Basic computer literacy",
      "No prior database experience required"
    ]),
    skillsVerified: JSON.stringify([
      "SQL", "Database Design", "Query Optimization", "Joins", "Normalization"
    ]),
    thumbnailUrl: "https://picsum.photos/seed/database,sql,data&sig=5/600/400",
    trailerVideoUrl: null,
  },
  {
    name: "Workplace Safety & Compliance Training",
    subtitle: "Industry-standard safety certification preparation",
    description: "Comprehensive safety training covering workplace hazards, PPE, emergency procedures, and regulatory compliance. Suitable for manufacturing, construction, and industrial environments.",
    category: "compliance",
    level: "beginner",
    price: 199,
    durationWeeks: 3,
    featured: false,
    published: true,
    instructorName: "FCCL Safety Team",
    instructorBio: "Certified safety professionals with 15+ years of industrial safety experience.",
    whatYouWillLearn: JSON.stringify([
      "Identify and mitigate workplace hazards",
      "Proper use of Personal Protective Equipment (PPE)",
      "Emergency response procedures",
      "Understand OSHA and industry compliance requirements",
      "Conduct safety audits and risk assessments"
    ]),
    prerequisites: JSON.stringify([
      "No prior experience required",
      "Suitable for all industry workers"
    ]),
    skillsVerified: JSON.stringify([
      "Workplace Safety", "PPE", "Hazard Identification",
      "Emergency Response", "Compliance", "Risk Assessment"
    ]),
    thumbnailUrl: "https://picsum.photos/seed/safety,industrial,workplace&sig=6/600/400",
    trailerVideoUrl: null,
  },
  {
    name: "Project Management for Engineers",
    subtitle: "Agile, Scrum, and leading technical teams",
    description: "Learn project management methodologies tailored for engineering teams. Master Agile, Scrum, sprint planning, stakeholder communication, and technical decision-making.",
    category: "business",
    level: "intermediate",
    price: 229,
    durationWeeks: 4,
    featured: false,
    published: true,
    instructorName: "FCCL Management Team",
    instructorBio: "PMP-certified project managers with experience leading engineering teams at scale.",
    whatYouWillLearn: JSON.stringify([
      "Run effective Agile/Scrum ceremonies",
      "Plan and estimate technical projects",
      "Communicate with stakeholders and executives",
      "Manage technical debt and priorities",
      "Lead cross-functional engineering teams"
    ]),
    prerequisites: JSON.stringify([
      "Some experience working in a team environment",
      "Basic understanding of software development"
    ]),
    skillsVerified: JSON.stringify([
      "Agile/Scrum", "Sprint Planning", "Stakeholder Communication",
      "Technical Estimation", "Team Leadership"
    ]),
    thumbnailUrl: "https://picsum.photos/seed/project-management,team,business&sig=7/600/400",
    trailerVideoUrl: null,
  },
  {
    name: "Financial Analysis & Reporting",
    subtitle: "Excel, financial modeling, and business intelligence",
    description: "Master financial analysis from basics to advanced modeling. Learn Excel, financial statements, ratio analysis, forecasting, and business intelligence tools.",
    category: "finance",
    level: "intermediate",
    price: 259,
    durationWeeks: 4,
    featured: false,
    published: true,
    instructorName: "FCCL Finance Team",
    instructorBio: "CFA-certified financial analysts with experience in corporate finance and investment banking.",
    whatYouWillLearn: JSON.stringify([
      "Build financial models in Excel",
      "Analyze financial statements (P&L, Balance Sheet, Cash Flow)",
      "Calculate and interpret financial ratios",
      "Create revenue and expense forecasts",
      "Present financial insights to decision-makers"
    ]),
    prerequisites: JSON.stringify([
      "Basic Excel skills",
      "Understanding of basic business concepts"
    ]),
    skillsVerified: JSON.stringify([
      "Financial Modeling", "Excel", "Financial Statements",
      "Ratio Analysis", "Forecasting", "Business Intelligence"
    ]),
    thumbnailUrl: "https://picsum.photos/seed/finance,analysis,excel&sig=8/600/400",
    trailerVideoUrl: null,
  },
];

async function main() {
  console.log("Seeding marketplace demo courses...\n");

  for (const course of DEMO_COURSES) {
    // Check if course already exists
    const existing = await db.course.findUnique({ where: { name: course.name } });
    if (existing) {
      // Update the existing course with marketplace fields
      await db.course.update({
        where: { id: existing.id },
        data: {
          subtitle: course.subtitle,
          category: course.category,
          price: course.price,
          currency: "USD",
          durationWeeks: course.durationWeeks,
          language: "en",
          thumbnailUrl: course.thumbnailUrl,
          published: course.published,
          featured: course.featured,
          instructorName: course.instructorName,
          instructorBio: course.instructorBio,
          whatYouWillLearn: course.whatYouWillLearn,
          prerequisites: course.prerequisites,
          skillsVerified: course.skillsVerified,
          description: course.description,
          level: course.level,
        },
      });
      console.log(`  ✓ Updated: ${course.name}`);
    } else {
      // Create new course
      const created = await db.course.create({
        data: {
          name: course.name,
          description: course.description,
          ...course,
          currency: "USD",
          language: "en",
          isActive: true,
        },
      });
      console.log(`  ✓ Created: ${course.name} (${created.id})`);
    }
  }

  // Create learning paths
  console.log("\nSeeding learning paths...\n");

  const webDevCourse = await db.course.findUnique({ where: { name: "Modern Web Development & AI Integration" } });
  const gitCourse = await db.course.findUnique({ where: { name: "Git & Version Control Essentials" } });
  const sqlCourse = await db.course.findUnique({ where: { name: "SQL Fundamentals for Engineers" } });
  const devopsCourse = await db.course.findUnique({ where: { name: "DevOps Fundamentals with Cloud Labs" } });

  if (webDevCourse && gitCourse && sqlCourse) {
    // Frontend Developer Path
    const existingPath = await db.learningPath.findUnique({ where: { title: "Full-Stack Developer Path" } });
    if (!existingPath) {
      const path = await db.learningPath.create({
        data: {
          title: "Full-Stack Developer Path",
          subtitle: "From beginner to job-ready full-stack developer",
          description: "A complete career track covering Git fundamentals, database design, and full-stack web development with AI integration. Earn a path credential upon completion.",
          category: "technology",
          icon: "🚀",
          price: 799,
          currency: "USD",
          durationWeeks: 9,
          level: "beginner",
          published: true,
          featured: true,
          courses: {
            create: [
              { courseId: gitCourse.id, order: 1, isCapstone: false },
              { courseId: sqlCourse.id, order: 2, isCapstone: false },
              { courseId: webDevCourse.id, order: 3, isCapstone: true },
            ],
          },
        },
      });
      console.log(`  ✓ Created path: ${path.title}`);
    } else {
      console.log(`  ⊘ Path already exists: Full-Stack Developer Path`);
    }
  }

  if (webDevCourse && devopsCourse) {
    // DevOps Engineer Path
    const existingPath = await db.learningPath.findUnique({ where: { title: "DevOps Engineer Path" } });
    if (!existingPath) {
      const path = await db.learningPath.create({
        data: {
          title: "DevOps Engineer Path",
          subtitle: "From developer to infrastructure engineer",
          description: "Master web development fundamentals, then advance to Docker, CI/CD, and cloud deployment. Become a full-spectrum DevOps engineer.",
          category: "technology",
          icon: "⚙️",
          price: 899,
          currency: "USD",
          durationWeeks: 11,
          level: "intermediate",
          published: true,
          featured: true,
          courses: {
            create: [
              { courseId: gitCourse?.id || webDevCourse.id, order: 1, isCapstone: false },
              { courseId: webDevCourse.id, order: 2, isCapstone: false },
              { courseId: devopsCourse.id, order: 3, isCapstone: true },
            ],
          },
        },
      });
      console.log(`  ✓ Created path: ${path.title}`);
    } else {
      console.log(`  ⊘ Path already exists: DevOps Engineer Path`);
    }
  }

  console.log("\n✅ Seed complete!");
  console.log("   Visit /courses to see the marketplace.");
  console.log("   Visit /courses/category/technology to see category pages.");
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
