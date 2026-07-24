/**
 * ExaminerAI — Comprehensive Demo Seed (for original app's data model)
 *
 * Creates:
 *  - 1 Institution (FCCL JB Plant IT)
 *  - 1 admin, 1 principal, 2 teachers, 1 counsellor, 1 mentor, 50 students
 *  - 1 Demo Developer account (auto-login target)
 *  - 2 Courses with full outlines (CS-301 DSA, MGT-205 Management)
 *  - 3 Batches (Section A, B, MGT-A)
 *  - StudentAlerts (with responses), MentorshipTouchpoints (GROW-style)
 *  - PsychologyObs (psychological observations)
 *  - Messages between roles
 *  - AuditLogs
 *  - WellbeingState entries
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
  console.log('🧹 Cleaning DB...')
  await db.interaction.deleteMany()
  await db.auditLog.deleteMany()
  await db.message.deleteMany()
  await db.mentorshipTouchpoint.deleteMany()
  await db.studentAlert.deleteMany()
  await db.psychologyObs.deleteMany()
  await db.wellbeingState.deleteMany()
  await db.certificate.deleteMany()
  await db.reportCard.deleteMany()
  await db.growthReport.deleteMany()
  await db.batchTeacher.deleteMany()
  await db.batch.deleteMany()
  await db.courseWeek.deleteMany()
  await db.courseDay.deleteMany()
  await db.course.deleteMany()
  await db.user.deleteMany()
  await db.institution.deleteMany()

  console.log('🏛️  Creating institution...')
  const institution = await db.institution.create({
    data: {
      name: 'FCCL JB Plant Institute of Technology',
      logoUrl: 'https://fccl.com.pk/eng/wp-content/uploads/2025/01/cropped-SITE-IDENTITY-ICON-270x270.webp',
      contactEmail: 'info@fccl.com.pk'
    }
  })

  // ---------- create users ----------
  const defaultPwd = await hashPwd('demo123')

  console.log('👤 Creating admin (developer)...')
  const admin = await db.user.create({
    data: {
      email: 'admin@examiner.ai',
      name: 'Developer Admin',
      passwordHash: await hashPwd('helloworld'),
      role: 'admin',
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
      role: 'teacher',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })
  const teacher2 = await db.user.create({
    data: {
      email: 'r.ahmed@fccl.com.pk',
      name: 'Maam Rabia Ahmed',
      passwordHash: defaultPwd,
      role: 'teacher',
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

  console.log('🧪 Creating DEMO developer account...')
  const demoUser = await db.user.create({
    data: {
      email: 'demo@examiner.ai',
      name: 'Demo Developer',
      passwordHash: defaultPwd,
      role: 'admin',
      approvedAt: new Date(),
      institutionId: institution.id
    }
  })

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

  // ---------- batches ----------
  console.log('📦 Creating batches...')
  const batch1A = await db.batch.create({
    data: {
      name: 'CS-301 Section A',
      courseId: course1.id,
      deliveryMode: 'physical',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-20'),
      description: 'On-campus section A for CS-301'
    }
  })
  const batch1B = await db.batch.create({
    data: {
      name: 'CS-301 Section B',
      courseId: course1.id,
      deliveryMode: 'hybrid',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-20'),
      description: 'Hybrid section B for CS-301'
    }
  })
  const batch2A = await db.batch.create({
    data: {
      name: 'MGT-205 Section A',
      courseId: course2.id,
      deliveryMode: 'physical',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-20'),
      description: 'On-campus section A for MGT-205'
    }
  })

  // Assign teachers to batches
  await db.batchTeacher.create({ data: { batchId: batch1A.id, teacherId: teacher1.id } })
  await db.batchTeacher.create({ data: { batchId: batch1B.id, teacherId: teacher1.id } })
  await db.batchTeacher.create({ data: { batchId: batch2A.id, teacherId: teacher2.id } })

  // Enroll students in batches
  console.log('🔗 Enrolling students in batches...')
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    let batchId: string
    if (i < 15) batchId = batch1A.id
    else if (i < 30) batchId = batch1B.id
    else batchId = batch2A.id
    await db.user.update({
      where: { id: s.id },
      data: { batchId }
    })
  }

  // ---------- student alerts (with responses) ----------
  console.log('🚨 Creating student alerts...')
  const alertTemplates = [
    { type: 'educational', severity: 'red', reason: 'Student has missed 3 consecutive daily check-ins. Engagement streak broken.', metric: 'engagementStreak', metricValue: '0' },
    { type: 'psychological', severity: 'red', reason: 'Mood score dropped to 2/10 in latest reflection. Possible distress.', metric: 'moodScore', metricValue: '2' },
    { type: 'educational', severity: 'amber', reason: 'Average score below 50% for 2 consecutive weeks.', metric: 'avgScore', metricValue: '47' },
    { type: 'psychological', severity: 'amber', reason: 'Reduced communication in AI Tutor sessions — possible disengagement.', metric: 'engagementStreak', metricValue: '3' },
    { type: 'educational', severity: 'amber', reason: 'Project tasks overdue by 5 days. At risk of falling behind.', metric: 'avgScore', metricValue: '65' },
    { type: 'mentorship', severity: 'red', reason: 'Student disclosed personal stress during mentor session. Refer to counsellor.', metric: 'moodScore', metricValue: '1' },
    { type: 'educational', severity: 'amber', reason: 'Quiz scores trending down across last 3 quizzes.', metric: 'avgScore', metricValue: '58' },
    { type: 'psychological', severity: 'amber', reason: 'Increased frustration markers in practice sessions.', metric: 'engagementStreak', metricValue: '5' }
  ]
  const alertResponses = [
    { status: 'resolved', note: 'Scheduled 1:1 with student. Issue resolved, will monitor weekly.' },
    { status: 'acknowledged', note: 'Referred to counsellor. Appointment booked for Friday.' },
    { status: 'resolved', note: 'Spoke with student. Family situation addressed, focus returning.' },
    { status: 'acknowledged', note: 'Mentor check-in scheduled for tomorrow.' },
    { status: 'resolved', note: 'Parent contacted. Will attend remedial sessions.' },
    { status: 'acknowledged', note: 'Counsellor intake scheduled. Mentor following up weekly.' },
    null, null, null
  ]
  let alertCount = 0
  for (let i = 0; i < 25; i++) {
    const student = students[i]
    const tpl = alertTemplates[i % alertTemplates.length]
    const resp = pick(alertResponses, i)
    const fromUser = i % 2 === 0 ? teacher1 : teacher2
    await db.studentAlert.create({
      data: {
        userId: student.id,
        type: tpl.type,
        severity: tpl.severity,
        reason: tpl.reason + ` [${student.name}]`,
        metric: tpl.metric,
        metricValue: tpl.metricValue,
        status: resp?.status || 'open',
        resolvedAt: resp ? new Date(Date.now() - rand(1, 14) * 86400000) : null,
        resolvedBy: resp ? counsellor.id : null,
        resolutionNote: resp?.note || null,
        createdAt: new Date(Date.now() - rand(1, 30) * 86400000)
      }
    })
    alertCount++
  }
  console.log(`   ✓ ${alertCount} alerts created`)

  // ---------- mentorship touchpoints (GROW-style) ----------
  console.log('🌱 Creating mentorship touchpoints...')
  const touchpointTypes = ['checkin', 'alert_response', 'praise_note', 'scheduled_followup']
  const touchpointNotes = [
    'GROW session — Goal: improve DSA problem-solving. Reality: struggles with graph algorithms. Options: re-watch lectures + 5 LeetCode problems/week. Will: commit to daily practice.',
    'GROW session — Goal: manage exam anxiety. Reality: reports sleeping <5 hrs during exams. Options: box breathing, sleep hygiene. Will: try before next quiz.',
    'Routine check-in. Student engaged and motivated. No concerns.',
    'Praise note — student submitted exceptional project. Recommended for honours track.',
    'Follow-up on previous alert. Student mood improved, engagement up.',
    'GROW session — Goal: career path clarity (SE vs DS). Reality: confused, no research done. Options: 2 informational interviews. Will: reach out via LinkedIn this week.',
    'GROW session — Goal: build confidence in group settings. Reality: avoids asking questions. Options: graduated exposure, 1 question/class. Will: try tomorrow.',
    'Check-in after failed quiz. Student emotional but resilient. Will reframe failure as data.',
    'Scheduled follow-up completed. Student showing steady progress on action items.',
    'Crisis intervention — student disclosed family pressure. Referred to counsellor immediately.'
  ]
  let touchpointCount = 0
  for (let i = 0; i < 15; i++) {
    const student = students[i]
    const sessionsToCreate = (i % 3) + 1
    for (let j = 0; j < sessionsToCreate; j++) {
      await db.mentorshipTouchpoint.create({
        data: {
          userId: student.id,
          actorUserId: mentor.id,
          type: pick(touchpointTypes, i + j),
          note: pick(touchpointNotes, i * 3 + j),
          outcome: pick(['resolved', 'ongoing', 'escalated', null], i + j),
          followUpDate: Math.random() < 0.4 ? new Date(Date.now() + rand(3, 14) * 86400000) : null,
          createdAt: new Date(Date.now() - rand(1, 60) * 86400000)
        }
      })
      touchpointCount++
    }
  }
  console.log(`   ✓ ${touchpointCount} mentorship touchpoints created`)

  // ---------- psychology observations ----------
  console.log('🧠 Creating psychology observations...')
  const commStyles = ['Clear and concise', 'Thoughtful, takes time to respond', 'Enthusiastic, asks many questions', 'Quiet, needs prompting', 'Articulate, uses examples well']
  const learningCurves = ['Steady progress', 'Fast initial uptake, plateaued', 'Slow start, accelerating', 'Consistent high performer', 'Inconsistent — peaks and valleys']
  const engagementLevels = ['Highly engaged', 'Engaged', 'Moderately engaged', 'Variable engagement', 'Recently disengaged']
  const cognitiveLoads = ['light', 'moderate', 'heavy']
  const remarks = [
    'Student shows strong analytical thinking. Encourage deeper exploration of edge cases.',
    'Excellent participation this week. Recommend peer-mentoring role.',
    'Showing signs of stress. Monitor closely and offer support.',
    'Solid grasp of fundamentals. Ready for advanced topics.',
    'Needs more practice with recursion. Suggested additional problems.',
    'Top of cohort. Consider honours track.',
    'Improving steadily. Keep current pace.',
    'Struggling with abstract concepts. Use more concrete examples.'
  ]
  for (let i = 0; i < 20; i++) {
    const student = students[i]
    await db.psychologyObs.create({
      data: {
        userId: student.id,
        week: rand(1, 12),
        confidence: pick(['low', 'moderate', 'high'], i),
        communication: pick(commStyles, i),
        learningCurve: pick(learningCurves, i),
        engagement: pick(engagementLevels, i),
        cognitiveLoad: pick(cognitiveLoads, i),
        metacognitive: pick(['low', 'moderate', 'high'], i),
        remarks: pick(remarks, i),
        date: new Date(Date.now() - rand(1, 30) * 86400000)
      }
    })
  }

  // ---------- wellbeing states ----------
  console.log('💚 Creating wellbeing states...')
  const tiers = ['green', 'amber', 'red']
  const reasonPool = [
    'Mood score dropped',
    'Engagement streak broken',
    'Missed 2+ check-ins',
    'Average score below 50%',
    'Reduced AI Tutor interaction',
    'Project tasks overdue'
  ]
  for (let i = 0; i < 30; i++) {
    const student = students[i]
    const tier = pick(tiers, i % 3)
    await db.wellbeingState.create({
      data: {
        userId: student.id,
        tier,
        reasonsJson: tier === 'green' ? '[]' : JSON.stringify([pick(reasonPool, i), pick(reasonPool, i + 1)]),
        detectedAt: new Date(Date.now() - rand(1, 14) * 86400000)
      }
    }).catch(() => {})
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
    [teacher1.id]: { name: teacher1.name, role: 'teacher' },
    [teacher2.id]: { name: teacher2.name, role: 'teacher' },
    [counsellor.id]: { name: counsellor.name, role: 'counselor' },
    [mentor.id]: { name: mentor.name, role: 'course_coordinator' },
    [principal.id]: { name: principal.name, role: 'principal' }
  }
  const auditActions = [
    { userId: admin.id, action: 'login', targetType: 'auth', targetId: admin.id, meta: 'Web login' },
    { userId: admin.id, action: 'user_created', targetType: 'user', targetId: teacher1.id, meta: 'Created teacher account' },
    { userId: admin.id, action: 'course_created', targetType: 'course', targetId: course1.id, meta: 'Created CS-301' },
    { userId: teacher1.id, action: 'grade_changed', targetType: 'assessment', targetId: 'multiple', meta: 'Graded Quiz 1 for 30 students' },
    { userId: teacher1.id, action: 'alert_created', targetType: 'student_alert', targetId: 'multiple', meta: 'Raised 18 alerts to counsellor' },
    { userId: counsellor.id, action: 'alert_resolved', targetType: 'student_alert', targetId: 'multiple', meta: 'Responded to 12 alerts' },
    { userId: mentor.id, action: 'mentorship_session', targetType: 'mentorship_touchpoint', targetId: 'multiple', meta: 'Conducted 24 mentor sessions' },
    { userId: principal.id, action: 'report_viewed', targetType: 'report_card', targetId: 'multiple', meta: 'Viewed Q3 performance review' },
    { userId: principal.id, action: 'batch_approved', targetType: 'batch', targetId: batch2A.id, meta: 'Approved additional MGT-205 tutorial slot' },
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
        cognitiveLoad: pick(['light', 'moderate', 'heavy'], i),
        confidence: pick(['low', 'moderate', 'high'], i),
        metacognitive: pick(['low', 'moderate', 'high'], i),
        date: new Date(Date.now() - rand(0, 14) * 86400000)
      }
    }).catch(() => {})
  }

  // ---------- growth reports ----------
  console.log('📈 Creating growth reports...')
  // GrowthReport in original schema is per-student (userId @unique), so create one for principal
  await db.growthReport.create({
    data: {
      userId: principal.id,
      courseId: course1.id,
      strengths: 'Strong analytical thinking; consistent engagement; excellent participation in graph algorithms unit. Demonstrates leadership in group work.',
      growthAreas: 'Time management during exams; needs more practice with dynamic programming; tendency to over-engineer solutions.',
      dimensionSnapshot: JSON.stringify({
        correctness: 78,
        engagement: 92,
        confidence: 65,
        metacognitive: 70,
        cognitiveLoad: 'moderate',
        communication: 'high',
        consistency: 85
      }),
      behavioralNotes: 'GROW session notes: Goal — maintain A grade; Reality — strong but exam anxiety; Options — timed practice; Will — daily 30min timed sets.',
      generatedAt: new Date(Date.now() - 7 * 86400000)
    }
  }).catch(() => {})

  console.log('\n✅ Seed complete!')
  console.log(`   - Institution: 1`)
  console.log(`   - Users: 57 (admin, principal, 2 teachers, counsellor, mentor, 50 students, demo)`)
  console.log(`   - Courses: 2`)
  console.log(`   - Batches: 3`)
  console.log(`   - Course weeks: ${csWeeks.length + mgtWeeks.length}`)
  console.log(`   - Student alerts: ${alertCount}`)
  console.log(`   - Mentorship touchpoints: ${touchpointCount}`)
  console.log(`   - Psychology observations: 20`)
  console.log(`   - Messages: ${messagePairs.length}`)
  console.log(`   - Audit logs: ${auditActions.length}`)
  console.log(`   - Interactions: 200`)
  console.log(`\n🔑 DEMO LOGIN: demo@examiner.ai / demo123`)
  console.log(`   (or admin@examiner.ai / helloworld)`)
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
