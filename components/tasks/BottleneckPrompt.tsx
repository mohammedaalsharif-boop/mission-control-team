"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AlertTriangle, X, ChevronRight, Check } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";

// ── Category quick-picks ────────────────────────────────────────────────────

interface Category {
  id: "waiting_on" | "unclear_scope" | "dependency" | "resource";
  label: string;
  emoji: string;
}

// ── Prompt copy variations (rotated per session) ────────────────────────────

function getPromptCopy(t: any): string[] {
  return t.bottlenecks.prompts;
}

function getCategories(t: any): Category[] {
  return [
    { id: "waiting_on",    label: t.bottlenecks.categories.waiting, emoji: "⏳" },
    { id: "unclear_scope", label: t.bottlenecks.categories.unclear, emoji: "❓" },
    { id: "dependency",    label: t.bottlenecks.categories.blocked, emoji: "🔗" },
    { id: "resource",      label: t.bottlenecks.categories.missing, emoji: "🔑" },
  ];
}

// ── Inline prompt (appears right after task creation) ────────────────────────
//
//  Design rationale:
//  ─ Appears inline, directly below the newly created task card / row.
//  ─ No modal. No overlay. The surrounding UI stays fully interactive.
//  ─ Uses a warm amber accent (#f59e0b) to signal "think about this" without
//    alarm — distinct from the red error/rejection palette.
//  ─ Auto-focuses the input so a single keystroke starts the response.
//  ─ Dismissing is as easy as pressing Escape or clicking elsewhere.
//  ─ Auto-dismisses after 12 seconds if the user ignores it, leaving behind
//    zero guilt — the skip feels like the prompt respectfully stepped aside.
//  ─ If the user types, the timer cancels and the prompt persists.

interface BottleneckPromptProps {
  taskId:   string;
  stage:    string;  // current task status when prompt appears
  memberId: string;
  onDone:   () => void;  // called after submit or dismiss
  variant?: "creation" | "transition";  // controls copy
}

export default function BottleneckPrompt({
  taskId,
  stage,
  memberId,
  onDone,
  variant = "creation",
}: BottleneckPromptProps) {
  const { orgId } = useAuth();
  const { t } = useLocale();
  const [body, setBody]               = useState("");
  const [category, setCategory]       = useState<string | null>(null);
  const [submitted, setSubmitted]     = useState(false);
  const [visible, setVisible]         = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addBottleneck = useMutation(api.bottlenecks.add);

  const categories = getCategories(t);
  const prompts = getPromptCopy(t);

  const promptText = variant === "transition"
    ? t.bottlenecks.transitionPrompt
    : prompts[(Math.random() * prompts.length) | 0];

  // ── Animate in after a short delay (200ms) ──────────────────────────────
  useEffect(() => {
    const timeoutId = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timeoutId);
  }, []);

  // ── Focus input once visible ────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      const timeoutId = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timeoutId);
    }
  }, [visible]);

  // ── Auto-dismiss after 12s if user hasn't started typing ────────────────
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (!body.trim()) dismiss();
    }, 12000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cancel auto-dismiss as soon as the user types
  useEffect(() => {
    if (body.trim() && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [body]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDone, 250); // wait for exit animation
  }, [onDone]);

  const handleSubmit = async () => {
    if (!body.trim() || !orgId) { dismiss(); return; }
    try {
      await addBottleneck({
        orgId,
        taskId:   taskId as Id<"tasks">,
        body:     body.trim(),
        stage,
        category: category ?? undefined,
        memberId: memberId as Id<"members">,
      });
      setSubmitted(true);
      setTimeout(dismiss, 1200); // show confirmation briefly
    } catch {
      dismiss();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === "Escape") dismiss();
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        overflow: "hidden",
        maxHeight: visible ? 200 : 0,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div style={{
        margin: "6px 0 2px",
        padding: "10px 14px",
        background: "rgba(245,158,11,0.06)",
        border: "1px solid rgba(245,158,11,0.15)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        {/* ── Success state ──────────────────────────────────────────── */}
        {submitted ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "2px 0",
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: "rgba(34,197,94,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Check size={12} style={{ color: "var(--status-success)" }} />
            </div>
            <span style={{ fontSize: 12.5, color: "var(--status-success)", fontWeight: 500 }}>
              {t.bottlenecks.logged}
            </span>
          </div>
        ) : (
          <>
            {/* ── Header row ───────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={13} style={{ color: "var(--status-warning)", flexShrink: 0 }} />
              <span style={{
                fontSize: 12.5, color: "var(--text)", fontWeight: 500,
                flex: 1,
              }}>
                {promptText}
              </span>
              <button
                onClick={dismiss}
                title={t.bottlenecks.skip}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-dim)", padding: 2,
                  display: "flex", borderRadius: 4,
                  transition: "color 0.1s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
              >
                <X size={13} />
              </button>
            </div>

            {/* ── Category quick-picks ──────────────────────────────────── */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCategory(category === cat.id ? null : cat.id);
                    inputRef.current?.focus();
                  }}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 500,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all 0.12s",
                    border: category === cat.id
                      ? "1px solid rgba(245,158,11,0.4)"
                      : "1px solid var(--border)",
                    background: category === cat.id
                      ? "rgba(245,158,11,0.1)"
                      : "var(--surface2)",
                    color: category === cat.id
                      ? "var(--status-warning)"
                      : "var(--text-muted)",
                  }}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>

            {/* ── Input row ────────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                ref={inputRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.bottlenecks.describePlaceholder}
                style={{
                  flex: 1,
                  background: "var(--surface)",
                  border: "1px solid var(--border2)",
                  borderRadius: 7,
                  padding: "7px 10px",
                  fontSize: 12.5,
                  color: "var(--text)",
                  fontFamily: "inherit",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(245,158,11,0.5)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border2)"}
              />
              <button
                onClick={handleSubmit}
                disabled={!body.trim()}
                style={{
                  background: body.trim() ? "var(--status-warning)" : "var(--surface3)",
                  border: "none",
                  borderRadius: 7,
                  padding: "7px 12px",
                  cursor: body.trim() ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s",
                  opacity: body.trim() ? 1 : 0.4,
                }}
              >
                <ChevronRight size={13} style={{ color: body.trim() ? "#000" : "var(--text-dim)" }} />
              </button>
            </div>

            {/* ── Skip hint ────────────────────────────────────────────── */}
            <p style={{
              fontSize: 10.5, color: "var(--text-dim)", margin: 0,
              letterSpacing: "0.01em",
            }}>
              Press <kbd style={{
                fontSize: 10, padding: "1px 4px", borderRadius: 3,
                background: "var(--surface3)", border: "1px solid var(--border)",
                fontFamily: "inherit",
              }}>Esc</kbd> {t.bottlenecks.skipHint}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Bottleneck badge (shown on task cards) ──────────────────────────────────
//
//  A compact amber pill that appears on task cards when there's an active
//  blocker. Shows the category emoji + truncated text. Clicking opens the
//  task modal where the full bottleneck is visible.

export function BottleneckBadge({
  body,
  category,
  resolved,
}: {
  body:      string;
  category?: string | null;
  resolved?: boolean;
}) {
  const { t } = useLocale();
  const categories = getCategories(t);
  const cat = categories.find((c) => c.id === category as any);
  const emoji = cat?.emoji ?? "⚠️";
  const truncated = body.length > 35 ? body.slice(0, 35) + "…" : body;

  return (
    <div
      title={body}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 8px 2px 6px",
        borderRadius: 5,
        fontSize: 10.5,
        fontWeight: 500,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        background: resolved ? "rgba(113,113,122,0.08)" : "rgba(245,158,11,0.1)",
        border: `1px solid ${resolved ? "var(--border)" : "rgba(245,158,11,0.2)"}`,
        color: resolved ? "var(--text-dim)" : "var(--status-warning)",
        textDecoration: resolved ? "line-through" : "none",
      }}
    >
      <span style={{ fontSize: 11, flexShrink: 0 }}>{emoji}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{truncated}</span>
    </div>
  );
}

// ── Bottleneck section (shown inside TaskModal) ─────────────────────────────
//
//  Full read/write view of all bottlenecks for a task.

export function BottleneckSection({
  taskId,
  memberId,
  stage,
  bottlenecks,
}: {
  taskId:      string;
  memberId:    string;
  stage:       string;
  bottlenecks: Array<{
    _id:        string;
    body:       string;
    stage:      string;
    category?:  string;
    resolvedAt?: number;
    createdAt:  number;
  }>;
}) {
  const { orgId } = useAuth();
  const { t } = useLocale();
  const [adding, setAdding] = useState(false);
  const [body, setBody]     = useState("");
  const [cat, setCat]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = getCategories(t);
  const addBottleneck    = useMutation(api.bottlenecks.add);
  const resolveOne       = useMutation(api.bottlenecks.resolve);

  const active   = bottlenecks.filter((item) => !item.resolvedAt);
  const resolved = bottlenecks.filter((item) => item.resolvedAt);

  const handleAdd = async () => {
    if (!body.trim() || !orgId) { setAdding(false); return; }
    await addBottleneck({
      orgId,
      taskId:   taskId as Id<"tasks">,
      body:     body.trim(),
      stage,
      category: cat ?? undefined,
      memberId: memberId as Id<"members">,
    });
    setBody("");
    setCat(null);
    setAdding(false);
  };

  useEffect(() => {
    if (adding) setTimeout(() => inputRef.current?.focus(), 50);
  }, [adding]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={14} style={{ color: "var(--status-warning)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {t.bottlenecks.title}
        </span>
        {active.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: "var(--status-warning)",
            background: "rgba(245,158,11,0.12)",
            padding: "1px 6px", borderRadius: 4,
          }}>
            {active.length} {t.active}
          </span>
        )}
      </div>

      {/* Active bottlenecks */}
      {active.map((item) => {
        const catInfo = categories.find((c) => c.id === item.category as any);
        return (
          <div key={item._id} style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "8px 10px",
            background: "rgba(245,158,11,0.05)",
            border: "1px solid rgba(245,158,11,0.12)",
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>
              {catInfo?.emoji ?? "⚠️"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, color: "var(--text)", margin: 0, lineHeight: 1.5 }}>
                {item.body}
              </p>
              {catInfo && (
                <span style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 2, display: "block" }}>
                  {catInfo.label}
                </span>
              )}
            </div>
            <button
              onClick={() => resolveOne({ bottleneckId: item._id as Id<"bottlenecks"> })}
              title="Mark resolved"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-dim)", padding: 3, borderRadius: 4,
                display: "flex", flexShrink: 0,
                transition: "color 0.1s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--status-success)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
            >
              <Check size={14} />
            </button>
          </div>
        );
      })}

      {/* Resolved bottlenecks (collapsed) */}
      {resolved.length > 0 && (
        <details style={{ marginTop: 2 }}>
          <summary style={{
            fontSize: 11, color: "var(--text-dim)", cursor: "pointer",
            listStyle: "none", display: "flex", alignItems: "center", gap: 4,
          }}>
            <ChevronRight size={11} style={{ transition: "transform 0.15s" }} />
            {resolved.length} {t.resolved}
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6, paddingLeft: 4 }}>
            {resolved.map((item) => (
              <div key={item._id} style={{
                fontSize: 12, color: "var(--text-dim)",
                textDecoration: "line-through",
                padding: "3px 0",
              }}>
                {item.body}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add new */}
      {adding ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {categories.map((catItem) => (
              <button
                key={catItem.id}
                onClick={() => { setCat(cat === catItem.id ? null : catItem.id); inputRef.current?.focus(); }}
                style={{
                  padding: "2px 8px", borderRadius: 5, fontSize: 10.5,
                  fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
                  transition: "all 0.12s",
                  border: cat === catItem.id ? "1px solid rgba(245,158,11,0.4)" : "1px solid var(--border)",
                  background: cat === catItem.id ? "rgba(245,158,11,0.1)" : "var(--surface2)",
                  color: cat === catItem.id ? "var(--status-warning)" : "var(--text-muted)",
                }}
              >
                {catItem.emoji} {catItem.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder={t.bottlenecks.describePlaceholder}
              style={{
                flex: 1, background: "var(--surface)", border: "1px solid var(--border2)",
                borderRadius: 7, padding: "6px 10px", fontSize: 12.5,
                color: "var(--text)", fontFamily: "inherit", outline: "none",
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "rgba(245,158,11,0.5)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "var(--border2)"}
            />
            <button
              onClick={handleAdd}
              disabled={!body.trim()}
              style={{
                background: body.trim() ? "var(--status-warning)" : "var(--surface3)",
                border: "none", borderRadius: 7, padding: "6px 10px",
                cursor: body.trim() ? "pointer" : "default",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                color: body.trim() ? "#000" : "var(--text-dim)",
                opacity: body.trim() ? 1 : 0.4,
                transition: "all 0.15s",
              }}
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 0", background: "none", border: "none",
            cursor: "pointer", fontSize: 12, color: "var(--text-dim)",
            fontFamily: "inherit", transition: "color 0.1s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--status-warning)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
        >
          <AlertTriangle size={12} />
          {t.bottlenecks.logBottleneck}
        </button>
      )}
    </div>
  );
}
