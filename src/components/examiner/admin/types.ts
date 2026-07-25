// Admin dashboard shared types — extracted from AdminDashboard.tsx

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  blocked: boolean;
  approvedAt: string | null;
  createdAt: string;
  lastLogin: string | null;
  currentWeek: number;
  projectName?: string | null;
  // Attention flags (from /api/stats)
  attentionScore?: number;
  attentionReasons?: string[];
  needsAttention?: boolean;
}

export interface ResetRequest {
  id: string; userId: string; reason: string; status: string; tempPassword: string | null;
  adminNote: string | null; createdAt: string; resolvedAt: string | null;
  user: { id: string; email: string; name: string; role: string };
}
