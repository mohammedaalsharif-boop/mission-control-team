"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from "lucide-react";

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  draft:       { bg: "rgba(113,113,122,0.12)", border: "rgba(113,113,122,0.3)",  text: "#a1a1aa" },
  in_progress: { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)",   text: "#60a5fa" },
  submitted:   { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",   text: "#fbbf24" },
  completed:   { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",    text: "#4ade80" },
};

const PRIORITY_DOT: Record<string, string> = {
  high: "var(--status-danger)", medium: "var(--status-warning)", low: "var(--status-success)",
};

// ── helpers ───────────────────────────────────────────────────────────────────

function sundayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDay(d: Date, locale: string) {
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" });
}

function fmtMonthYear(d: Date, locale: string) {
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "long", year: "numeric" });
}

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const start = addDays(first, -startDay);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
  return cells;
}

// ── Task pill shared component ────────────────────────────────────────────────

function TaskPill({
  task, projectName, compact,
}: {
  task: { _id: string; title: string; status: string; priority?: string; submissionDate?: number };
  projectName?: string;
  compact?: boolean;
}) {
  const s   = STATUS_STYLE[task.status] ?? STATUS_STYLE.draft;
  const dot = PRIORITY_DOT[task.priority ?? "medium"] ?? PRIORITY_DOT.medium;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const submissionEod = new Date(task.submissionDate!);
  submissionEod.setHours(23,59,59,999);
  const isOverdue = task.status !== "completed" &&
    submissionEod.getTime() < Date.now() &&
    !sameDay(new Date(task.submissionDate!), today);

  return (
    <div style={{
      padding: compact ? "2px 5px" : "4px 7px",
      borderRadius: compact ? 4 : 6,
      background: s.bg,
      border: `1px solid ${isOverdue ? "rgba(239,68,68,0.4)" : s.border}`,
      display: "flex", alignItems: "center", gap: compact ? 3 : 5,
    }}>
      {isOverdue && <AlertTriangle size={compact ? 8 : 10} style={{ color: "var(--status-danger)", flexShrink: 0 }} />}
      <div style={{
        width: compact ? 3 : 5, height: compact ? 3 : 5,
        borderRadius: "50%", background: dot, flexShrink: 0,
      }} />
      <span style={{
        fontSize: compact ? 9.5 : 11,
        color: isOverdue ? "#f87171" : s.text,
        fontWeight: 500, flex: 1, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {task.title}
      </span>
      {!compact && projectName && (
        <span style={{
          fontSize: 9, color: "var(--text-dim)", flexShrink: 0,
          maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {projectName}
        </span>
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { isLoading, orgId } = useAuth();
  const { t, locale } = useLocale();
  const allTasks  = useQuery(api.tasks.listAllTasks, orgId ? { orgId } : "skip") ?? [];
  const members   = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];
  const projects  = useQuery(api.projects.listAll, orgId ? { orgId } : "skip") ?? [];

  const projectMap = new Map(projects.map((p) => [p._id, p.name]));

  // Localized week/month days from translation keys
  const WEEK_DAYS = [t.calendar.sun, t.calendar.mon, t.calendar.tue, t.calendar.wed, t.calendar.thu];
  const MONTH_DAYS = [t.calendar.sun, t.calendar.mon, t.calendar.tue, t.calendar.wed, t.calendar.thu, t.calendar.fri, t.calendar.sat];

  const [mode, setMode] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState<Date>(() => sundayOf(new Date()));
  const [monthDate, setMonthDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  if (isLoading) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Visible members — all members plus admin if they have tasks
  const memberTaskCount = new Map<string, number>();
  for (const tk of allTasks) {
    memberTaskCount.set(tk.memberId, (memberTaskCount.get(tk.memberId) ?? 0) + 1);
  }
  const visibleMembers = members.filter(
    (m) => m.role !== "admin" || (memberTaskCount.get(m._id) ?? 0) > 0
  );

  // Week data
  const weekDays = WEEK_DAYS.map((_, i) => addDays(weekStart, i));
  const weekEnd  = addDays(weekStart, 4);
  const isThisWeek = sameDay(weekStart, sundayOf(new Date()));

  const weekTasks = allTasks.filter((tk) => {
    if (!tk.submissionDate) return false;
    const due = new Date(tk.submissionDate);
    return due >= weekStart && due <= addDays(weekEnd, 1);
  });

  // Month data
  const monthGrid = getMonthGrid(monthDate.getFullYear(), monthDate.getMonth());
  const isThisMonth = monthDate.getFullYear() === today.getFullYear() && monthDate.getMonth() === today.getMonth();

  const monthTasks = allTasks.filter((tk) => {
    if (!tk.submissionDate) return false;
    const due = new Date(tk.submissionDate);
    const gridStart = monthGrid[0];
    const gridEnd   = monthGrid[monthGrid.length - 1];
    return due >= gridStart && due <= addDays(gridEnd, 1);
  });

  // Unscheduled
  const unscheduled = allTasks.filter((tk) => !tk.submissionDate && tk.status !== "completed");

  // Navigation
  const prev = () => {
    if (mode === "week") setWeekStart((d) => addDays(d, -7));
    else setMonthDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
  };
  const next = () => {
    if (mode === "week") setWeekStart((d) => addDays(d, 7));
    else setMonthDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });
  };
  const goToday = () => {
    if (mode === "week") setWeekStart(sundayOf(new Date()));
    else { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setMonthDate(d); }
  };

  const isCurrent    = mode === "week" ? isThisWeek : isThisMonth;
  const periodLabel  = mode === "week" ? `${fmtDay(weekStart, locale)} \u2013 ${fmtDay(weekEnd, locale)}` : fmtMonthYear(monthDate, locale);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <div style={{
          padding: "14px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 14,
          background: "var(--surface)", flexShrink: 0,
        }}>
          {/* Prev / Next */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={prev} style={{
              width: 28, height: 28, borderRadius: 7,
              background: "var(--surface2)", border: "1px solid var(--border2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-muted)",
            }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={next} style={{
              width: 28, height: 28, borderRadius: 7,
              background: "var(--surface2)", border: "1px solid var(--border2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--text-muted)",
            }}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Period label */}
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            {periodLabel}
          </span>

          {/* Today button */}
          {!isCurrent && (
            <button onClick={goToday} style={{
              padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
              background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.25)",
              color: "var(--accent-light)", cursor: "pointer",
            }}>
              {t.calendar.today}
            </button>
          )}

          {/* Week / Month toggle */}
          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            background: "var(--surface2)", border: "1px solid var(--border2)",
            borderRadius: 8, padding: 3,
          }}>
            {(["week", "month"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", border: "none",
                  background: mode === m ? "var(--surface)" : "transparent",
                  color:      mode === m ? "var(--text)"    : "var(--text-muted)",
                  boxShadow:  mode === m ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {m === "week" ? t.calendar.week : t.calendar.month}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            {Object.entries(STATUS_STYLE).map(([key, s]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: s.bg, border: `1px solid ${s.border}`,
                }} />
                <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                  {key === "draft" ? t.status.draft :
                   key === "in_progress" ? t.status.in_progress :
                   key === "submitted" ? t.status.submitted :
                   key === "completed" ? t.status.completed : key}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Week View ────────────────────────────────────────────────── */}
        {mode === "week" && (
          <div className="flex-1 overflow-y-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{
                    width: 160, padding: "10px 16px",
                    borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)",
                    textAlign: "left", background: "var(--surface)",
                    fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {t.calendar.member}
                  </th>
                  {weekDays.map((day, i) => {
                    const isToday = sameDay(day, today);
                    return (
                      <th key={i} style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--border)",
                        borderRight: i < 4 ? "1px solid var(--border)" : "none",
                        textAlign: "left",
                        background: isToday ? "var(--accent-subtle)" : "var(--surface)",
                      }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600,
                          color: isToday ? "var(--accent-light)" : "var(--text-muted)",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>
                          {WEEK_DAYS[i]}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? "var(--accent-light)" : "var(--text)", marginTop: 2 }}>
                          {day.getDate()}
                          {isToday && (
                            <span style={{
                              marginLeft: 5, fontSize: 9, fontWeight: 700,
                              background: "var(--accent)", color: "#fff",
                              borderRadius: 4, padding: "1px 5px", verticalAlign: "middle",
                            }}>
                              {t.calendar.todayBadge}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "48px 24px", textAlign: "center" }}>
                      <CalendarDays size={32} style={{ color: "var(--text-dim)", margin: "0 auto 12px" }} />
                      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t.calendar.noMembersYet}</p>
                    </td>
                  </tr>
                ) : (
                  visibleMembers.map((member) => {
                    const mWeekTasks = weekTasks.filter((tk) => tk.memberId === member._id);
                    const mUnscheduled = unscheduled.filter((tk) => tk.memberId === member._id);
                    const hasAnything = mWeekTasks.length > 0 || mUnscheduled.length > 0;
                    return (
                      <tr key={member._id} style={{ verticalAlign: "top" }}>
                        <td style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)",
                          background: "var(--surface)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 26, height: 26, borderRadius: "50%",
                              background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 700, color: "var(--accent-light)", flexShrink: 0,
                            }}>
                              {member.name[0]?.toUpperCase()}
                            </div>
                            <span style={{
                              fontSize: 12, fontWeight: 600, color: "var(--text)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {member.name}
                            </span>
                          </div>
                          {!hasAnything && (
                            <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, display: "block" }}>{t.calendar.nothingDue}</span>
                          )}
                        </td>
                        {weekDays.map((day, i) => {
                          const isToday = sameDay(day, today);
                          const dayTasks = mWeekTasks.filter((tk) =>
                            tk.submissionDate && sameDay(new Date(tk.submissionDate), day)
                          );
                          return (
                            <td key={i} style={{
                              padding: "8px 8px",
                              borderBottom: "1px solid var(--border)",
                              borderRight: i < 4 ? "1px solid var(--border)" : "none",
                              verticalAlign: "top", minHeight: 64,
                              background: isToday ? "rgba(99,102,241,0.03)" : "transparent",
                            }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {dayTasks.map((tk) => (
                                  <TaskPill
                                    key={tk._id}
                                    task={tk}
                                    projectName={tk.projectId ? projectMap.get(tk.projectId) : undefined}
                                  />
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Unscheduled — week view */}
            {unscheduled.length > 0 && (
              <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border)" }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12,
                }}>
                  {t.calendar.unscheduledNoDueDate}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {visibleMembers.map((member) => {
                    const tasks = unscheduled.filter((tk) => tk.memberId === member._id);
                    if (tasks.length === 0) return null;
                    return (
                      <div key={member._id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ width: 136, flexShrink: 0, display: "flex", alignItems: "center", gap: 7, paddingTop: 3 }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 700, color: "var(--accent-light)",
                          }}>
                            {member.name[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{member.name}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {tasks.map((tk) => (
                            <TaskPill key={tk._id} task={tk} projectName={tk.projectId ? projectMap.get(tk.projectId) : undefined} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Month View ───────────────────────────────────────────────── */}
        {mode === "month" && (
          <div className="flex-1 overflow-y-auto">
            {/* Day-of-week headers */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: "1px solid var(--border)", background: "var(--surface)",
            }}>
              {MONTH_DAYS.map((d, i) => {
                const isWeekend = i === 5 || i === 6; // Friday & Saturday
                return (
                  <div key={d} style={{
                    padding: "8px 10px", textAlign: "center",
                    fontSize: 10, fontWeight: 600,
                    color: isWeekend ? "var(--text-dim)" : "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    background: isWeekend ? "rgba(113,113,122,0.08)" : "transparent",
                  }}>
                    {d}
                  </div>
                );
              })}
            </div>

            {/* 6×7 grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
              gridAutoRows: "minmax(100px, 1fr)",
            }}>
              {monthGrid.map((cell, i) => {
                const isTodayCell = sameDay(cell, today);
                const isCurrentMonth = cell.getMonth() === monthDate.getMonth();
                const isWeekend = cell.getDay() === 5 || cell.getDay() === 6; // Friday & Saturday
                const dayTasks = monthTasks.filter((tk) =>
                  tk.submissionDate && sameDay(new Date(tk.submissionDate), cell)
                );
                const MAX_SHOW = 3;
                const overflow = dayTasks.length - MAX_SHOW;

                return (
                  <div
                    key={i}
                    style={{
                      borderRight:  (i % 7 < 6) ? "1px solid var(--border)" : "none",
                      borderBottom: "1px solid var(--border)",
                      padding: "6px 8px 4px",
                      background: isTodayCell
                        ? "rgba(99,102,241,0.05)"
                        : isWeekend
                          ? "rgba(113,113,122,0.06)"
                          : !isCurrentMonth
                            ? "var(--surface)"
                            : "transparent",
                      opacity: isCurrentMonth ? 1 : 0.4,
                      display: "flex", flexDirection: "column",
                    }}
                  >
                    {/* Day number */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 4,
                    }}>
                      <span style={{
                        fontSize: 12, fontWeight: isTodayCell ? 700 : 500,
                        color: isTodayCell ? "var(--accent-light)" : isCurrentMonth ? "var(--text)" : "var(--text-dim)",
                        ...(isTodayCell ? {
                          background: "var(--accent)", color: "#fff",
                          width: 24, height: 24, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11,
                        } as React.CSSProperties : {}),
                      }}>
                        {cell.getDate()}
                      </span>
                      {dayTasks.length > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-dim)" }}>
                          {dayTasks.length}
                        </span>
                      )}
                    </div>

                    {/* Task pills */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                      {dayTasks.slice(0, MAX_SHOW).map((tk) => (
                        <TaskPill key={tk._id} task={tk} compact />
                      ))}
                      {overflow > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", padding: "1px 4px" }}>
                          +{overflow} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
