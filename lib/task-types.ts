export type TaskStatus =
  | "draft"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected"
  | "completed";

export type TaskPriority = "high" | "medium" | "low";

export interface TeamTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  memberId: string;
  memberName: string;
  priority: TaskPriority;
  tag?: string;
  dueDate?: Date;
  projectId?: string;
  submissionDate?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  // Recurrence fields
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceInterval?: number;
  recurrenceDays?: number[];
  nextRecurrenceAt?: number;
  parentRecurringId?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "member";
  createdAt: Date;
}

export interface CurrentUser {
  memberId: string;
  orgId: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "member";
}

export interface OrgInfo {
  orgId: string;
  orgName: string;
  orgSlug: string;
  plan?: string;
  memberId: string;
  role: string;
}
