/**
 * ExaminerAI — Comprehensive Demo Seed (for original app's data model)
 *
 * Creates:
 *  - 1 Institution (FCCL JB Plant IT)
 *  - 1 admin, 1 principal, 2 teachers, 1 counsellor, 1 mentor, 50 students
 *  - 1 Demo account (auto-login target)
 *  - 2 Courses with full outlines (CS-301 DSA, MGT-205 Management)
 *  - CourseEnrollments (replacing batches)
 *  - Messages between roles
 *  - AuditLogs
 *  - Interactions (activity feed)
 *
 * Run: bun run scripts/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// ---------- helpers ----------
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length]
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pad = (n: number, len = 3) => String(n).padStart(len, '0')
const hashPwd = async (p: string) => bcrypt.hash(p, 10)

// ---------- data pools ----------
const firstNames = [
  'Aisha', 'Bilal', 'Cyrus', 'Dua', 'Ehsan', 'Fatima', 'Gulzar', 'Hadia', 'Imran', 'Javeria',
  'Kamran', 'Laiba', 'Mustafa', 'Nida', 'Owais', 'Parveen', 'Qasim', 'Rabia', 'Sufyan', 'Tania',
  'Umair', 'Varda', 'Waseem', 'Xenia', 'Yasir', 'Zainab', 'Ali', 'Bano', 'Daniyal', 'Eman',
  'Faraz', 'Gauhar', 'Hira', 'Iqbal', 'Junaid', 'Kiran', 'Luqman', 'Mehwish', 'Naveed', 'Omar',
  'Pareesa', 'Qurat', 'Rashid', 'Sara', 'Talha', 'Uzma', 'Vishal', 'Wajid', 'Yusra', 'Zohaib'
]
const lastNames = [
  'Khan', 'Ahmed', 'Malik', 'Sheikh', 'Qureshi', 'Raza', 'Hussain', 'Iqbal', 'Siddiqui', 'Butt',
  'Chaudhry', 'Hashmi', 'Jatoi', 'Khokhar', 'Lodhi', 'Mughal', 'Noon', 'Pathan', 'Rana', 'Sattar',
  'Tariq', 'Usman', 'Warsi', 'Yousaf', 'Zubairi', 'Akhtar', 'Bashir', 'Cheema', 'Durrani', 'Ejaz'
]

// ---------- course outlines (markdown) ----------
const cs301Outline = `# CS-301: Data Structures & Algorithms

## Course Description
A comprehensive study of fundamental data structures (arrays, linked lists, stacks, queues, trees, graphs, hash tables) and algorithms (searching, sorting, recursion, dynamic programming, greedy methods). Emphasis on complexity analysis and real-world problem solving.

## Learning Outcomes
1. Analyse time and space complexity using Big-O notation
2. Implement core data structures in a programming language of choice
3. Apply appropriate algorithms to solve computational problems
4. Evaluate trade-offs between competing data-structure choices
5. Design efficient solutions for real-world software engineering problems

## Weekly Outline
- Week 1 — Introduction & Complexity Analysis (Big-O, Big-Ω, Big-Θ)
- Week 2 — Arrays & Dynamic Arrays (amortized analysis)
- Week 3 — Linked Lists (singly, doubly, circular)
- Week 4 — Stacks & Queues (applications: parsing, BFS)
- Week 5 — Hash Tables (chaining vs. open addressing)
- Week 6 — Trees (BST, AVL, Red-Black)
- Week 7 — Heaps & Priority Queues
- Week 8 — Midterm Examination
- Week 9 — Graphs (representation, traversal)
- Week 10 — Graph Algorithms (Dijkstra, Bellman-Ford, Floyd-Warshall)
- Week 11 — Sorting Algorithms (merge, quick, heap, counting)
- Week 12 — Dynamic Programming (knapsack, LCS, matrix chain)
- Week 13 — Greedy Algorithms (Huffman, activity selection)
- Week 14 — String Algorithms (KMP, Rabin-Karp)
- Week 15 — Project Presentations
- Week 16 — Final Examination

## Assessment Structure
| Component        | Weight |
|------------------|--------|
| Quizzes (4)      | 15%    |
| Assignments (5)  | 20%    |
| Midterm          | 20%    |
| Project          | 20%    |
| Final            | 25%    |

## Textbook
- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022). Introduction to Algorithms (4th ed.). MIT Press.`

const mgt205Outline = `# MGT-205: Principles of Management

## Course Description
Foundational course covering the four pillars of management — Planning, Organising, Leading, and Controlling. Includes modern topics: change management, organisational behaviour, decision-making frameworks, and digital transformation in enterprises.

## Learning Outcomes
1. Understand the historical evolution and modern theories of management
2. Apply planning frameworks (SWOT, PESTEL, Porter's Five Forces)
3. Design organisational structures for different business contexts
4. Lead teams using situational and transformational leadership models
5. Implement control systems and KPI-driven performance management

## Weekly Outline
- Week 1 — Management: History, Theory & Contemporary Practice
- Week 2 — Planning & Strategic Management
- Week 3 — Decision-Making Frameworks (rational, bounded, intuitive)
- Week 4 — Organisational Structure & Design
- Week 5 — Human Resource Management fundamentals
- Week 6 — Motivation Theories (Maslow, Herzberg, McClelland)
- Week 7 — Leadership Styles (trait, behavioural, situational)
- Week 8 — Midterm Examination
- Week 9 — Communication & Conflict Resolution
- Week 10 — Organisational Culture & Change Management
- Week 11 — Controlling & Performance Measurement
- Week 12 — Operations Management & Quality Control
- Week 13 — Digital Transformation & Innovation
- Week 14 — Ethics, CSR & Sustainability
- Week 15 — Group Presentations
- Week 16 — Final Examination

## Assessment Structure
| Component           | Weight |
|---------------------|--------|
| Class Participation | 10%    |
| Case Studies (3)    | 20%    |
| Midterm             | 20%    |
| Group Project       | 25%    |
| Final               | 25%    |

## Textbook
- Robbins, S. P., Coulter, M., & DeCenzo, D. A. (2023). Fundamentals of Management (12th ed.). Pearson.`

// ============================================================
// MAIN
// ============================================================
async function main() {
  // Idempotent check: if --skip-if-populated was passed AND the DB already
  // has users, exit early without wiping anything. This preserves existing
  // users + data across re-deploys.
  if (await shouldSkip()) {
    return
  }

  console.log('🧹 Cleaning DB...')
  // Comprehensive cleanup — all models that we'll seed
  await db.interaction.deleteMany()
  await db.auditLog.deleteMany()
  await db.message.deleteMany()
  await db.certificate.deleteMany()
  await db.reportCard.deleteMany()
  await db.competency.deleteMany()
  await db.weeklyTest.deleteMany()
  await db.dailyLog.deleteMany()
  await db.dailyTest.deleteMany()
  await db.dailyTestAnswer.deleteMany()
  await db.skillMastery.deleteMany()
  await db.projectTask.deleteMany()
  await db.projectWeek.deleteMany()
  await db.projectReport.deleteMany()
  await db.groupTask.deleteMany()
  await db.groupTaskSubmission.deleteMany()
  await db.curriculumProgress.deleteMany()
  await db.peerAssessment.deleteMany()
  await db.chatSession.deleteMany()
  await db.accessGrant.deleteMany()
  await db.passwordResetRequest.deleteMany()
  await db.roleNavConfig.deleteMany()
  await db.guardianLink.deleteMany()
  await db.instructorRule.deleteMany()
  await db.aICache.deleteMany()
  await db.aIUsageLog.deleteMany()
  await db.setting.deleteMany()
  await db.courseWeek.deleteMany()
  await db.courseDay.deleteMany()
  await db.course.deleteMany()
  await db.user.deleteMany()
  await db.institution.deleteMany()

  console.log('🏛️  Creating institution...')
  const institution = await db.institution.create({
    data: {
      name: 'Inzet Enterprises Software Bootcamp',
      logoUrl: '',
      contactEmail: 'inzet.enterprises@gmail.com'
    }
  })

  // ---------- create users ----------
  const defaultPwd = await hashPwd('demo123')

  console.log('👤 Creating admin...')
  const admin = await db.user.create({
    data: {
      email: 'admin@examiner.ai',
      name: 'Administrator',
      passwordHash: await hashPwd('helloworld'),
      role: 'administrator',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })

  console.log('👑 Creating principal...')
  const principal = await db.user.create({
    data: {
      email: 'principal@fccl.com.pk',
      name: 'Dr. Asma Rauf',
      passwordHash: defaultPwd,
      role: 'principal',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })

  console.log('👩‍🏫 Creating 2 teachers...')
  const teacher1 = await db.user.create({
    data: {
      email: 's.khan@fccl.com.pk',
      name: 'Sir Saeed Khan',
      passwordHash: defaultPwd,
      role: 'instructor',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })
  const teacher2 = await db.user.create({
    data: {
      email: 'r.ahmed@fccl.com.pk',
      name: 'Maam Rabia Ahmed',
      passwordHash: defaultPwd,
      role: 'instructor',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })

  console.log('🧑‍⚕️ Creating counsellor...')
  const counsellor = await db.user.create({
    data: {
      email: 'counsellor@fccl.com.pk',
      name: 'Dr. Hina Siddiqui',
      passwordHash: defaultPwd,
      role: 'counselor',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })

  console.log('🌱 Creating mentor (course_coordinator role)...')
  const mentor = await db.user.create({
    data: {
      email: 'mentor@fccl.com.pk',
      name: 'Mr. Tariq Mehmood',
      passwordHash: defaultPwd,
      role: 'course_coordinator',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })

  console.log('🎓 Creating 50 students...')
  const students: { id: string; email: string; name: string }[] = []
  for (let i = 0; i < 50; i++) {
    const fn = firstNames[i % firstNames.length]
    const ln = lastNames[i % lastNames.length]
    const suffix = i >= firstNames.length ? Math.floor(i / firstNames.length) + 1 : ''
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${suffix ? suffix : ''}@students.fccl.com.pk`.replace(/[^a-z0-9.@-]/g, '')
    const s = await db.user.create({
      data: {
        email,
        name: `${fn} ${ln}`,
        passwordHash: defaultPwd,
        role: 'student',
        approvedAt: new Date(),
        institutionId: institution.id,
        currentWeek: rand(3, 12)
      }
    })
    students.push(s)
  }

  console.log('🧪 Creating DEMO account...')
  const demoUser = await db.user.create({
    data: {
      email: 'demo@examiner.ai',
      name: 'Demo User',
      passwordHash: defaultPwd,
      role: 'demo',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })

  console.log('👨‍👩‍👧 Creating a guardian account (linked to first student)...')
  const guardian = await db.user.create({
    data: {
      email: 'guardian@fccl.com.pk',
      name: 'Mr. Khan (Parent)',
      passwordHash: defaultPwd,
      role: 'guardian',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })
  // Link guardian to the first student (Aisha Khan)
  await db.guardianLink.create({
    data: {
      guardianId: guardian.id,
      studentId: students[0].id,
      relationship: 'parent'
    }
  }).catch(() => {})

  // ---------- courses ----------
  console.log('📚 Creating 2 courses...')
  const course1 = await db.course.create({
    data: {
      name: 'CS-301 Data Structures & Algorithms',
      description: 'A comprehensive study of fundamental data structures and algorithms with emphasis on complexity analysis and real-world problem solving.',
      domain: 'technology',
      level: 'intermediate',
      toolsUsed: JSON.stringify(['Python', 'Java', 'C++']),
      deliverableTypes: JSON.stringify(['code commit', 'written analysis', 'project']),
      assessmentType: 'socratic',
      institutionId: institution.id
    }
  })
  const course2 = await db.course.create({
    data: {
      name: 'MGT-205 Principles of Management',
      description: 'Foundational course covering planning, organising, leading, and controlling — with modern topics in change management and digital transformation.',
      domain: 'business',
      level: 'beginner',
      toolsUsed: JSON.stringify(['Case studies', 'HBR articles', 'Excel']),
      deliverableTypes: JSON.stringify(['case analysis', 'presentation', 'group project']),
      assessmentType: 'case-study',
      institutionId: institution.id
    }
  })

  // Save outlines as CourseWeek entries
  console.log('📅 Creating course weeks...')
  const csWeeks = ['Complexity', 'Arrays', 'Linked Lists', 'Stacks/Queues', 'Hash Tables', 'Trees', 'Heaps', 'Graphs', 'Dijkstra', 'Sorting', 'DP', 'Greedy']
  for (let i = 0; i < csWeeks.length; i++) {
    await db.courseWeek.create({
      data: {
        courseId: course1.id,
        weekNumber: i + 1,
        phase: csWeeks[i],
        milestone: i === 7 ? 'Midterm' : (i === 11 ? 'Final' : '')
      }
    })
  }
  const mgtWeeks = ['Intro to Mgmt', 'Planning', 'Strategy', 'Decision Making', 'Org Structure', 'HR', 'Motivation', 'Leadership', 'Communication', 'Change Mgmt', 'Controlling', 'Operations']
  for (let i = 0; i < mgtWeeks.length; i++) {
    await db.courseWeek.create({
      data: {
        courseId: course2.id,
        weekNumber: i + 1,
        phase: mgtWeeks[i],
        milestone: i === 7 ? 'Midterm' : (i === 11 ? 'Final' : '')
      }
    })
  }

  // ---------- course enrollments ----------
  console.log('📦 Creating course enrollments...')
  
  // Enroll instructors in courses
  await db.courseEnrollment.create({ data: { userId: teacher1.id, courseId: course1.id, role: 'instructor' } })
  await db.courseEnrollment.create({ data: { userId: teacher2.id, courseId: course2.id, role: 'instructor' } })
  
  // Enroll students in courses (replace batches with course enrollments)
  console.log('🔗 Enrolling students in courses...')
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    let courseId: string
    if (i < 15) courseId = course1.id
    else if (i < 30) courseId = course1.id
    else courseId = course2.id
    
    await db.courseEnrollment.create({
      data: { userId: s.id, courseId, role: 'student' }
    })
  }

  // ---------- messages ----------
  console.log('💬 Creating messages...')
  const messagePairs = [
    { from: students[0], to: teacher1, subject: 'Absence today', body: 'Sir, I could not attend today due to illness. Will submit doctor note.' },
    { from: teacher1, to: students[0], subject: 'Re: Absence today', body: 'Noted. Please submit Assignment 2 by Friday with late penalty waived.' },
    { from: students[5], to: counsellor, subject: 'Appointment request', body: 'Maam, can I book an appointment this week? Feeling overwhelmed.' },
    { from: counsellor, to: students[5], subject: 'Re: Appointment request', body: 'Of course. Thursday 2pm works? I will send a calendar invite.' },
    { from: students[10], to: mentor, subject: 'Career discussion', body: 'Sir, I want to discuss career options — software vs data science.' },
    { from: mentor, to: students[10], subject: 'Re: Career discussion', body: 'Great topic. Let us meet Friday 4pm. I will prep some questions for you.' },
    { from: teacher2, to: principal, subject: 'Additional tutorial slots', body: 'Maam, MGT-205 Section A needs additional tutorial slots — many students struggling with case analysis.' },
    { from: principal, to: teacher2, subject: 'Re: Additional tutorial slots', body: 'Approved. Please coordinate with admin to schedule a Friday 11am slot.' },
    { from: students[15], to: teacher1, subject: 'Assignment clarification', body: 'Sir, can you clarify the Dijkstra assignment requirements?' },
    { from: teacher1, to: students[15], subject: 'Re: Assignment clarification', body: 'Sure. Implement Dijkstra with adjacency list. Bonus marks for A* on grid.' },
    { from: students[3], to: mentor, subject: 'Box breathing worked!', body: 'I tried the box breathing before Quiz 3. It actually helped!' },
    { from: mentor, to: students[3], subject: 'Re: Box breathing worked!', body: 'Wonderful! Practice it daily — it compounds. Let us review next Tuesday.' }
  ]
  for (let i = 0; i < messagePairs.length; i++) {
    const m = messagePairs[i]
    await db.message.create({
      data: {
        fromId: m.from.id,
        toId: m.to.id,
        subject: m.subject,
        body: m.body,
        isRead: i % 3 !== 0,
        sentAt: new Date(Date.now() - i * 3600000)
      }
    })
  }

  // ---------- audit logs ----------
  console.log('📋 Creating audit logs...')
  const userMap: Record<string, { name: string; role: string }> = {
    [admin.id]: { name: admin.name, role: 'admin' },
    [teacher1.id]: { name: teacher1.name, role: 'instructor' },
    [teacher2.id]: { name: teacher2.name, role: 'instructor' },
    [counsellor.id]: { name: counsellor.name, role: 'counselor' },
    [mentor.id]: { name: mentor.name, role: 'course_coordinator' },
    [principal.id]: { name: principal.name, role: 'principal' }
  }
  const auditActions = [
    { userId: admin.id, action: 'login', targetType: 'auth', targetId: admin.id, meta: 'Web login' },
    { userId: admin.id, action: 'user_created', targetType: 'user', targetId: teacher1.id, meta: 'Created teacher account' },
    { userId: admin.id, action: 'course_created', targetType: 'course', targetId: course1.id, meta: 'Created CS-301' },
    { userId: teacher1.id, action: 'grade_changed', targetType: 'assessment', targetId: 'multiple', meta: 'Graded Quiz 1 for 30 students' },
    { userId: principal.id, action: 'report_viewed', targetType: 'report_card', targetId: 'multiple', meta: 'Viewed Q3 performance review' },
    { userId: principal.id, action: 'course_approved', targetType: 'course', targetId: course2.id, meta: 'Approved additional MGT-205 tutorial slot' },
    { userId: admin.id, action: 'institution_updated', targetType: 'institution', targetId: institution.id, meta: 'Updated institution contact info' }
  ]
  for (let i = 0; i < auditActions.length; i++) {
    const a = auditActions[i]
    const u = userMap[a.userId]
    await db.auditLog.create({
      data: {
        actorUserId: a.userId,
        actorName: u.name,
        actorRole: u.role,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        metadata: a.meta,
        createdAt: new Date(Date.now() - i * 86400000)
      }
    })
  }

  // ---------- interactions (activity feed) ----------
  console.log('📊 Creating interactions...')
  const interactionPillars = ['Why Probe', 'Break-It Scenario', 'Client Translation', 'Edge Case Test']
  const interactionTopics = ['arrays', 'linked-lists', 'trees', 'graphs', 'dp', 'motivation', 'leadership', 'case-study']
  const interactionQuestions = ['What is Big-O?', 'Explain Dijkstra', 'Define BST property', 'Compare DFS vs BFS', 'What is idempotency?', 'Why use a hash table?', 'When is greedy optimal?']
  for (let i = 0; i < 200; i++) {
    const s = students[i % students.length]
    await db.interaction.create({
      data: {
        userId: s.id,
        week: rand(1, 12),
        pillar: pick(interactionPillars, i),
        topic: pick(interactionTopics, i),
        question: pick(interactionQuestions, i),
        projectContext: pick(['Web app', 'CLI tool', 'Mobile app', 'Data pipeline', 'Research'], i),
        studentAnswer: pick(['Attempted solution', 'Partial answer', 'Correct', 'No response'], i),
        timeTakenSeconds: rand(30, 600),
        answerLength: rand(20, 500),
        correctness: rand(0, 100),
        feedback: pick(['Good attempt', 'Needs work', 'Excellent', 'Review fundamentals'], i),
        level: pick(['Beginner', 'Intermediate', 'Advanced'], i),
        date: new Date(Date.now() - rand(0, 14) * 86400000)
      }
    }).catch(() => {})
  }

  // ============================================================
  // COMPREHENSIVE EDUCATIONAL DATA
  // Fills the academic tabs so the demo shows full functionality
  // ============================================================
  console.log('\n📊 Filling comprehensive educational data...')

  // ---------- 2c. AccessGrants for demo account → all students ----------
  // CRITICAL: demo account has 'demo' role which needs an AccessGrant
  // to view student portfolios. Without this, the teacher's student portfolio
  // page fails to load with "You need an access grant to view this student".
  console.log('   🔑 Access grants for demo account (so portfolio loads)...')
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    await db.accessGrant.create({
      data: {
        granteeUserId: demoUser.id,
        scopeType: 'student',
        scopeId: s.id,
        dataScope: 'full',
        grantedByUserId: admin.id,
        grantedAt: new Date(Date.now() - 30 * 86400000)
      }
    }).catch(() => {})
  }
  // Also grant the demo access to all students via the counsellor + mentor too
  // (so when demo switches to Counsellor/Coordinator view, portfolio still works)
  for (const staffUser of [counsellor, mentor]) {
    for (let i = 0; i < students.length; i++) {
      const s = students[i]
      await db.accessGrant.create({
        data: {
          granteeUserId: staffUser.id,
          scopeType: 'student',
          scopeId: s.id,
          dataScope: 'full',
          grantedByUserId: admin.id,
          grantedAt: new Date(Date.now() - 30 * 86400000)
        }
      }).catch(() => {})
    }
  }

  // ---------- 3. Competencies for all students ----------
  console.log('   🎯 Competencies for all students...')
  const topics = ['arrays', 'linked-lists', 'stacks-queues', 'hash-tables', 'trees', 'graphs', 'sorting', 'dynamic-programming', 'greedy', 'motivation', 'leadership', 'case-study', 'planning', 'org-structure', 'communication']
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    // 4-6 competencies per student
    const compCount = (i % 3) + 4
    for (let c = 0; c < compCount; c++) {
      const topic = pick(topics, i + c)
      await db.competency.create({
        data: {
          userId: s.id,
          topic,
          level: pick(['Beginner', 'Intermediate', 'Advanced'], i + c),
          score: rand(20, 95),
          attempts: rand(3, 15),
          lastAssessed: new Date(Date.now() - rand(0, 14) * 86400000),
          weakSubTopics: JSON.stringify(pick([['time-complexity', 'space-complexity'], ['edge-cases'], ['recursion-depth'], ['null-handling'], []], i + c))
        }
      }).catch(() => {})
    }
  }

  // ---------- 6b. SkillMastery for all students (Educational tab) ----------
  console.log('   📈 Skill mastery (Educational tab)...')
  const masteryTopics = [
    { topic: 'arrays', pillar: 'Why Probe' },
    { topic: 'linked-lists', pillar: 'Why Probe' },
    { topic: 'stacks-queues', pillar: 'Break-It Scenario' },
    { topic: 'hash-tables', pillar: 'Client Translation' },
    { topic: 'trees', pillar: 'Why Probe' },
    { topic: 'graphs', pillar: 'Edge Case Test' },
    { topic: 'sorting', pillar: 'Break-It Scenario' },
    { topic: 'dynamic-programming', pillar: 'Edge Case Test' },
    { topic: 'greedy', pillar: 'Client Translation' },
    { topic: 'motivation', pillar: 'Why Probe' },
    { topic: 'leadership', pillar: 'Client Translation' },
    { topic: 'case-study', pillar: 'Edge Case Test' },
    { topic: 'planning', pillar: 'Why Probe' },
    { topic: 'communication', pillar: 'Client Translation' }
  ]
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    // 3-5 skill mastery entries per student
    const masteryCount = (i % 3) + 3
    for (let m = 0; m < masteryCount; m++) {
      const mt = pick(masteryTopics, i + m)
      await db.skillMastery.create({
        data: {
          userId: s.id,
          topic: mt.topic,
          pillar: mt.pillar,
          masteryLevel: pick(['not-started', 'developing', 'proficient', 'mastered'], i + m),
          evidenceCount: rand(2, 12),
          lastAssessedWeek: rand(1, 12),
          trend: pick(['improving', 'stable', 'declining'], i + m)
        }
      }).catch(() => {})
    }
  }

  // ---------- 7. WeeklyTests for all students ----------
  console.log('   📝 Weekly tests for all students...')
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const weeksToTest = (i % 4) + 2 // 2-5 weeks of tests
    for (let w = 0; w < weeksToTest; w++) {
      const score = rand(45, 95)
      await db.weeklyTest.create({
        data: {
          userId: s.id,
          week: w + 1,
          status: 'completed',
          startedAt: new Date(Date.now() - (weeksToTest - w) * 7 * 86400000),
          completedAt: new Date(Date.now() - (weeksToTest - w) * 7 * 86400000 + 30 * 60000),
          score,
          strengths: JSON.stringify(pick([['clear reasoning', 'good code structure'], ['thorough explanations', 'edge case awareness'], ['fast problem-solving', 'clean syntax'], ['deep understanding', 'excellent debugging']], w)),
          weaknesses: JSON.stringify(pick([['time management', 'overthinks solutions'], ['skips edge cases', 'rarely tests null input'], ['rushed answers', 'misses optimisation'], ['assumes input validity', 'no error handling']], w)),
          nextAction: pick([
            'Practice 3 more problems on this topic',
            'Review lecture notes before next test',
            'Try the extension problem for bonus',
            'Schedule office hours to review missed concepts',
            'Continue current pace — on track'
          ], w),
          plagiarismScore: rand(0, 15),
          currentQuestion: 5,
          replyCount: rand(3, 5)
        } as any
      }).catch(() => {})
    }
  }

  // ---------- 8. DailyLogs for all students ----------
  console.log('   📓 Daily logs for all students...')
  const dailyActivities = [
    'Completed 3 practice problems on arrays; reviewed Big-O notation',
    'Worked on capstone project — implemented user authentication',
    'Watched lecture on linked lists; took detailed notes',
    'Pair-programmed with peer on hash table implementation',
    'Debugged failing test cases for stack implementation',
    'Read chapter 7 on trees; completed exercises 1-5',
    'Worked through Dijkstra algorithm walkthrough',
    'Refactored project code; improved time complexity from O(n²) to O(n log n)',
    'Completed weekly test; reviewed mistakes with mentor',
    'Built CLI tool for visualising sorting algorithms',
    'Researched graph traversal applications in real-world systems',
    'Attended office hours; clarified recursion vs iteration trade-offs',
    'Wrote unit tests for queue implementation; 100% coverage',
    'Studied dynamic programming patterns; solved knapsack problem',
    'Reviewed peer code; gave constructive feedback on 3 PRs'
  ]
  const confusions = [
    'Confused about when to use BFS vs DFS',
    'Time complexity of recursive solutions still unclear',
    'Not sure when hash collisions become a performance issue',
    'Struggled with the pointer manipulation in linked list deletion',
    'Unclear on amortised analysis for dynamic arrays',
    'Dynamic programming state transition still feels magical',
    'Not sure how to choose between greedy and DP',
    'Graph representation (adjacency list vs matrix) — when to use which?',
    '',
    'Everything clicked this session!'
  ]
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const logCount = (i % 5) + 3 // 3-7 logs per student
    for (let l = 0; l < logCount; l++) {
      await db.dailyLog.create({
        data: {
          userId: s.id,
          week: rand(1, 12),
          whatDidYouDo: pick(dailyActivities, i + l),
          anyErrors: pick(['Fixed null pointer exception in tree traversal', 'Resolved stack overflow in recursive sort', 'No errors today', 'Had to refactor — was mutating input array', 'Spent 1hr on a typo bug 😅'], l),
          confidence: rand(1, 5),
          gitCommit: `https://github.com/student/practice/commit/${Math.random().toString(36).slice(2, 10)}`,
          learningReflection: pick(['Learned that choosing the right data structure upfront saves hours of refactoring', 'Recursion makes tree problems so much cleaner', 'Hash tables are powerful but collisions need careful handling', 'Big-O analysis helps me reason about scalability', 'Practice makes patterns recognisable'], l),
          confusionNotes: pick(confusions, l),
          nextQuestion: pick(['How do I measure real-world performance vs theoretical complexity?', 'When is recursion preferable to iteration?', 'How do databases index using B-trees?', 'What patterns indicate I should use DP vs greedy?', 'How does garbage collection interact with linked structures?'], l),
          date: new Date(Date.now() - l * 86400000)
        }
      }).catch(() => {})
    }
  }

  // ---------- 9. ReportCards for all students ----------
  console.log('   📊 Report cards for all students...')
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const weeksToReport = (i % 3) + 1 // 1-3 report cards
    for (let w = 0; w < weeksToReport; w++) {
      const score = rand(55, 95)
      const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
      await db.reportCard.create({
        data: {
          userId: s.id,
          week: w + 1,
          grade,
          score,
          strengths: JSON.stringify(pick([['analytical thinking', 'consistent effort', 'excellent participation'], ['clean code', 'thorough testing', 'good documentation'], ['creative problem-solving', 'helps peers', 'asks insightful questions'], ['strong fundamentals', 'steady progress', 'reliable attendance']], w)),
          weaknesses: JSON.stringify(pick([['time management under pressure', 'rushes through edge cases'], ['over-engineers solutions', 'needs simpler approach'], ['inconsistent practice', 'gaps in fundamentals'], ['avoidance of difficult topics', 'procrastination']], w)),
          progress: pick(['Strong upward trajectory; ready for advanced topics', 'Steady progress; on track to meet course outcomes', 'Plateaued; needs new challenge or different approach', 'Recovered from early struggles; momentum building'], w),
          nextSteps: JSON.stringify(pick([['Continue daily practice', 'Start capstone planning', 'Mentor a junior peer'], ['Focus on weak areas', 'Schedule office hours weekly', 'Try extension problems'], ['Maintain current pace', 'Explore enrichment material', 'Build portfolio project'], ['Review fundamentals', 'Complete missed assignments', 'Attend all office hours']], w)),
          date: new Date(Date.now() - w * 7 * 86400000)
        }
      }).catch(() => {})
    }
  }

  console.log('   ✅ Comprehensive data fill complete!')

  console.log('\n✅ Seed complete!')
  console.log(`   - Institution: 1`)
  console.log(`   - Users: 57 (admin, principal, 2 teachers, counsellor, mentor, 50 students, demo)`)
  console.log(`   - Courses: 2 with professional outlines`)
   console.log(`   - CourseEnrollments: ${50 + 2} (50 students + 2 instructors)`)
  console.log(`   - Course weeks: ${csWeeks.length + mgtWeeks.length}`)
  console.log(`   - Competencies: 250+ (4-6 per student)`)
  console.log(`   - Weekly tests: 150+ (2-5 per student with scores)`)
  console.log(`   - Daily logs: 250+ (3-7 per student with reflections)`)
  console.log(`   - Report cards: 100+ (1-3 per student)`)
  console.log(`   - Messages: ${messagePairs.length}`)
  console.log(`   - Audit logs: ${auditActions.length}`)
  console.log(`   - Interactions: 200`)
  console.log(`\n🔑 DEMO LOGIN: demo@examiner.ai / demo123`)
  console.log(`   (or admin@examiner.ai / helloworld)`)
  console.log(`   Demo account has 'demo' role — read-only, no writes.`)
}

/**
 * ensureCoreAccounts — always runs, even when seed is skipped.
 * Ensures the admin + demo accounts exist so login always works.
 * If the accounts already exist, they're left untouched.
 */
async function ensureCoreAccounts() {
  console.log('🔐 Ensuring core accounts exist (admin + demo)...')
  const adminPwd = await hashPwd('helloworld')
  const demoPwd = await hashPwd('demo123')

  // Ensure admin account
  await db.user.upsert({
    where: { email: 'admin@examiner.ai' },
    update: {}, // don't overwrite existing password/role
    create: {
      email: 'admin@examiner.ai',
      name: 'Administrator',
      passwordHash: adminPwd,
      role: 'administrator',
      approvedAt: new Date(),
    },
  }).catch(() => {})

  // Ensure demo account
  await db.user.upsert({
    where: { email: 'demo@examiner.ai' },
    update: {}, // don't overwrite existing password/role
    create: {
      email: 'demo@examiner.ai',
      name: 'Demo User',
      passwordHash: demoPwd,
      role: 'demo',
      approvedAt: new Date(),
    },
  }).catch(() => {})

  console.log('✓ Core accounts verified.')
}

// Check for --skip-if-populated flag. When set, the seed checks if the
// database already has users and skips seeding entirely if so. This makes
// the build idempotent — re-deploys don't wipe existing users.
const skipIfPopulated = process.argv.includes('--skip-if-populated')

async function shouldSkip(): Promise<boolean> {
  if (!skipIfPopulated) return false
  try {
    const userCount = await db.user.count()
    if (userCount > 0) {
      console.log(`⏭️  Database already has ${userCount} users — skipping seed (--skip-if-populated).`)
      console.log('   Existing users and data are preserved.')
      return true
    }
  } catch (err) {
    // If the count fails (e.g. table doesn't exist yet), don't skip —
    // the schema push should have created the tables.
    console.log('⚠️  Could not check user count, proceeding with seed:', err instanceof Error ? err.message : String(err))
  }
  return false
}

async function run() {
  // Always ensure core accounts (admin + demo) exist — even if seed is skipped.
  // This guarantees login always works after a deploy.
  await ensureCoreAccounts().catch(e =>
    console.error('⚠️  ensureCoreAccounts failed (non-blocking):', e instanceof Error ? e.message : String(e))
  )
  // Run the full seed (which internally checks --skip-if-populated)
  await main()
}

run()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
