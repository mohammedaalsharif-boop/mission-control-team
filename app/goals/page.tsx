"use client";

import { useState } from "react";
import { Target, Plus, ChevronDown, ChevronRight, Trash2, Edit2, Link2, X, Check } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";

/* ── Status colours ──────────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  on_track:  { label: "On Track",  color: "var(--status-success)", bg: "rgba(34,197,94,0.1)" },
  at_risk:   { label: "At Risk",   color: "var(--status-warning)", bg: "rgba(245,158,11,0.1)" },
  behind:    { label: "Behind",    color: "var(--status-danger)",  bg: "rgba(239,68,68,0.1)" },
  completed: { label: "Completed", color: "var(--accent-light)",   bg: "var(--accent-subtle)" },
};

export default function GoalsPage() {
  const { orgId, user } = useAuth();
  const { t } = useLocale();
  const goals    = useQuery(api.goals.list, orgId ? { orgId } : "skip") ?? [];
  const projects = useQuery(api.projects.listAll, orgId ? { orgId } : "skip") ?? [];
  const members  = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];

  const createGoal   = useMutation(api.goals.create);
  const updateGoal   = useMutation(api.goals.update);
  const removeGoal   = useMutation(api.goals.remove);
  const linkProject  = useMutation(api.goals.linkProject);
  const unlinkProject = useMutation(api.goals.unlinkProject);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", color: "#6366f1" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!orgId || !user || !form.title.trim()) return;
    await createGoal({
      orgId,
      title:     form.title.trim(),
      description: form.description.trim() || undefined,
      dueDate:   form.dueDate ? new Date(form.dueDate).getTime() : undefined,
      color:     form.color,
      createdBy: user.memberId as Id<"members">,
    });
    setForm({ title: "", description: "", dueDate: "", color: "#6366f1" });
    setCreating(false);
  };

  if (!orgId) return null;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Target size={20} style={{ color: "var(--accent)" }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.goals.title}</h1>
          <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
            {goals.length} goal{goals.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Plus size={13} /> {t.goals.newGoal}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div style={{
          background: "var(--surface2)", border: "1px solid var(--border2)",
          borderRadius: 10, padding: 16, marginBottom: 20,
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t.goals.goalTitlePlaceholder}
              style={{
                flex: 1, padding: "8px 10px", fontSize: 13,
                background: "var(--surface)", border: "1px solid var(--border2)",
                borderRadius: 6, color: "var(--text)", outline: "none", fontFamily: "inherit",
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              style={{
                padding: "8px 10px", fontSize: 12,
                background: "var(--surface)", border: "1px solid var(--border2)",
                borderRadius: 6, color: "var(--text)", fontFamily: "inherit",
              }}
            />
          </div>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t.goals.descriptionPlaceholder}
            rows={2}
            style={{
              width: "100%", padding: "8px 10px", fontSize: 12,
              background: "var(--surface)", border: "1px solid var(--border2)",
              borderRadius: 6, color: "var(--text)", resize: "none", outline: "none",
              fontFamily: "inherit", marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleCreate} disabled={!form.title.trim()} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: form.title.trim() ? "var(--accent)" : "var(--surface3)",
              color: "#fff", border: "none", cursor: form.title.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}>
              {t.create}
            </button>
            <button onClick={() => setCreating(false)} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12,
              background: "var(--surface3)", color: "var(--text-muted)",
              border: "none", cursor: "pointer", fontFamily: "inherit",
            }}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 && !creating && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }}>
          <Target size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0, marginBottom: 4 }}>{t.goals.noGoals}</p>
          <p style={{ fontSize: 12, margin: 0 }}>{t.goals.noGoalsHint}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {goals.map((goal) => (
          <GoalCard
            key={goal._id}
            goal={goal}
            expanded={expanded.has(goal._id)}
            onToggle={() => toggleExpand(goal._id)}
            projects={projects}
            members={members}
            onUpdate={updateGoal}
            onRemove={removeGoal}
            onLink={linkProject}
            onUnlink={unlinkProject}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Goal Card ───────────────────────────────────────────────────────────── */

function GoalCard({
  goal, expanded, onToggle, projects, members,
  onUpdate, onRemove, onLink, onUnlink,
}: {
  goal: any;
  expanded: boolean;
  onToggle: () => void;
  projects: any[];
  members: any[];
  onUpdate: any;
  onRemove: any;
  onLink: any;
  onUnlink: any;
}) {
  const { t } = useLocale();
  const progress     = useQuery(api.goals.getProgress, { goalId: goal._id });
  const goalProjects = useQuery(api.goals.getGoalProjects, { goalId: goal._id }) ?? [];
  const [linking, setLinking] = useState(false);

  const statusLabels: Record<string, string> = {
    on_track: t.goals.goalStatus.on_track,
    at_risk: t.goals.goalStatus.at_risk,
    behind: t.goals.goalStatus.behind,
    completed: t.goals.goalStatus.completed,
  };

  const stMap = STATUS_MAP[goal.status] ?? STATUS_MAP.on_track;
  const st = {
    ...stMap,
    label: statusLabels[goal.status] ?? statusLabels.on_track,
  };

  const pct = progress?.pct ?? 0;

  const linkedProjectIds = new Set(goalProjects.map((gp: any) => gp?.project._id));
  const availableProjects = projects.filter((p) => !linkedProjectIds.has(p._id));

  const owner = goal.ownerId ? members.find((m: any) => m._id === goal.ownerId) : null;

  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border2)",
      borderRadius: 10, overflow: "hidden",
      borderLeft: `3px solid ${goal.color ?? "var(--accent)"}`,
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px", cursor: "pointer",
        }}
      >
        {expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{goal.title}</span>
            <span style={{
              fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
              background: st.bg, color: st.color,
            }}>
              {st.label}
            </span>
          </div>
          {goal.description && (
            <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0, lineHeight: 1.4 }}>
              {goal.description}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ width: 120, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--surface3)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: pct === 100 ? "var(--status-success)" : (goal.color ?? "var(--accent)"),
              width: `${pct}%`, transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: pct === 100 ? "var(--status-success)" : "var(--text-muted)", width: 30, textAlign: "right" }}>
            {pct}%
          </span>
        </div>

        {owner && (
          <div style={{
            width: 24, height: 24, borderRadius: "50%", background: "var(--accent-bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "var(--accent-light)", flexShrink: 0,
          }}>
            {owner.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--border)" }}>
          {/* Stats */}
          <div style={{ display: "flex", gap: 16, padding: "10px 0", fontSize: 11, color: "var(--text-dim)" }}>
            <span>{progress?.totalTasks ?? 0} {t.goals.tasks}</span>
            <span>{progress?.completedTasks ?? 0} {t.goals.completed}</span>
            {goal.dueDate && (
              <span>{t.goals.due} {new Date(goal.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            )}
          </div>

          {/* Status selector */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <button
                key={key}
                onClick={() => onUpdate({ goalId: goal._id, status: key })}
                style={{
                  padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 500,
                  background: goal.status === key ? val.bg : "transparent",
                  color: goal.status === key ? val.color : "var(--text-dim)",
                  border: `1px solid ${goal.status === key ? val.color : "var(--border2)"}`,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {val.label}
              </button>
            ))}
          </div>

          {/* Linked projects */}
          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontSize: 10, color: "var(--text-muted)", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6,
            }}>
              {t.goals.linkedProjects} ({goalProjects.length})
            </span>

            {goalProjects.map((gp: any) => {
              if (!gp) return null;
              return (
                <div key={gp.link._id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 8px", borderRadius: 6, marginBottom: 4,
                  background: "var(--surface)", border: "1px solid var(--border)",
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{gp.project.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <div style={{ width: 60, height: 3, borderRadius: 2, background: "var(--surface3)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          background: gp.taskStats.pct === 100 ? "var(--status-success)" : "var(--accent)",
                          width: `${gp.taskStats.pct}%`,
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                        {gp.taskStats.completed}/{gp.taskStats.total} tasks
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onUnlink({ linkId: gp.link._id })}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-dim)", padding: 2, display: "flex",
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}

            {linking ? (
              <div style={{ marginTop: 4 }}>
                <select
                  autoFocus
                  onChange={(e) => {
                    if (e.target.value) {
                      onLink({ goalId: goal._id, projectId: e.target.value as Id<"projects"> });
                      setLinking(false);
                    }
                  }}
                  style={{
                    width: "100%", padding: "6px 8px", fontSize: 12,
                    background: "var(--surface)", border: "1px solid var(--border2)",
                    borderRadius: 6, color: "var(--text)", fontFamily: "inherit",
                  }}
                >
                  <option value="">{t.goals.selectProject}</option>
                  {availableProjects.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <button
                onClick={() => setLinking(true)}
                style={{
                  fontSize: 11, color: "var(--accent-light)", background: "none",
                  border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 4, marginTop: 4,
                }}
              >
                <Link2 size={10} /> {t.goals.linkProject}
              </button>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <button
              onClick={() => onRemove({ goalId: goal._id })}
              style={{
                fontSize: 11, color: "var(--status-danger)", background: "none",
                border: "none", cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <Trash2 size={10} /> {t.delete}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
