"use client";

import { useMemo } from "react";
import {
  MessageSquare, CheckCircle2, ArrowRight, Send,
  ThumbsUp, ThumbsDown, UserPlus, UserMinus,
  FolderPlus, Plus,
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

interface Props {
  activities: Activity[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVITY_META: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  task_created:    { icon: Plus,          color: "var(--accent-light)" },
  task_moved:      { icon: ArrowRight,    color: "var(--status-info)" },
  task_submitted:  { icon: Send,          color: "var(--status-warning)" },
  task_approved:   { icon: ThumbsUp,      color: "var(--status-success)" },
  task_rejected:   { icon: ThumbsDown,    color: "var(--status-danger)" },
  comment_added:   { icon: MessageSquare, color: "#60a5fa" },
  member_added:    { icon: UserPlus,      color: "#34d399" },
  member_removed:  { icon: UserMinus,     color: "#f87171" },
  project_created: { icon: FolderPlus,    color: "var(--accent-light)" },
};

const fallbackMeta = { icon: CheckCircle2, color: "var(--text-muted)" };

function formatTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByDate(activities: Activity[], locale: string): { label: string; items: Activity[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;

  const groups: Map<string, Activity[]> = new Map();
  const labels: Map<string, string> = new Map();

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

    if (!groups.has(dayKey)) {
      groups.set(dayKey, []);
      labels.set(dayKey, label);
    }
    groups.get(dayKey)!.push(a);
  }

  return Array.from(groups.entries()).map(([key, items]) => ({
    label: labels.get(key)!,
    items,
  }));
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProjectTimeline({ activities }: Props) {
  const { locale } = useLocale();

  const groups = useMemo(
    () => groupByDate(activities, locale),
    [activities, locale],
  );

  if (activities.length === 0) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-muted)", fontSize: 14,
      }}>
        No activity yet
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, overflowY: "auto", padding: "24px 32px",
    }}>
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 28 }}>
          {/* Date header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: "var(--text)",
              whiteSpace: "nowrap",
            }}>
              {group.label}
            </span>
            <div style={{
              flex: 1, height: 1, background: "var(--border)",
            }} />
          </div>

          {/* Activity items */}
          <div style={{ position: "relative", paddingLeft: 28 }}>
            {/* Vertical timeline line */}
            <div style={{
              position: "absolute", left: 11, top: 4, bottom: 4,
              width: 1, background: "var(--border)",
            }} />

            {group.items.map((activity) => {
              const meta = ACTIVITY_META[activity.type] ?? fallbackMeta;
              const Icon = meta.icon;

              return (
                <div
                  key={activity._id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    marginBottom: 16, position: "relative",
                  }}
                >
                  {/* Timeline dot */}
                  <div style={{
                    position: "absolute", left: -28, top: 2,
                    width: 22, height: 22, borderRadius: "50%",
                    background: `${meta.color}18`,
                    border: `1.5px solid ${meta.color}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, zIndex: 1,
                  }}>
                    <Icon size={11} style={{ color: meta.color }} />
                  </div>

                  {/* Avatar */}
                  {activity.memberName && (
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(99,102,241,0.15)",
                      border: "1px solid rgba(99,102,241,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: "var(--accent-light)",
                    }}>
                      {initials(activity.memberName)}
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, color: "var(--text)", margin: 0, lineHeight: 1.5,
                    }}>
                      {activity.description}
                    </p>
                  </div>

                  {/* Time */}
                  <span style={{
                    fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap",
                    flexShrink: 0, marginTop: 2,
                  }}>
                    {formatTime(activity.createdAt, locale)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
