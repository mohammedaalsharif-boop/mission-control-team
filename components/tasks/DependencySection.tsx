"use client";

import { useState } from "react";
import { Link2, X, AlertTriangle, CheckCircle2, Plus, ChevronRight } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  taskId:    string;
  orgId:     Id<"organizations"> | null;
  memberId:  string;
  projectId?: string;
}

export default function DependencySection({ taskId, orgId, memberId, projectId }: Props) {
  const { t } = useLocale();
  const [adding, setAdding] = useState(false);
  const [search, setSearch]  = useState("");

  const blockers = useQuery(api.dependencies.getBlockers, { taskId: taskId as Id<"tasks"> }) ?? [];
  const blocking = useQuery(api.dependencies.getBlocking, { taskId: taskId as Id<"tasks"> }) ?? [];
  const blocked  = useQuery(api.dependencies.isBlocked,   { taskId: taskId as Id<"tasks"> });

  const projectTasks = useQuery(
    api.tasks.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  ) ?? [];

  const addDep    = useMutation(api.dependencies.addDependency);
  const removeDep = useMutation(api.dependencies.removeDependency);

  const filteredTasks = projectTasks.filter(
    (t) =>
      t._id !== taskId &&
      !blockers.some((b) => b?.task._id === t._id) &&
      t.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = async (blockerTaskId: string) => {
    if (!orgId) return;
    await addDep({
      orgId,
      blockerTaskId:   blockerTaskId as Id<"tasks">,
      dependentTaskId: taskId as Id<"tasks">,
      createdBy:       memberId as Id<"members">,
    });
    setSearch("");
    setAdding(false);
  };

  const totalDeps = blockers.length + blocking.length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Link2 size={12} color="var(--text-muted)" />
        <span style={{
          fontSize: 10, color: "var(--text-muted)", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {t.dependencies.title} {totalDeps > 0 && `(${totalDeps})`}
        </span>
        {blocked?.blocked && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: "var(--status-warning)",
            display: "flex", alignItems: "center", gap: 3, marginLeft: "auto",
          }}>
            <AlertTriangle size={10} /> {t.dependencies.blocked}
          </span>
        )}
      </div>

      {/* Blockers (prerequisites) */}
      {blockers.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 500, marginBottom: 4, display: "block" }}>
            {t.dependencies.waitingOn}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {blockers.map((b) => {
              if (!b) return null;
              const done = b.task.status === "completed";
              return (
                <div key={b.dep._id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", borderRadius: 6,
                  background: done ? "rgba(34,197,94,0.06)" : "rgba(245,158,11,0.06)",
                  border: `1px solid ${done ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)"}`,
                }}>
                  {done
                    ? <CheckCircle2 size={12} style={{ color: "var(--status-success)", flexShrink: 0 }} />
                    : <AlertTriangle size={12} style={{ color: "var(--status-warning)", flexShrink: 0 }} />
                  }
                  <span style={{
                    flex: 1, fontSize: 12, color: "var(--text)",
                    textDecoration: done ? "line-through" : "none",
                    opacity: done ? 0.6 : 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {b.task.title}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-dim)", flexShrink: 0 }}>
                    {b.task.status.replace("_", " ")}
                  </span>
                  <button
                    onClick={() => removeDep({ dependencyId: b.dep._id })}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-dim)", padding: 2, display: "flex",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--status-danger)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Blocking (downstream) */}
      {blocking.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 500, marginBottom: 4, display: "block" }}>
            {t.dependencies.blocking}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {blocking.map((b) => {
              if (!b) return null;
              return (
                <div key={b.dep._id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", borderRadius: 6,
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.12)",
                }}>
                  <ChevronRight size={12} style={{ color: "var(--accent-light)", flexShrink: 0 }} />
                  <span style={{
                    flex: 1, fontSize: 12, color: "var(--text)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {b.task.title}
                  </span>
                  <button
                    onClick={() => removeDep({ dependencyId: b.dep._id })}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-dim)", padding: 2, display: "flex",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--status-danger)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add dependency */}
      {adding ? (
        <div>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.dependencies.searchPlaceholder}
            style={{
              width: "100%", padding: "6px 10px", fontSize: 12,
              background: "var(--surface2)", border: "1px solid var(--border2)",
              borderRadius: 6, color: "var(--text)", outline: "none",
              fontFamily: "inherit", marginBottom: 4,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
            onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); }}
          />
          {search.trim() && (
            <div style={{
              maxHeight: 150, overflowY: "auto",
              border: "1px solid var(--border2)", borderRadius: 6,
              background: "var(--surface2)",
            }}>
              {filteredTasks.slice(0, 8).map((t) => (
                <button
                  key={t._id}
                  onClick={() => handleAdd(t._id)}
                  style={{
                    width: "100%", textAlign: "left", padding: "6px 10px",
                    fontSize: 12, color: "var(--text)", background: "none",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  {t.title}
                </button>
              ))}
              {filteredTasks.length === 0 && (
                <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--text-dim)" }}>
                  {t.dependencies.noMatching}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setAdding(false)}
            style={{
              fontSize: 11, color: "var(--text-dim)", background: "none",
              border: "none", cursor: "pointer", marginTop: 4, fontFamily: "inherit",
            }}
          >
            {t.cancel}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            fontSize: 11, color: "var(--accent-light)", background: "none",
            border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <Plus size={11} /> {t.dependencies.addDependency}
        </button>
      )}
    </div>
  );
}

/** Small badge for TaskCard showing blocked status. */
export function BlockedBadge({ taskId }: { taskId: string }) {
  const { t } = useLocale();
  const blocked = useQuery(api.dependencies.isBlocked, { taskId: taskId as Id<"tasks"> });
  if (!blocked?.blocked) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 9, fontWeight: 600, color: "var(--status-warning)",
      background: "rgba(245,158,11,0.1)",
      border: "1px solid rgba(245,158,11,0.2)",
      padding: "1px 6px", borderRadius: 4,
    }}>
      <Link2 size={8} /> {t.dependencies.blocked}
    </span>
  );
}
