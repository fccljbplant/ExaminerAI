/**
 * src/lib/api-types.ts — Shared TypeScript interfaces for API responses.
 *
 * These types mirror the shapes returned by API routes, so frontend
 * components can consume them without `any`. When an API route changes
 * its response shape, update the corresponding type here.
 *
 * Convention: each type is named after the API resource + "Response" or
 * the individual entity name.
 */

// ── Access Grants ───────────────────────────────────────────────
export interface AccessGrant {
  id: string;
  granteeUserId: string;
  granteeName?: string;
  granteeEmail?: string;
  grantee?: { name: string; email: string; role: string };
  role: string;
  scopeType: string;
  scopeId: string;
  dataScope?: string;
  createdAt: string;
  grantedAt?: string;
}

// ── Audit Log ───────────────────────────────────────────────────
export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson: string | null;
  afterJson: string | null;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string;
  // Parsed fields (added by the API before returning)
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadataObj?: Record<string, unknown> | null;
  reason?: string;
  
}

// ── Events ──────────────────────────────────────────────────────
export interface CourseEvent {
  id: string;
  title: string;
  description?: string;
  type?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  courseId?: string;
  [key: string]: unknown;
}

// ── Group Task Submissions ──────────────────────────────────────
export interface GroupTaskSubmission {
  id: string;
  groupTaskId: string;
  userId: string;
  content: string;
  link?: string;
  submittedAt: string;
  score?: number;
  feedback?: string;
  user?: { name: string; email: string };
  [key: string]: unknown;
}

// ── Group Tasks ─────────────────────────────────────────────────
export interface GroupTask {
  id: string;
  title: string;
  description?: string;
  courseId?: string;
  dueDate?: string;
}

// ── Certificate (simplified for frontend) ───────────────────────
export interface CertificateResponse {
  id: string;
  credentialId?: string;
  courseName: string;
  studentName: string;
  grade: string;
  score: number;
  issuedAt: string;
  signedBy: string;
  verifyToken: string;
  verifyUrl?: string;
}

// ── Teacher Stats (used by instructor views) ────────────────────
export interface TeacherStats {
  totalStudents: number;
  pendingApprovals: number;
  totalTeachers: number;
  testsThisWeek: number;
  studentsWithProjects: number;
  studentsWithoutProjects: number;
  studentsNeedingAttention: number;
  totalWithTests: number;
  totalActiveToday: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  loadedCount?: number;
}

// ── Alert Item (used by instructor triage) ──────────────────────
export interface AlertItem {
  id: string;
  userId: string;
  type: string;
  severity: string;
  reason: string;
  metric?: string;
  metricValue?: string;
  status: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; batchId: string | null };
}

// ── Peer Assessment ─────────────────────────────────────────────
export interface PeerAssessment {
  id: string;
  assesseeId: string;
  assesseeName: string;
  assessorId: string;
  assessorName: string;
  rating?: number;
  textFeedback?: string;
}
