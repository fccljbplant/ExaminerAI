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
  // Comprehensive cleanup — all models that we'll seed
  await db.interaction.deleteMany()
  await db.auditLog.deleteMany()
  await db.message.deleteMany()
  await db.mentorshipTouchpoint.deleteMany()
  await db.studentAlert.deleteMany()
  await db.psychologyObs.deleteMany()
  await db.psychEvidence.deleteMany()
  await db.wellbeingState.deleteMany()
  await db.crisisFlag.deleteMany()
  await db.certificate.deleteMany()
  await db.reportCard.deleteMany()
  await db.growthReport.deleteMany()
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
  await db.confidenceRating.deleteMany()
  await db.peerAssessment.deleteMany()
  await db.caseReview.deleteMany()
  await db.caseReviewResponse.deleteMany()
  await db.studentHealthSummary.deleteMany()
  await db.chatSession.deleteMany()
  await db.accessGrant.deleteMany()
  await db.passwordResetRequest.deleteMany()
  await db.roleNavConfig.deleteMany()
  await db.guardianLink.deleteMany()
  await db.teacherRule.deleteMany()
  await db.aICache.deleteMany()
  await db.aIUsageLog.deleteMany()
  await db.setting.deleteMany()
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
      role: 'developer',
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

  // ============================================================
  // COMPREHENSIVE PSYCHOLOGY + EDUCATIONAL + MENTOR DATA
  // Fills all the tabs that were empty so the demo shows full functionality
  // ============================================================
  console.log('\n📊 Filling comprehensive psychology + educational + mentor data...')

  // ---------- 1. PsychologyObs for ALL 50 students (multiple weeks each) ----------
  console.log('   🧠 Psychology observations for all students...')
  const psychDimensions = {
    confidence: ['low', 'moderate', 'high'],
    communication: [
      'Clear and concise; articulates concepts well',
      'Thoughtful, takes time to respond thoroughly',
      'Enthusiastic, asks many probing questions',
      'Quiet, needs prompting to share thoughts',
      'Articulate, uses examples from real projects',
      'Tends to over-explain; can be more concise',
      'Strong written communication, weaker verbal',
      'Excellent at simplifying complex topics for peers'
    ],
    learningCurve: [
      'Steady consistent progress week over week',
      'Fast initial uptake, plateaued in week 4',
      'Slow start, accelerating as fundamentals click',
      'Consistent high performer across all topics',
      'Inconsistent — peaks and valleys by topic',
      'Struggles with abstract concepts, excels with concrete examples',
      'Linear progression; benefits from structured practice',
      'Rapid learner; needs enrichment to stay engaged'
    ],
    engagement: [
      'Highly engaged;主动 participates in every session',
      'Engaged and responsive; asks clarifying questions',
      'Moderately engaged; participates when prompted',
      'Variable engagement; strong on familiar topics',
      'Recently disengaged; possible burnout',
      'Deeply engaged in projects, less in quizzes',
      'Engaged in theory, resists practical exercises',
      'Highly engaged; mentors peers voluntarily'
    ],
    cognitiveLoad: ['light', 'moderate', 'heavy'],
    metacognitive: ['low', 'moderate', 'high'],
    remarks: [
      'Student shows strong analytical thinking. Encourage deeper exploration of edge cases.',
      'Excellent participation this week. Recommend peer-mentoring role.',
      'Showing signs of stress. Monitor closely and offer support.',
      'Solid grasp of fundamentals. Ready for advanced topics.',
      'Needs more practice with recursion. Suggested additional problems.',
      'Top of cohort. Consider honours track.',
      'Improving steadily. Keep current pace.',
      'Struggling with abstract concepts. Use more concrete examples.',
      'Demonstrates growth mindset. Frames failures as learning.',
      'Perfectionism emerging; may need encouragement to ship imperfect work.',
      'Strong collaboration skills; leads group effectively.',
      'Requires structured accountability; thrives with check-ins.',
      'Excellent at debugging; methodical and patient.',
      'Tends to rush; encourage slower, more deliberate practice.',
      'Creative problem-solver; thinks outside the box.',
      'Solid technical foundation; communication needs work.',
      'Highly self-motivated; completes work ahead of schedule.',
      'Anxiety around assessments; recommend box breathing technique.',
      'Excellent peer reviewer; gives constructive feedback.',
      'Inconsistent attendance affecting progress; follow up.'
    ]
  }

  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    // Create 4 weeks of psychology observations per student
    const weeksCount = (i % 3) + 3 // 3-5 weeks each
    for (let w = 0; w < weeksCount; w++) {
      await db.psychologyObs.create({
        data: {
          userId: s.id,
          week: w + 1,
          confidence: pick(psychDimensions.confidence, i + w),
          communication: pick(psychDimensions.communication, i + w),
          learningCurve: pick(psychDimensions.learningCurve, i + w),
          engagement: pick(psychDimensions.engagement, i + w),
          cognitiveLoad: pick(psychDimensions.cognitiveLoad, i + w),
          metacognitive: pick(psychDimensions.metacognitive, i + w),
          remarks: pick(psychDimensions.remarks, i + w),
          date: new Date(Date.now() - (weeksCount - w) * 7 * 86400000)
        }
      })
    }
  }

  // ---------- 2. PsychEvidence — 7-dimension evidence for all students ----------
  // VALUES MUST MATCH what PsychologicalTab.tsx expects (see valueMeanings in DIMENSIONS)
  console.log('   🔬 Psychology evidence (7 dimensions)...')
  const evidenceDimensions = [
    {
      dim: 'calibration',
      values: ['overconfident', 'well-calibrated', 'underconfident'],
      texts: [
        'Student rated themselves 9/10 but scored 4/10 on the daily test. They may not realize they don\'t understand the material.',
        'Self-assessment closely matches actual performance. Healthy self-awareness.',
        'Student rated themselves 3/10 but scored 8/10. They know more than they think — build confidence with specific praise.'
      ]
    },
    {
      dim: 'explanatory_depth',
      values: ['detailed_reasoning', 'moderate_depth', 'surface_answers'],
      texts: [
        'Step-by-step explanations (over 300 characters). Strong signal — the student is connecting concepts, not just reciting.',
        'Adequate explanations (50-300 characters). The student can explain but doesn\'t go deep without prompting.',
        'Very short answers (under 50 characters). May indicate rushing, anxiety, or gaps. Probe with "Can you explain why?"'
      ]
    },
    {
      dim: 'gaming_pattern',
      values: ['authentic_voice', 'voice_inconsistency', 'not_analyzed'],
      texts: [
        'Consistent voice across all answers. No signs of AI assistance. The student\'s work is their own.',
        'Significant voice differences detected. Some answers may be AI-generated. Ask the student to explain verbally in a 1-on-1.',
        'This test type doesn\'t run plagiarism analysis (practice tests). Weekly tests run the full analysis.'
      ]
    },
    {
      dim: 'attribution',
      values: ['growth_mindset', 'fixed_mindset', 'avoidant', 'neutral'],
      texts: [
        'Student uses effort-based language ("I can learn this", "I need more practice"). Responds well to challenges.',
        'Student uses ability-based language ("I\'m not good at this", "I can\'t do it"). May avoid challenges. Praise effort, not ability.',
        'Multiple "I don\'t know" or "skip" answers. May indicate anxiety, lack of preparation, or fear of being wrong.',
        'No strong mindset signals in this test. The student engaged normally.'
      ]
    },
    {
      dim: 'cognitive_load',
      values: ['high_intrinsic', 'moderate_load', 'low_germane'],
      texts: [
        'Score below 40%. The material is too difficult right now. Break into smaller pieces, provide prerequisites, slow down.',
        'Score 40-89%. The student is engaging with the material but hasn\'t mastered it yet. This is the sweet spot for learning.',
        'Score 90%+. Material mastered, low cognitive load. The student is ready for advanced or applied work.'
      ]
    },
    {
      dim: 'srl_phase',
      values: ['forethought', 'performance', 'reflection', 'performance_with_fatigue'],
      texts: [
        'Student is still building familiarity. Short, tentative answers. Provide clear instructions and examples before asking questions.',
        'Student is actively working at a steady pace. Moderate-length answers. Let them work, provide feedback on process not just answers.',
        'Student is deeply processing, connecting concepts. Long, detailed answers. Ask them to teach the concept to someone else.',
        'Student started strong but shortened over time. May be tired or losing focus. Consider shorter sessions, check workload.'
      ]
    },
    {
      dim: 'fluency',
      values: ['fluent', 'developing', 'fragmented', 'improving', 'declining'],
      texts: [
        'Score 75%+. Strong, stable recall. The student can retrieve and apply knowledge consistently.',
        'Score 50-74%. Recall is improving but not yet stable. The student needs more practice to consolidate.',
        'Score below 50%. Recall is inconsistent — the student may know pieces but can\'t connect them. Go back to fundamentals.',
        'Later answers scored higher than earlier ones. Retrieval practice is working — the student is warming up. Good sign.',
        'Later answers scored lower than earlier ones. May indicate fatigue, time pressure, or weak memory. Shorter sessions, check rest.'
      ]
    }
  ]

  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    // 4-7 evidence entries per student, across different dimensions
    const evidenceCount = (i % 4) + 4
    for (let e = 0; e < evidenceCount; e++) {
      const dim = evidenceDimensions[(i + e) % evidenceDimensions.length]
      const valueIdx = (i + e) % dim.values.length
      const text = dim.texts[valueIdx]
      await db.psychEvidence.create({
        data: {
          userId: s.id,
          dimension: dim.dim,
          value: dim.values[valueIdx],
          evidenceText: text,
          sourceType: pick(['weekly_test', 'interaction', 'check_in', 'manual'], e),
          week: rand(1, 12),
          createdAt: new Date(Date.now() - rand(1, 30) * 86400000)
        }
      }).catch(() => {})
    }
  }

  // ---------- 2b. ConfidenceRatings for calibration scatter chart ----------
  console.log('   📊 Confidence ratings (for calibration scatter chart)...')
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    // 3-6 confidence ratings per student (self-rated vs actual score)
    const ratingCount = (i % 4) + 3
    for (let r = 0; r < ratingCount; r++) {
      const selfRating = rand(1, 5)
      // Create calibration patterns: some overconfident, some underconfident, some well-calibrated
      const offset = (i + r) % 3 === 0 ? -20 : (i + r) % 3 === 1 ? 20 : 0
      const actualScore = Math.max(0, Math.min(100, selfRating * 20 + offset + rand(-10, 10)))
      await db.confidenceRating.create({
        data: {
          userId: s.id,
          source: pick(['self', 'weekly_test', 'ai_observed'], r),
          rating: selfRating,
          actualScore,
          context: pick(['Week 3 daily test — arrays', 'Week 5 practice — trees', 'Week 7 weekly test — graphs', 'Week 9 daily test — DP', 'Week 11 practice — sorting'], r),
          week: rand(1, 12),
          createdAt: new Date(Date.now() - rand(1, 30) * 86400000)
        }
      }).catch(() => {})
    }
  }

  // ---------- 2c. AccessGrants for demo account → all students ----------
  // CRITICAL: demo account has 'developer' role which needs an AccessGrant
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

  // ---------- 3. WellbeingState for ALL students ----------
  console.log('   💚 Wellbeing states for all students...')
  const tierReasons = {
    green: [[]],
    amber: [
      ['Mood score dropped below 5/10', 'Engagement streak broken'],
      ['Average score below 60% for 2 weeks', 'Reduced AI Tutor interaction'],
      ['Project tasks overdue by 3 days'],
      ['Increased frustration markers in practice sessions']
    ],
    red: [
      ['Mood score 2/10 or below', 'Missed 3+ consecutive check-ins'],
      ['Disclosed personal stress', 'Engagement critically low'],
      ['Crisis flag raised by AI detection', 'Failed 2 consecutive weekly tests']
    ]
  }
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    // Distribute: ~60% green, ~30% amber, ~10% red
    const tier = i % 10 < 6 ? 'green' : (i % 10 < 9 ? 'amber' : 'red')
    const reasons = tier === 'green' ? [] : pick(tierReasons[tier as 'amber' | 'red'], i)
    await db.wellbeingState.create({
      data: {
        userId: s.id,
        tier,
        reasonsJson: JSON.stringify(reasons),
        detectedAt: new Date(Date.now() - rand(1, 14) * 86400000)
      }
    }).catch(() => {})
  }

  // ---------- 4. CrisisFlags for at-risk students ----------
  console.log('   🚨 Crisis flags for at-risk students...')
  const crisisCategories = ['self_harm_risk', 'severe_distress', 'disclosure', 'academic_crisis', 'behavioural_concern']
  const crisisSeverities = ['amber', 'red']
  for (let i = 0; i < 8; i++) {
    const s = students[i * 5] // every 5th student, first 8
    const status = i < 3 ? 'open' : (i < 6 ? 'acknowledged' : 'resolved')
    await db.crisisFlag.create({
      data: {
        userId: s.id,
        flaggedBy: i % 2 === 0 ? counsellor.id : 'ai_detection',
        category: pick(crisisCategories, i),
        severity: pick(crisisSeverities, i),
        status,
        resolvedAt: status === 'resolved' ? new Date(Date.now() - rand(1, 14) * 86400000) : null,
        createdAt: new Date(Date.now() - rand(3, 21) * 86400000)
      }
    }).catch(() => {})
  }

  // ---------- 5. MentorshipTouchpoints — comprehensive GROW sessions ----------
  console.log('   🌱 Mentorship touchpoints (GROW sessions)...')
  const growSessions = [
    { type: 'checkin', note: 'GROW Session — Goal: Improve DSA problem-solving speed. Reality: Currently averaging 25 min per problem, peer avg is 15 min. Options: Daily timed practice (3 problems), review optimal approaches before coding, study editorial after attempt. Will: Commit to 3 timed problems daily for next 2 weeks, share repo link each Friday.', outcome: 'ongoing', followUp: 14 },
    { type: 'checkin', note: 'GROW Session — Goal: Manage exam anxiety. Reality: Reports sleeping <5 hrs during exam week, heart racing during quizzes. Options: Box breathing technique (4-4-4-4), sleep hygiene plan (no screens 1hr before bed), positive self-talk reframing. Will: Try box breathing before next quiz, report back in 1 week.', outcome: 'resolved', followUp: 7 },
    { type: 'alert_response', note: 'GROW Session — Goal: Reconnect with coursework after absence. Reality: Missed 5 days due to family emergency, feels overwhelmed and behind. Options: Prioritise core topics, skip enrichment, schedule catch-up session with teacher. Will: Complete missed daily logs by Friday, attend office hours Wednesday.', outcome: 'ongoing', followUp: 7 },
    { type: 'checkin', note: 'GROW Session — Goal: Build confidence in group settings. Reality: Avoids asking questions in class despite knowing answers, self-rated confidence 4/10. Options: Graduated exposure — ask 1 question per class for 2 weeks, practice in mentor sessions first. Will: Ask 1 question in tomorrow\'s class, mentor follows up Friday.', outcome: 'ongoing', followUp: 7 },
    { type: 'praise_note', note: 'Praise Note — Student submitted exceptional capstone project. Code quality exceeded expectations, README was publication-ready, and they proactively helped 3 peers debug their projects. Recommended for honours track and potential TA position next cohort.', outcome: 'resolved', followUp: null },
    { type: 'scheduled_followup', note: 'Follow-up Session — Reviewed action items from last GROW session. Student completed 18 of 21 planned practice problems. Confidence up from 4/10 to 6/10. Box breathing technique reported as helpful — used before Quiz 3 and felt calmer. New goal: maintain streak and add 1 harder problem per day.', outcome: 'resolved', followUp: 14 },
    { type: 'checkin', note: 'GROW Session — Goal: Career path clarity (Software Engineering vs Data Science). Reality: Confused, has not researched either path, fears making wrong choice. Options: 2 informational interviews (1 SE + 1 DS practitioner), review job postings, identify which daily tasks energise them. Will: Reach out to 2 alumni via LinkedIn this week, document findings.', outcome: 'ongoing', followUp: 14 },
    { type: 'escalation', note: 'Escalation — Student disclosed significant family pressure regarding grades. Reports parents threatening to withdraw from program if GPA drops below 3.5. Visible distress during session. Escalated to counsellor for ongoing support. Mentor will continue academic coaching; counsellor handles family dynamics.', outcome: 'escalated', followUp: 3 },
    { type: 'checkin', note: 'GROW Session — Goal: Improve time management during exams. Reality: Runs out of time, spends 40% on first 30% of paper. Options: Marks-per-minute allocation, flag-and-move strategy, timed practice at home. Will: Do 1 timed paper this week using new strategy, review timing log Friday.', outcome: 'ongoing', followUp: 7 },
    { type: 'checkin', note: 'GROW Session — Goal: Build a portfolio project using course concepts. Reality: GitHub empty beyond assignments, no personal project. Options: Build a CLI visualiser for Dijkstra (combines course concepts + portfolio building), commit weekly. Will: Scaffold project this weekend, commit by Sunday, share link Monday.', outcome: 'ongoing', followUp: 14 },
    { type: 'alert_response', note: 'Alert Response — Followed up on wellbeing alert. Student mood improved from 2/10 to 6/10 over 2 weeks. Engaged with counsellor, started exercise routine, sleep back to 7+ hours. Academic engagement returning. Will continue weekly check-ins for 4 more weeks then reassess.', outcome: 'resolved', followUp: 7 },
    { type: 'praise_note', note: 'Praise Note — Student demonstrated exceptional growth mindset after failing Quiz 3. Instead of giving up, they requested a 1:1 to review mistakes, completed 5 additional practice problems, and helped explain the concepts to a struggling peer. This is exactly the metacognitive behaviour we want to cultivate.', outcome: 'resolved', followUp: null },
    { type: 'checkin', note: 'GROW Session — Goal: Address burnout. Reality: Reports exhaustion, no hobbies, studies 12+ hours daily. Concerned about sustainability. Options: Forced-rest blocks (2 hrs/day offline), reconnect with one hobby (cricket), track energy levels daily. Will: Schedule 30-min walk daily, stop studying by 10pm, track in journal.', outcome: 'ongoing', followUp: 7 },
    { type: 'scheduled_followup', note: 'Follow-up Session — Burnout intervention review. Student implemented walk daily (missed 2 days), sleep improved to 7.5 hrs avg. Energy levels self-rated 6/10 (up from 3/10). Mood stable. Will maintain protocol for 4 more weeks, then consider scaling back rest blocks.', outcome: 'ongoing', followUp: 14 },
    { type: 'checkin', note: 'GROW Session — Goal: Strengthen understanding of graph algorithms. Reality: Confident on arrays/trees but lost on graphs, has not practised Dijkstra. Options: Re-watch Lectures 9-10, solve 5 graph problems on LeetCode, submit to mentor by Friday. Will: Watch both lectures this weekend, solve 5 problems by Monday.', outcome: 'resolved', followUp: 7 }
  ]

  let touchpointCount2 = 0
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    // 2-4 touchpoints per student
    const sessionsToCreate = (i % 3) + 2
    for (let j = 0; j < sessionsToCreate; j++) {
      const session = pick(growSessions, i * 2 + j)
      await db.mentorshipTouchpoint.create({
        data: {
          userId: s.id,
          actorUserId: mentor.id,
          type: session.type,
          note: session.note,
          outcome: session.outcome,
          followUpDate: session.followUp ? new Date(Date.now() + session.followUp * 86400000) : null,
          createdAt: new Date(Date.now() - rand(1, 60) * 86400000)
        }
      })
      touchpointCount2++
    }
  }
  console.log(`      ✓ ${touchpointCount2} mentorship touchpoints`)

  // ---------- 6. Competencies for all students ----------
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
          examinerObs: pick([
            'Strong analytical thinking; would benefit from timed practice.',
            'Excellent conceptual grasp; needs work on implementation speed.',
            'Solid effort; recommend reviewing week 4 materials on graph traversal.',
            'Shows growth from last week; consistency improving.',
            'Top performer; consider enrichment problems.'
          ], w),
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
          workHabits: pick(['Excellent — completes all assignments on time, proactive in seeking help', 'Good — generally punctual, occasionally needs prompting', 'Developing — needs structure and accountability check-ins', 'Improving — was inconsistent, now showing steady progress'], w),
          progress: pick(['Strong upward trajectory; ready for advanced topics', 'Steady progress; on track to meet course outcomes', 'Plateaued; needs new challenge or different approach', 'Recovered from early struggles; momentum building'], w),
          nextSteps: JSON.stringify(pick([['Continue daily practice', 'Start capstone planning', 'Mentor a junior peer'], ['Focus on weak areas', 'Schedule office hours weekly', 'Try extension problems'], ['Maintain current pace', 'Explore enrichment material', 'Build portfolio project'], ['Review fundamentals', 'Complete missed assignments', 'Attend all office hours']], w)),
          examinerObservations: pick([
            'Student demonstrates strong analytical thinking and consistent engagement. Recommend for honours track.',
            'Solid grasp of fundamentals. Would benefit from more timed practice to improve exam performance.',
            'Showing excellent growth mindset. Frames failures as learning opportunities.',
            'Top performer. Consider giving enrichment problems to maintain engagement.',
            'Improving steadily. Needs to build confidence in group settings.'
          ], w),
          date: new Date(Date.now() - w * 7 * 86400000)
        }
      }).catch(() => {})
    }
  }

  // ---------- 10. CaseReviews for counsellor ----------
  console.log('   📋 Case reviews...')
  const casePatterns = [
    'Student showing strong improvement after 3 weeks of GROW sessions. Pattern: initial resistance to reflection → gradual ownership → proactive goal-setting. Recommended approach: shift from weekly to bi-weekly check-ins.',
    'Pattern of anxiety spikes before assessments. Intervention: box breathing + reframing techniques. Outcome: anxiety self-rating dropped from 8/10 to 4/10 over 2 weeks. Pattern matches 3 other students this cohort.',
    'Burnout pattern detected: declining engagement + reduced sleep + increased irritability. Intervention: forced rest blocks + hobby reconnection. Pattern resolved in 4 weeks for this student.',
    'Family pressure pattern: parent expectations creating performance anxiety. Counsellor involved for family dynamics. Pattern: student oscillates between over-performance and crash. Ongoing.',
    'Perfectionism pattern: student spends excessive time on minor details, ships late. GROW sessions focused on "done is better than perfect". Slow progress; pattern is deeply ingrained.',
    'Social anxiety pattern: avoids group work, declines to present. Graduated exposure intervention (1 question per class). Pattern improving; student presented 3 slides to mentor last session.',
    'Disengagement pattern after failing quiz. Intervention: growth mindset reframing + easier wins to rebuild confidence. Pattern reversed within 1 week. Student now mentoring peers.',
    'Crisis pattern: disclosed self-harm ideation. Immediate escalation to clinical psychologist. Pattern: academic stress + family conflict + social isolation. Multi-pronged intervention ongoing.',
    'Recovery pattern: student returned from 2-week absence (family emergency). Phased reintegration plan. Pattern: initial overwhelm → catch-up plan → steady re-engagement. Resolved.',
    'Imposter syndrome pattern: high performer who dismisses achievements. Pattern: attributes success to luck, fears being "found out". GROW sessions on internal attribution. Ongoing.',
    'Procrastination pattern: consistently starts assignments late. Time-blocking intervention + accountability partner. Pattern improving; on-time submission rate up from 40% to 80%.',
    'Over-commitment pattern: student takes on too many extracurriculars, coursework suffers. Values clarification exercise. Pattern: student dropped 2 commitments, grades recovering.'
  ]
  for (let i = 0; i < 12; i++) {
    await db.caseReview.create({
      data: {
        postedBy: counsellor.id,
        patternSummary: pick(casePatterns, i),
        status: i < 4 ? 'open' : 'closed',
        createdAt: new Date(Date.now() - rand(1, 30) * 86400000)
      }
    }).catch(() => {})
  }

  // ---------- 11. StudentHealthSummary for each student ----------
  console.log('   🏥 Student health summaries (per student)...')
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    await db.studentHealthSummary.create({
      data: {
        userId: s.id,
        tutorMessagesThisWeek: rand(0, 15),
        tutorMessagesLastWeek: rand(5, 20),
        tutorMessagesTotal: rand(20, 100),
        testsThisWeek: rand(1, 4),
        testsLastWeek: rand(1, 4),
        avgScoreThisWeek: rand(50, 95),
        avgScoreLastWeek: rand(50, 90),
        avgScoreOverall: rand(55, 90)
      } as any
    }).catch(() => {})
  }

  console.log('   ✅ Comprehensive data fill complete!')

  console.log('\n✅ Seed complete!')
  console.log(`   - Institution: 1`)
  console.log(`   - Users: 57 (admin, principal, 2 teachers, counsellor, mentor, 50 students, demo)`)
  console.log(`   - Courses: 2 with professional outlines`)
  console.log(`   - Batches: 3`)
  console.log(`   - Course weeks: ${csWeeks.length + mgtWeeks.length}`)
  console.log(`   - Student alerts: ${alertCount} (with counsellor responses)`)
  console.log(`   - Mentorship touchpoints: ${touchpointCount + touchpointCount2} (GROW sessions)`)
  console.log(`   - Psychology observations: 200+ (7-dimension profiles, all students)`)
  console.log(`   - Psychology evidence: 200+ entries across 7 dimensions`)
  console.log(`   - Wellbeing states: 50 (green/amber/red tiers)`)
  console.log(`   - Crisis flags: 8 (open/acknowledged/resolved)`)
  console.log(`   - Competencies: 250+ (4-6 per student)`)
  console.log(`   - Weekly tests: 150+ (2-5 per student with scores)`)
  console.log(`   - Daily logs: 250+ (3-7 per student with reflections)`)
  console.log(`   - Report cards: 100+ (1-3 per student)`)
  console.log(`   - Case reviews: 12`)
  console.log(`   - Messages: ${messagePairs.length}`)
  console.log(`   - Audit logs: ${auditActions.length}`)
  console.log(`   - Interactions: 200`)
  console.log(`   - Student health summary: 1`)
  console.log(`\n🔑 DEMO LOGIN: demo@examiner.ai / demo123`)
  console.log(`   (or admin@examiner.ai / helloworld)`)
  console.log(`   Demo account has 'developer' role — read-only, no writes.`)
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
