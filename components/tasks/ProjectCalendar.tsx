"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface CalTask {
  _id: string;
  title: string;
  status: string;
  priority?: string;
  memberId: string;
  memberName?: string;
  submissionDate?: number;
}

interface Props {
  tasks: CalTask[];
  members: { _id: string; name: string }[];
}

/* ── Constants ──────────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  draft:       { bg: "rgba(113,113,122,0.12)", border: "rgba(113,113,122,0.3)",  text: "#a1a1aa" },
  in_progress: { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)",   text: "#60a5fa" },
  submitted:   { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",   text: "#fbbf24" },
  completed:   { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",    text: "#4ade80" },
};

const PRIORITY_DOT: Record<string, string> = {
  high: "var(--status-danger)", medium: "var(--status-warning)", low: "var(--status-success)",
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */

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

/** Get all calendar cells for a month grid (includes leading/trailing days) */
function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0=Sun
  const start = addDays(first, -startDay);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) { // 6 weeks × 7 days
    cells.push(addDays(start, i));
  }
  return cells;
}

/* ── Task Pill (shared between views) ──────────────────────────────────────── */

function TaskPill({ task, compact }: { task: CalTask; compact?: boolean }) {
  const s   = STATUS_STYLE[task.status] ?? STATUS_STYLE.draft;
  const dot = PRIORITY_DOT[task.priority ?? "medium"] ?? PRIORITY_DOT.medium;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = task.status !== "completed" &&
    task.submissionDate! < Date.now() &&
    !sameDay(new Date(task.submissionDate!), today);

  return (
    <div style={{
      padding: compact ? "2px 5px" : "3px 6px",
      borderRadius: compact ? 4 : 5,
      background: s.bg,
      border: `1px solid ${isOverdue ? "rgba(239,68,68,0.4)" : s.border}`,
      display: "flex", alignItems: "center", gap: compact ? 3 : 4,
    }}>
      {isOverdue && <AlertTriangle size={compact ? 8 : 9} style={{ color: "var(--status-danger)", flexShrink: 0 }} />}
      <div style={{
        width: compact ? 3 : 4, height: compact ? 3 : 4,
        borderRadius: "50%", background: dot, flexShrink: 0,
      }} />
      <span style={{
        fontSize: compact ? 9.5 : 10.5,
        color: isOverdue ? "#f87171" : s.text,
        fontWeight: 500,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {task.title}
      </span>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */

export default function ProjectCalendar({ tasks, members }: Props) {
  const { t, locale } = useLocale();
  const [mode, setMode] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState<Date>(() => sundayOf(new Date()));
  const [monthDate, setMonthDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const WEEK_DAYS = [t.calendar.sun, t.calendar.mon, t.calendar.tue, t.calendar.wed, t.calendar.thu];
  const MONTH_DAYS = [t.calendar.sun, t.calendar.mon, t.calendar.tue, t.calendar.wed, t.calendar.thu, t.calendar.fri, t.calendar.sat];

  /* Shared data */
  const memberMap = new Map(members.map((m) => [m._id, m]));
  const projectMemberIds = Array.from(new Set(tasks.map((tk) => tk.memberId)));
  const projectMembers = projectMemberIds
    .map((id) => memberMap.get(id))
    .filter(Boolean) as { _id: string; name: string }[];

  const unscheduled = tasks.filter(
    (tk) => !tk.submissionDate && tk.status !== "completed"
  );

  /* Week helpers */
  const weekDays = WEEK_DAYS.map((_, i) => addDays(weekStart, i));
  const weekEnd  = addDays(weekStart, 4);
  const isThisWeek = sameDay(weekStart, sundayOf(new Date()));

  const weekTasks = tasks.filter((tk) => {
    if (!tk.submissionDate) return false;
    const due = new Date(tk.submissionDate);
    return due >= weekStart && due <= addDays(weekEnd, 1);
  });

  /* Month helpers */
  const monthGrid = getMonthGrid(monthDate.getFullYear(), monthDate.getMonth());
  const isThisMonth = monthDate.getFullYear() === today.getFullYear() && monthDate.getMonth() === today.getMonth();

  const monthTasks = tasks.filter((tk) => {
    if (!tk.submissionDate) return false;
    const due = new Date(tk.submissionDate);
    // Show tasks in the grid range (includes leading/trailing days)
    const gridStart = monthGrid[0];
    const gridEnd   = monthGrid[monthGrid.length - 1];
    return due >= gridStart && due <= addDays(gridEnd, 1);
  });

  /* Navigation */
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

  const isCurrent = mode === "week" ? isThisWeek : isThisMonth;
  const periodLabel = mode === "week"
    ? `${fmtDay(weekStart, locale)} \u2013 ${fmtDay(weekEnd, locale)}`
    : fmtMonthYear(monthDate, locale);

  const periodTaskCount = mode === "week" ? weekTasks.length : monthTasks.length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Nav bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        {/* Prev / Next */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={prev} style={{
            width: 26, height: 26, borderRadius: 6,
            background: "var(--surface2)", border: "1px solid var(--border2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-muted)",
          }}>
            <ChevronLeft size={13} />
          </button>
          <button onClick={next} style={{
            width: 26, height: 26, borderRadius: 6,
            background: "var(--surface2)", border: "1px solid var(--border2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-muted)",
          }}>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Period label */}
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {periodLabel}
        </span>

        {/* Today button */}
        {!isCurrent && (
          <button onClick={goToday} style={{
            padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
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
          borderRadius: 7, padding: 2, marginLeft: 4,
        }}>
          {(["week", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                cursor: "pointer", border: "none",
                background: mode === m ? "var(--surface)" : "transparent",
                color:      mode === m ? "var(--text)"    : "var(--text-muted)",
                boxShadow:  mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.12s", textTransform: "capitalize",
              }}
            >
              {m === "week" ? t.calendar.week : t.calendar.month}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {periodTaskCount} {periodTaskCount === 1 ? t.calendar.task : t.calendar.tasks}
          </span>
          {unscheduled.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {unscheduled.length} {t.calendar.unscheduled}
            </span>
          )}
        </div>
      </div>

      {/* ── Week View ────────────────────────────────────────────────────── */}
      {mode === "week" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{
                  width: 140, padding: "8px 12px",
                  borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)",
                  textAlign: "left", background: "var(--surface)",
                  fontSize: 10, fontWeight: 600, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {t.calendar.member}
                </th>
                {weekDays.map((day, i) => {
                  const isToday = sameDay(day, today);
                  return (
                    <th key={i} style={{
                      padding: "8px 10px",
                      borderBottom: "1px solid var(--border)",
                      borderRight: i < 4 ? "1px solid var(--border)" : "none",
                      textAlign: "left",
                      background: isToday ? "var(--accent-subtle)" : "var(--surface)",
                    }}>
                      <div style={{
                        fontSize: 10, fontWeight: 600,
                        color: isToday ? "var(--accent-light)" : "var(--text-muted)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        {WEEK_DAYS[i]}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? "var(--accent-light)" : "var(--text)", marginTop: 1 }}>
                        {day.getDate()}
                        {isToday && (
                          <span style={{
                            marginLeft: 4, fontSize: 8, fontWeight: 700,
                            background: "var(--accent)", color: "#fff",
                            borderRadius: 3, padding: "1px 4px", verticalAlign: "middle",
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
              {projectMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 20px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t.calendar.noTasksWithDueDates}</p>
                  </td>
                </tr>
              ) : (
                projectMembers.map((member) => {
                  const mTasks = weekTasks.filter((tk) => tk.memberId === member._id);
                  return (
                    <tr key={member._id} style={{ verticalAlign: "top" }}>
                      <td style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)",
                        background: "var(--surface)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 700, color: "var(--accent-light)", flexShrink: 0,
                          }}>
                            {member.name[0]?.toUpperCase()}
                          </div>
                          <span style={{
                            fontSize: 11.5, fontWeight: 600, color: "var(--text)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {member.name}
                          </span>
                        </div>
                        {mTasks.length === 0 && (
                          <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 3, display: "block" }}>
                            {t.calendar.nothingDue}
                          </span>
                        )}
                      </td>
                      {weekDays.map((day, i) => {
                        const isToday = sameDay(day, today);
                        const dayTasks = mTasks.filter((tk) =>
                          tk.submissionDate && sameDay(new Date(tk.submissionDate), day)
                        );
                        return (
                          <td key={i} style={{
                            padding: "6px 6px",
                            borderBottom: "1px solid var(--border)",
                            borderRight: i < 4 ? "1px solid var(--border)" : "none",
                            verticalAlign: "top",
                            background: isToday ? "rgba(99,102,241,0.03)" : "transparent",
                          }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {dayTasks.map((tk) => <TaskPill key={tk._id} task={tk} />)}
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
        </div>
      )}

      {/* ── Month View ───────────────────────────────────────────────────── */}
      {mode === "month" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
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

          {/* Grid cells — 6 rows × 7 cols */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
            gridAutoRows: "minmax(90px, 1fr)",
          }}>
            {monthGrid.map((cell, i) => {
              const isToday     = sameDay(cell, today);
              const isThisMonth = cell.getMonth() === monthDate.getMonth();
              const isWeekend   = cell.getDay() === 5 || cell.getDay() === 6; // Friday & Saturday
              const dayTasks    = monthTasks.filter((tk) =>
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
                    padding: "6px 6px 4px",
                    background: isToday
                      ? "rgba(99,102,241,0.05)"
                      : isWeekend
                        ? "rgba(113,113,122,0.06)"
                        : !isThisMonth
                          ? "var(--surface)"
                          : "transparent",
                    opacity: isThisMonth ? 1 : 0.4,
                    display: "flex", flexDirection: "column",
                  }}
                >
                  {/* Day number */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: isToday ? 700 : 500,
                      color: isToday ? "var(--accent-light)" : isThisMonth ? "var(--text)" : "var(--text-dim)",
                      ...(isToday ? {
                        background: "var(--accent)", color: "#fff",
                        width: 22, height: 22, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      } as React.CSSProperties : {}),
                    }}>
                      {cell.getDate()}
                    </span>
                    {dayTasks.length > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: "var(--text-dim)",
                      }}>
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task pills — max 3, then "+N more" */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                    {dayTasks.slice(0, MAX_SHOW).map((tk) => (
                      <TaskPill key={tk._id} task={tk} compact />
                    ))}
                    {overflow > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: "var(--text-muted)",
                        padding: "1px 4px",
                      }}>
                        +{overflow} {t.calendar.more}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Unscheduled tasks (both views) ───────────────────────────────── */}
      {unscheduled.length > 0 && (
        <div style={{
          padding: "12px 16px", borderTop: "1px solid var(--border)",
          flexShrink: 0, maxHeight: 120, overflowY: "auto",
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px",
          }}>
            {t.calendar.unscheduledNoDueDate}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {unscheduled.map((tk) => {
              const s   = STATUS_STYLE[tk.status] ?? STATUS_STYLE.draft;
              const dot = PRIORITY_DOT[tk.priority ?? "medium"] ?? PRIORITY_DOT.medium;
              const name = memberMap.get(tk.memberId)?.name ?? t.unknown;
              return (
                <div key={tk._id} style={{
                  padding: "3px 8px", borderRadius: 5,
                  background: s.bg, border: `1px solid ${s.border}`,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: dot }} />
                  <span style={{ fontSize: 10.5, color: s.text, fontWeight: 500 }}>{tk.title}</span>
                  <span style={{ fontSize: 9.5, color: "var(--text-dim)" }}>\u00b7 {name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
