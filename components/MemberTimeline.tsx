"use client";

import { useMemo } from "react";
import {
  CheckSquare, MessageSquare, ArrowRight, Send,
  ThumbsUp, ThumbsDown, UserPlus, UserMinus,
  FolderPlus, Plus, FileText,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

// ── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  _id: string;
  type: string;
  taskId?: string;
  projectId?: string;
  memberId?: string;
  memberName?: string;
  description: string;
  createdAt: number;
}

interface ProjectInfo {
  _id: string;
  name: string;
}

interface Props {
  activities: Activity[];
  memberName: string;
  projects?: ProjectInfo[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVITY_META: Record<string, { icon: typeof CheckSquare; color: string; verb: string }> = {
  task_created:    { icon: Plus,          color: "#6366f1", verb: "created" },
  task_moved:      { icon: ArrowRight,    color: "#3b82f6", verb: "moved" },
  task_submitted:  { icon: Send,          color: "#f59e0b", verb: "submitted" },
  task_approved:   { icon: ThumbsUp,      color: "#22c55e", verb: "approved" },
  task_rejected:   { icon: ThumbsDown,    color: "#ef4444", verb: "rejected" },
  comment_added:   { icon: MessageSquare, color: "#60a5fa", verb: "commented on" },
  member_added:    { icon: UserPlus,      color: "#34d399", verb: "added" },
  member_removed:  { icon: UserMinus,     color: "#f87171", verb: "removed" },
  project_created: { icon: FolderPlus,    color: "#6366f1", verb: "created project" },
};

const fallbackMeta = { icon: FileText, color: "#6b7280", verb: "" };

function formatTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface DateGroup {
  label: string;
  projectGroups: { projectName: string; projectId?: string; items: Activity[] }[];
}

function groupByDateAndProject(
  activities: Activity[],
  locale: string,
  projects: ProjectInfo[],
): DateGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const projectMap = new Map(projects.map((p) => [p._id, p.name]));

  const dateOrder: string[] = [];
  const dateMap: Map<string, { label: string; projectOrder: string[]; projectMap: Map<string, Activity[]> }> = new Map();

  for (const a of activities) {
    const d = new Date(a.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dayTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    let label: string;
    if (dayTs === today) {
      label = locale === "ar" ? "اليوم" : "Today";
    } else if (dayTs === yesterday) {
      label = locale === "ar" ? "أمس" : "Yesterday";
    } else {
      label = d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    if (!dateMap.has(dayKey)) {
      dateOrder.push(dayKey);
      dateMap.set(dayKey, { label, projectOrder: [], projectMap: new Map() });
    }

    const group = dateMap.get(dayKey)!;
    const projKey = a.projectId ?? "__none__";
    if (!group.projectMap.has(projKey)) {
      group.projectOrder.push(projKey);
      group.projectMap.set(projKey, []);
    }
    group.projectMap.get(projKey)!.push(a);
  }

  return dateOrder.map((dayKey) => {
    const { label, projectOrder, projectMap: pm } = dateMap.get(dayKey)!;
    return {
      label,
      projectGroups: projectOrder.map((projKey) => ({
        projectName: projKey === "__none__" ? "" : (projectMap.get(projKey) ?? ""),
        projectId: projKey === "__none__" ? undefined : projKey,
        items: pm.get(projKey)!,
      })),
    };
  });
}

// ── Determine if an activity is a "checked off" type ────────────────────────
function isCompletionType(type: string): boolean {
  return type === "task_approved" || type === "task_moved";
}

// ── Extract task name from description ──────────────────────────────────────
function extractTaskName(description: string): string | null {
  const match = description.match(/"([^"]+)"/);
  return match ? match[1] : null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MemberTimeline({ activities, memberName, projects = [] }: Props) {
  const { locale } = useLocale();

  const groups = useMemo(
    () => groupByDateAndProject(activities, locale, projects),
    [activities, locale, projects],
  );

  if (activities.length === 0) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-muted)", fontSize: 14, padding: 40,
      }}>
        No activity yet
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {groups.map((dateGroup) => (
        <div key={dateGroup.label}>
          {/* ── Date header ───────────────────────────────────────────── */}
          <div style={{
            textAlign: "center", padding: "24px 0 16px",
          }}>
            <span style={{
              fontSize: 15, fontWeight: 700, color: "var(--text)",
            }}>
              {dateGroup.label}
            </span>
          </div>

          {/* ── Project groups within this date ───────────────────────── */}
          {dateGroup.projectGroups.map((pg, pgIdx) => (
            <div
              key={pg.projectId ?? pgIdx}
              style={{
                display: "flex",
                borderTop: "1px solid var(--border)",
                minHeight: 80,
              }}
            >
              {/* Left column — activities */}
              <div style={{
                flex: 1,
                padding: "16px 24px",
                borderRight: "1px solid var(--border)",
              }}>
                {/* Project label */}
                {pg.projectName && (
                  <div style={{
                    fontSize: 12, fontWeight: 500, color: "var(--text-muted)",
                    marginBottom: 12,
                    borderLeft: "2px solid var(--accent)",
                    paddingLeft: 10,
                  }}>
                    {pg.projectName}
                  </div>
                )}

                {/* Activity entries */}
                {pg.items.map((activity) => {
                  const meta = ACTIVITY_META[activity.type] ?? fallbackMeta;
                  const taskName = extractTaskName(activity.description);
                  const isCompletion = activity.type === "task_approved" || activity.description.includes("→ completed");

                  return (
                    <div
                      key={activity._id}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: "var(--surface2)",
                        border: "1px solid var(--border2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                        overflow: "hidden",
                      }}>
                        {activity.memberName ? initials(activity.memberName) : "?"}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Description line */}
                        <p style={{
                          fontSize: 13, color: "var(--text)", margin: 0, lineHeight: 1.5,
                        }}>
                          <span style={{ fontWeight: 600 }}>{activity.memberName ?? memberName}</span>
                          {" "}
                          {activity.type === "comment_added"
                            ? <>commented on <span style={{ color: "var(--accent-light)", fontWeight: 600 }}>{taskName ?? "a task"}</span></>
                            : activity.type === "task_created"
                            ? <>created task: <span style={{ fontWeight: 500 }}>{taskName ?? ""}</span></>
                            : activity.type === "task_submitted"
                            ? <>submitted <span style={{ fontWeight: 500 }}>{taskName ?? ""}</span> for approval</>
                            : activity.type === "task_approved"
                            ? <>checked off:</>
                            : activity.type === "task_moved" && activity.description.includes("→ completed")
                            ? <>checked off:</>
                            : activity.type === "task_moved"
                            ? <>moved <span style={{ fontWeight: 500 }}>{taskName ?? "a task"}</span></>
                            : activity.type === "task_rejected"
                            ? <>sent back <span style={{ fontWeight: 500 }}>{taskName ?? "a task"}</span></>
                            : activity.type === "member_added"
                            ? <>{activity.description.replace(activity.memberName + " ", "")}</>
                            : activity.type === "project_created"
                            ? <>{activity.description}</>
                            : <>{activity.description}</>
                          }
                        </p>

                        {/* Task name with checkmark for completion types */}
                        {(isCompletion) && taskName && (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            marginTop: 6, paddingLeft: 2,
                          }}>
                            <CheckSquare size={15} style={{ color: "#22c55e", flexShrink: 0 }} />
                            <span style={{
                              fontSize: 13, color: "var(--text)",
                            }}>
                              {taskName}
                            </span>
                          </div>
                        )}

                        {/* Comment preview */}
                        {activity.type === "comment_added" && (
                          <p style={{
                            fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0",
                            fontStyle: "italic", lineHeight: 1.4,
                          }}>
                            {activity.description.split(": ").slice(1).join(": ").slice(0, 100)}
                          </p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <span style={{
                        fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap",
                        flexShrink: 0, marginTop: 2,
                      }}>
                        {formatTime(activity.createdAt, locale)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Right column — empty space for balance (like screenshot) */}
              <div style={{
                flex: 1,
                padding: "16px 24px",
              }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
