import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/dashboard
// Returns role-specific dashboard data
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Determine the effective user (either the logged-in user OR the user
  // the demo developer is currently "viewing as")
  const effectiveUserId = session.isDemo && session.viewingAsUserId
    ? session.viewingAsUserId
    : session.id
  const role = session.role

  switch (role) {
    case 'STUDENT':
      return NextResponse.json(await getStudentDashboard(effectiveUserId))
    case 'TEACHER':
      return NextResponse.json(await getTeacherDashboard(effectiveUserId))
    case 'COUNSELOR':
      return NextResponse.json(await getCounsellorDashboard(effectiveUserId))
    case 'MENTOR':
      return NextResponse.json(await getMentorDashboard(effectiveUserId))
    case 'PRINCIPAL':
      return NextResponse.json(await getPrincipalDashboard(session.institutionId!))
    case 'ADMIN':
      return NextResponse.json(await getAdminDashboard())
    case 'DEVELOPER':
      return NextResponse.json(await getDeveloperDashboard(session.institutionId!))
    default:
      return NextResponse.json({ error: 'Unknown role' }, { status: 400 })
  }
}

// ============================================================
// STUDENT DASHBOARD
// ============================================================
async function getStudentDashboard(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return { error: 'User not found' }

  const enrollments = await db.enrollment.findMany({
    where: { studentId: userId },
    include: {
      course: { include: { teacher: true } },
      batch: true
    }
  })

  // Grades for this student
  const grades = await db.grade.findMany({
    where: { studentId: userId },
    include: { assessment: { include: { course: true } } }
  })

  // Compute per-course weighted score
  const courseGrades: Record<string, { course: any; assessments: any[]; weightedTotal: number }> = {}
  for (const g of grades) {
    const courseId = g.assessment.courseId
    if (!courseGrades[courseId]) {
      courseGrades[courseId] = {
        course: g.assessment.course,
        assessments: [],
        weightedTotal: 0
      }
    }
    const pct = (g.marks / g.assessment.maxMarks) * 100
    courseGrades[courseId].assessments.push({
      title: g.assessment.title,
      type: g.assessment.type,
      marks: g.marks,
      maxMarks: g.assessment.maxMarks,
      pct: Number(pct.toFixed(1)),
      weightage: g.assessment.weightage,
      feedback: g.feedback
    })
    courseGrades[courseId].weightedTotal += (pct * g.assessment.weightage) / 100
  }

  // Attendance
  const attendances = await db.attendance.findMany({
    where: { studentId: userId },
    include: { session: true }
  })
  const attendanceSummary = {
    total: attendances.length,
    present: attendances.filter(a => a.status === 'PRESENT').length,
    late: attendances.filter(a => a.status === 'LATE').length,
    absent: attendances.filter(a => a.status === 'ABSENT').length,
    excused: attendances.filter(a => a.status === 'EXCUSED').length
  }
  const attendancePct = attendanceSummary.total > 0
    ? Number(((attendanceSummary.present + attendanceSummary.late * 0.5) / attendanceSummary.total * 100).toFixed(1))
    : 0

  // Alerts targeted at this student (sent to counsellor about them)
  const alerts = await db.alert.findMany({
    where: { studentId: userId },
    include: { fromUser: true, toUser: true, course: true },
    orderBy: { createdAt: 'desc' }
  })

  // Mentor sessions
  const mentorSessions = await db.mentorSession.findMany({
    where: { studentId: userId },
    include: { mentor: true },
    orderBy: { date: 'desc' }
  })

  // Assignments + submissions
  const courseIds = enrollments.map(e => e.courseId)
  const assignments = await db.assignment.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      course: true,
      submissions: { where: { studentId: userId } }
    },
    orderBy: { dueDate: 'asc' }
  })

  // Counsellor assignment
  const counsellorAssignment = await db.studentCounsellorAssignment.findFirst({
    where: { studentId: userId, status: 'ACTIVE' },
    include: { counsellor: true }
  })

  // Messages
  const messages = await db.message.findMany({
    where: { OR: [{ fromId: userId }, { toId: userId }] },
    include: { fromUser: true, toUser: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  return {
    role: 'STUDENT',
    user,
    enrollments: enrollments.map(e => ({
      id: e.id,
      course: e.course,
      batch: e.batch,
      status: e.status,
      finalGrade: e.finalGrade
    })),
    courseGrades: Object.values(courseGrades).map(cg => ({
      course: cg.course,
      assessments: cg.assessments,
      weightedTotal: Number(cg.weightedTotal.toFixed(1)),
      letterGrade: pctToLetter(cg.weightedTotal)
    })),
    attendanceSummary,
    attendancePct,
    alerts,
    mentorSessions,
    assignments: assignments.map(a => ({
      id: a.id,
      title: a.title,
      course: a.course,
      dueDate: a.dueDate,
      maxMarks: a.maxMarks,
      submission: a.submissions[0] || null
    })),
    counsellorAssignment,
    recentMessages: messages,
    gpa: computeGPA(Object.values(courseGrades).map(cg => cg.weightedTotal))
  }
}

// ============================================================
// TEACHER DASHBOARD
// ============================================================
async function getTeacherDashboard(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return { error: 'User not found' }

  const courses = await db.course.findMany({
    where: { teacherId: userId },
    include: {
      enrollments: { include: { student: true } },
      batches: { include: { enrollments: true } }
    }
  })

  // Alerts sent by this teacher (with responses)
  const alertsSent = await db.alert.findMany({
    where: { fromUserId: userId },
    include: { student: true, course: true, toUser: true },
    orderBy: { createdAt: 'desc' }
  })

  // Sessions led
  const sessions = await db.classSession.findMany({
    where: { teacherId: userId },
    include: {
      batch: true,
      course: true,
      attendances: true
    },
    orderBy: { date: 'desc' },
    take: 12
  })

  // Gradebook for each course
  const gradebooks = []
  for (const c of courses) {
    const assessments = await db.assessment.findMany({
      where: { courseId: c.id },
      orderBy: { date: 'asc' }
    })
    const studentGrades: any[] = []
    for (const en of c.enrollments) {
      const grades = await db.grade.findMany({
        where: { studentId: en.studentId },
        include: { assessment: true }
      })
      const gradeMap: Record<string, number> = {}
      let weighted = 0
      for (const g of grades) {
        gradeMap[g.assessmentId] = g.marks
        weighted += (g.marks / g.assessment.maxMarks) * 100 * g.assessment.weightage / 100
      }
      studentGrades.push({
        student: en.student,
        grades: gradeMap,
        weighted: Number(weighted.toFixed(1)),
        letter: pctToLetter(weighted)
      })
    }
    gradebooks.push({
      course: { id: c.id, code: c.code, title: c.title },
      assessments,
      students: studentGrades
    })
  }

  // Submissions pending review
  const courseIds = courses.map(c => c.id)
  const pendingSubmissions = await db.submission.findMany({
    where: {
      assignment: { courseId: { in: courseIds } },
      status: { in: ['SUBMITTED', 'LATE'] }
    },
    include: { assignment: { include: { course: true } }, student: true },
    orderBy: { submittedAt: 'desc' }
  })

  return {
    role: 'TEACHER',
    user,
    courses: courses.map(c => ({
      id: c.id,
      code: c.code,
      title: c.title,
      semester: c.semester,
      studentCount: c.enrollments.length,
      batches: c.batches
    })),
    alertsSent,
    recentSessions: sessions,
    gradebooks,
    pendingSubmissions,
    stats: {
      totalCourses: courses.length,
      totalStudents: courses.reduce((sum, c) => sum + c.enrollments.length, 0),
      alertsOpen: alertsSent.filter(a => a.status === 'OPEN').length,
      alertsResolved: alertsSent.filter(a => a.status === 'RESOLVED').length,
      pendingSubmissions: pendingSubmissions.length
    }
  }
}

// ============================================================
// COUNSELLOR DASHBOARD
// ============================================================
async function getCounsellorDashboard(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return { error: 'User not found' }

  const assignments = await db.studentCounsellorAssignment.findMany({
    where: { counsellorId: userId },
    include: { student: true }
  })

  // Alerts sent TO this counsellor (with responses from counsellor)
  const alerts = await db.alert.findMany({
    where: { toUserId: userId },
    include: { student: true, fromUser: true, course: true },
    orderBy: { createdAt: 'desc' }
  })

  // Students with wellbeing/critical alerts not yet responded to
  const urgentQueue = alerts.filter(a => a.status === 'OPEN' && (a.severity === 'CRITICAL' || a.severity === 'HIGH'))

  return {
    role: 'COUNSELOR',
    user,
    assignments,
    alerts,
    urgentQueue,
    stats: {
      totalAssigned: assignments.length,
      activeCases: assignments.filter(a => a.status === 'ACTIVE').length,
      alertsOpen: alerts.filter(a => a.status === 'OPEN').length,
      alertsAcknowledged: alerts.filter(a => a.status === 'ACKNOWLEDGED').length,
      alertsResolved: alerts.filter(a => a.status === 'RESOLVED').length,
      urgentCases: urgentQueue.length
    }
  }
}

// ============================================================
// MENTOR DASHBOARD
// ============================================================
async function getMentorDashboard(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return { error: 'User not found' }

  const sessions = await db.mentorSession.findMany({
    where: { mentorId: userId },
    include: { student: true },
    orderBy: { date: 'desc' }
  })

  const psychologicalSessions = sessions.filter(s => s.type === 'PSYCHOLOGICAL')
  const educationalSessions = sessions.filter(s => s.type === 'EDUCATIONAL')

  // Mood distribution
  const moodCounts: Record<string, number> = {}
  for (const s of psychologicalSessions) {
    if (s.mood) moodCounts[s.mood] = (moodCounts[s.mood] || 0) + 1
  }

  // Unique students mentored
  const studentIds = new Set(sessions.map(s => s.studentId))

  // Recent GROW model entries (last 5)
  const recentSessions = sessions.slice(0, 5)

  // Follow-ups due
  const now = new Date()
  const followUpsDue = sessions.filter(s => {
    if (!s.followUp) return false
    const sessionDate = new Date(s.date)
    const days = parseInt(s.followUp)
    const dueDate = new Date(sessionDate)
    dueDate.setDate(dueDate.getDate() + days * 7)
    return dueDate >= sessionDate && dueDate <= new Date(now.getTime() + 7 * 86400000)
  })

  return {
    role: 'MENTOR',
    user,
    sessions,
    recentSessions,
    followUpsDue,
    stats: {
      totalSessions: sessions.length,
      psychologicalSessions: psychologicalSessions.length,
      educationalSessions: educationalSessions.length,
      uniqueStudents: studentIds.size,
      moodDistribution: moodCounts,
      followUpsDue: followUpsDue.length
    }
  }
}

// ============================================================
// PRINCIPAL DASHBOARD — institution-wide
// ============================================================
async function getPrincipalDashboard(institutionId: string) {
  const institution = await db.institution.findUnique({ where: { id: institutionId } })
  if (!institution) return { error: 'Institution not found' }

  // Counts
  const [users, courses, batches, students, teachers, counsellors, mentors, alerts, mentorSessions, enrollments, growthReports] = await Promise.all([
    db.user.count({ where: { institutionId } }),
    db.course.count({ where: { institutionId } }),
    db.batch.count({ where: { institutionId } }),
    db.user.count({ where: { institutionId, role: 'STUDENT' } }),
    db.user.count({ where: { institutionId, role: 'TEACHER' } }),
    db.user.count({ where: { institutionId, role: 'COUNSELOR' } }),
    db.user.count({ where: { institutionId, role: 'MENTOR' } }),
    db.alert.count({ where: { fromUser: { institutionId } } }),
    db.mentorSession.count({ where: { mentor: { institutionId } } }),
    db.enrollment.count({ where: { course: { institutionId } } }),
    db.growthReport.findMany({ where: { institutionId } })
  ])

  // Course performance
  const allCourses = await db.course.findMany({
    where: { institutionId },
    include: { teacher: true, _count: { select: { enrollments: true } } }
  })
  const coursePerformance = []
  for (const c of allCourses) {
    const grades = await db.grade.findMany({
      where: { assessment: { courseId: c.id } },
      include: { assessment: true }
    })
    const avgPct = grades.length > 0
      ? grades.reduce((s, g) => s + (g.marks / (g.assessment?.maxMarks || 1)) * 100, 0) / grades.length
      : 0
    coursePerformance.push({
      id: c.id,
      code: c.code,
      title: c.title,
      teacher: c.teacher?.name,
      studentCount: c._count.enrollments,
      avgScore: Number(avgPct.toFixed(1))
    })
  }

  // All alerts for institution
  const allAlerts = await db.alert.findMany({
    where: { fromUser: { institutionId } },
    include: { student: true, fromUser: true, course: true },
    orderBy: { createdAt: 'desc' }
  })

  // Audit logs
  const auditLogs = await db.auditLog.findMany({
    where: { user: { institutionId } },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  })

  // Recent activity (interactions)
  const recentActivity = await db.interaction.findMany({
    where: { user: { institutionId } },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 15
  })

  return {
    role: 'PRINCIPAL',
    institution,
    stats: {
      totalUsers: users,
      totalCourses: courses,
      totalBatches: batches,
      totalStudents: students,
      totalTeachers: teachers,
      totalCounsellors: counsellors,
      totalMentors: mentors,
      totalAlerts: alerts,
      totalMentorSessions: mentorSessions,
      totalEnrollments: enrollments
    },
    coursePerformance,
    alerts: allAlerts,
    growthReports,
    auditLogs,
    recentActivity,
    alertStats: {
      open: allAlerts.filter(a => a.status === 'OPEN').length,
      acknowledged: allAlerts.filter(a => a.status === 'ACKNOWLEDGED').length,
      resolved: allAlerts.filter(a => a.status === 'RESOLVED').length,
      critical: allAlerts.filter(a => a.severity === 'CRITICAL').length,
      high: allAlerts.filter(a => a.severity === 'HIGH').length
    }
  }
}

// ============================================================
// ADMIN DASHBOARD — system-wide
// ============================================================
async function getAdminDashboard() {
  const [totalUsers, totalInstitutions, totalCourses, totalAlerts, totalMentorSessions] = await Promise.all([
    db.user.count(),
    db.institution.count(),
    db.course.count(),
    db.alert.count(),
    db.mentorSession.count()
  ])

  const usersByRole = await db.user.groupBy({
    by: ['role'],
    _count: true
  })

  const recentUsers = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { institution: true }
  })

  const auditLogs = await db.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 30
  })

  const institutions = await db.institution.findMany({
    include: {
      _count: {
        select: { users: true, courses: true, batches: true }
      }
    }
  })

  return {
    role: 'ADMIN',
    stats: {
      totalUsers,
      totalInstitutions,
      totalCourses,
      totalAlerts,
      totalMentorSessions
    },
    usersByRole: usersByRole.map(u => ({ role: u.role, count: u._count })),
    recentUsers,
    auditLogs,
    institutions
  }
}

// ============================================================
// DEVELOPER DASHBOARD — shows everything (for demo)
// ============================================================
async function getDeveloperDashboard(institutionId: string) {
  // The developer dashboard shows a summary of all dashboards combined
  const principalData = await getPrincipalDashboard(institutionId)
  const adminData = await getAdminDashboard()
  return {
    role: 'DEVELOPER',
    institution: principalData.institution,
    stats: {
      ...adminData.stats,
      ...principalData.stats
    },
    usersByRole: adminData.usersByRole,
    coursePerformance: principalData.coursePerformance,
    alerts: principalData.alerts,
    growthReports: principalData.growthReports,
    institutions: adminData.institutions,
    recentUsers: adminData.recentUsers,
    auditLogs: adminData.auditLogs,
    message: 'Demo Developer account. Use the role switcher in the top bar to preview any dashboard.'
  }
}

// ============================================================
// helpers
// ============================================================
function pctToLetter(pct: number): string {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

function computeGPA(scores: number[]): number {
  if (scores.length === 0) return 0
  const points = scores.map(s => {
    if (s >= 90) return 4.0
    if (s >= 80) return 3.0
    if (s >= 70) return 2.0
    if (s >= 60) return 1.0
    return 0.0
  })
  return Number((points.reduce((a, b) => a + b, 0) / points.length).toFixed(2))
}
