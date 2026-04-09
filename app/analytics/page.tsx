"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Download, ChevronDown, ChevronLeft, ChevronRight,
  CalendarDays, X, TrendingUp, Clock, CheckCircle2,
  AlertTriangle, Users, BarChart3, Target, ArrowUpRight, ArrowDownRight,
  Activity, Zap, Award, Eye, RotateCcw,
  ExternalLink, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Date range helpers ──────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function fmtShort(d: Date, locale?: string): string {
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" });
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getPresetRange(key: string): [Date, Date] {
  const now = new Date();
  const today = startOfDay(now);
  switch (key) {
    case "week": {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return [s, endOfDay(now)];
    }
    case "month": {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return [s, endOfDay(now)];
    }
    case "quarter": {
      const s = new Date(today);
      s.setMonth(s.getMonth() - 3);
      return [s, endOfDay(now)];
    }
    case "year": {
      const s = new Date(today.getFullYear(), 0, 1);
      return [s, endOfDay(now)];
    }
    default: return [new Date(0), endOfDay(now)];
  }
}

const PRESETS = [
  { key: "week",    label: "Last 7 days" },
  { key: "month",   label: "This Month" },
  { key: "quarter", label: "Last 3 Months" },
  { key: "year",    label: "This Year" },
] as const;

// ── Calendar date range picker component ────────────────────────────────────

function DateRangePicker({ from, to, onChange }: {
  from: Date | null;
  to: Date | null;
  onChange: (from: Date | null, to: Date | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = to ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const [hovered, setHovered] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  const handleDayClick = (day: Date) => {
    if (selecting === "from") {
      onChange(startOfDay(day), to && day <= to ? to : null);
      setSelecting("to");
    } else {
      if (from && day < from) {
        onChange(startOfDay(day), null);
        setSelecting("to");
      } else {
        onChange(from, endOfDay(day));
        setSelecting("from");
        setOpen(false);
      }
    }
  };

  const handlePreset = (key: string) => {
    const [s, e] = getPresetRange(key);
    onChange(s, e);
    setViewMonth(new Date(s.getFullYear(), s.getMonth(), 1));
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null, null);
    setOpen(false);
  };

  const isInRange = (day: Date) => {
    if (!from) return false;
    const end = to ?? (hovered && selecting === "to" ? hovered : null);
    if (!end) return isSameDay(day, from);
    const lo = from < end ? from : end;
    const hi = from < end ? end : from;
    return day >= lo && day <= hi;
  };
  const isStart = (day: Date) => from ? isSameDay(day, from) : false;
  const isEnd = (day: Date) => to ? isSameDay(day, to) : false;
  const isToday = (day: Date) => isSameDay(day, new Date());

  const label = from && to
    ? `${fmtShort(from)} — ${fmtShort(to)}`
    : from
    ? `${fmtShort(from)} — ...`
    : "All Time";

  const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "var(--surface2)", border: "1px solid var(--border2)",
          borderRadius: 10, padding: "8px 14px",
          fontSize: 13, fontWeight: 500, color: "var(--text)",
          cursor: "pointer", outline: "none", whiteSpace: "nowrap",
          transition: "all 0.15s ease",
        }}
      >
        <CalendarDays size={14} strokeWidth={2} style={{ color: "var(--accent)" }} />
        {label}
        <ChevronDown size={13} strokeWidth={2} style={{ color: "var(--text-muted)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
          background: "var(--surface)", border: "1px solid var(--border2)",
          borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)",
          display: "flex", overflow: "hidden", minWidth: 420,
          animation: "popIn 0.2s ease both",
        }}>
          <div style={{
            width: 140, borderRight: "1px solid var(--border)",
            padding: "12px 0", display: "flex", flexDirection: "column", gap: 2,
          }}>
            {PRESETS.map(({ key, label: pLabel }) => (
              <button
                key={key}
                onClick={() => handlePreset(key)}
                style={{
                  background: "none", border: "none", textAlign: "left",
                  padding: "7px 14px", fontSize: 12, fontWeight: 500,
                  color: "var(--text)", cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-subtle)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text)"; }}
              >
                {pLabel}
              </button>
            ))}
            <div style={{ borderTop: "1px solid var(--border)", margin: "6px 14px" }} />
            <button
              onClick={handleClear}
              style={{
                background: "none", border: "none", textAlign: "left",
                padding: "7px 14px", fontSize: 12, fontWeight: 500,
                color: "var(--text-muted)", cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              All Time
            </button>
          </div>

          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <ChevronLeft size={16} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}>
                <ChevronRight size={16} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, marginBottom: 4 }}>
              {WEEKDAYS.map((wd) => (
                <span key={wd} style={{
                  fontSize: 10, fontWeight: 600, color: "var(--text-muted)",
                  textAlign: "center", padding: "4px 0",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {wd}
                </span>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
              {days.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;
                const inRange = isInRange(day);
                const start = isStart(day);
                const end = isEnd(day);
                const today = isToday(day);
                return (
                  <button
                    key={day.getTime()}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={() => setHovered(day)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      width: 36, height: 34, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: start || end ? 700 : 500,
                      borderRadius: start ? "8px 0 0 8px" : end ? "0 8px 8px 0" : (start && end) ? 8 : 0,
                      background: start || end ? "var(--accent)" : inRange ? "rgba(99,102,241,0.10)" : "transparent",
                      color: start || end ? "#fff" : today ? "var(--accent)" : "var(--text)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.1s",
                      outline: today && !start && !end ? "1px solid var(--accent)" : "none",
                      outlineOffset: -1,
                    }}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              {selecting === "from" ? "Select start date" : "Select end date"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status color map ────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  draft:       "#71717a",
  in_progress: "#3b82f6",
  submitted:   "#f59e0b",
  rejected:    "#ef4444",
  completed:   "#22c55e",
};

const STATUS_BG: Record<string, string> = {
  draft:       "rgba(113,113,122,0.12)",
  in_progress: "rgba(59,130,246,0.12)",
  submitted:   "rgba(245,158,11,0.12)",
  rejected:    "rgba(239,68,68,0.12)",
  completed:   "rgba(34,197,94,0.12)",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  submitted: "Submitted",
  rejected: "Rejected",
  completed: "Completed",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

// ── Utility helpers ─────────────────────────────────────────────────────────

function sundayOf(ms: number): number {
  const d = new Date(ms);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function fmtWeekLabel(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" });
}

function fmtDuration(ms: number): string {
  const totalHours = Math.round(ms / (1000 * 60 * 60));
  const days  = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) return `${hours}h`;
  if (hours === 0) return `${days}d`;
  return `${days}d ${hours}h`;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getCategoryMeta(t: any): Record<string, { label: string; emoji: string; color: string }> {
  return {
    waiting_on:      { label: t.analyticsPage.catWaitingOn,      emoji: "\u23f3", color: "#f59e0b" },
    unclear_scope:   { label: t.analyticsPage.catUnclearScope,   emoji: "\ud83c\udfaf", color: "#8b5cf6" },
    dependency:      { label: t.analyticsPage.catDependency,     emoji: "\ud83d\udd17", color: "#3b82f6" },
    resource:        { label: t.analyticsPage.catResource,       emoji: "\ud83d\udd11", color: "#ef4444" },
    uncategorized:   { label: t.analyticsPage.catUncategorized,  emoji: "\ud83d\udccc", color: "#71717a" },
  };
}

// ── Custom Recharts Tooltip ─────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border2)",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      fontSize: 12,
    }}>
      <p style={{ color: "var(--text-muted)", margin: "0 0 6px", fontWeight: 600, fontSize: 11 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color }} />
          <span style={{ color: "var(--text)", fontWeight: 600 }}>{entry.value}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{entry.name}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Drill-Down Drawer Types ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

type DrillDownData = {
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  metric?: string | number;
  tasks: Doc<"tasks">[];
  breakdown?: { label: string; count: number; color: string }[];
  insight?: string;
};

// ── Urgency helpers ─────────────────────────────────────────────────────────

type UrgencyLevel = "critical" | "attention" | "on_track";

function getTaskUrgency(tk: Doc<"tasks">): UrgencyLevel {
  const now = Date.now();
  const _eod = tk.dueDate ? new Date(tk.dueDate) : null;
  if (_eod) _eod.setHours(23, 59, 59, 999);
  const isOverdue = _eod && _eod.getTime() < now && tk.status !== "completed";
  const isHigh = tk.priority === "high";
  const daysSinceCreated = Math.floor((now - tk.createdAt) / (1000 * 60 * 60 * 24));
  const isStale = daysSinceCreated > 14 && tk.status !== "completed" && tk.status !== "approved";
  const wasRejected = tk.rejectedAt != null && tk.status !== "completed";

  if (isOverdue && isHigh) return "critical";
  if (isOverdue || (isHigh && isStale) || wasRejected) return "attention";
  return "on_track";
}

function getTaskAge(tk: Doc<"tasks">): string {
  const now = Date.now();
  const days = Math.floor((now - tk.createdAt) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getDaysUntilDue(dueDate: number): string {
  const diff = dueDate - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < -1) return `${Math.abs(days)}d overdue`;
  if (days === -1) return "1d overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days}d`;
  return `Due ${fmtDate(dueDate)}`;
}

function getUrgencyMeta(t: any): Record<UrgencyLevel, { label: string; countLabel: string; color: string; bg: string; icon: any }> {
  return {
    critical:  { label: t.analyticsPage.drawerCritical,  countLabel: t.analyticsPage.drawerCriticalCount,  color: "#ef4444", bg: "rgba(239,68,68,0.08)",  icon: AlertTriangle },
    attention: { label: t.analyticsPage.drawerAttention, countLabel: t.analyticsPage.drawerAttentionCount, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: Eye },
    on_track:  { label: t.analyticsPage.drawerOnTrack,   countLabel: t.analyticsPage.drawerOnTrackCount,   color: "#22c55e", bg: "rgba(34,197,94,0.06)",  icon: CheckCircle2 },
  };
}

// ── Drill-Down Drawer Component ─────────────────────────────────────────────

function DrillDownDrawer({
  data,
  onClose,
  members,
  t,
}: {
  data: DrillDownData;
  onClose: () => void;
  members: Doc<"members">[];
  t: any;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m._id, m])),
    [members]
  );

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  const Icon = data.icon;

  // Group tasks by urgency
  const groupedTasks = useMemo(() => {
    const groups: Record<UrgencyLevel, Doc<"tasks">[]> = { critical: [], attention: [], on_track: [] };
    data.tasks.forEach((tk) => {
      groups[getTaskUrgency(tk)].push(tk);
    });
    // Sort each group: overdue first, then by priority, then by creation date
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorter = (a: Doc<"tasks">, b: Doc<"tasks">) => {
      const aOverdue = a.dueDate && a.dueDate < Date.now() ? 0 : 1;
      const bOverdue = b.dueDate && b.dueDate < Date.now() ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const aPri = priorityOrder[a.priority ?? ""] ?? 3;
      const bPri = priorityOrder[b.priority ?? ""] ?? 3;
      if (aPri !== bPri) return aPri - bPri;
      return b.createdAt - a.createdAt;
    };
    groups.critical.sort(sorter);
    groups.attention.sort(sorter);
    groups.on_track.sort(sorter);
    return groups;
  }, [data.tasks]);

  // Build per-status breakdown of the tasks
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    data.tasks.forEach((tk) => {
      counts[tk.status] = (counts[tk.status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([status, count]) => ({
        status,
        label: STATUS_LABEL[status] || status,
        count,
        color: STATUS_COLOR[status] || "#71717a",
      }))
      .sort((a, b) => b.count - a.count);
  }, [data.tasks]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  };

  // Render a single rich task card
  const renderTaskCard = (tk: Doc<"tasks">) => {
    const member = memberMap.get(tk.memberId);
    const _eodTk = tk.dueDate ? new Date(tk.dueDate) : null;
    if (_eodTk) _eodTk.setHours(23, 59, 59, 999);
    const isOverdue = _eodTk && _eodTk.getTime() < Date.now() && tk.status !== "completed";
    const isExpanded = expandedTaskId === tk._id;
    const urgency = getTaskUrgency(tk);
    const accentColor = urgency === "critical" ? "#ef4444" : urgency === "attention" ? "#f59e0b" : "var(--border)";

    return (
      <div
        key={tk._id}
        style={{
          borderRadius: 12,
          background: "var(--surface)",
          border: `1px solid ${isOverdue ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
          borderLeft: `3px solid ${accentColor}`,
          transition: "all 0.15s ease",
          overflow: "hidden",
        }}
      >
        {/* Main row — click to expand */}
        <div
          onClick={() => toggleExpand(tk._id)}
          style={{
            padding: "12px 14px",
            cursor: "pointer",
            display: "flex", flexDirection: "column", gap: 8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {/* Top line: title + badges */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 600, color: "var(--text)",
                margin: 0, lineHeight: 1.4,
                overflow: isExpanded ? "visible" : "hidden",
                textOverflow: isExpanded ? "unset" : "ellipsis",
                whiteSpace: isExpanded ? "normal" : "nowrap",
              }}>
                {tk.title}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              {tk.priority && (
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                  color: PRIORITY_COLOR[tk.priority] || "var(--text-muted)",
                  background: `${PRIORITY_COLOR[tk.priority] || "var(--text-muted)"}15`,
                  padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em",
                }}>
                  {tk.priority}
                </span>
              )}
              <span style={{
                fontSize: 9, fontWeight: 600,
                color: STATUS_COLOR[tk.status] || "#71717a",
                background: STATUS_BG[tk.status] || "var(--surface2)",
                padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
              }}>
                {STATUS_LABEL[tk.status] || tk.status}
              </span>
            </div>
          </div>

          {/* Meta line: member, age, due date */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* Member avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 700, color: "var(--accent)", flexShrink: 0,
              }}>
                {(member?.name ?? "?")[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                {member?.name ?? "Unassigned"}
              </span>
            </div>

            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>·</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>
              {t.analyticsPage.drawerCreated} {getTaskAge(tk)}
            </span>

            {tk.dueDate && (
              <>
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>·</span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: isOverdue ? "#ef4444" : tk.dueDate - Date.now() < 2 * 24 * 60 * 60 * 1000 ? "#f59e0b" : "var(--text-muted)",
                  display: "flex", alignItems: "center", gap: 3,
                }}>
                  {isOverdue && <AlertTriangle size={10} />}
                  {getDaysUntilDue(tk.dueDate)}
                </span>
              </>
            )}

            {tk.rejectedAt && tk.status !== "completed" && (
              <>
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>·</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}>
                  <RotateCcw size={9} /> {t.analyticsPage.drawerSentBack}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Expanded detail section */}
        {isExpanded && (
          <div style={{
            padding: "0 14px 14px",
            borderTop: "1px solid var(--border)",
            marginTop: 0,
          }}>
            {/* Description */}
            {tk.description && (
              <p style={{
                fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0",
                lineHeight: 1.6, fontWeight: 400,
                maxHeight: 80, overflow: "hidden",
              }}>
                {tk.description.length > 200 ? tk.description.slice(0, 200) + "..." : tk.description}
              </p>
            )}

            {/* Rejection reason */}
            {tk.rejectionReason && (
              <div style={{
                margin: "10px 0 0", padding: "8px 10px",
                background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: 8, fontSize: 11, color: "var(--text)", lineHeight: 1.5,
              }}>
                <span style={{ color: "#ef4444", fontWeight: 700, marginRight: 4 }}>{t.analyticsPage.drawerRejectionReason}</span>
                {tk.rejectionReason}
              </div>
            )}

            {/* Timeline stamps */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {tk.submittedAt && (
                <span style={{ fontSize: 10, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 3 }}>
                  <Clock size={10} /> {t.analyticsPage.drawerSubmitted} {fmtDate(tk.submittedAt)}
                </span>
              )}
              {tk.approvedAt && (
                <span style={{ fontSize: 10, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 3 }}>
                  <CheckCircle2 size={10} /> {t.analyticsPage.drawerApproved} {fmtDate(tk.approvedAt)}
                </span>
              )}
              {tk.rejectedAt && (
                <span style={{ fontSize: 10, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 3 }}>
                  <RotateCcw size={10} /> {t.analyticsPage.drawerRejected} {fmtDate(tk.rejectedAt)}
                </span>
              )}
            </div>

            {/* View task link */}
            <a
              href={`/tasks/${tk._id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                marginTop: 10, padding: "6px 12px", borderRadius: 8,
                background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
                color: "var(--accent)", fontSize: 11, fontWeight: 600,
                textDecoration: "none", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent-bg)"; e.currentTarget.style.color = "var(--accent)"; }}
            >
              {t.analyticsPage.drawerOpenTask} <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>
    );
  };

  const urgencyOrder: UrgencyLevel[] = ["critical", "attention", "on_track"];
  const totalCritical = groupedTasks.critical.length;
  const totalAttention = groupedTasks.attention.length;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: isClosing ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.4)",
        transition: "background 0.25s ease",
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        ref={drawerRef}
        style={{
          width: 560, maxWidth: "92vw", height: "100vh",
          background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.25)",
          transform: isClosing ? "translateX(100%)" : "translateX(0)",
          animation: isClosing ? "none" : "drawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
          overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Sticky Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", gap: 14,
          position: "sticky", top: 0, background: "var(--bg)", zIndex: 1,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: `${data.color}15`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Icon size={22} strokeWidth={2} style={{ color: data.color }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              {data.metric !== undefined && (
                <span style={{
                  fontSize: 28, fontWeight: 800, color: data.color, letterSpacing: "-0.5px",
                }}>
                  {data.metric}
                </span>
              )}
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                {data.title}
              </h2>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, fontWeight: 400 }}>
              {data.subtitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 8, width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface2)"; }}
          >
            <X size={16} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Quick urgency summary bar */}
        {data.tasks.length > 0 && (
          <div style={{
            display: "flex", gap: 8, padding: "14px 24px",
            borderBottom: "1px solid var(--border)",
          }}>
            {totalCritical > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 8,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              }}>
                <AlertTriangle size={12} style={{ color: "#ef4444" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>{totalCritical}</span>
                <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 500 }}>{t.analyticsPage.drawerCriticalCount}</span>
              </div>
            )}
            {totalAttention > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 8,
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
              }}>
                <Eye size={12} style={{ color: "#f59e0b" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{totalAttention}</span>
                <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 500 }}>{t.analyticsPage.drawerAttentionCount}</span>
              </div>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 8,
              background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
            }}>
              <CheckCircle2 size={12} style={{ color: "#22c55e" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>{groupedTasks.on_track.length}</span>
              <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 500 }}>{t.analyticsPage.drawerOnTrackCount}</span>
            </div>
          </div>
        )}

        {/* Insight banner */}
        {data.insight && (
          <div style={{
            margin: "14px 24px 0", padding: "12px 14px",
            background: `${data.color}08`, border: `1px solid ${data.color}20`,
            borderRadius: 10, fontSize: 12, color: "var(--text)", lineHeight: 1.5,
            fontWeight: 500,
          }}>
            <span style={{ color: data.color, fontWeight: 700, marginRight: 6 }}>{t.analyticsPage.drawerInsight}</span>
            {data.insight}
          </div>
        )}

        {/* Custom breakdown (if provided) */}
        {data.breakdown && data.breakdown.length > 0 && (
          <div style={{ padding: "14px 24px 0" }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
              {t.analyticsPage.drawerBreakdown}
            </h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {data.breakdown.map((b) => (
                <div key={b.label} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 8,
                  background: "var(--surface)", border: "1px solid var(--border)",
                  flex: "1 1 auto", minWidth: 120,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1, fontWeight: 500 }}>{b.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: b.color }}>{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status distribution bar */}
        {statusBreakdown.length > 1 && (
          <div style={{ padding: "14px 24px 0" }}>
            <div style={{
              display: "flex", height: 6, borderRadius: 3, overflow: "hidden",
              background: "var(--surface3)",
            }}>
              {statusBreakdown.map(({ status, count, color }) => (
                <div key={status} style={{ flex: count, background: color, transition: "flex 0.3s ease" }}
                  title={`${STATUS_LABEL[status] || status}: ${count}`}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {statusBreakdown.map(({ status, label, count, color }) => (
                <div key={status} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 10, fontWeight: 500,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ fontWeight: 700, color }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Task groups by urgency */}
        <div style={{ padding: "14px 24px 24px", flex: 1 }}>
          {data.tasks.length === 0 ? (
            <div style={{
              padding: "48px 0", textAlign: "center",
              color: "var(--text-dim)", fontSize: 13,
            }}>
              {t.analyticsPage.drawerNoTasks}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {urgencyOrder.map((level) => {
                const tasksInGroup = groupedTasks[level];
                if (tasksInGroup.length === 0) return null;
                const urgencyMeta = getUrgencyMeta(t);
                const meta = urgencyMeta[level];
                const UrgIcon = meta.icon;
                const isCollapsed = collapsedGroups.has(level);
                const displayTasks = tasksInGroup.slice(0, 30);

                return (
                  <div key={level}>
                    {/* Group header */}
                    <div
                      onClick={() => toggleGroup(level)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 0", cursor: "pointer", userSelect: "none",
                      }}
                    >
                      <UrgIcon size={14} style={{ color: meta.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: meta.color,
                        background: meta.bg, padding: "2px 8px", borderRadius: 10,
                        border: `1px solid ${meta.color}25`,
                      }}>
                        {tasksInGroup.length}
                      </span>
                      <div style={{ flex: 1 }} />
                      <ChevronDown
                        size={14}
                        style={{
                          color: "var(--text-dim)",
                          transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                      />
                    </div>

                    {/* Task cards */}
                    {!isCollapsed && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {displayTasks.map(renderTaskCard)}
                        {tasksInGroup.length > 30 && (
                          <div style={{
                            textAlign: "center", padding: "8px 0",
                            fontSize: 11, color: "var(--text-muted)", fontWeight: 500,
                          }}>
                            +{tasksInGroup.length - 30} {t.analyticsPage.drawerMoreTasks}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stat Card Component (now clickable) ─────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, trend, trendLabel, onClick }: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "22px 24px",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${color}50`;
        e.currentTarget.style.boxShadow = `0 4px 20px ${color}15, 0 1px 3px rgba(0,0,0,0.04)`;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Subtle gradient orb */}
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} strokeWidth={2} style={{ color }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {trend && trendLabel && (
            <div style={{
              display: "flex", alignItems: "center", gap: 3,
              fontSize: 11, fontWeight: 600,
              color: trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "var(--text-muted)",
              padding: "3px 8px", borderRadius: 6,
              background: trend === "up" ? "rgba(34,197,94,0.1)" : trend === "down" ? "rgba(239,68,68,0.1)" : "var(--surface2)",
            }}>
              {trend === "up" ? <ArrowUpRight size={12} /> : trend === "down" ? <ArrowDownRight size={12} /> : null}
              {trendLabel}
            </div>
          )}
          {onClick && (
            <ArrowRight size={14} style={{ color: "var(--text-dim)" }} />
          )}
        </div>
      </div>

      <p style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px", lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0", fontWeight: 500 }}>
        {label}
      </p>
    </div>
  );
}

// ── Section Header Component ────────────────────────────────────────────────

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      {Icon && (
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--accent-bg)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={16} strokeWidth={2} style={{ color: "var(--accent)" }} />
        </div>
      )}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0, letterSpacing: "-0.3px" }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", fontWeight: 400 }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ── Card Wrapper ────────────────────────────────────────────────────────────

function Card({ children, style: extraStyle }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "24px",
      ...extraStyle,
    }}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Main Page Component ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export default function AnalyticsPage() {
  const { isLoading, orgId, can } = useAuth();
  const { t, locale } = useLocale();
  const CATEGORY_META = getCategoryMeta(t);
  const membersArgs = orgId ? { orgId } : "skip" as const;
  const rawMembers = useQuery(api.members.listMembers, membersArgs);
  const members = rawMembers ?? [];
  const allTasksArgs = orgId ? { orgId } : "skip" as const;
  const rawAllTasks = useQuery(api.tasks.listAllTasks, allTasksArgs);
  const allTasks = rawAllTasks ?? [];
  const bnStatsArgs = orgId ? { orgId } : "skip" as const;
  const bnStats  = useQuery(api.bottlenecks.analytics, bnStatsArgs) ?? null;
  const streaks  = useQuery(api.streaks.listByOrg, orgId ? { orgId } : "skip") ?? [];

  // ── Filter state ──
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");

  // ── Drill-down drawer state ──
  const [drawerData, setDrawerData] = useState<DrillDownData | null>(null);

  const openDrawer = useCallback((data: DrillDownData) => {
    setDrawerData(data);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerData(null);
  }, []);

  const handleDateChange = useCallback((from: Date | null, to: Date | null) => {
    setDateFrom(from);
    setDateTo(to);
  }, []);

  // ── Filtered tasks ──
  const tasks = useMemo(() => {
    return allTasks.filter((tk: Doc<"tasks">) => {
      if (selectedMemberId !== "all" && tk.memberId !== selectedMemberId) return false;
      if (dateFrom && tk.createdAt < dateFrom.getTime()) return false;
      if (dateTo && tk.createdAt > dateTo.getTime()) return false;
      return true;
    });
  }, [allTasks, dateFrom, dateTo, selectedMemberId]);

  const hasDateFilter = dateFrom !== null || dateTo !== null;
  const dateLabel = dateFrom && dateTo
    ? `${fmtShort(dateFrom, locale)} — ${fmtShort(dateTo, locale)}`
    : dateFrom
    ? `From ${fmtShort(dateFrom, locale)}`
    : "All Time";

  // ── CSV download ──
  const csvEscape = (v: string | number): string => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const downloadCsv = useCallback(() => {
    const memberNameMap = new Map(members.map((m: Doc<"members">) => [m._id, m.name]));
    const periodLabel = dateLabel;
    const memberLabel = selectedMemberId === "all" ? "All Members" : (memberNameMap.get(selectedMemberId as Id<"members">) ?? "Unknown");

    const targetMembers = selectedMemberId === "all"
      ? members
      : members.filter((m: Doc<"members">) => m._id === selectedMemberId);

    const headers = ["Member", "Total Tasks", "Completed", "Submitted", "Rejected", "Completion Rate", "Avg Approval Time"];
    const rows = targetMembers.map((m: Doc<"members">) => {
      const mTasks = tasks.filter((tk: Doc<"tasks">) => tk.memberId === m._id);
      const mCompleted = mTasks.filter((tk: Doc<"tasks">) => tk.status === "completed").length;
      const mSubmitted = mTasks.filter((tk: Doc<"tasks">) => tk.status === "submitted").length;
      const mRejected = mTasks.filter((tk: Doc<"tasks">) => tk.rejectedAt != null).length;
      const mRate = mTasks.length > 0 ? Math.round((mCompleted / mTasks.length) * 100) : 0;
      const mWithDates = mTasks.filter((tk: Doc<"tasks">) => tk.approvedAt != null && tk.createdAt != null);
      const mAvg = mWithDates.length === 0 ? "—" : (() => {
        const ms = mWithDates.reduce((s: number, tk: Doc<"tasks">) => s + (tk.approvedAt! - tk.createdAt), 0);
        return fmtDuration(ms / mWithDates.length);
      })();
      return [csvEscape(m.name), mTasks.length, mCompleted, mSubmitted, mRejected, `${mRate}%`, csvEscape(mAvg)].join(",");
    });

    const safePeriod = periodLabel.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-").toLowerCase();
    const meta = `# Analytics Report — ${csvEscape(periodLabel)} — ${csvEscape(memberLabel)}\n# Generated ${new Date().toLocaleDateString()}\n`;
    const csv = meta + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${safePeriod}-${selectedMemberId === "all" ? "all" : memberLabel.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tasks, members, dateLabel, selectedMemberId]);

  const dataLoading = isLoading || (orgId != null && rawAllTasks === undefined);

  // ── Compute metrics (memoized) ──
  // NOTE: All hooks MUST be above any early returns to satisfy React's rules of hooks.
  const metrics = useMemo(() => {
    const total     = tasks.length;
    const completed = tasks.filter((tk: Doc<"tasks">) => tk.status === "completed").length;
    const submitted = tasks.filter((tk: Doc<"tasks">) => tk.status === "submitted").length;
    const inProg    = tasks.filter((tk: Doc<"tasks">) => tk.status === "in_progress").length;
    const draftCount = tasks.filter((tk: Doc<"tasks">) => tk.status === "draft").length;

    const approvedTasks  = tasks.filter((tk: Doc<"tasks">) => tk.approvedAt  != null);
    const rejectedTasks  = tasks.filter((tk: Doc<"tasks">) => tk.rejectedAt  != null);
    const approvedCount  = approvedTasks.length;
    const rejectedCount  = rejectedTasks.length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const tasksWithBothDates = tasks.filter(
      (tk: Doc<"tasks">) => tk.approvedAt != null && tk.createdAt != null
    );
    const avgApprovalTime: string = (() => {
      if (tasksWithBothDates.length === 0) return "—";
      const totalMs = tasksWithBothDates.reduce(
        (sum: number, tk: Doc<"tasks">) => sum + (tk.approvedAt! - tk.createdAt),
        0
      );
      return fmtDuration(totalMs / tasksWithBothDates.length);
    })();

    const sendbackRate: string = (() => {
      const denom = approvedCount + rejectedCount;
      if (denom === 0) return "—";
      return `${Math.round((rejectedCount / denom) * 100)}%`;
    })();

    return {
      total, completed, submitted, inProg, draftCount,
      approvedTasks, rejectedTasks, approvedCount, rejectedCount,
      completionRate, tasksWithBothDates, avgApprovalTime, sendbackRate,
    };
  }, [tasks]);

  const {
    total, completed, submitted, inProg, draftCount,
    approvedTasks, rejectedTasks, approvedCount, rejectedCount,
    completionRate, tasksWithBothDates, avgApprovalTime, sendbackRate,
  } = metrics;

  const statusCounts = useMemo(() => [
    { label: t.status.draft,       id: "draft",       count: draftCount },
    { label: t.status.in_progress, id: "in_progress", count: inProg },
    { label: t.status.submitted,   id: "submitted",   count: submitted },
    { label: t.status.rejected,    id: "rejected",    count: rejectedCount },
    { label: t.status.completed,   id: "completed",   count: completed },
  ], [t, draftCount, inProg, submitted, rejectedCount, completed]);

  // ── Weekly completions (last 6 weeks) ──
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const weekStarts = useMemo(() => {
    const now = Date.now();
    const thisSunday = sundayOf(now);
    const starts: number[] = [];
    for (let i = 5; i >= 0; i--) {
      starts.push(thisSunday - i * WEEK_MS);
    }
    return starts;
  }, []);

  const weeklyData = useMemo(() => weekStarts.map((wStart: number) => {
    const wEnd = wStart + WEEK_MS;
    const completedCount = tasks.filter((tk: Doc<"tasks">) => {
      if (tk.status !== "completed" || tk.approvedAt == null) return false;
      return tk.approvedAt >= wStart && tk.approvedAt < wEnd;
    }).length;
    const createdCount = tasks.filter((tk: Doc<"tasks">) => {
      return tk.createdAt >= wStart && tk.createdAt < wEnd;
    }).length;
    return {
      week: fmtWeekLabel(wStart, locale),
      wStart,
      completed: completedCount,
      created: createdCount,
    };
  }), [tasks, weekStarts, locale]);

  // ── Status distribution pie data ──
  const pieData = useMemo(() => statusCounts
    .filter(s => s.count > 0)
    .map(s => ({
      name: s.label,
      id: s.id,
      value: s.count,
      color: STATUS_COLOR[s.id],
      bg: STATUS_BG[s.id],
    })), [statusCounts]);

  // ── Per-member data ──
  const memberData = useMemo(() => members.map((m: Doc<"members">) => {
    const mTasks     = tasks.filter((tk: Doc<"tasks">) => tk.memberId === m._id);
    const mCompleted = mTasks.filter((tk: Doc<"tasks">) => tk.status === "completed").length;
    const mSubmitted = mTasks.filter((tk: Doc<"tasks">) => tk.status === "submitted").length;
    const mRejected  = mTasks.filter((tk: Doc<"tasks">) => tk.rejectedAt != null).length;
    const mRate      = mTasks.length > 0 ? Math.round((mCompleted / mTasks.length) * 100) : 0;
    const mWithDates = mTasks.filter((tk: Doc<"tasks">) => tk.approvedAt != null && tk.createdAt != null);
    const mAvgTime: string = (() => {
      if (mWithDates.length === 0) return "—";
      const totalMs = mWithDates.reduce((s: number, tk: Doc<"tasks">) => s + (tk.approvedAt! - tk.createdAt), 0);
      return fmtDuration(totalMs / mWithDates.length);
    })();
    return {
      member: m,
      total: mTasks.length,
      completed: mCompleted,
      submitted: mSubmitted,
      rejected: mRejected,
      rate: mRate,
      avgTime: mAvgTime,
    };
  }).sort((a, b) => b.rate - a.rate || b.completed - a.completed), [tasks, members]);

  // ── Early returns (AFTER all hooks) ──────────────────────────────────────
  if (dataLoading) return (
    <div className="flex h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div style={{ padding: "32px 40px", maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ width: 200, height: 28, borderRadius: 8, background: "var(--surface2)", marginBottom: 8 }} />
            <div style={{ width: 280, height: 14, borderRadius: 6, background: "var(--surface2)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 28 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 24px", height: 120, animation: "pulse 1.5s ease-in-out infinite" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface2)", marginBottom: 14 }} />
                <div style={{ width: "60%", height: 24, borderRadius: 6, background: "var(--surface2)", marginBottom: 8 }} />
                <div style={{ width: "40%", height: 12, borderRadius: 4, background: "var(--surface2)" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, height: 340, animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, height: 340, animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>
      </div>
    </div>
  );

  if (!can("task.approve")) return (
    <div className="flex h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>{t.adminAccessRequired}</p>
      </div>
    </div>
  );

  // ── Streaks leaderboard ──
  const memberMap = new Map(members.map((m: Doc<"members">) => [m._id, m]));
  const sortedStreaks = [...streaks].sort((a, b) => b.current - a.current || b.best - a.best);

  // ── Drill-down handlers ──────────────────────────────────────────────────

  const openTotalTasks = () => openDrawer({
    title: t.analyticsPage.totalTasks,
    subtitle: `All ${total} tasks in your workspace`,
    icon: BarChart3,
    color: "#6366f1",
    metric: total,
    tasks,
  });

  const openCompleted = () => openDrawer({
    title: t.analyticsPage.completed,
    subtitle: `${completed} tasks have been completed`,
    icon: CheckCircle2,
    color: "#22c55e",
    metric: completed,
    tasks: tasks.filter((tk: Doc<"tasks">) => tk.status === "completed"),
    insight: completed > 0
      ? `${completionRate}% of all tasks are done. ${total - completed} tasks still remaining.`
      : "No tasks completed yet.",
  });

  const openPendingReview = () => openDrawer({
    title: t.analyticsPage.pendingReview,
    subtitle: `${submitted} tasks awaiting review`,
    icon: Eye,
    color: "#f59e0b",
    metric: submitted,
    tasks: tasks.filter((tk: Doc<"tasks">) => tk.status === "submitted"),
    insight: submitted > 0
      ? `These tasks have been submitted and are waiting for approval. Review them promptly to keep the team moving.`
      : undefined,
  });

  const openCompletionRate = () => {
    const incompleteTasks = tasks.filter((tk: Doc<"tasks">) => tk.status !== "completed");
    const overdueTasks = incompleteTasks.filter((tk: Doc<"tasks">) => tk.dueDate && tk.dueDate < Date.now());
    openDrawer({
      title: t.analyticsPage.completionPct,
      subtitle: `${completed} of ${total} tasks completed`,
      icon: Target,
      color: completionRate >= 70 ? "#22c55e" : completionRate >= 40 ? "#f59e0b" : "#ef4444",
      metric: `${completionRate}%`,
      tasks: incompleteTasks,
      breakdown: [
        { label: "Completed", count: completed, color: "#22c55e" },
        { label: "In Progress", count: inProg, color: "#3b82f6" },
        { label: "Submitted (pending)", count: submitted, color: "#f59e0b" },
        { label: "Draft / Not started", count: draftCount, color: "#71717a" },
        ...(overdueTasks.length > 0 ? [{ label: "Overdue", count: overdueTasks.length, color: "#ef4444" }] : []),
      ].filter(b => b.count > 0),
      insight: completionRate < 40
        ? `Completion rate is below 40%. ${overdueTasks.length} task${overdueTasks.length !== 1 ? "s are" : " is"} overdue. Consider reprioritizing or unblocking the team.`
        : completionRate < 70
        ? `Moderate progress. ${incompleteTasks.length} tasks still need attention.`
        : `Great progress! ${incompleteTasks.length} task${incompleteTasks.length !== 1 ? "s" : ""} remaining to reach 100%.`,
    });
  };

  const openAvgApproval = () => openDrawer({
    title: t.analyticsPage.avgApprovalTime,
    subtitle: `Average time from creation to approval: ${avgApprovalTime}`,
    icon: Clock,
    color: "#6366f1",
    metric: avgApprovalTime,
    tasks: tasksWithBothDates,
    insight: tasksWithBothDates.length > 0
      ? `Based on ${tasksWithBothDates.length} approved tasks. Faster approval keeps the team unblocked.`
      : "No approved tasks yet to measure.",
  });

  const openSendbackRate = () => openDrawer({
    title: t.analyticsPage.sendBackRate,
    subtitle: `${rejectedCount} rejected out of ${approvedCount + rejectedCount} reviewed`,
    icon: RotateCcw,
    color: "#ef4444",
    metric: sendbackRate,
    tasks: rejectedTasks,
    breakdown: [
      { label: "Approved", count: approvedCount, color: "#22c55e" },
      { label: "Rejected / Sent back", count: rejectedCount, color: "#ef4444" },
    ].filter(b => b.count > 0),
    insight: rejectedCount > 0
      ? `${rejectedCount} task${rejectedCount !== 1 ? "s were" : " was"} sent back. Review rejection reasons to identify patterns and reduce rework.`
      : "No tasks have been sent back yet.",
  });

  const openStatusDrillDown = (statusId: string, label: string) => {
    const filtered = tasks.filter((tk: Doc<"tasks">) => {
      if (statusId === "rejected") return tk.rejectedAt != null;
      return tk.status === statusId;
    });
    openDrawer({
      title: label,
      subtitle: `${filtered.length} task${filtered.length !== 1 ? "s" : ""} with status "${label}"`,
      icon: Activity,
      color: STATUS_COLOR[statusId] || "#71717a",
      metric: filtered.length,
      tasks: filtered,
    });
  };

  const openWeekDrillDown = (weekIndex: number) => {
    const wStart = weekStarts[weekIndex];
    const wEnd = wStart + WEEK_MS;
    const weekTasks = tasks.filter((tk: Doc<"tasks">) => tk.createdAt >= wStart && tk.createdAt < wEnd);
    const weekCompleted = tasks.filter((tk: Doc<"tasks">) =>
      tk.status === "completed" && tk.approvedAt != null && tk.approvedAt >= wStart && tk.approvedAt < wEnd
    );
    openDrawer({
      title: `Week of ${fmtWeekLabel(wStart, locale)}`,
      subtitle: `${weekTasks.length} created, ${weekCompleted.length} completed`,
      icon: TrendingUp,
      color: "#6366f1",
      metric: weekTasks.length,
      tasks: weekTasks,
      breakdown: [
        { label: "Created this week", count: weekTasks.length, color: "#6366f1" },
        { label: "Completed this week", count: weekCompleted.length, color: "#22c55e" },
      ],
    });
  };

  const openMemberDrillDown = (m: Doc<"members">) => {
    const mTasks = tasks.filter((tk: Doc<"tasks">) => tk.memberId === m._id);
    const mCompleted = mTasks.filter((tk: Doc<"tasks">) => tk.status === "completed").length;
    const mRate = mTasks.length > 0 ? Math.round((mCompleted / mTasks.length) * 100) : 0;
    openDrawer({
      title: m.name,
      subtitle: `${m.role} · ${mTasks.length} tasks assigned`,
      icon: Users,
      color: mRate >= 80 ? "#22c55e" : mRate >= 50 ? "#f59e0b" : "#3b82f6",
      metric: `${mRate}%`,
      tasks: mTasks,
      insight: mTasks.length > 0
        ? `${mCompleted} of ${mTasks.length} tasks completed (${mRate}%). ${mTasks.filter(tk => tk.status === "submitted").length} awaiting review.`
        : "No tasks assigned yet.",
    });
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <style>{`
        @keyframes flamePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.85; }
        }
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .flame-animate { animation: flamePulse 1.8s ease-in-out infinite; }
        .analytics-row:hover { background: var(--surface2) !important; }
        .analytics-row { transition: background 0.15s ease; }
        .clickable-row { cursor: pointer; }
        .clickable-row:hover { background: var(--surface2) !important; }
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line {
          stroke: var(--border) !important;
          opacity: 0.5;
        }
      `}</style>
      <Sidebar />
      <div className="flex-1 overflow-y-auto" style={{ scrollBehavior: "smooth" }}>
        <div style={{ padding: "32px 40px", maxWidth: 1400, margin: "0 auto" }}>

          {/* ═══ Page Header ═══ */}
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            marginBottom: 28, gap: 16, flexWrap: "wrap",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
                }}>
                  <BarChart3 size={20} strokeWidth={2.2} style={{ color: "#fff" }} />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
                  {t.analyticsPage.title}
                </h1>
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0, fontWeight: 400 }}>
                {t.analyticsPage.subtitle}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <DateRangePicker from={dateFrom} to={dateTo} onChange={handleDateChange} />

              <div style={{ position: "relative" }}>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  style={{
                    appearance: "none", WebkitAppearance: "none",
                    background: "var(--surface2)", border: "1px solid var(--border2)",
                    borderRadius: 10, padding: "8px 34px 8px 14px",
                    fontSize: 13, fontWeight: 500, color: "var(--text)",
                    cursor: "pointer", outline: "none", minWidth: 150,
                    transition: "all 0.15s ease",
                  }}
                >
                  <option value="all">All Members</option>
                  {members.map((m: Doc<"members">) => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} strokeWidth={2} style={{
                  position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-muted)", pointerEvents: "none",
                }} />
              </div>

              <button
                onClick={downloadCsv}
                title="Export CSV"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "var(--accent)", color: "#fff",
                  border: "none", borderRadius: 10, padding: "8px 16px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.35)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(99,102,241,0.25)"; }}
              >
                <Download size={14} strokeWidth={2.2} />
                Export
              </button>
            </div>
          </div>

          {/* ═══ Active Filter Banner ═══ */}
          {(hasDateFilter || selectedMemberId !== "all") && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 24,
              padding: "8px 14px", background: "var(--accent-subtle)",
              border: "1px solid var(--accent-border)", borderRadius: 10,
            }}>
              <Activity size={13} strokeWidth={2} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Filters:</span>
              {hasDateFilter && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "var(--accent-bg)", borderRadius: 6, padding: "3px 8px" }}>
                  {dateLabel}
                </span>
              )}
              {selectedMemberId !== "all" && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "var(--accent-bg)", borderRadius: 6, padding: "3px 8px" }}>
                  {members.find((m: Doc<"members">) => m._id === selectedMemberId)?.name ?? "Member"}
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>
                {total} task{total !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => { setDateFrom(null); setDateTo(null); setSelectedMemberId("all"); }}
                style={{
                  marginLeft: "auto", background: "none", border: "none",
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, color: "var(--text-muted)", cursor: "pointer", fontWeight: 500,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                <X size={12} /> Clear
              </button>
            </div>
          )}

          {/* ═══ KPI Summary Cards (all clickable) ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 28 }}>
            <StatCard label={t.analyticsPage.totalTasks} value={total} icon={BarChart3} color="#6366f1" onClick={openTotalTasks} />
            <StatCard label={t.analyticsPage.completed} value={completed} icon={CheckCircle2} color="#22c55e" onClick={openCompleted} />
            <StatCard label={t.analyticsPage.pendingReview} value={submitted} icon={Eye} color="#f59e0b" onClick={openPendingReview} />
            <StatCard
              label={t.analyticsPage.completionPct}
              value={`${completionRate}%`}
              icon={Target}
              color={completionRate >= 70 ? "#22c55e" : completionRate >= 40 ? "#f59e0b" : "#ef4444"}
              trend={completionRate >= 70 ? "up" : completionRate >= 40 ? "neutral" : "down"}
              trendLabel={completionRate >= 70 ? "On track" : completionRate >= 40 ? "Moderate" : "Needs focus"}
              onClick={openCompletionRate}
            />
            <StatCard label={t.analyticsPage.avgApprovalTime} value={avgApprovalTime} icon={Clock} color="#6366f1" onClick={openAvgApproval} />
            <StatCard label={t.analyticsPage.sendBackRate} value={sendbackRate} icon={RotateCcw} color="#ef4444" onClick={openSendbackRate} />
          </div>

          {/* ═══ Charts Row: Weekly Trend + Status Distribution ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 28 }}>

            {/* Weekly Task Activity */}
            <Card>
              <SectionHeader title={t.analyticsPage.weeklyCompletions} subtitle="Click a bar to drill into that week" icon={TrendingUp} />
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 500 }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface2)", radius: 8 }} />
                    <Bar
                      dataKey="created"
                      name="Created"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                      opacity={0.25}
                      barSize={28}
                      cursor="pointer"
                      onClick={(_: any, idx: number) => openWeekDrillDown(idx)}
                    />
                    <Bar
                      dataKey="completed"
                      name="Completed"
                      fill="#22c55e"
                      radius={[6, 6, 0, 0]}
                      barSize={28}
                      cursor="pointer"
                      onClick={(_: any, idx: number) => openWeekDrillDown(idx)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: "#6366f1", opacity: 0.3 }} />
                  Created
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e" }} />
                  Completed
                </div>
              </div>
            </Card>

            {/* Status Distribution Donut (clickable slices + legend) */}
            <Card>
              <SectionHeader title={t.analyticsPage.tasksByStatus} subtitle="Click a status to see tasks" icon={Activity} />

              {pieData.length > 0 ? (
                <>
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={76}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                          cursor="pointer"
                          onClick={(entry: any) => {
                            if (entry?.id) openStatusDrillDown(entry.id, entry.name);
                          }}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    {statusCounts.filter(s => s.count > 0).map(({ label, id, count }) => {
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div
                          key={id}
                          onClick={() => openStatusDrillDown(id, label)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 10px", borderRadius: 8,
                            background: STATUS_BG[id],
                            transition: "all 0.15s ease",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(2px)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(0)"; }}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[id], flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "var(--text)", flex: 1, fontWeight: 500 }}>{label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[id] }}>{count}</span>
                          <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 500, minWidth: 30, textAlign: "right" }}>{pct}%</span>
                          <ArrowRight size={12} style={{ color: "var(--text-dim)" }} />
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No tasks yet</p>
                </div>
              )}
            </Card>
          </div>

          {/* ═══ Team Performance Table (clickable rows) ═══ */}
          <Card style={{ marginBottom: 28 }}>
            <SectionHeader title={t.analyticsPage.perMember} subtitle="Click a member to see their tasks" icon={Users} />
            {members.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{t.analyticsPage.noMembersYet}</p>
            ) : (
              <div style={{ borderRadius: 12, overflow: "auto", border: "1px solid var(--border)", WebkitOverflowScrolling: "touch" }}>
                <div style={{ minWidth: 720 }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 0.7fr 0.7fr 0.7fr 0.7fr 1fr 0.8fr",
                  padding: "10px 16px",
                  background: "var(--surface2)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  {[
                    t.analyticsPage.columnMember,
                    t.analyticsPage.columnTasks,
                    t.analyticsPage.columnDone,
                    t.analyticsPage.columnSubmitted,
                    t.analyticsPage.columnRejected,
                    t.analyticsPage.columnRate,
                    t.analyticsPage.columnAvgTime,
                  ].map((h, i) => (
                    <span key={h} style={{
                      fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      textAlign: i === 0 ? "left" : "center",
                    }}>
                      {h}
                    </span>
                  ))}
                </div>

                {memberData.map((d, idx) => {
                  const progressWidth = `${d.rate}%`;
                  return (
                    <div
                      key={d.member._id}
                      className="analytics-row clickable-row"
                      onClick={() => openMemberDrillDown(d.member)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 0.7fr 0.7fr 0.7fr 0.7fr 1fr 0.8fr",
                        padding: "14px 16px",
                        borderBottom: idx === memberData.length - 1 ? "none" : "1px solid var(--border)",
                        alignItems: "center",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10,
                          background: `linear-gradient(135deg, ${STATUS_COLOR[d.rate >= 80 ? "completed" : d.rate >= 50 ? "submitted" : "in_progress"]}20, ${STATUS_COLOR[d.rate >= 80 ? "completed" : d.rate >= 50 ? "submitted" : "in_progress"]}08)`,
                          border: `1.5px solid ${STATUS_COLOR[d.rate >= 80 ? "completed" : d.rate >= 50 ? "submitted" : "in_progress"]}30`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 700,
                          color: STATUS_COLOR[d.rate >= 80 ? "completed" : d.rate >= 50 ? "submitted" : "in_progress"],
                          flexShrink: 0,
                        }}>
                          {d.member.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "block" }}>{d.member.name}</span>
                          <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 500 }}>{d.member.role}</span>
                        </div>
                      </div>

                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textAlign: "center" }}>{d.total}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#22c55e", textAlign: "center" }}>{d.completed}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", textAlign: "center" }}>{d.submitted}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#ef4444", textAlign: "center" }}>{d.rejected}</span>

                      <div style={{ textAlign: "center", padding: "0 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface3)", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 3, width: progressWidth,
                              background: d.rate >= 80 ? "linear-gradient(90deg, #22c55e, #4ade80)" : d.rate >= 50 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)",
                              transition: "width 0.5s ease",
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, minWidth: 32, color: d.rate >= 80 ? "#22c55e" : d.rate >= 50 ? "#f59e0b" : "#ef4444" }}>
                            {d.rate}%
                          </span>
                        </div>
                      </div>

                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textAlign: "center" }}>{d.avgTime}</span>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </Card>

          {/* ═══ Streak Leaderboard ═══ */}
          {sortedStreaks.length > 0 && (
            <Card style={{ marginBottom: 28 }}>
              <SectionHeader title="Streak Leaderboard" subtitle="Consecutive on-time completion streaks" icon={Award} />
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "48px 1fr 120px 120px",
                  padding: "10px 16px", background: "var(--surface2)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>#</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Member</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Current</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Best</span>
                </div>

                {sortedStreaks.map((s, idx) => {
                  const member = memberMap.get(s.memberId as Id<"members">);
                  const name = member?.name ?? "—";
                  const isTop = idx === 0 && s.current > 0;
                  const medals = ["🥇", "🥈", "🥉"];
                  const medal = idx < 3 ? medals[idx] : null;
                  const rankColors = ["#f59e0b", "#94a3b8", "#c2884e"];

                  return (
                    <div
                      key={s._id}
                      className="analytics-row clickable-row"
                      onClick={() => member && openMemberDrillDown(member)}
                      style={{
                        display: "grid", gridTemplateColumns: "48px 1fr 120px 120px",
                        padding: "14px 16px",
                        borderBottom: idx === sortedStreaks.length - 1 ? "none" : "1px solid var(--border)",
                        alignItems: "center",
                        cursor: member ? "pointer" : "default",
                        background: isTop ? "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(249,115,22,0.02) 100%)" : "transparent",
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        {medal ? <span style={{ fontSize: 18 }}>{medal}</span> : <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)" }}>{idx + 1}</span>}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10,
                          background: isTop ? "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.05))" : idx < 3 ? `linear-gradient(135deg, ${rankColors[idx]}20, ${rankColors[idx]}05)` : "var(--surface3)",
                          border: `1.5px solid ${isTop ? "rgba(249,115,22,0.3)" : idx < 3 ? `${rankColors[idx]}30` : "var(--border)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 700,
                          color: isTop ? "#f97316" : idx < 3 ? rankColors[idx] : "var(--text-muted)",
                          flexShrink: 0,
                        }}>
                          {name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{name}</span>
                          {isTop && (
                            <span style={{
                              display: "inline-block", marginLeft: 8,
                              fontSize: 9, fontWeight: 800, color: "#f97316",
                              background: "rgba(249,115,22,0.12)", padding: "2px 6px",
                              borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em",
                            }}>
                              On Fire
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {s.current > 0 && <span className="flame-animate" style={{ fontSize: 14 }}>🔥</span>}
                        <span style={{ fontSize: 16, fontWeight: 800, color: s.current > 0 ? "#f97316" : "var(--text-dim)" }}>{s.current}</span>
                      </div>

                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textAlign: "center" }}>{s.best}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ═══ Bottleneck Insights Section ═══ */}
          {bnStats && bnStats.total > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "8px 0 24px" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(239,68,68,0.25)",
                }}>
                  <AlertTriangle size={18} strokeWidth={2.2} style={{ color: "#fff" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.4px" }}>
                    {t.analyticsPage.bottleneckInsights}
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0", fontWeight: 400 }}>
                    {t.analyticsPage.whatsSlowingDown}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
                <StatCard label={t.analyticsPage.totalLogged}        value={bnStats.total}         icon={AlertTriangle} color="#f59e0b" />
                <StatCard label={t.analyticsPage.activeBottlenecks}  value={bnStats.activeCount}   icon={Zap}           color="#ef4444" />
                <StatCard label={t.analyticsPage.resolved}           value={bnStats.resolvedCount} icon={CheckCircle2}  color="#22c55e" />
                <StatCard
                  label={t.analyticsPage.avgResolveTime}
                  value={bnStats.avgResolveMs != null ? fmtDuration(bnStats.avgResolveMs) : "—"}
                  icon={Clock}
                  color="#6366f1"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
                <Card>
                  <SectionHeader title={t.analyticsPage.byCategory} icon={Target} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {Object.entries(bnStats.byCategory)
                      .sort(([, a]: [string, unknown], [, b]: [string, unknown]) => (b as any).total - (a as any).total)
                      .map(([cat, { total: catTotal, active: catActive }]: [string, any]) => {
                        const meta = CATEGORY_META[cat] ?? { label: cat, emoji: "\u2022", color: "#71717a" };
                        const pct  = bnStats.total > 0 ? (catTotal / bnStats.total) * 100 : 0;
                        return (
                          <div key={cat}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                                {meta.emoji} {meta.label}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {catActive > 0 && (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "2px 6px", borderRadius: 4 }}>
                                    {catActive} active
                                  </span>
                                )}
                                <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{catTotal}</span>
                              </div>
                            </div>
                            <div style={{ height: 6, background: "var(--surface3)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: 3, width: `${pct}%`,
                                background: `linear-gradient(90deg, ${meta.color}, ${meta.color}cc)`,
                                transition: "width 0.5s ease",
                              }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </Card>

                <Card>
                  <SectionHeader title={t.analyticsPage.weeklyTrend} icon={TrendingUp} />
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={bnStats.weeklyCreated.map((wc: any, i: number) => ({
                        week: fmtWeekLabel(wc.weekStart, locale),
                        created: wc.count,
                        resolved: bnStats.weeklyResolved[i]?.count ?? 0,
                      }))}>
                        <defs>
                          <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                        <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="created" name={t.analyticsPage.created} stroke="#f59e0b" fill="url(#gradCreated)" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} />
                        <Area type="monotone" dataKey="resolved" name={t.analyticsPage.resolved} stroke="#22c55e" fill="url(#gradResolved)" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                      {t.analyticsPage.created}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                      {t.analyticsPage.resolved}
                    </div>
                  </div>
                </Card>
              </div>

              {bnStats.topActive.length > 0 && (
                <Card style={{ marginBottom: 28 }}>
                  <SectionHeader title={t.analyticsPage.activeBottlenecks} subtitle="Top blockers requiring attention" icon={AlertTriangle} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {bnStats.topActive.map((b: any, idx: number) => {
                      const meta = CATEGORY_META[b.category ?? "uncategorized"] ?? CATEGORY_META.uncategorized;
                      const age  = Date.now() - b.createdAt;
                      return (
                        <div key={b.id} className="analytics-row" style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "14px 8px", borderRadius: 8,
                          borderBottom: idx === bnStats.topActive.length - 1 ? "none" : "1px solid var(--border)",
                        }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: meta.color,
                            background: `${meta.color}15`,
                            padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap",
                            border: `1px solid ${meta.color}25`,
                          }}>
                            {meta.emoji} {meta.label}
                          </span>
                          <span style={{ fontSize: 13, color: "var(--text)", flex: 1, fontWeight: 500, lineHeight: 1.4 }}>
                            {b.body}
                          </span>
                          <span style={{
                            fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap", fontWeight: 500,
                            background: "var(--surface2)", padding: "3px 8px", borderRadius: 5,
                          }}>
                            {fmtDuration(age)} ago
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}

          <div style={{ height: 40 }} />
        </div>
      </div>

      {/* ═══ Drill-Down Drawer Overlay ═══ */}
      {drawerData && (
        <DrillDownDrawer
          data={drawerData}
          onClose={closeDrawer}
          members={members}
          t={t}
        />
      )}
    </div>
  );
}
