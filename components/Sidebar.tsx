"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, CheckSquare, Users, TrendingUp, Settings,
  Bell, Sun, Moon, LogOut, CalendarDays, ChevronDown,
  ChevronRight, Plus, Lock, Info, X, CheckCheck, Pencil,
  Star, Search, ArrowRight, Hash, Folder, Command,
  MoreHorizontal, Archive, ExternalLink, Link as LinkIcon,
  CheckCircle, Building2, Target, Zap, Brain, Flame,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";
import { useLocale } from "@/components/LocaleProvider";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Favorites hook (localStorage-backed per user)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function useFavorites(memberId: string | undefined) {
  const key = `mc-favorites-${memberId ?? "anon"}`;
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setIds(JSON.parse(stored));
    } catch {}
  }, [key]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);

  const isFav = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, isFav };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Quick Switcher (Cmd+K)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SwitcherItem {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: "page" | "project" | "space";
  section: string;
}

function QuickSwitcher({
  onClose,
  items,
}: {
  onClose: () => void;
  items: SwitcherItem[];
}) {
  const { t } = useLocale();
  const [query, setQuery]     = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.sublabel?.toLowerCase().includes(q)) ||
        item.section.toLowerCase().includes(q)
    );
  }, [query, items]);

  // Reset selection when results change
  useEffect(() => { setSelected(0); }, [filtered.length]);

  const go = useCallback((item: SwitcherItem) => {
    onClose();
    router.push(item.href);
  }, [onClose, router]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && filtered[selected]) {
      go(filtered[selected]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [filtered, selected, go, onClose]);

  // Group filtered items by section
  const grouped = useMemo(() => {
    const map = new Map<string, SwitcherItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.section) ?? [];
      arr.push(item);
      map.set(item.section, arr);
    }
    return map;
  }, [filtered]);

  let globalIdx = -1;

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "min(20vh, 140px)", zIndex: 9999,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 520, maxWidth: "calc(100vw - 32px)",
          maxHeight: "min(480px, 60vh)",
          background: "var(--surface)", border: "1px solid var(--border2)",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
          display: "flex", flexDirection: "column",
          animation: "qsIn 0.15s ease both",
        }}
      >
        {/* Search input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px", borderBottom: "1px solid var(--border)",
        }}>
          <Search size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t.sidebar.searchPlaceholder}
            style={{
              flex: 1, background: "transparent", border: "none",
              fontSize: 15, color: "var(--text)", outline: "none",
              fontFamily: "inherit", letterSpacing: "-0.01em",
            }}
          />
          <kbd style={{
            fontSize: 10, fontWeight: 600, padding: "2px 6px",
            borderRadius: 4, background: "var(--surface3)",
            border: "1px solid var(--border2)", color: "var(--text-dim)",
            fontFamily: "inherit",
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: "32px 20px", textAlign: "center",
            }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 4px" }}>
                {t.sidebar.noResultsFor} "{query}"
              </p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                {t.sidebar.tryDifferent}
              </p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([section, items]) => (
              <div key={section}>
                <div style={{
                  padding: "8px 16px 4px",
                  fontSize: 10.5, fontWeight: 650, color: "var(--text-dim)",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {section}
                </div>
                {items.map((item) => {
                  globalIdx++;
                  const idx = globalIdx;
                  const isSelected = idx === selected;
                  return (
                    <div
                      key={item.id}
                      onClick={() => go(item)}
                      onMouseEnter={() => setSelected(idx)}
                      className="qs-item"
                      data-selected={isSelected ? "true" : undefined}
                    >
                      {item.icon === "project" && <Folder size={14} className="qs-item-icon" />}
                      {item.icon === "space"   && <Hash size={14} className="qs-item-icon" />}
                      {item.icon === "page"    && <ArrowRight size={14} className="qs-item-icon" />}
                      <span className="qs-item-label">{item.label}</span>
                      {item.sublabel && (
                        <span className="qs-item-sub">{item.sublabel}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: "8px 16px", borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12,
          fontSize: 10.5, color: "var(--text-dim)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <kbd className="qs-kbd">↑</kbd><kbd className="qs-kbd">↓</kbd> {t.sidebar.navigate}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <kbd className="qs-kbd">↵</kbd> {t.sidebar.open}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <kbd className="qs-kbd">esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Create Space Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CreateSpaceModal({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const { user, orgId } = useAuth();
  const createSpace = useMutation(api.spaces.create);

  const PERMISSION_OPTIONS = [
    { value: "full_edit", label: t.createSpace.fullEdit },
    { value: "comment",   label: t.createSpace.commentOnly },
    { value: "view",      label: t.createSpace.viewOnly },
  ];

  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [permission,  setPermission]  = useState("full_edit");
  const [isPrivate,   setIsPrivate]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);
  const avatarLetter = name.trim()[0]?.toUpperCase() ?? "S";

  const handleSubmit = async () => {
    if (!name.trim() || !user?.memberId || !orgId) return;
    setLoading(true); setError("");
    try {
      await createSpace({
        orgId,
        name: name.trim(), description: description.trim() || undefined,
        icon: avatarLetter, isPrivate, permission,
        createdBy: user.memberId as Id<"members">,
      });
      onClose();
    } catch (err: any) { setError(err?.message ?? t.sidebar.failedToCreateSpace); }
    setLoading(false);
  };

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)", borderRadius: 20,
        width: 540, maxWidth: "calc(100vw - 32px)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        overflow: "hidden", border: "1px solid var(--border2)",
      }}>
        <div style={{ padding: "28px 28px 20px", position: "relative" }}>
          <button onClick={onClose} className="sb-icon-btn" style={{ position: "absolute", top: 20, right: 20, width: 32, height: 32, borderRadius: "50%" }}>
            <X size={15} />
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>{t.createSpace.title}</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
            {t.createSpace.description}
          </p>
        </div>
        <div style={{ padding: "0 28px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>{t.createSpace.iconAndName}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: "var(--surface2)", border: "1.5px solid var(--border2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, color: "var(--text-muted)", userSelect: "none",
              }}>{avatarLetter}</div>
              <input
                ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onClose(); }}
                placeholder="e.g. Marketing, Engineering, HR" className="sb-modal-input"
              />
            </div>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
              {t.createSpace.descriptionLabel} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
            </p>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="sb-modal-input" style={{ resize: "none", width: "100%", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Lock size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{t.createSpace.defaultPermission}</span>
            <Info size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
            <div style={{ marginLeft: "auto" }}>
              <select value={permission} onChange={(e) => setPermission(e.target.value)}
                style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "var(--text)", cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
                {PERMISSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{t.createSpace.makePrivate}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.createSpace.privateHint}</p>
            </div>
            <button onClick={() => setIsPrivate(!isPrivate)} style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0, position: "relative",
              background: isPrivate ? "var(--accent)" : "var(--border2)", transition: "background 0.2s",
            }}>
              <span style={{ position: "absolute", top: 3, left: isPrivate ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </button>
          </div>
          {error && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{error}</p>}
        </div>
        <div style={{ borderTop: "1px solid var(--border)", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button style={{ background: "none", border: "none", fontSize: 13, color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>{t.createSpace.useTemplates}</button>
          <button onClick={handleSubmit} disabled={!name.trim() || loading} className="sb-primary-btn"
            style={{ opacity: !name.trim() || loading ? 0.35 : 1, cursor: !name.trim() || loading ? "not-allowed" : "pointer" }}>
            {loading ? t.creating : t.createSpace.continue}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Create Project Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CreateProjectModal({ spaceId, onClose }: { spaceId: Id<"spaces">; onClose: () => void }) {
  const { t } = useLocale();
  const { user, orgId } = useAuth();
  const members = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];
  const createProject = useMutation(api.projects.create);
  const router = useRouter();

  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState(user?.memberId ?? "");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !user?.memberId || !orgId) return;
    setLoading(true);
    try {
      const projectId = await createProject({
        orgId,
        spaceId, name: name.trim(),
        ownerId: (ownerId || user.memberId) as Id<"members">,
        createdBy: user.memberId as Id<"members">,
      });
      onClose();
      router.push(`/projects/${projectId}`);
    } catch {}
    setLoading(false);
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 16,
        padding: "24px 26px", width: 420, boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.createProject.title}</h3>
          <button onClick={onClose} className="sb-icon-btn" style={{ width: 28, height: 28 }}><X size={14} /></button>
        </div>
        <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onClose(); }}
          placeholder={t.createProject.namePlaceholder} className="sb-modal-input" />
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            {t.createProject.projectLead}
          </label>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
            style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "var(--text)", cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
            {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text-muted)", cursor: "pointer" }}>{t.cancel}</button>
          <button onClick={handleSubmit} disabled={!name.trim() || loading} className="sb-primary-btn"
            style={{ opacity: !name.trim() || loading ? 0.35 : 1, cursor: !name.trim() || loading ? "not-allowed" : "pointer" }}>
            {loading ? t.creating : t.create}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Spaces + Projects tree (with favorites & truncation)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MAX_VISIBLE_PROJECTS = 4;

// Distinct color palette for space icons
const SPACE_COLORS = [
  { bg: "var(--accent-bg)",  text: "var(--accent)", border: "var(--accent-border)" },  // Indigo
  { bg: "rgba(16,185,129,0.12)",  text: "#10b981", border: "rgba(16,185,129,0.22)" },  // Emerald
  { bg: "rgba(245,158,11,0.12)",  text: "var(--status-warning)", border: "rgba(245,158,11,0.22)" },  // Amber
  { bg: "rgba(239,68,68,0.12)",   text: "var(--status-danger)", border: "rgba(239,68,68,0.22)"  },  // Red
  { bg: "rgba(168,85,247,0.12)",  text: "#a855f7", border: "rgba(168,85,247,0.22)" },  // Purple
  { bg: "rgba(14,165,233,0.12)",  text: "#0ea5e9", border: "rgba(14,165,233,0.22)" },  // Sky
  { bg: "rgba(236,72,153,0.12)",  text: "#ec4899", border: "rgba(236,72,153,0.22)" },  // Pink
  { bg: "rgba(20,184,166,0.12)",  text: "#14b8a6", border: "rgba(20,184,166,0.22)" },  // Teal
];

function getSpaceColor(index: number) {
  return SPACE_COLORS[index % SPACE_COLORS.length];
}

function SpacesTree({
  onCreateSpace,
  favorites,
}: {
  onCreateSpace: () => void;
  favorites: ReturnType<typeof useFavorites>;
}) {
  const { t } = useLocale();
  const { user, isAdmin, orgId, can } = useAuth();
  const pathname = usePathname();

  const spaces   = useQuery(api.spaces.list, orgId ? { orgId } : "skip") ?? [];
  const canArchiveSpaces = can("space.archive");
  const allSpaces = useQuery(api.spaces.list, canArchiveSpaces && orgId ? { orgId, includeArchived: true } : "skip") ?? [];
  const archivedSpaces = allSpaces.filter((s) => s.archivedAt);
  const projects = useQuery(
    api.projects.listForViewer,
    user?.memberId && orgId ? { orgId, viewerId: user.memberId as Id<"members"> } : "skip"
  ) ?? [];

  const [collapsed,          setCollapsed]          = useState<Record<string, boolean>>({});
  const [expanded,           setExpanded]           = useState<Record<string, boolean>>({});
  const [addingProjectSpace, setAddingProjectSpace] = useState<string | null>(null);
  const [editingProjectId,   setEditingProjectId]   = useState<string | null>(null);
  const [editingName,        setEditingName]        = useState("");

  // Space rename & context menu state (admin only)
  const [editingSpaceId,     setEditingSpaceId]     = useState<string | null>(null);
  const [editingSpaceName,   setEditingSpaceName]   = useState("");
  const [spaceMenuId,        setSpaceMenuId]        = useState<string | null>(null);
  const [linkCopied,         setLinkCopied]         = useState(false);

  const updateProject = useMutation(api.projects.update);
  const updateSpace   = useMutation(api.spaces.update);
  const archiveSpace  = useMutation(api.spaces.archive);
  const deleteSpaceMut = useMutation(api.spaces.deleteSpace);

  const startEditSpace = (id: string, currentName: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setEditingSpaceId(id);
    setEditingSpaceName(currentName);
    setSpaceMenuId(null);
  };

  const saveSpaceName = async (id: string) => {
    const trimmed = editingSpaceName.trim();
    if (trimmed && orgId) await updateSpace({ orgId, spaceId: id as Id<"spaces">, name: trimmed });
    setEditingSpaceId(null);
  };

  const handleArchiveSpace = async (id: string) => {
    if (orgId) await archiveSpace({ orgId, spaceId: id as Id<"spaces">, archive: true });
    setSpaceMenuId(null);
  };

  const copySpaceLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/spaces/${id}`);
    setLinkCopied(true);
    setTimeout(() => { setLinkCopied(false); setSpaceMenuId(null); }, 1200);
  };

  // Close space menu on outside click
  useEffect(() => {
    if (!spaceMenuId) return;
    const handler = () => setSpaceMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [spaceMenuId]);

  const startEditProject = (id: string, currentName: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setEditingProjectId(id);
    setEditingName(currentName);
  };

  const saveProjectName = async (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed) await updateProject({ projectId: id as Id<"projects">, name: trimmed });
    setEditingProjectId(null);
  };

  const toggleSpace   = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const toggleExpand  = (id: string) => setExpanded((c) => ({ ...c, [id]: !c[id] }));
  const canEditProjects = can("project.create");
  const canManageSpaces = can("space.edit");

  // Determine which space contains the active project (auto-expand)
  const activeProjectId = pathname.startsWith("/projects/") ? pathname.split("/")[2] : null;
  const activeSpaceId = activeProjectId
    ? projects.find((p) => p._id === activeProjectId)?.spaceId
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Section label */}
      <div className="sb-section-header">
        <span className="sb-section-label">{t.sidebar.spaces}</span>
        {canManageSpaces && (
          <button onClick={onCreateSpace} title="Create space" className="sb-section-action">
            <Plus size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      {spaces.length === 0 && (
        <div style={{ padding: "4px 8px" }}>
          {canManageSpaces ? (
            <button onClick={onCreateSpace} className="sb-empty-btn">{t.sidebar.createFirstSpace}</button>
          ) : (
            <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0, padding: "0 4px" }}>{t.sidebar.noSpaces}</p>
          )}
        </div>
      )}

      {spaces.map((space, spaceIndex) => {
        const spaceProjects = projects.filter(
          (p) => p.spaceId === space._id && p.status !== "archived"
        );
        const isOpen = !collapsed[space._id];
        const isActiveSpace = activeSpaceId === space._id;
        const spaceColor = getSpaceColor(spaceIndex);

        // Smart truncation: show all if expanded or if this space has the active project
        const showAll = expanded[space._id] || isActiveSpace;
        const visibleProjects = showAll ? spaceProjects : spaceProjects.slice(0, MAX_VISIBLE_PROJECTS);
        const hiddenCount = spaceProjects.length - MAX_VISIBLE_PROJECTS;

        return (
          <div key={space._id}>
            <div className="sb-space-row" style={{ position: "relative" }}>
              <button onClick={() => toggleSpace(space._id)} className="sb-chevron">
                {isOpen ? <ChevronDown size={11} strokeWidth={2.5} /> : <ChevronRight size={11} strokeWidth={2.5} />}
              </button>
              <div className="sb-space-icon" style={{ background: spaceColor.bg, color: spaceColor.text, borderColor: spaceColor.border }}>
                {(space.icon && /^[a-zA-Z0-9]/.test(space.icon) ? space.icon[0].toUpperCase() : space.name[0]?.toUpperCase()) ?? "S"}
              </div>

              {/* Inline rename input (admin only) */}
              {editingSpaceId === space._id ? (
                <input
                  autoFocus
                  value={editingSpaceName}
                  onChange={(e) => setEditingSpaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveSpaceName(space._id);
                    if (e.key === "Escape") setEditingSpaceId(null);
                  }}
                  onBlur={() => saveSpaceName(space._id)}
                  className="sb-space-edit-input"
                />
              ) : (
                <span className="sb-space-name">{space.name}</span>
              )}

              {spaceProjects.length > 0 && editingSpaceId !== space._id && (
                <span className="sb-space-count">{spaceProjects.length}</span>
              )}

              {/* Context menu trigger (admin only) */}
              {canManageSpaces && editingSpaceId !== space._id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSpaceMenuId(spaceMenuId === space._id ? null : space._id);
                  }}
                  className="sb-space-menu-btn"
                  title="Space options"
                >
                  <MoreHorizontal size={13} />
                </button>
              )}

              {canEditProjects && editingSpaceId !== space._id && (
                <button onClick={(e) => { e.stopPropagation(); setAddingProjectSpace(space._id); }}
                  title="Add project" className="sb-space-add">
                  <Plus size={12} strokeWidth={2} />
                </button>
              )}

              {/* Space context menu dropdown */}
              {spaceMenuId === space._id && (
                <div className="sb-space-dropdown" onClick={(e) => e.stopPropagation()}>
                  <a href={`/spaces/${space._id}`} target="_blank" rel="noopener noreferrer" className="sb-dropdown-item">
                    <ExternalLink size={13} /> {t.sidebar.openSpace}
                  </a>
                  <button className="sb-dropdown-item" onClick={() => copySpaceLink(space._id)}>
                    <LinkIcon size={13} /> {linkCopied ? t.copied : t.sidebar.copyLink}
                  </button>
                  <button className="sb-dropdown-item" onClick={(e) => startEditSpace(space._id, space.name, e)}>
                    <Pencil size={13} /> {t.sidebar.rename}
                  </button>
                  <div className="sb-dropdown-divider" />
                  <button className="sb-dropdown-item sb-dropdown-danger" onClick={() => handleArchiveSpace(space._id)}>
                    <Archive size={13} /> {t.sidebar.archive}
                  </button>
                </div>
              )}
            </div>

            {isOpen && (
              <div className="sb-project-list">
                {spaceProjects.length === 0 && (
                  <p className="sb-no-projects">{t.sidebar.noProjects}</p>
                )}
                {visibleProjects.map((project) => {
                  const href = `/projects/${project._id}`;
                  const isActive = pathname === href || pathname.startsWith(`${href}/`);
                  const isEditing = editingProjectId === project._id;
                  const isFav = favorites.isFav(project._id);

                  const statusColor =
                    project.status === "active" ? "var(--status-success)"
                    : project.status === "on_hold" ? "var(--status-warning)"
                    : "var(--text-dim)";

                  const dot = (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: statusColor }} />
                  );

                  if (isEditing) {
                    return (
                      <div key={project._id} className="sb-project-row" data-active="true">
                        {dot}
                        <input autoFocus value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveProjectName(project._id); if (e.key === "Escape") setEditingProjectId(null); }}
                          onBlur={() => saveProjectName(project._id)}
                          className="sb-project-edit-input" />
                      </div>
                    );
                  }

                  return (
                    <div key={project._id} className="sb-project-row" data-active={isActive ? "true" : undefined}>
                      <Link href={href} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
                        {dot}
                        <span className="sb-project-name" data-active={isActive ? "true" : undefined}>
                          {project.name}
                        </span>
                      </Link>
                      {/* Favorite star */}
                      <button
                        className="sb-project-star"
                        data-fav={isFav ? "true" : undefined}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); favorites.toggle(project._id); }}
                        title={isFav ? t.sidebar.unstar : t.sidebar.star}
                      >
                        <Star size={11} fill={isFav ? "currentColor" : "none"} />
                      </button>
                      {canEditProjects && (
                        <button className="sb-project-edit"
                          onClick={(e) => startEditProject(project._id, project.name, e)} title="Rename">
                          <Pencil size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Show more / Show less */}
                {hiddenCount > 0 && !showAll && (
                  <button className="sb-show-more" onClick={() => toggleExpand(space._id)}>
                    {t.sidebar.showMore} {hiddenCount}...
                  </button>
                )}
                {showAll && hiddenCount > 0 && !isActiveSpace && (
                  <button className="sb-show-more" onClick={() => toggleExpand(space._id)}>
                    {t.sidebar.showLess}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Archived spaces (admin only) */}
      {canManageSpaces && archivedSpaces.length > 0 && (
        <>
          <div className="sb-section-header" style={{ marginTop: 10, opacity: 0.7 }}>
            <span className="sb-section-label">{t.sidebar.archived}</span>
          </div>
          {archivedSpaces.map((space) => (
            <div key={space._id} className="sb-space-row" style={{ opacity: 0.5 }}>
              <div style={{ width: 22 }} />
              <div className="sb-space-icon" style={{ background: "var(--surface3)", color: "var(--text-dim)", borderColor: "var(--border)" }}>
                {(space.icon && /^[a-zA-Z0-9]/.test(space.icon) ? space.icon[0].toUpperCase() : space.name[0]?.toUpperCase()) ?? "S"}
              </div>
              <span className="sb-space-name" style={{ textDecoration: "line-through" }}>{space.name}</span>
              <button
                onClick={() => orgId && archiveSpace({ orgId, spaceId: space._id as Id<"spaces">, archive: false })}
                title="Restore space"
                className="sb-space-menu-btn"
                style={{ opacity: 1, fontSize: 11, color: "var(--accent)", fontFamily: "inherit", padding: "3px 8px", borderRadius: 5 }}
              >
                {t.sidebar.restore}
              </button>
              <button
                onClick={() => {
                  if (orgId && window.confirm(t.sidebar.confirmDeleteSpace)) {
                    deleteSpaceMut({ orgId, spaceId: space._id as Id<"spaces"> });
                  }
                }}
                title="Delete space permanently"
                className="sb-space-menu-btn"
                style={{ opacity: 1, fontSize: 11, color: "#ef4444", fontFamily: "inherit", padding: "3px 8px", borderRadius: 5 }}
              >
                {t.sidebar.deleteSpace}
              </button>
            </div>
          ))}
        </>
      )}

      {addingProjectSpace && (
        <CreateProjectModal
          spaceId={addingProjectSpace as Id<"spaces">}
          onClose={() => setAddingProjectSpace(null)}
        />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Notification Panel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NotificationPanel({ isAdmin, memberId, onClose, orgId, canApprove }: {
  isAdmin: boolean; memberId: string; onClose: () => void; orgId: Id<"organizations"> | null; canApprove?: boolean;
}) {
  const { t } = useLocale();
  const router   = useRouter();
  const adminNotifs  = useQuery(api.notifications.listAdminNotifications, isAdmin && orgId ? { orgId } : "skip") ?? [];
  const memberNotifs = useQuery(
    api.notifications.listMemberNotifications,
    !isAdmin && memberId ? { memberId: memberId as Id<"members"> } : "skip"
  ) ?? [];
  const notifications = isAdmin ? adminNotifs : memberNotifs;
  const markRead    = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const approveTask = useMutation(api.tasks.updateTaskStatus);

  const handleMarkAll = () => {
    if (orgId) {
      markAllRead({ orgId, role: isAdmin ? "admin" : "member", memberId: isAdmin ? undefined : memberId as Id<"members"> });
    }
  };

  const unread = notifications.filter((n) => !n.read).length;

  const TYPE_META: Record<string, { icon: string; accent: string }> = {
    task_submitted:            { icon: "\ud83d\udce8", accent: "var(--status-warning)" },
    task_approved:             { icon: "\u2705",       accent: "var(--status-success)" },
    task_rejected:             { icon: "\u274c",       accent: "var(--status-danger)" },
    task_assigned:             { icon: "\ud83d\udc64", accent: "var(--status-info)" },
    task_mention:              { icon: "\ud83d\udcac", accent: "var(--accent-light)" },
    comment_added:             { icon: "\ud83d\udcac", accent: "var(--accent-light)" },
    due_soon:                  { icon: "\u23f0",       accent: "var(--status-warning)" },
    weekly_digest_thursday:    { icon: "\ud83d\udcc5", accent: "var(--accent)" },
    weekly_digest_sunday:      { icon: "\ud83d\udcc5", accent: "var(--accent)" },
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000)     return t.notificationsPage.justNow;
    if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}${t.notificationsPage.mAgo}`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}${t.notificationsPage.hAgo}`;
    return `${Math.floor(diff / 86_400_000)}${t.notificationsPage.dAgo}`;
  };

  /* Group notifications: Today / Yesterday / Earlier */
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const todayMs     = today.getTime();
  const yesterdayMs  = yesterday.getTime();

  type GroupedNotifs = { label: string; items: typeof notifications };
  const grouped: GroupedNotifs[] = [];
  const todayItems     = notifications.filter((n) => n._creationTime >= todayMs);
  const yesterdayItems = notifications.filter((n) => n._creationTime >= yesterdayMs && n._creationTime < todayMs);
  const earlierItems   = notifications.filter((n) => n._creationTime < yesterdayMs);
  if (todayItems.length > 0)     grouped.push({ label: t.sidebar.today,     items: todayItems     });
  if (yesterdayItems.length > 0) grouped.push({ label: t.sidebar.yesterday, items: yesterdayItems });
  if (earlierItems.length > 0)   grouped.push({ label: t.sidebar.earlier,   items: earlierItems   });

  const handleNotifClick = (n: (typeof notifications)[0]) => {
    if (!n.read) markRead({ notificationId: n._id });
    if (n.taskId) {
      onClose();
      router.push(`/tasks/${n.taskId}`);
    }
  };

  const handleInlineApprove = async (n: (typeof notifications)[0]) => {
    if (n.taskId) {
      await approveTask({ taskId: n.taskId as Id<"tasks">, status: "completed" });
      if (!n.read) markRead({ notificationId: n._id });
    }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
      <div style={{
        position: "fixed", left: 248, bottom: 56, width: 360,
        maxHeight: "min(560px, calc(100vh - 100px))",
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 16, zIndex: 9999,
        display: "flex", flexDirection: "column",
        boxShadow: "0 16px 48px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
        animation: "popIn 0.18s ease both", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          <Bell size={14} style={{ color: "var(--text-muted)" }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            {t.sidebar.notifications}
            {unread > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 700,
                background: "var(--accent)", color: "#fff",
                borderRadius: 10, padding: "1px 7px",
              }}>
                {unread}
              </span>
            )}
          </span>
          {unread > 0 && (
            <button onClick={handleMarkAll} className="sb-notif-mark-all">
              <CheckCheck size={11} /> {t.sidebar.markAllRead}
            </button>
          )}
          <button onClick={onClose} className="sb-icon-btn" style={{ width: 26, height: 26 }}><X size={13} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {notifications.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "48px 20px", gap: 10,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "var(--surface3)", border: "1px solid var(--border2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Bell size={20} style={{ color: "var(--text-dim)" }} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", margin: 0 }}>{t.sidebar.allCaughtUp}</p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>{t.sidebar.noNotifications}</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <div style={{
                  padding: "8px 16px 4px", fontSize: 10, fontWeight: 600,
                  color: "var(--text-dim)", textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  background: "var(--surface)",
                  position: "sticky", top: 0, zIndex: 1,
                }}>
                  {group.label}
                </div>
                {group.items.map((n) => {
                  const meta = TYPE_META[n.type] ?? { icon: "\ud83d\udd14", accent: "var(--text-muted)" };
                  const isSubmission = n.type === "task_submitted" && (canApprove ?? isAdmin);
                  return (
                    <div
                      key={n._id}
                      className="sb-notif-row"
                      data-unread={!n.read ? "true" : undefined}
                      onClick={() => handleNotifClick(n)}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        cursor: n.taskId ? "pointer" : "default",
                      }}
                    >
                      {/* Accent bar */}
                      {!n.read && (
                        <span style={{
                          position: "absolute", left: 0, top: 8, bottom: 8,
                          width: 2.5, borderRadius: "0 2px 2px 0",
                          background: meta.accent,
                        }} />
                      )}

                      {/* Icon */}
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: `${meta.accent}12`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14,
                      }}>
                        {meta.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 12.5, margin: "0 0 2px", lineHeight: 1.4,
                          color: n.read ? "var(--text-muted)" : "var(--text)",
                          fontWeight: n.read ? 400 : 500,
                        }}>
                          {n.message}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{formatTime(n._creationTime)}</span>
                          {n.taskId && (
                            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                              \u2192 View task
                            </span>
                          )}
                        </div>

                        {/* Inline approve action for submitted tasks */}
                        {isSubmission && !n.read && n.taskId && (
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleInlineApprove(n); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 4,
                                padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                                color: "var(--status-success)", cursor: "pointer", fontFamily: "inherit",
                                transition: "background 0.12s",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(34,197,94,0.2)"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(34,197,94,0.1)"}
                            >
                              <CheckCircle size={11} /> Approve
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                router.push(`/tasks/${n.taskId}`);
                              }}
                              style={{
                                display: "flex", alignItems: "center", gap: 4,
                                padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                                background: "none", border: "1px solid var(--border2)",
                                color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
                                transition: "background 0.12s",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                            >
                              Review
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Unread dot */}
                      {!n.read && (
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: meta.accent, flexShrink: 0, marginTop: 4,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer: View all link */}
        {notifications.length > 0 && (
          <div style={{
            padding: "10px 16px", borderTop: "1px solid var(--border)",
            flexShrink: 0, textAlign: "center",
          }}>
            <button
              onClick={() => { onClose(); router.push("/notifications"); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: "var(--accent)",
                fontFamily: "inherit", padding: "2px 0",
                transition: "opacity 0.12s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.75"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              {t.sidebar.viewAll}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Main Sidebar
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Sidebar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const { user, logout, isAdmin, orgId, orgs, switchOrg, can } = useAuth();
  const { theme, toggle } = useTheme();
  const { signOut } = useAuthActions();

  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showNotifPanel,  setShowNotifPanel]  = useState(false);
  const [showSwitcher,    setShowSwitcher]    = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);

  const favorites = useFavorites(user?.memberId);

  // ── Data for Quick Switcher ──
  const projects = useQuery(
    api.projects.listForViewer,
    user?.memberId && orgId ? { orgId, viewerId: user.memberId as Id<"members"> } : "skip"
  ) ?? [];
  const spaces = useQuery(api.spaces.list, orgId ? { orgId } : "skip") ?? [];

  // ── Streak data ──
  const streak = useQuery(
    api.streaks.getForMember,
    user?.memberId ? { memberId: user.memberId as Id<"members"> } : "skip"
  );

  const adminUnread  = useQuery(api.notifications.countUnreadAdmin, isAdmin && orgId ? { orgId } : "skip") ?? 0;
  const memberUnread = useQuery(
    api.notifications.countUnreadMember,
    !isAdmin && user ? { memberId: user.memberId as Id<"members"> } : "skip"
  ) ?? 0;
  const unreadCount = isAdmin ? adminUnread : memberUnread;

  // Primary links — daily-use only (visible to everyone)
  const primaryLinks = [
    { href: "/",          label: t.nav.dashboard, icon: LayoutGrid   },
    { href: "/my-tasks",  label: t.nav.myTasks,   icon: CheckSquare  },
    { href: "/goals",     label: t.nav.goals,     icon: Target       },
    { href: "/calendar",  label: "Calendar",      icon: CalendarDays },
    { href: "/reflections", label: "Reflections", icon: Brain        },
  ];

  // Admin/manager tools — shown as compact icons in footer dock
  const adminTools = [
    { href: "/approvals", label: t.nav.approvals, icon: CheckSquare,  show: can("task.approve")   },
    { href: "/members",   label: "Members",       icon: Users,        show: can("member.invite") || can("member.remove") },
    { href: "/analytics", label: t.nav.analytics, icon: TrendingUp,   show: can("task.approve")   },
    { href: "/settings",  label: t.nav.settings,  icon: Settings,     show: can("settings.edit")  },
  ].filter((l) => l.show);

  // Combined for Quick Switcher (keep all pages searchable via Cmd+K)
  const links = [
    ...primaryLinks.map((l) => ({ ...l, show: true })),
    ...adminTools,
  ];

  // Build switcher items
  const switcherItems = useMemo<SwitcherItem[]>(() => {
    const items: SwitcherItem[] = [];
    // Pages — only visible to users with admin tools access in the switcher
    if (adminTools.length > 0) {
      for (const l of links) {
        items.push({ id: `page-${l.href}`, label: l.label, href: l.href, icon: "page", section: "Pages" });
      }
    }
    // Build space name lookup
    const spaceMap = new Map(spaces.map((s) => [s._id, s.name]));
    // Favorites first
    const favProjects = projects.filter((p) => favorites.isFav(p._id));
    for (const p of favProjects) {
      items.push({
        id: `fav-${p._id}`, label: p.name,
        sublabel: spaceMap.get(p.spaceId) ?? "",
        href: `/projects/${p._id}`, icon: "project", section: "Favorites",
      });
    }
    // All projects
    for (const p of projects.filter((p) => p.status !== "archived")) {
      items.push({
        id: `proj-${p._id}`, label: p.name,
        sublabel: spaceMap.get(p.spaceId) ?? "",
        href: `/projects/${p._id}`, icon: "project", section: "Projects",
      });
    }
    // Spaces
    for (const s of spaces) {
      items.push({ id: `space-${s._id}`, label: s.name, href: `/spaces/${s._id}`, icon: "space", section: "Spaces" });
    }
    return items;
  }, [links, projects, spaces, favorites, adminTools]);

  // Close org switcher on outside click
  useEffect(() => {
    if (!showOrgSwitcher) return;
    const handler = () => setShowOrgSwitcher(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showOrgSwitcher]);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSwitcher((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Favorited projects for the Favorites section
  const favProjects = projects.filter((p) => favorites.isFav(p._id));

  return (
    <>
      {/* ── Scoped styles ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* ── Base ── */
        .sb {
          height: 100vh; width: 240px; min-width: 240px;
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          z-index: 40;
          font-feature-settings: "cv02", "cv03", "cv04", "cv11";
          -webkit-font-smoothing: antialiased;
        }

        /* ── Workspace header ── */
        .sb-header {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 16px 14px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .sb-logo {
          width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--accent), #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 800; color: #fff;
          letter-spacing: -0.02em;
          box-shadow: 0 1px 3px rgba(99,102,241,0.25);
        }
        .sb-ws-name {
          font-size: 13.5px; font-weight: 700; color: var(--text);
          margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          letter-spacing: -0.01em;
        }
        .sb-ws-role {
          font-size: 10.5px; color: var(--text-muted); margin: 0;
          letter-spacing: 0.01em;
        }

        /* ── Search trigger ── */
        .sb-search-trigger {
          display: flex; align-items: center; gap: 8px;
          margin: 10px 8px 2px; padding: 7px 10px;
          border-radius: 8px; cursor: pointer;
          background: var(--surface2);
          border: 1px solid var(--border);
          transition: border-color 0.15s, background 0.1s;
        }
        .sb-search-trigger:hover {
          border-color: var(--border2);
          background: var(--surface3);
        }
        .sb-search-trigger-text {
          flex: 1; font-size: 12.5px; color: var(--text-dim);
          letter-spacing: -0.005em;
        }
        .sb-search-trigger:hover .sb-search-trigger-text { color: var(--text-muted); }
        .sb-search-kbd {
          font-size: 10px; font-weight: 600; padding: 1px 5px;
          border-radius: 4px; background: var(--surface);
          border: 1px solid var(--border); color: var(--text-dim);
          font-family: inherit; line-height: 1.5;
        }

        /* ── Navigation links ── */
        .sb-nav { flex: 1; overflow-y: auto; padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 1px; }
        .sb-link {
          display: flex; align-items: center; gap: 10px;
          padding: 7px 10px; border-radius: 8px;
          text-decoration: none;
          transition: background 0.1s, color 0.1s;
          cursor: pointer; border: none; width: 100%;
          background: transparent;
          position: relative;
        }
        .sb-link:hover { background: var(--surface2); }
        .sb-link[data-active="true"] { background: var(--surface2); }
        .sb-link[data-active="true"]::before {
          content: '';
          position: absolute; left: 0; top: 8px; bottom: 8px;
          width: 2px; border-radius: 0 1px 1px 0;
          background: var(--accent);
        }
        .sb-link-icon {
          width: 16px; height: 16px; flex-shrink: 0;
          color: var(--text-dim); transition: color 0.1s;
        }
        .sb-link[data-active="true"] .sb-link-icon { color: var(--text); }
        .sb-link:hover .sb-link-icon { color: var(--text-muted); }
        .sb-link-label {
          flex: 1; font-size: 13px; font-weight: 450;
          color: var(--text-muted); transition: color 0.1s;
          letter-spacing: -0.005em;
        }
        .sb-link[data-active="true"] .sb-link-label { color: var(--text); font-weight: 550; }
        .sb-link:hover .sb-link-label { color: var(--text); }

        .sb-badge {
          font-size: 10px; font-weight: 700; line-height: 1;
          background: var(--accent); color: #fff;
          border-radius: 10px; padding: 2px 6px; flex-shrink: 0;
          min-width: 16px; text-align: center;
        }

        /* ── Divider ── */
        .sb-divider { height: 1px; background: var(--border); margin: 6px 8px 8px; }

        /* ── Favorites section ── */
        .sb-fav-section {
          display: flex; flex-direction: column; gap: 1px;
          margin-bottom: 2px;
        }
        .sb-fav-row {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 10px; border-radius: 7px; margin: 0 4px;
          cursor: pointer; transition: background 0.1s;
          text-decoration: none;
        }
        .sb-fav-row:hover { background: var(--surface2); }
        .sb-fav-row[data-active="true"] { background: var(--surface2); }
        .sb-fav-star { color: var(--status-warning); flex-shrink: 0; width: 12px; height: 12px; }
        .sb-fav-name {
          flex: 1; font-size: 12.5px; font-weight: 450; color: var(--text-muted);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          letter-spacing: -0.005em; transition: color 0.1s;
        }
        .sb-fav-row:hover .sb-fav-name { color: var(--text); }
        .sb-fav-row[data-active="true"] .sb-fav-name { color: var(--text); font-weight: 500; }

        /* ── Section header ── */
        .sb-section-header {
          display: flex; align-items: center;
          padding: 2px 8px 6px 12px;
        }
        .sb-section-label {
          flex: 1; font-size: 10.5px; font-weight: 650;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-dim);
        }
        .sb-section-action {
          background: none; border: none; cursor: pointer;
          color: var(--text-dim); padding: 2px 4px; border-radius: 5px;
          display: flex; align-items: center;
          transition: color 0.1s, background 0.1s;
        }
        .sb-section-action:hover { color: var(--text-muted); background: var(--surface2); }

        /* ── Space row ── */
        .sb-space-row {
          display: flex; align-items: center; gap: 0;
          border-radius: 8px; margin: 0 4px;
          transition: background 0.1s;
        }
        .sb-space-row:hover { background: var(--surface2); }
        .sb-chevron {
          background: none; border: none; cursor: pointer;
          padding: 6px 4px 6px 6px; color: var(--text-dim);
          display: flex; align-items: center; flex-shrink: 0;
          transition: color 0.1s;
        }
        .sb-space-row:hover .sb-chevron { color: var(--text-muted); }
        .sb-space-icon {
          width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
          border: 1px solid;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700;
          margin-right: 7px;
        }
        .sb-space-name {
          flex: 1; font-size: 12.5px; font-weight: 500;
          color: var(--text-muted);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          letter-spacing: -0.005em;
        }
        .sb-space-row:hover .sb-space-name { color: var(--text); }
        .sb-space-count {
          font-size: 10px; font-weight: 600; color: var(--text-dim);
          margin-right: 2px; flex-shrink: 0;
        }
        .sb-space-add {
          background: none; border: none; cursor: pointer;
          color: var(--text-dim); padding: 6px;
          display: flex; align-items: center; flex-shrink: 0;
          opacity: 0; transition: opacity 0.12s, color 0.1s;
        }
        .sb-space-row:hover .sb-space-add { opacity: 1; }
        .sb-space-add:hover { color: var(--text-muted); }

        /* ── Space menu button ── */
        .sb-space-menu-btn {
          background: none; border: none; cursor: pointer;
          color: var(--text-dim); padding: 4px;
          display: flex; align-items: center; flex-shrink: 0;
          opacity: 0; transition: opacity 0.12s, color 0.1s;
          border-radius: 4px;
        }
        .sb-space-row:hover .sb-space-menu-btn { opacity: 1; }
        .sb-space-menu-btn:hover { color: var(--text-muted); background: var(--surface3); }

        /* ── Space edit input ── */
        .sb-space-edit-input {
          flex: 1; min-width: 0;
          font-size: 12.5px; font-weight: 500;
          background: var(--surface2); border: 1.5px solid var(--border2);
          border-radius: 5px; padding: 2px 6px;
          color: var(--text); outline: none;
          font-family: inherit; letter-spacing: -0.005em;
        }
        .sb-space-edit-input:focus { border-color: var(--accent); }

        /* ── Space dropdown menu ── */
        .sb-space-dropdown {
          position: absolute; top: 100%; right: 4px; z-index: 100;
          background: var(--surface); border: 1px solid var(--border2);
          border-radius: 10px; padding: 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          min-width: 170px;
        }
        .sb-dropdown-item {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 7px 10px; border: none;
          background: none; border-radius: 6px; cursor: pointer;
          font-size: 12.5px; color: var(--text-muted);
          font-family: inherit; text-decoration: none;
          transition: background 0.1s, color 0.1s;
        }
        .sb-dropdown-item:hover { background: var(--surface2); color: var(--text); }
        .sb-dropdown-danger:hover { background: rgba(239,68,68,0.1); color: #f87171; }
        .sb-dropdown-divider {
          height: 1px; background: var(--border); margin: 3px 6px;
        }

        /* ── Project rows ── */
        .sb-project-list { padding-left: 20px; }
        .sb-no-projects {
          font-size: 11px; color: var(--text-dim);
          margin: 2px 4px 4px; font-style: italic; padding: 0 8px;
        }
        .sb-project-row {
          display: flex; align-items: center; gap: 7px;
          padding: 5px 8px; border-radius: 7px; margin: 1px 4px;
          transition: background 0.1s; cursor: pointer;
        }
        .sb-project-row:hover { background: var(--surface2); }
        .sb-project-row[data-active="true"] { background: var(--surface2); }
        .sb-project-name {
          font-size: 12.5px; color: var(--text-muted);
          flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-weight: 400; transition: color 0.1s; letter-spacing: -0.005em;
        }
        .sb-project-name[data-active="true"] { color: var(--text); font-weight: 500; }
        .sb-project-row:hover .sb-project-name { color: var(--text); }

        /* Star button */
        .sb-project-star {
          background: none; border: none; cursor: pointer;
          color: var(--text-dim); padding: 1px 2px;
          display: flex; flex-shrink: 0;
          opacity: 0; transition: opacity 0.1s, color 0.1s;
        }
        .sb-project-row:hover .sb-project-star { opacity: 1; }
        .sb-project-star[data-fav="true"] { opacity: 1; color: var(--status-warning); }
        .sb-project-star:hover { color: var(--status-warning); }

        .sb-project-edit {
          background: none; border: none; cursor: pointer;
          color: var(--text-dim); padding: 1px 2px;
          display: flex; flex-shrink: 0;
          opacity: 0; transition: opacity 0.1s, color 0.1s;
        }
        .sb-project-row:hover .sb-project-edit { opacity: 1; }
        .sb-project-edit:hover { color: var(--text-muted); }
        .sb-project-edit-input {
          flex: 1; background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.4); border-radius: 4px;
          outline: none; padding: 1px 6px;
          font-size: 12px; color: var(--text); font-family: inherit;
        }

        /* ── Show more ── */
        .sb-show-more {
          background: none; border: none; cursor: pointer;
          font-size: 11px; font-weight: 500; color: var(--text-dim);
          padding: 4px 8px; margin: 2px 4px;
          text-align: left; font-family: inherit;
          transition: color 0.1s;
          border-radius: 5px;
        }
        .sb-show-more:hover { color: var(--accent-light); background: rgba(99,102,241,0.06); }

        /* ── Empty state button ── */
        .sb-empty-btn {
          background: none; border: 1px dashed var(--border2);
          border-radius: 7px; padding: 7px 10px; cursor: pointer;
          color: var(--text-dim); font-size: 11px; width: 100%;
          text-align: left; font-family: inherit;
          transition: border-color 0.15s, color 0.15s;
        }
        .sb-empty-btn:hover { border-color: var(--text-dim); color: var(--text-muted); }

        /* ── Admin dock ── */
        .sb-admin-dock {
          padding: 6px 12px 8px;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
          display: flex; align-items: center; gap: 8px;
        }
        .sb-dock-label {
          font-size: 9.5px; font-weight: 650;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-dim);
          flex-shrink: 0;
        }
        .sb-dock-icons {
          display: flex; align-items: center; gap: 2px;
          margin-left: auto;
        }
        .sb-dock-btn {
          width: 32px; height: 32px; border-radius: 8px;
          border: none; cursor: pointer; background: transparent;
          color: var(--text-dim);
          display: flex; align-items: center; justify-content: center;
          transition: background 0.1s, color 0.15s;
          position: relative;
        }
        .sb-dock-btn:hover { background: var(--surface2); color: var(--text-muted); }
        .sb-dock-btn[data-active="true"] {
          background: var(--surface2); color: var(--text);
        }
        .sb-dock-btn[data-active="true"]::after {
          content: '';
          position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
          width: 4px; height: 4px; border-radius: 50%;
          background: var(--accent);
        }

        /* ── Notification button (in user row) ── */
        .sb-notif-btn {
          width: 32px; height: 32px; position: relative;
          flex-shrink: 0; border-radius: 8px;
        }
        .sb-notif-btn[data-active="true"] { background: var(--surface2); color: var(--text); }
        .sb-notif-dot {
          position: absolute; top: 4px; right: 4px;
          min-width: 14px; height: 14px; border-radius: 10px;
          background: var(--accent); color: #fff;
          font-size: 8.5px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          padding: 0 3px; line-height: 1;
          box-shadow: 0 0 0 2px var(--surface);
        }

        /* ── User row ── */
        .sb-user {
          padding: 12px 14px; border-top: 1px solid var(--border);
          display: flex; align-items: center; gap: 10px; flex-shrink: 0;
        }
        .sb-avatar {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.18);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: var(--accent-light);
        }
        .sb-user-name {
          font-size: 12.5px; font-weight: 600; color: var(--text);
          margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sb-user-role { font-size: 10.5px; color: var(--text-muted); margin: 0; }

        /* ── Footer ── */
        .sb-footer {
          padding: 8px 14px; border-top: 1px solid var(--border);
          display: flex; align-items: center; justify-content: flex-end;
          flex-shrink: 0; gap: 2px;
        }
        .sb-icon-btn {
          border-radius: 7px; border: none; cursor: pointer;
          background: transparent; color: var(--text-dim);
          display: flex; align-items: center; justify-content: center;
          transition: background 0.1s, color 0.15s;
        }
        .sb-icon-btn:hover { background: var(--surface2); color: var(--text-muted); }
        .sb-footer-btn { width: 30px; height: 30px; }

        /* ── Modal styles ── */
        .sb-modal-input {
          flex: 1; background: transparent;
          border: 1.5px solid var(--border2); border-radius: 10px;
          padding: 11px 14px; font-size: 14px; color: var(--text);
          outline: none; font-family: inherit; transition: border-color 0.15s;
        }
        .sb-modal-input:focus { border-color: var(--accent); }
        .sb-primary-btn {
          padding: 10px 24px; border-radius: 10px;
          font-size: 14px; font-weight: 700;
          background: var(--text); color: var(--bg);
          border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .sb-primary-btn:hover { opacity: 0.88; }

        /* ── Notification panel ── */
        .sb-notif-mark-all {
          background: none; border: 1px solid var(--border2); cursor: pointer;
          color: var(--text-muted); display: flex; align-items: center; gap: 4px;
          font-size: 11px; font-family: inherit; padding: 3px 8px;
          border-radius: 6px; transition: all 0.1s;
        }
        .sb-notif-mark-all:hover { background: var(--surface3); color: var(--text); }
        .sb-notif-row {
          display: flex; gap: 12px; padding: 11px 16px;
          cursor: pointer; position: relative; transition: background 0.1s;
        }
        .sb-notif-row[data-unread="true"] { background: rgba(99,102,241,0.04); }
        .sb-notif-row[data-unread="true"]:hover { background: rgba(99,102,241,0.08); }
        .sb-notif-accent {
          position: absolute; left: 0; top: 10px; bottom: 10px;
          width: 2.5px; border-radius: 0 2px 2px 0; background: var(--accent);
        }

        /* ── Quick Switcher ── */
        .qs-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 16px; cursor: pointer;
          transition: background 0.06s;
        }
        .qs-item:hover, .qs-item[data-selected="true"] {
          background: var(--surface2);
        }
        .qs-item-icon {
          width: 14px; height: 14px; flex-shrink: 0;
          color: var(--text-dim);
        }
        .qs-item[data-selected="true"] .qs-item-icon { color: var(--accent-light); }
        .qs-item-label {
          font-size: 13px; font-weight: 500; color: var(--text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .qs-item-sub {
          font-size: 11px; color: var(--text-dim); margin-left: auto;
          flex-shrink: 0;
        }
        .qs-kbd {
          font-size: 10px; font-weight: 600; padding: 1px 5px;
          border-radius: 3px; background: var(--surface3);
          border: 1px solid var(--border); color: var(--text-dim);
          font-family: inherit;
        }

        /* ── Animations ── */
        @keyframes popIn {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes qsIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      ` }} />

      {/* ── Sidebar ── */}
      <aside className="sb">

        {/* Workspace header */}
        <div className="sb-header">
          <div className="sb-logo">M</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="sb-ws-name">{t.sidebar.missionControl}</p>
            <p className="sb-ws-role">
              {user?.role === "admin" ? t.roles.admin : user?.role === "manager" ? t.roles.manager : t.roles.member}
            </p>
          </div>
        </div>

        {/* Org Switcher */}
        {orgs && orgs.length > 0 && (
          <div style={{ padding: "0 12px 12px", borderBottom: "1px solid var(--border)" }}>
            <button
              onClick={() => setShowOrgSwitcher(!showOrgSwitcher)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border2)",
                background: "var(--bg-input)",
                cursor: orgs.length > 1 ? "pointer" : "default",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (orgs.length > 1) {
                  e.currentTarget.style.borderColor = "var(--border3)";
                  e.currentTarget.style.background = "var(--bg-input-hover)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border2)";
                e.currentTarget.style.background = "var(--bg-input)";
              }}
            >
              <Building2 size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {orgs.find((o) => o.orgId === orgId)?.orgName || t.sidebar.selectOrg}
              </span>
              {orgs.length > 1 && <ChevronDown size={12} style={{ flexShrink: 0 }} />}
            </button>

            {/* Org Dropdown */}
            {showOrgSwitcher && orgs.length > 1 && (
              <div
                style={{
                  position: "absolute",
                  top: "124px",
                  left: 12,
                  right: 12,
                  background: "var(--surface)",
                  border: "1px solid var(--border2)",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  zIndex: 1000,
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {orgs.map((org) => (
                  <button
                    key={org.orgId}
                    onClick={() => {
                      switchOrg(org.orgId);
                      setShowOrgSwitcher(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      background: orgId === org.orgId ? "var(--bg-selected)" : "transparent",
                      color: "var(--text)",
                      fontSize: 12,
                      textAlign: "left",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border3)",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (orgId !== org.orgId) {
                        e.currentTarget.style.background = "var(--bg-hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = orgId === org.orgId ? "var(--bg-selected)" : "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Building2 size={13} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{org.orgName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{org.role}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search trigger (opens Cmd+K) */}
        <div className="sb-search-trigger" onClick={() => setShowSwitcher(true)} role="button" tabIndex={0}>
          <Search size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <span className="sb-search-trigger-text">Search...</span>
          <kbd className="sb-search-kbd">
            <Command size={9} style={{ display: "inline", verticalAlign: "middle" }} />K
          </kbd>
        </div>

        {/* ── Work-focused navigation ── */}
        <nav className="sb-nav">

          {/* Primary links — daily use only */}
          {primaryLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div className="sb-link" data-active={isActive ? "true" : undefined}>
                  <Icon size={16} strokeWidth={1.8} className="sb-link-icon" />
                  <span className="sb-link-label">{label}</span>
                </div>
              </Link>
            );
          })}

          <div className="sb-divider" />

          {/* Favorites section — personal shortcuts right at the top of the work zone */}
          {favProjects.length > 0 && (
            <>
              <div className="sb-section-header">
                <span className="sb-section-label">{t.sidebar.favorites}</span>
              </div>
              <div className="sb-fav-section">
                {favProjects.map((p) => {
                  const href = `/projects/${p._id}`;
                  const isActive = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link key={p._id} href={href} style={{ textDecoration: "none" }}>
                      <div className="sb-fav-row" data-active={isActive ? "true" : undefined}>
                        <Star size={12} fill="currentColor" className="sb-fav-star" />
                        <span className="sb-fav-name">{p.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="sb-divider" />
            </>
          )}

          {/* Spaces & Projects — the main work zone, gets all remaining space */}
          <SpacesTree onCreateSpace={() => setShowCreateSpace(true)} favorites={favorites} />
        </nav>

        {/* ── Admin dock — compact icon row, only for admins/managers ── */}
        {adminTools.length > 0 && (
          <div className="sb-admin-dock">
            <span className="sb-dock-label">Tools</span>
            <div className="sb-dock-icons">
              {adminTools.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link key={href} href={href} style={{ textDecoration: "none" }}>
                    <button className="sb-dock-btn" data-active={isActive ? "true" : undefined} title={label}>
                      <Icon size={15} strokeWidth={1.8} />
                    </button>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── User row + utility icons ── */}
        <div className="sb-user">
          <div className="sb-avatar">{user?.name?.[0]?.toUpperCase() ?? "?"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <p className="sb-user-name" style={{ margin: 0 }}>{user?.name ?? "—"}</p>
              {(streak?.current ?? 0) > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 14, fontWeight: 700, color: "#f97316",
                  background: "rgba(249,115,22,0.12)", borderRadius: 8,
                  padding: "2px 8px", lineHeight: 1,
                }}>
                  🔥 {streak!.current}
                </span>
              )}
            </div>
            <p className="sb-user-role">
              {user?.role === "admin" ? t.roles.admin : user?.role === "manager" ? t.roles.manager : t.roles.member}
            </p>
          </div>
          {/* Notification bell — compact, out of the main nav flow */}
          <button className="sb-icon-btn sb-notif-btn"
            onClick={() => setShowNotifPanel((v) => !v)}
            title="Notifications"
            data-active={showNotifPanel ? "true" : undefined}>
            <Bell size={15} strokeWidth={1.8} />
            {unreadCount > 0 && <span className="sb-notif-dot">{unreadCount}</span>}
          </button>
        </div>

        {/* Footer — minimal utility */}
        <div className="sb-footer">
          <button onClick={toggle}
            title={theme === "light" ? t.sidebar.darkMode : t.sidebar.lightMode}
            className="sb-icon-btn sb-footer-btn">
            {theme === "light" ? <Moon size={14} strokeWidth={1.8} /> : <Sun size={14} strokeWidth={1.8} />}
          </button>
          <button onClick={() => { signOut(); logout(); }} title="Sign out"
            className="sb-icon-btn sb-footer-btn"
            onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = ""; }}>
            <LogOut size={14} strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      {showCreateSpace && <CreateSpaceModal onClose={() => setShowCreateSpace(false)} />}
      {showNotifPanel && user && (
        <NotificationPanel isAdmin={isAdmin} memberId={user.memberId} onClose={() => setShowNotifPanel(false)} orgId={orgId} canApprove={can("task.approve")} />
      )}
      {showSwitcher && <QuickSwitcher onClose={() => setShowSwitcher(false)} items={switcherItems} />}
    </>
  );
}
