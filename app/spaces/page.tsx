"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import {
  Plus, FolderOpen, Archive, Pencil, Check, X,
  LayoutGrid, ChevronRight,
} from "lucide-react";

const SPACE_COLORS = [
  "var(--accent)", "#8b5cf6", "#ec4899", "var(--status-warning)",
  "#10b981", "#06b6d4", "#f97316", "#84cc16",
];
const SPACE_ICONS = ["📁", "⚙️", "🔧", "📦", "🚀", "📊", "🏭", "🛠️", "💼", "🎯"];

function SpaceCard({
  space,
  projectCount,
  taskCount,
  onEdit,
  t,
}: {
  space: any;
  projectCount: number;
  taskCount: number;
  onEdit: () => void;
  t: any;
}) {
  const router = useRouter();
  const { can } = useAuth();

  return (
    <div
      style={{
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 14, padding: "20px 22px", cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        position: "relative",
      }}
      onClick={() => router.push(`/spaces/${space._id}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = space.color ?? "var(--accent)";
        e.currentTarget.style.boxShadow = `0 0 0 1px ${space.color ?? "var(--accent)"}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border2)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Color accent */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        borderRadius: "14px 14px 0 0",
        background: space.color ?? "var(--accent)",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>{space.icon ?? "📁"}</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>
              {space.name}
            </h3>
          </div>
          {space.description && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              {space.description}
            </p>
          )}
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>{projectCount}</span> {projectCount !== 1 ? t.spacesPage.projects : t.spacesPage.project}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>{taskCount}</span> {taskCount !== 1 ? t.spacesPage.tasks : t.spacesPage.task}
            </span>
          </div>
        </div>

        {can("space.edit") && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", padding: 4, borderRadius: 6,
              flexShrink: 0,
            }}
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        marginTop: 16, color: space.color ?? "var(--accent)", fontSize: 11, fontWeight: 600,
      }}>
        <span>{t.spacesPage.openSpace}</span>
        <ChevronRight size={12} />
      </div>
    </div>
  );
}

function NewSpaceModal({ onClose, t }: { onClose: () => void; t: any }) {
  const { user, orgId } = useAuth();
  const createSpace = useMutation(api.spaces.create);
  const [form, setForm] = useState({
    name: "", description: "", color: SPACE_COLORS[0], icon: SPACE_ICONS[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !user?.memberId || !orgId) return;
    setLoading(true); setError("");
    try {
      await createSpace({
        orgId,
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
        color:       form.color,
        icon:        form.icon,
        createdBy:   user.memberId as Id<"members">,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create space.");
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 16, padding: "28px 32px", width: 460, maxWidth: "calc(100vw - 40px)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            {t.spacesPage.createSpace}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Icon picker */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
              {t.spacesPage.icon}
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SPACE_ICONS.map((icon) => (
                <button
                  key={icon} type="button"
                  onClick={() => setForm({ ...form, icon })}
                  style={{
                    fontSize: 18, padding: "4px 6px", borderRadius: 7, cursor: "pointer",
                    border: form.icon === icon ? "2px solid var(--accent)" : "2px solid transparent",
                    background: form.icon === icon ? "var(--accent-bg)" : "var(--surface2)",
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
              {t.spacesPage.color}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {SPACE_COLORS.map((color) => (
                <button
                  key={color} type="button"
                  onClick={() => setForm({ ...form, color })}
                  style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: color, border: "none", cursor: "pointer",
                    outline: form.color === color ? `2px solid ${color}` : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
              {t.spacesPage.name}
            </label>
            <input
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t.spacesPage.namePlaceholder}
              required autoFocus
              style={{
                width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text)",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
              {t.spacesPage.description}
            </label>
            <textarea
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t.spacesPage.whatDoesThisSpaceCover}
              rows={2}
              style={{
                width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text)",
                outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
              }}
            />
          </div>

          {error && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "var(--surface2)", border: "1px solid var(--border2)",
              color: "var(--text-muted)", cursor: "pointer",
            }}>
              {t.cancel}
            </button>
            <button type="submit" disabled={loading} style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "var(--accent)", color: "#fff", border: "none", cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? t.creating : t.spacesPage.createSpace}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpacesPage() {
  const { user, orgId, can } = useAuth();
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();

  const spaces   = useQuery(api.spaces.list, orgId ? { orgId } : "skip") ?? [];
  const projects = useQuery(
    api.projects.listForViewer,
    orgId && user?.memberId ? { orgId, viewerId: user.memberId as Id<"members"> } : "skip"
  ) ?? [];
  const allTasks = useQuery(api.tasks.listAllTasks, orgId ? { orgId } : "skip") ?? [];

  const [showNewSpace, setShowNewSpace] = useState(false);

  // Auto-open modal if ?new=space in URL
  useEffect(() => {
    if (searchParams.get("new") === "space") setShowNewSpace(true);
  }, [searchParams]);

  const projectCountForSpace = (spaceId: string) =>
    projects.filter((p) => p.spaceId === spaceId && p.status !== "archived").length;

  const taskCountForSpace = (spaceId: string) => {
    const projectIds = new Set(
      projects.filter((p) => p.spaceId === spaceId).map((pk) => pk._id)
    );
    return allTasks.filter((tk) => tk.projectId && projectIds.has(tk.projectId)).length;
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)" }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: "auto", padding: "32px 36px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
              {t.spacesPage.title}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              {t.spacesPage.subtitle}
            </p>
          </div>
          {can("space.create") && (
            <button
              onClick={() => setShowNewSpace(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              <Plus size={14} /> {t.spacesPage.newSpace}
            </button>
          )}
        </div>

        {/* Spaces grid */}
        {spaces.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 20px",
            color: "var(--text-muted)", fontSize: 13,
          }}>
            <FolderOpen size={40} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
            <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{t.spacesPage.noSpacesYet}</p>
            <p style={{ margin: 0, fontSize: 12 }}>
              {can("space.create")
                ? t.spacesPage.createFirstSpace
                : t.spacesPage.noSpacesCreated}
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {spaces.map((space) => (
              <SpaceCard
                key={space._id}
                space={space}
                projectCount={projectCountForSpace(space._id)}
                taskCount={taskCountForSpace(space._id)}
                onEdit={() => router.push(`/spaces/${space._id}`)}
                t={t}
              />
            ))}
          </div>
        )}
      </main>

      {showNewSpace && <NewSpaceModal onClose={() => setShowNewSpace(false)} t={t} />}
    </div>
  );
}
