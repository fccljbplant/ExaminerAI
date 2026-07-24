/**
 * ExaminerAI - Comprehensive Demo Seed
 * Creates: 1 institution, 1 admin, 1 principal, 2 teachers, 1 counsellor, 1 mentor,
 *          50 students, 2 professional courses with outlines, batches, sessions,
 *          attendance, grades, alerts (with responses), mentor sessions (psych + edu),
 *          messages, timeline events, audit log, assignments & submissions,
 *          and the all-powerful DEMO developer account.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ---------- helpers ----------
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length]
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pad = (n: number, len = 3) => String(n).padStart(len, '0')

// ---------- data pools ----------
const firstNames = [
  'Aisha', 'Bilal', 'Cyrus', 'Dua', 'Ehsan', 'Fatima', 'Gulzar', 'Hadia', 'Imran', 'Javeria',
  'Kamran', 'Laiba', 'Mustafa', 'Nida', 'Owais', 'Parveen', 'Qasim', 'Rabia', 'Sufyan', 'Tania',
  'Umair', 'Varda', 'Waseem', 'Xenia', 'Yasir', 'Zainab', 'Ali', 'Bano', 'Daniyal', 'Eman',
  'Faraz', 'Gauhar', 'Hira', 'Iqbal', 'Junaid', 'Kiran', 'Luqman', 'Mehwish', 'Naveed', 'Omar',
  'Pareesa', 'Qurat', 'Rashid', 'Sara', 'Talha', 'Uzma', 'Vishal', 'Wajid', 'Yusra', 'Zohaib',
  'Amna', 'Bilquis'
]
const lastNames = [
  'Khan', 'Ahmed', 'Malik', 'Sheikh', 'Qureshi', 'Raza', 'Hussain', 'Iqbal', 'Siddiqui', 'Butt',
  'Chaudhry', 'Hashmi', 'Jatoi', 'Khokhar', 'Lodhi', 'Mughal', 'Noon', 'Pathan', 'Rana', 'Sattar',
  'Tariq', 'Usman', 'Warsi', 'Yousaf', 'Zubairi', 'Akhtar', 'Bashir', 'Cheema', 'Durrani', 'Ejaz'
]

const moods = ['HAPPY', 'NEUTRAL', 'ANXIOUS', 'SAD', 'STRESSED', 'MOTIVATED'] as const
const attendanceStatuses = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const

// ---------- course outlines (professional) ----------
const course1Outline = `# CS-301: Data Structures & Algorithms

## Course Description
A comprehensive study of fundamental data structures (arrays, linked lists, stacks, queues, trees, graphs, hash tables) and algorithms (searching, sorting, recursion, dynamic programming, greedy methods). Emphasis on complexity analysis and real-world problem solving.

## Learning Outcomes
By the end of this course, students will be able to:
1. Analyse time and space complexity using Big-O notation
2. Implement core data structures in a programming language of choice
3. Apply appropriate algorithms to solve computational problems
4. Evaluate trade-offs between competing data-structure choices
5. Design efficient solutions for real-world software engineering problems

## Weekly Outline
- **Week 1** — Introduction & Complexity Analysis (Big-O, Big-Ω, Big-Θ)
- **Week 2** — Arrays & Dynamic Arrays (amortized analysis)
- **Week 3** — Linked Lists (singly, doubly, circular)
- **Week 4** — Stacks & Queues (applications: parsing, BFS)
- **Week 5** — Hash Tables (chaining vs. open addressing)
- **Week 6** — Trees (BST, AVL, Red-Black)
- **Week 7** — Heaps & Priority Queues
- **Week 8** — Midterm Examination
- **Week 9** — Graphs (representation, traversal)
- **Week 10** — Graph Algorithms (Dijkstra, Bellman-Ford, Floyd-Warshall)
- **Week 11** — Sorting Algorithms (merge, quick, heap, counting)
- **Week 12** — Dynamic Programming (knapsack, LCS, matrix chain)
- **Week 13** — Greedy Algorithms (Huffman, activity selection)
- **Week 14** — String Algorithms (KMP, Rabin-Karp)
- **Week 15** — Project Presentations
- **Week 16** — Final Examination

## Assessment Structure
| Component        | Weight |
|------------------|--------|
| Quizzes (4)      | 15%    |
| Assignments (5)  | 20%    |
| Midterm          | 20%    |
| Project          | 20%    |
| Final            | 25%    |

## Textbook
- Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022). *Introduction to Algorithms* (4th ed.). MIT Press.`

const course2Outline = `# MGT-205: Principles of Management

## Course Description
Foundational course covering the four pillars of management — Planning, Organising, Leading, and Controlling. Includes modern topics: change management, organisational behaviour, decision-making frameworks, and digital transformation in enterprises.

## Learning Outcomes
1. Understand the historical evolution and modern theories of management
2. Apply planning frameworks (SWOT, PESTEL, Porter's Five Forces)
3. Design organisational structures for different business contexts
4. Lead teams using situational and transformational leadership models
5. Implement control systems and KPI-driven performance management

## Weekly Outline
- **Week 1** — Management: History, Theory & Contemporary Practice
- **Week 2** — Planning & Strategic Management
- **Week 3** — Decision-Making Frameworks (rational, bounded, intuitive)
- **Week 4** — Organisational Structure & Design
- **Week 5** — Human Resource Management fundamentals
- **Week 6** — Motivation Theories (Maslow, Herzberg, McClelland)
- **Week 7** — Leadership Styles (trait, behavioural, situational)
- **Week 8** — Midterm Examination
- **Week 9** — Communication & Conflict Resolution
- **Week 10** — Organisational Culture & Change Management
- **Week 11** — Controlling & Performance Measurement
- **Week 12** — Operations Management & Quality Control
- **Week 13** — Digital Transformation & Innovation
- **Week 14** — Ethics, CSR & Sustainability
- **Week 15** — Group Presentations
- **Week 16** — Final Examination

## Assessment Structure
| Component           | Weight |
|---------------------|--------|
| Class Participation | 10%    |
| Case Studies (3)    | 20%    |
| Midterm             | 20%    |
| Group Project       | 25%    |
| Final               | 25%    |

## Textbook
- Robbins, S. P., Coulter, M., & DeCenzo, D. A. (2023). *Fundamentals of Management* (12th ed.). Pearson.`

// ---------- AI timeline events for a course ----------
const aiTimelineEvents = [
  { type: 'LECTURE', title: 'Lecture 01 — Introduction & Complexity', description: 'Big-O notation, asymptotic analysis, intro to DSA' },
  { type: 'LECTURE', title: 'Lecture 02 — Arrays & Dynamic Arrays', description: 'Static vs dynamic arrays, amortized insertion cost' },
  { type: 'RESOURCE', title: 'AI-Generated: Complexity Cheat Sheet', description: 'Auto-generated quick reference for Big-O of common operations' },
  { type: 'QUIZ', title: 'Quiz 01 — Complexity Analysis', description: '10 MCQs + 2 short problems, weight 4%' },
  { type: 'ASSIGNMENT', title: 'Assignment 01 — Implement a Singly Linked List', description: 'Due: Week 3. Submit code + complexity analysis.' },
  { type: 'LECTURE', title: 'Lecture 03 — Linked Lists in Practice', description: 'Singly, doubly, circular; sentinel nodes' },
  { type: 'LECTURE', title: 'Lecture 04 — Stacks & Queues', description: 'LIFO vs FIFO, applications in parsing and BFS' },
  { type: 'AI_GENERATED', title: 'AI-Generated Practice Problems', description: '5 problems auto-generated to reinforce stack/queue mastery' },
  { type: 'QUIZ', title: 'Quiz 02 — Stacks, Queues, Linked Lists', description: 'Weight 4%' },
  { type: 'ASSIGNMENT', title: 'Assignment 02 — Build a Hash Table', description: 'Implement chaining & open addressing; benchmark' },
  { type: 'LECTURE', title: 'Lecture 05 — Hash Tables', description: 'Hash functions, collision resolution, load factor' },
  { type: 'LECTURE', title: 'Lecture 06 — Binary Search Trees', description: 'BST property, traversal, deletion cases' },
  { type: 'LECTURE', title: 'Lecture 07 — Balanced Trees (AVL, Red-Black)', description: 'Rotations, balance factor, real-world usage' },
  { type: 'LECTURE', title: 'Lecture 08 — Heaps & Priority Queues', description: 'Binary heap, heapify, applications' },
  { type: 'MILESTONE', title: 'MIDTERM EXAM', description: 'Covers Weeks 1-7, 20% weight' },
  { type: 'LECTURE', title: 'Lecture 09 — Graphs & Traversal', description: 'Adjacency list/matrix, BFS, DFS' },
  { type: 'LECTURE', title: 'Lecture 10 — Shortest Path Algorithms', description: 'Dijkstra, Bellman-Ford, Floyd-Warshall' },
  { type: 'AI_GENERATED', title: 'AI-Generated: Visual Walkthrough', description: 'Step-by-step animation of Dijkstra on a sample graph' },
  { type: 'QUIZ', title: 'Quiz 03 — Graphs', description: 'Weight 4%' },
  { type: 'ASSIGNMENT', title: 'Assignment 03 — Implement Dijkstra', description: 'Bonus: A* for grid pathfinding' },
  { type: 'LECTURE', title: 'Lecture 11 — Sorting Algorithms', description: 'Merge, quick, heap, counting sort' },
  { type: 'LECTURE', title: 'Lecture 12 — Dynamic Programming', description: 'Memoization vs tabulation, classic problems' },
  { type: 'LECTURE', title: 'Lecture 13 — Greedy Algorithms', description: 'Huffman coding, activity selection' },
  { type: 'LECTURE', title: 'Lecture 14 — String Algorithms', description: 'KMP, Rabin-Karp' },
  { type: 'ASSIGNMENT', title: 'Assignment 04 — DP Problem Set', description: 'LCS, knapsack, matrix chain multiplication' },
  { type: 'MILESTONE', title: 'Project Presentations', description: 'Each team presents a real-world DSA application' },
  { type: 'MILESTONE', title: 'FINAL EXAM', description: 'Comprehensive, 25% weight' }
]

const mgmtTimelineEvents = [
  { type: 'LECTURE', title: 'Lecture 01 — What is Management?', description: 'Definition, evolution, classical vs modern schools' },
  { type: 'LECTURE', title: 'Lecture 02 — Planning & Strategy', description: 'SWOT, PESTEL, Porter, vision/mission' },
  { type: 'RESOURCE', title: 'AI-Generated: Case Study — Apple vs Samsung', description: 'Auto-generated strategic comparison case' },
  { type: 'CASE', title: 'Case Study 01 — Strategic Planning', description: 'Analyse Netflix pivot from DVD to streaming' },
  { type: 'LECTURE', title: 'Lecture 03 — Decision Making', description: 'Rational, bounded rationality, intuition' },
  { type: 'LECTURE', title: 'Lecture 04 — Organisational Structure', description: 'Functional, matrix, flat, network' },
  { type: 'QUIZ', title: 'Quiz 01 — Planning & Structure', description: 'Weight 5%' },
  { type: 'LECTURE', title: 'Lecture 05 — HR Management', description: 'Recruitment, training, performance review' },
  { type: 'LECTURE', title: 'Lecture 06 — Motivation', description: 'Maslow, Herzberg, McClelland, equity theory' },
  { type: 'LECTURE', title: 'Lecture 07 — Leadership', description: 'Trait, behavioural, situational, transformational' },
  { type: 'AI_GENERATED', title: 'AI-Generated Leadership Self-Assessment', description: 'Reflective tool, results feed into mentor sessions' },
  { type: 'MILESTONE', title: 'MIDTERM EXAM', description: 'Covers Weeks 1-7' },
  { type: 'LECTURE', title: 'Lecture 08 — Communication & Conflict', description: 'Channels, barriers, Thomas-Kilmann model' },
  { type: 'LECTURE', title: 'Lecture 09 — Org Culture & Change', description: 'Schein model, Kotter 8-step, Lewin 3-stage' },
  { type: 'CASE', title: 'Case Study 02 — Change Management', description: 'Microsoft cultural turnaround under Nadella' },
  { type: 'LECTURE', title: 'Lecture 10 — Controlling & KPIs', description: 'Feedforward, concurrent, feedback controls' },
  { type: 'LECTURE', title: 'Lecture 11 — Operations & Quality', description: 'Six Sigma, Lean, ISO 9001' },
  { type: 'LECTURE', title: 'Lecture 12 — Digital Transformation', description: 'Disruption, platform business, Agile@scale' },
  { type: 'LECTURE', title: 'Lecture 13 — Ethics & CSR', description: 'Stakeholder theory, triple bottom line' },
  { type: 'CASE', title: 'Case Study 03 — Ethics & CSR', description: 'Patagonia vs fast fashion' },
  { type: 'ASSIGNMENT', title: 'Group Project Submission', description: 'Strategic analysis of chosen company' },
  { type: 'MILESTONE', title: 'Group Presentations', description: 'Each group 15 min + 5 min Q&A' },
  { type: 'MILESTONE', title: 'FINAL EXAM', description: 'Comprehensive, 25% weight' }
]

// ============================================================
// MAIN SEED
// ============================================================
async function main() {
  // Idempotent check: skip if users already exist (for Vercel rebuilds)
  const existingUsers = await db.user.count()
  if (existingUsers > 0 && process.argv.includes('--if-empty')) {
    console.log(`ℹ️  Database already has ${existingUsers} users. Skipping seed (--if-empty flag set).`)
    return
  }
  if (existingUsers > 0) {
    console.log(`ℹ️  Database already has ${existingUsers} users. Re-seeding (cleaning first)...`)
  }

  console.log('🧹 Cleaning DB...')
  await db.interaction.deleteMany()
  await db.auditLog.deleteMany()
  await db.timelineEvent.deleteMany()
  await db.message.deleteMany()
  await db.mentorSession.deleteMany()
  await db.studentCounsellorAssignment.deleteMany()
  await db.alert.deleteMany()
  await db.submission.deleteMany()
  await db.assignment.deleteMany()
  await db.grade.deleteMany()
  await db.assessment.deleteMany()
  await db.attendance.deleteMany()
  await db.classSession.deleteMany()
  await db.enrollment.deleteMany()
  await db.batch.deleteMany()
  await db.course.deleteMany()
  await db.growthReport.deleteMany()
  await db.user.deleteMany()
  await db.institution.deleteMany()

  console.log('🏛️  Creating institution...')
  const institution = await db.institution.create({
    data: {
      name: 'FCCL JB Plant Institute of Technology',
      code: 'FCCL-JB-IT',
      address: 'Jhang Bahtar, Attock, Punjab, Pakistan',
      phone: '+92-57-2610221',
      email: 'info@fccl.com.pk',
      website: 'https://fccl.com.pk',
      logo: 'https://fccl.com.pk/eng/wp-content/uploads/2025/01/cropped-SITE-IDENTITY-ICON-270x270.webp'
    }
  })

  console.log('👤 Creating admin...')
  const admin = await db.user.create({
    data: {
      email: 'admin@examiner.ai',
      name: 'System Administrator',
      role: 'ADMIN',
      phone: '+92-300-1111111',
      bio: 'Platform administrator with full system oversight.',
      institutionId: institution.id,
      isDemo: false
    }
  })

  console.log('👑 Creating principal...')
  const principal = await db.user.create({
    data: {
      email: 'principal@fccl.com.pk',
      name: 'Dr. Asma Rauf',
      role: 'PRINCIPAL',
      phone: '+92-300-2222222',
      bio: 'Principal of FCCL JB Plant Institute. PhD in Educational Leadership, 18 years experience.',
      institutionId: institution.id,
      isDemo: false
    }
  })

  console.log('👩‍🏫 Creating 2 teachers...')
  const teacher1 = await db.user.create({
    data: {
      email: 's.khan@fccl.com.pk',
      name: 'Sir Saeed Khan',
      role: 'TEACHER',
      phone: '+92-301-3333333',
      bio: 'Senior Lecturer, Computer Science. Specialises in algorithms & data structures. MS CS from NUST.',
      institutionId: institution.id
    }
  })
  const teacher2 = await db.user.create({
    data: {
      email: 'r.ahmed@fccl.com.pk',
      name: 'Maam Rabia Ahmed',
      role: 'TEACHER',
      phone: '+92-302-4444444',
      bio: 'Assistant Professor, Management Sciences. MBA from LUMS. Industry consulting experience at PwC.',
      institutionId: institution.id
    }
  })

  console.log('🧑‍⚕️ Creating counsellor...')
  const counsellor = await db.user.create({
    data: {
      email: 'counsellor@fccl.com.pk',
      name: 'Dr. Hina Siddiqui',
      role: 'COUNSELOR',
      phone: '+92-303-5555555',
      bio: 'Student counsellor. MS Clinical Psychology. Trained in CBT, crisis intervention, and academic counselling.',
      institutionId: institution.id
    }
  })

  console.log('🌱 Creating mentor...')
  const mentor = await db.user.create({
    data: {
      email: 'mentor@fccl.com.pk',
      name: 'Mr. Tariq Mehmood',
      role: 'MENTOR',
      phone: '+92-304-6666666',
      bio: 'Academic & psychological mentor. GROW model practitioner. 10+ years coaching undergraduates.',
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
    const student = await db.user.create({
      data: {
        email,
        name: `${fn} ${ln}`,
        role: 'STUDENT',
        phone: `+92-3${rand(0, 9)}${rand(10000000, 99999999)}`,
        bio: `Enrolled in Fall 2025 cohort. Roll No. FCCL-2025-${pad(i + 1)}`,
        institutionId: institution.id
      }
    })
    students.push(student)
  }
  console.log(`   ✓ ${students.length} students created`)

  console.log('🧪 Creating the DEMO developer account...')
  const demoUser = await db.user.create({
    data: {
      email: 'demo@examiner.ai',
      name: 'Demo Developer',
      role: 'DEVELOPER',
      isDemo: true,
      bio: 'Full-access demo account. Read-only writes (sandboxed). Can switch to any role to preview dashboards.',
      institutionId: institution.id
    }
  })

  // ============================================================
  // COURSES
  // ============================================================
  console.log('📚 Creating 2 courses with professional outlines...')
  const course1 = await db.course.create({
    data: {
      code: 'CS-301',
      title: 'Data Structures & Algorithms',
      description: 'A comprehensive study of fundamental data structures and algorithms with emphasis on complexity analysis and real-world problem solving.',
      outline: course1Outline,
      credits: 4,
      semester: 'Fall 2025',
      level: 'Undergraduate',
      teacherId: teacher1.id,
      institutionId: institution.id
    }
  })

  const course2 = await db.course.create({
    data: {
      code: 'MGT-205',
      title: 'Principles of Management',
      description: 'Foundational course covering planning, organising, leading, and controlling — with modern topics in change management and digital transformation.',
      outline: course2Outline,
      credits: 3,
      semester: 'Fall 2025',
      level: 'Undergraduate',
      teacherId: teacher2.id,
      institutionId: institution.id
    }
  })

  // ============================================================
  // BATCHES
  // ============================================================
  console.log('📦 Creating batches...')
  const batch1A = await db.batch.create({
    data: {
      name: 'CS-301 / Section A',
      courseId: course1.id,
      deliveryMode: 'ON_CAMPUS',
      room: 'CS Lab 1',
      schedule: 'Mon, Wed, Fri — 09:00-10:30',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-20'),
      institutionId: institution.id,
      teachers: { connect: [{ id: teacher1.id }] }
    }
  })
  const batch1B = await db.batch.create({
    data: {
      name: 'CS-301 / Section B',
      courseId: course1.id,
      deliveryMode: 'HYBRID',
      room: 'CS Lab 2 + Zoom',
      schedule: 'Tue, Thu — 14:00-16:30',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-20'),
      institutionId: institution.id,
      teachers: { connect: [{ id: teacher1.id }] }
    }
  })
  const batch2A = await db.batch.create({
    data: {
      name: 'MGT-205 / Section A',
      courseId: course2.id,
      deliveryMode: 'ON_CAMPUS',
      room: 'Lecture Hall 3',
      schedule: 'Mon, Wed — 11:00-12:30',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-20'),
      institutionId: institution.id,
      teachers: { connect: [{ id: teacher2.id }] }
    }
  })

  // ============================================================
  // ENROLLMENTS (split students across courses/batches)
  // ============================================================
  console.log('🔗 Enrolling students...')
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    if (i < 30) {
      const batch = i < 15 ? batch1A : batch1B
      await db.enrollment.create({
        data: { studentId: s.id, courseId: course1.id, batchId: batch.id }
      })
    }
    if (i >= 20) {
      await db.enrollment.create({
        data: { studentId: s.id, courseId: course2.id, batchId: batch2A.id }
      })
    }
  }
  console.log('   ✓ Enrollments created')

  // ============================================================
  // ASSESSMENTS
  // ============================================================
  console.log('📝 Creating assessments...')
  const csAssessments = [
    { title: 'Quiz 01 — Complexity', type: 'QUIZ', maxMarks: 20, weightage: 4, date: new Date('2025-09-15') },
    { title: 'Quiz 02 — Stacks/Queues', type: 'QUIZ', maxMarks: 20, weightage: 4, date: new Date('2025-09-29') },
    { title: 'Quiz 03 — Graphs', type: 'QUIZ', maxMarks: 20, weightage: 4, date: new Date('2025-11-10') },
    { title: 'Quiz 04 — DP', type: 'QUIZ', maxMarks: 20, weightage: 3, date: new Date('2025-12-01') },
    { title: 'Assignment 01 — Linked List', type: 'ASSIGNMENT', maxMarks: 100, weightage: 4, date: new Date('2025-09-22') },
    { title: 'Assignment 02 — Hash Table', type: 'ASSIGNMENT', maxMarks: 100, weightage: 4, date: new Date('2025-10-06') },
    { title: 'Assignment 03 — Dijkstra', type: 'ASSIGNMENT', maxMarks: 100, weightage: 4, date: new Date('2025-11-17') },
    { title: 'Assignment 04 — DP Set', type: 'ASSIGNMENT', maxMarks: 100, weightage: 4, date: new Date('2025-12-08') },
    { title: 'Midterm', type: 'MIDTERM', maxMarks: 100, weightage: 20, date: new Date('2025-10-20') },
    { title: 'Project', type: 'PROJECT', maxMarks: 100, weightage: 20, date: new Date('2025-12-15') },
    { title: 'Final', type: 'FINAL', maxMarks: 100, weightage: 25, date: new Date('2025-12-22') }
  ]
  const csAssessmentRecords = []
  for (const a of csAssessments) {
    const rec = await db.assessment.create({ data: { ...a, courseId: course1.id } })
    csAssessmentRecords.push(rec)
  }

  const mgtAssessments = [
    { title: 'Quiz 01 — Planning', type: 'QUIZ', maxMarks: 20, weightage: 5, date: new Date('2025-09-22') },
    { title: 'Case Study 01 — Strategy', type: 'ASSIGNMENT', maxMarks: 100, weightage: 7, date: new Date('2025-10-06') },
    { title: 'Case Study 02 — Change', type: 'ASSIGNMENT', maxMarks: 100, weightage: 7, date: new Date('2025-11-17') },
    { title: 'Case Study 03 — Ethics', type: 'ASSIGNMENT', maxMarks: 100, weightage: 6, date: new Date('2025-12-08') },
    { title: 'Midterm', type: 'MIDTERM', maxMarks: 100, weightage: 20, date: new Date('2025-10-20') },
    { title: 'Group Project', type: 'PROJECT', maxMarks: 100, weightage: 25, date: new Date('2025-12-15') },
    { title: 'Final', type: 'FINAL', maxMarks: 100, weightage: 25, date: new Date('2025-12-22') }
  ]
  const mgtAssessmentRecords = []
  for (const a of mgtAssessments) {
    const rec = await db.assessment.create({ data: { ...a, courseId: course2.id } })
    mgtAssessmentRecords.push(rec)
  }
  console.log('   ✓ Assessments created')

  // ============================================================
  // GRADES — realistic distribution (with some outliers)
  // ============================================================
  console.log('📊 Generating grades for all students...')
  const feedbackPool = [
    'Excellent work — keep it up!',
    'Strong grasp of fundamentals. Review edge cases.',
    'Good attempt. Tighten complexity analysis.',
    'Needs improvement. Please attend office hours.',
    'Outstanding! Consider taking the advanced track.',
    'Satisfactory. Practice more problems.',
    'Below average. Reach out to mentor.',
    'Top of the class — exceptional.',
    'Solid submission with minor issues.',
    'Incomplete. Submit within 3 days for partial credit.',
    ''
  ]
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const tier = i % 5
    const tierBase: Record<number, number> = { 0: 88, 1: 78, 2: 70, 3: 60, 4: 50 }
    const base = tierBase[tier]
    for (const a of csAssessmentRecords) {
      if (i >= 30) break
      const marks = Math.max(0, Math.min(a.maxMarks, base + rand(-15, 12)))
      await db.grade.create({
        data: {
          assessmentId: a.id,
          studentId: s.id,
          marks: marks,
          feedback: pick(feedbackPool, rand(0, feedbackPool.length - 1))
        }
      })
    }
    for (const a of mgtAssessmentRecords) {
      if (i < 20) continue
      const marks = Math.max(0, Math.min(a.maxMarks, base + rand(-15, 12)))
      await db.grade.create({
        data: {
          assessmentId: a.id,
          studentId: s.id,
          marks,
          feedback: pick(feedbackPool, rand(0, feedbackPool.length - 1))
        }
      })
    }
  }
  console.log('   ✓ Grades generated')

  // ============================================================
  // CLASS SESSIONS + ATTENDANCE
  // ============================================================
  console.log('🗓️  Creating class sessions + attendance...')
  const sessionsPerBatch = 12
  for (const batch of [batch1A, batch1B, batch2A]) {
    const isCs = batch.courseId === course1.id
    const teacherId = isCs ? teacher1.id : teacher2.id
    const topics = isCs
      ? ['Complexity', 'Arrays', 'Linked Lists', 'Stacks/Queues', 'Hash Tables', 'BST', 'AVL Trees', 'Heaps', 'Graphs', 'Dijkstra', 'Sorting', 'DP']
      : ['Intro to Mgmt', 'Planning', 'Strategy', 'Decision Making', 'Org Structure', 'HR', 'Motivation', 'Leadership', 'Communication', 'Change Mgmt', 'Controlling', 'Operations']
    const startDate = new Date('2025-09-01')
    for (let w = 0; w < sessionsPerBatch; w++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + w * 7)
      const session = await db.classSession.create({
        data: {
          batchId: batch.id,
          courseId: batch.courseId,
          teacherId,
          date,
          topic: topics[w],
          mode: batch.deliveryMode
        }
      })
      const enrollments = await db.enrollment.findMany({ where: { batchId: batch.id } })
      for (const en of enrollments) {
        await db.attendance.create({
          data: {
            sessionId: session.id,
            studentId: en.studentId,
            status: pick([...attendanceStatuses], rand(0, attendanceStatuses.length - 1))
          }
        })
      }
    }
  }
  console.log('   ✓ Sessions + attendance created')

  // ============================================================
  // ALERTS — teachers → students (with some responses)
  // ============================================================
  console.log('🚨 Creating alerts (with responses)...')
  const alertTemplates = [
    { type: 'ACADEMIC', severity: 'HIGH', message: 'Student has missed the last 2 assignments. At risk of failing.' },
    { type: 'ATTENDANCE', severity: 'MEDIUM', message: 'Attendance dropped below 70% in last 3 weeks.' },
    { type: 'BEHAVIOURAL', severity: 'LOW', message: 'Distracted during class — recommended mentor check-in.' },
    { type: 'PERFORMANCE', severity: 'HIGH', message: 'Midterm score < 40%. Needs urgent intervention.' },
    { type: 'WELLBEING', severity: 'CRITICAL', message: 'Student disclosed personal stress. Refer to counsellor immediately.' },
    { type: 'ACADEMIC', severity: 'MEDIUM', message: 'Quiz scores trending downward across last 3 quizzes.' },
    { type: 'ACADEMIC', severity: 'LOW', message: 'Top performer — recommend for honours track.' },
    { type: 'ATTENDANCE', severity: 'HIGH', message: '4 consecutive absences. Family contact attempted, no response.' }
  ]
  const alertResponses = [
    'Acknowledged. Scheduled 1:1 with student for tomorrow.',
    'Spoke with student. Issue resolved, will monitor.',
    'Referred to counsellor. Appointment booked for Friday.',
    'Parent contacted. Will attend remedial sessions.',
    'On watchlist. Progress check scheduled in 2 weeks.',
    null, null, null
  ]
  let alertCounter = 0
  for (let i = 0; i < 30; i++) {
    const useCs = i < 18
    const teacher = useCs ? teacher1 : teacher2
    const course = useCs ? course1 : course2
    const enrollments = await db.enrollment.findMany({ where: { courseId: course.id } })
    if (enrollments.length === 0) continue
    const en = enrollments[i % enrollments.length]
    const tpl = alertTemplates[i % alertTemplates.length]
    const resp = pick(alertResponses, i)
    const status = resp ? (i % 4 === 0 ? 'ACKNOWLEDGED' : 'RESOLVED') : 'OPEN'
    const student = await db.user.findUnique({ where: { id: en.studentId } })
    await db.alert.create({
      data: {
        type: tpl.type,
        severity: tpl.severity,
        message: tpl.message + ` [Student: ${student?.name}]`,
        courseId: course.id,
        studentId: en.studentId,
        fromUserId: teacher.id,
        toUserId: counsellor.id,
        status,
        response: resp,
        respondedAt: resp ? new Date(Date.now() - rand(1, 14) * 86400000) : null,
        createdAt: new Date(Date.now() - rand(1, 30) * 86400000)
      }
    })
    alertCounter++
  }
  console.log(`   ✓ ${alertCounter} alerts created`)

  // ============================================================
  // COUNSELLOR ASSIGNMENTS
  // ============================================================
  console.log('🤝 Assigning counsellor to flagged students...')
  const flaggedStudents = students.slice(0, 15)
  for (let i = 0; i < flaggedStudents.length; i++) {
    await db.studentCounsellorAssignment.create({
      data: {
        studentId: flaggedStudents[i].id,
        counsellorId: counsellor.id,
        reason: pick(['Academic stress', 'Attendance concerns', 'Performance drop', 'Personal wellbeing', 'Proactive check-in'], i),
        status: i < 10 ? 'ACTIVE' : 'RESOLVED'
      }
    })
  }

  // ============================================================
  // MENTOR SESSIONS — mix of PSYCHOLOGICAL & EDUCATIONAL
  // ============================================================
  console.log('🌱 Creating mentor sessions (psychological + educational)...')
  const psychGoals = [
    'Manage exam anxiety and develop coping strategies',
    'Address motivation issues and goal setting',
    'Improve self-confidence in group settings',
    'Process family pressure and academic expectations',
    'Develop emotional regulation techniques',
    'Work through social anxiety in classroom',
    'Address burnout and develop rest strategies',
    'Build resilience after academic setback'
  ]
  const psychRealities = [
    'Student reports sleeping <5 hrs/night during exam weeks. Currently anxious about CS-301 midterm.',
    'Self-reported motivation at 3/10. Considering dropping a course.',
    'Avoids asking questions in class despite knowing answers. Self-rated confidence 4/10.',
    'Pressure from parents to maintain 80%+ average. Reports feeling overwhelmed.',
    'Quickly loses temper in group work. Peers avoid pairing with them.',
    'Skips class to avoid presentation requirements. Reports sweating and racing heart.',
    'Reports exhaustion, no hobbies, studies 12+ hours daily. Concerned about sustainability.',
    'Failed Quiz 03. Reports feeling "stupid". Has stopped attending office hours.'
  ]
  const psychOptions = [
    'CBT reframing exercise for catastrophic thoughts; introduce box breathing for exam-day anxiety; sleep hygiene plan.',
    'Reconnect with original motivation for studying CS; break goals into weekly milestones; trial Pomodoro technique.',
    'Graduated exposure: ask 1 question per class for 2 weeks; practice in mentor sessions first.',
    'Family meeting offered; values clarification exercise; reduce to 6 courses next semester if needed.',
    'Anger log + trigger identification; introduce "pause-breathe-respond" protocol; pair with counsellor.',
    'Refer to clinical psychologist for assessment; interim: presentation in mentor-only setting first.',
    'Implement forced-rest blocks; reconnect with one hobby; track energy levels daily.',
    'Reframe failure as data; assign one small win per day; mentor check-in twice weekly for 4 weeks.'
  ]
  const psychWills = [
    'Will try box breathing before next quiz; report back in 1 week.',
    'Will write 3 reasons for studying CS; will set 1 small goal for this week.',
    'Will ask 1 question in tomorrow\'s class; mentor will follow up Friday.',
    'Will discuss course load with parents this weekend; report outcome Monday.',
    'Will use pause-breathe before next group meeting; will journal triggers daily.',
    'Will attend clinical psych intake; will present 3 slides to mentor next session.',
    'Will schedule 30-min walk daily; will stop studying by 10pm; track in journal.',
    'Will solve 1 problem daily; will attend office hours Wed; check-in Fri.'
  ]
  const psychNotes = [
    'Student engaged well. Slight defensiveness initially but opened up by minute 15.',
    'Excellent insight. Student already aware of patterns, needs structured accountability.',
    'Shy but willing. Build confidence progressively.',
    'Emotional session. Tears when discussing parents. Refer to counsellor for ongoing support.',
    'Tense. Student minimises behaviour. Will need 2-3 sessions to build awareness.',
    'High anxiety visible. Empathic listening. Reframed presentation as practice.',
    'Burnout confirmed. At risk of more serious issues if not addressed.',
    'Vulnerable and honest. Strong therapeutic alliance established.'
  ]
  const eduGoals = [
    'Improve problem-solving approach for DSA assignments',
    'Build a study schedule for the final 4 weeks of semester',
    'Strengthen understanding of graph algorithms',
    'Develop better note-taking and revision strategy',
    'Prepare for MGT-205 case study analysis',
    'Improve time management during exams',
    'Build a portfolio project using course concepts',
    'Plan career path — software engineering vs data science'
  ]
  const eduRealities = [
    'Attempts problems without understanding the underlying structure. Spends hours on brute force.',
    'No fixed schedule. Studies reactively. Misses deadlines.',
    'Confident on arrays/trees but lost on graphs. Has not practised Dijkstra.',
    'Notes are verbatim from lectures. No synthesis. Revision takes 3x expected time.',
    'Has read 0 case studies. Treats them as reading, not analysis.',
    'Runs out of time in exams. Spends 40% of time on first 30% of paper.',
    'No project beyond assignments. GitHub empty.',
    'Confused about specialisations. Has not researched either path.'
  ]
  const eduOptions = [
    'Introduce problem taxonomy (Brilliant.org style); solve 1 problem per topic daily for 2 weeks.',
    'Build weekly schedule: Mon-Wed study, Thu revision, Fri quiz practice. Track with Notion.',
    'Re-watch Lecture 09-10; solve 5 graph problems on LeetCode; submit to mentor by Friday.',
    'Adopt Cornell note-taking; build 1-page summary per lecture; weekly review session.',
    'Read 3 HBR case studies; apply 5-force framework to each; present 1 to mentor.',
    'Practise timed papers; allocate marks-per-minute; flag-and-move strategy for stuck items.',
    'Build a CLI visualiser for Dijkstra — combines course concepts with portfolio building.',
    'Information interview assignment: 1 SE + 1 DS practitioner. Compare and decide.'
  ]
  const eduWills = [
    'Will solve 7 problems this week; will share repo link Friday.',
    'Will draft schedule tonight; will share screenshot tomorrow.',
    'Will watch both lectures this weekend; will solve 5 problems by Monday.',
    'Will convert last 3 lectures to Cornell format by Friday.',
    'Will read 1 HBR case tonight; will write 5-force analysis by Wed.',
    'Will do 1 timed paper this week; will review timing log Friday.',
    'Will scaffold project this weekend; commit by Sunday.',
    'Will reach out to 2 alumni via LinkedIn this week.'
  ]
  const eduNotes = [
    'Strong analytical base. Just needs methodical practice.',
    'Responsive to structure. Will need accountability check-ins.',
    'Capable — fear of graphs is the issue, not ability.',
    'Quick learner. Will adopt Cornell method easily.',
    'Enthusiastic. May need to slow down for depth over breadth.',
    'Exam anxiety is part of the issue — combine with psychological session.',
    'Self-directed. Will run with project idea.',
    'Mature thinker. Career conversation productive.'
  ]

  let sessionCounter = 0
  for (let i = 0; i < flaggedStudents.length; i++) {
    const s = flaggedStudents[i]
    const sessionsToCreate = (i % 3) + 1
    for (let j = 0; j < sessionsToCreate; j++) {
      const isPsych = (i + j) % 2 === 0
      const pool = isPsych
        ? { goals: psychGoals, realities: psychRealities, options: psychOptions, wills: psychWills, notes: psychNotes, type: 'PSYCHOLOGICAL' as const }
        : { goals: eduGoals, realities: eduRealities, options: eduOptions, wills: eduWills, notes: eduNotes, type: 'EDUCATIONAL' as const }
      const idx = (i * 3 + j) % pool.goals.length
      await db.mentorSession.create({
        data: {
          mentorId: mentor.id,
          studentId: s.id,
          type: pool.type,
          date: new Date(Date.now() - rand(1, 60) * 86400000),
          duration: pick([30, 45, 60, 75, 90], i + j),
          goal: pool.goals[idx],
          reality: pool.realities[idx],
          options: pool.options[idx],
          will: pool.wills[idx],
          mood: pick([...moods], rand(0, moods.length - 1)),
          notes: pool.notes[idx],
          followUp: pick(['1 week', '2 weeks', '1 month', null], i + j)
        }
      })
      sessionCounter++
    }
  }
  console.log(`   ✓ ${sessionCounter} mentor sessions created`)

  // ============================================================
  // ASSIGNMENTS + SUBMISSIONS
  // ============================================================
  console.log('📤 Creating assignments + submissions...')
  const csAssignmentDefs = [
    { title: 'Assignment 01 — Implement a Singly Linked List', dueDate: new Date('2025-09-22') },
    { title: 'Assignment 02 — Build a Hash Table', dueDate: new Date('2025-10-06') },
    { title: 'Assignment 03 — Implement Dijkstra', dueDate: new Date('2025-11-17') },
    { title: 'Assignment 04 — DP Problem Set', dueDate: new Date('2025-12-08') }
  ]
  const csAssignmentRecords = []
  for (const a of csAssignmentDefs) {
    const rec = await db.assignment.create({
      data: { ...a, courseId: course1.id, maxMarks: 100, description: `${a.title}. Submit code + brief complexity analysis.` }
    })
    csAssignmentRecords.push(rec)
  }

  const mgtAssignmentDefs = [
    { title: 'Case Study 01 — Strategic Analysis', dueDate: new Date('2025-10-06') },
    { title: 'Case Study 02 — Change Management', dueDate: new Date('2025-11-17') },
    { title: 'Case Study 03 — Ethics & CSR', dueDate: new Date('2025-12-08') }
  ]
  const mgtAssignmentRecords = []
  for (const a of mgtAssignmentDefs) {
    const rec = await db.assignment.create({
      data: { ...a, courseId: course2.id, maxMarks: 100, description: `${a.title}. 1500 words + appendices.` }
    })
    mgtAssignmentRecords.push(rec)
  }

  const submissionStatuses = ['SUBMITTED', 'GRADED', 'LATE', 'RETURNED']
  const submissionContents = [
    'Submitted code via GitHub repo link. Complexity analysis attached.',
    'Code submitted. Compilation passes all test cases.',
    'Submitted late with extension approval from instructor.',
    'Initial submission. Will refine based on feedback.',
    'Final version. All test cases green.'
  ]
  for (let i = 0; i < 30; i++) {
    const s = students[i]
    for (const a of csAssignmentRecords) {
      if (Math.random() < 0.15) continue
      const status = pick(submissionStatuses, rand(0, submissionStatuses.length - 1))
      const isGraded = status === 'GRADED' || status === 'RETURNED'
      await db.submission.create({
        data: {
          assignmentId: a.id,
          studentId: s.id,
          content: pick(submissionContents, i),
          status,
          marks: isGraded ? rand(55, 95) : null,
          feedback: isGraded ? pick(feedbackPool, i) : null,
          submittedAt: new Date(a.dueDate.getTime() - rand(0, 4) * 86400000)
        }
      })
    }
  }
  for (let i = 20; i < 50; i++) {
    const s = students[i]
    for (const a of mgtAssignmentRecords) {
      if (Math.random() < 0.15) continue
      const status = pick(submissionStatuses, rand(0, submissionStatuses.length - 1))
      const isGraded = status === 'GRADED' || status === 'RETURNED'
      await db.submission.create({
        data: {
          assignmentId: a.id,
          studentId: s.id,
          content: `Case study analysis: ${a.title}. Submitted via LMS.`,
          status,
          marks: isGraded ? rand(60, 92) : null,
          feedback: isGraded ? pick(feedbackPool, i) : null,
          submittedAt: new Date(a.dueDate.getTime() - rand(0, 4) * 86400000)
        }
      })
    }
  }
  console.log('   ✓ Assignments + submissions created')

  // ============================================================
  // TIMELINE EVENTS
  // ============================================================
  console.log('📅 Creating timeline events...')
  const startDate = new Date('2025-09-01')
  for (let i = 0; i < aiTimelineEvents.length; i++) {
    const e = aiTimelineEvents[i]
    const date = new Date(startDate)
    date.setDate(date.getDate() + Math.floor(i * 3.5))
    await db.timelineEvent.create({
      data: {
        courseId: course1.id,
        type: e.type,
        title: e.title,
        description: e.description,
        date
      }
    })
  }
  for (let i = 0; i < mgmtTimelineEvents.length; i++) {
    const e = mgmtTimelineEvents[i]
    const date = new Date(startDate)
    date.setDate(date.getDate() + Math.floor(i * 3.5))
    await db.timelineEvent.create({
      data: {
        courseId: course2.id,
        type: e.type,
        title: e.title,
        description: e.description,
        date
      }
    })
  }
  console.log('   ✓ Timeline events created')

  // ============================================================
  // MESSAGES
  // ============================================================
  console.log('💬 Creating messages...')
  const messagePairs = [
    { from: students[0], to: teacher1, content: 'Sir, I could not attend today due to illness. Will submit doctor note.' },
    { from: teacher1, to: students[0], content: 'Noted. Please submit Assignment 02 by Friday with late penalty waived.' },
    { from: students[5], to: counsellor, content: 'Maam, can I book an appointment this week? Feeling overwhelmed.' },
    { from: counsellor, to: students[5], content: 'Of course. Thursday 2pm works? I\'ll send a calendar invite.' },
    { from: students[10], to: mentor, content: 'Sir, I want to discuss career options — software vs data science.' },
    { from: mentor, to: students[10], content: 'Great topic. Let\'s meet Friday 4pm. I\'ll prep some questions for you.' },
    { from: teacher2, to: principal, content: 'Maam, MGT-205 Section A needs additional tutorial slots — many students struggling with case analysis.' },
    { from: principal, to: teacher2, content: 'Approved. Please coordinate with admin to schedule a Friday 11am slot.' },
    { from: students[15], to: teacher1, content: 'Sir, can you clarify the Dijkstra assignment requirements?' },
    { from: teacher1, to: students[15], content: 'Sure. Implement Dijkstra with adjacency list. Bonus marks for A* on grid.' },
    { from: students[20], to: teacher2, content: 'Maam, my group project submission is on Friday — may I get an extension to Monday?' },
    { from: teacher2, to: students[20], content: 'Extension granted to Monday 11:59pm. 5% late penalty applies.' },
    { from: students[3], to: mentor, content: 'I tried the box breathing before Quiz 03. It actually helped!' },
    { from: mentor, to: students[3], content: 'Wonderful! Practice it daily — it compounds. Let\'s review next Tuesday.' },
    { from: principal, to: admin, content: 'Please generate a system usage report for the board meeting.' },
    { from: admin, to: principal, content: 'Will share by EOD tomorrow. Includes login frequency, alerts resolved, mentor session count.' }
  ]
  for (const m of messagePairs) {
    await db.message.create({
      data: {
        fromId: m.from.id,
        toId: m.to.id,
        content: m.content,
        read: Math.random() < 0.6,
        createdAt: new Date(Date.now() - rand(0, 7) * 86400000)
      }
    })
  }
  console.log('   ✓ Messages created')

  // ============================================================
  // GROWTH REPORTS (private, for principal + key staff)
  // ============================================================
  console.log('📈 Creating growth reports...')
  await db.growthReport.create({
    data: {
      userId: principal.id,
      institutionId: institution.id,
      title: 'Q3 2025 Institutional Performance Review',
      content: 'Institution-wide performance review covering academic outcomes, attendance trends, alert resolution rates, and mentor session impact. Key findings: 73% alert acknowledgement rate (up from 58% in Q2); average CS-301 midterm score 68%; 18 mentor sessions conducted with 89% positive student feedback. Recommendations: scale mentor program to all flagged students, increase tutorial slots for case-based courses.',
      period: 'Q3 2025',
      visibility: 'PRIVATE'
    }
  })
  await db.growthReport.create({
    data: {
      userId: principal.id,
      institutionId: institution.id,
      title: 'Mentor Program Impact Analysis',
      content: 'Analysis of 18 GROW-model mentor sessions across psychological and educational domains. Psychological sessions showed improved mood scores in 78% of students within 2 weeks. Educational sessions correlated with 12% improvement in subsequent assignment scores. Recommend continued investment in mentor capacity.',
      period: 'Fall 2025 (mid-semester)',
      visibility: 'PRIVATE'
    }
  })
  console.log('   ✓ Growth reports created')

  // ============================================================
  // AUDIT LOGS
  // ============================================================
  console.log('📋 Creating audit logs...')
  const auditActions = [
    { userId: admin.id, action: 'LOGIN', entity: 'Auth', entityId: admin.id, meta: 'IP 39.41.x.x' },
    { userId: admin.id, action: 'CREATE', entity: 'User', entityId: teacher1.id, meta: 'Created teacher account' },
    { userId: admin.id, action: 'CREATE', entity: 'Course', entityId: course1.id, meta: 'Created CS-301' },
    { userId: teacher1.id, action: 'GRADE', entity: 'Assessment', entityId: csAssessmentRecords[0].id, meta: 'Graded Quiz 01 for 30 students' },
    { userId: teacher1.id, action: 'ALERT', entity: 'Alert', entityId: 'multiple', meta: 'Raised 18 alerts to counsellor' },
    { userId: counsellor.id, action: 'RESPOND', entity: 'Alert', entityId: 'multiple', meta: 'Responded to 12 alerts' },
    { userId: mentor.id, action: 'SESSION', entity: 'MentorSession', entityId: 'multiple', meta: 'Conducted 24 mentor sessions' },
    { userId: principal.id, action: 'VIEW', entity: 'GrowthReport', entityId: 'multiple', meta: 'Viewed Q3 performance review' },
    { userId: principal.id, action: 'APPROVE', entity: 'Batch', entityId: batch2A.id, meta: 'Approved additional MGT-205 tutorial slot' },
    { userId: admin.id, action: 'UPDATE', entity: 'Institution', entityId: institution.id, meta: 'Updated institution contact info' }
  ]
  for (let i = 0; i < auditActions.length; i++) {
    const a = auditActions[i]
    await db.auditLog.create({
      data: {
        ...a,
        createdAt: new Date(Date.now() - i * 86400000)
      }
    })
  }

  // ============================================================
  // INTERACTIONS (recent activity feed)
  // ============================================================
  console.log('📊 Creating interactions (activity feed)...')
  const interactionTypes = ['LOGIN', 'VIEW', 'CLICK', 'SUBMIT', 'DOWNLOAD']
  for (let i = 0; i < 200; i++) {
    const u = students[i % students.length]
    await db.interaction.create({
      data: {
        userId: u.id,
        type: pick(interactionTypes, i),
        target: pick(['dashboard', 'course:CS-301', 'course:MGT-205', 'grades', 'assignment', 'mentor-session'], i),
        meta: pick(['mobile', 'desktop', 'tablet'], i),
        createdAt: new Date(Date.now() - rand(0, 14) * 86400000)
      }
    })
  }
  console.log('   ✓ Interactions created')

  // ============================================================
  console.log('\n✅ Seed complete!')
  console.log(`   - Institution: 1`)
  console.log(`   - Users: ${2 + 1 + 1 + 1 + 1 + 50 + 1} (admin, principal, 2 teachers, counsellor, mentor, 50 students, demo)`)
  console.log(`   - Courses: 2`)
  console.log(`   - Batches: 3`)
  console.log(`   - Assessments: ${csAssessmentRecords.length + mgtAssessmentRecords.length}`)
  console.log(`   - Class sessions: ${3 * 12}`)
  console.log(`   - Assignments: ${csAssignmentRecords.length + mgtAssignmentRecords.length}`)
  console.log(`   - Alerts: ${alertCounter}`)
  console.log(`   - Mentor sessions: ${sessionCounter}`)
  console.log(`   - Messages: ${messagePairs.length}`)
  console.log(`   - Timeline events: ${aiTimelineEvents.length + mgmtTimelineEvents.length}`)
  console.log(`   - Growth reports: 2`)
  console.log(`   - Audit logs: ${auditActions.length}`)
  console.log(`   - Interactions: 200`)
  console.log(`\n🔑 DEMO LOGIN: demo@examiner.ai / demo123`)
  console.log(`   (or any user with password "demo123")`)
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
