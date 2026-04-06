"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import { Id } from "@/convex/_generated/dataModel";
import { Brain, Calendar, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Doc } from "@/convex/_generated/dataModel";

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + "T00:00:00");
  const endDate = new Date(date);
  endDate.setDate(date.getDate() + 6);

  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = date.toLocaleDateString("en-US", options);
  const end = endDate.toLocaleDateString("en-US", { ...options, year: "numeric" });
  return `${start} – ${end}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  return `${weeks} weeks ago`;
}

export default function ReflectionsPage() {
  const { user, isLoading } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reflections = useQuery(
    api.weeklyReflections.listByMember,
    user ? { memberId: user.memberId as Id<"members"> } : "skip"
  ) ?? [];

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #3a3a3a", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "32px 40px", maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, marginBottom: 16, transition: "color 0.15s" }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Brain size={22} style={{ color: "var(--accent-light)" }} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                Weekly Reflections
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
                Your past weekly check-ins — look back to move forward.
              </p>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {reflections.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 24px",
            background: "var(--surface)", border: "1px solid var(--border2)",
            borderRadius: 16,
          }}>
            <Brain size={40} style={{ color: "var(--text-dim)", marginBottom: 16 }} />
            <p style={{ fontSize: 15, color: "var(--text-muted)", margin: 0 }}>
              No reflections yet. Your first one will appear here after you fill it out on Sunday.
            </p>
          </div>
        )}

        {/* Reflection cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reflections.map((r: Doc<"weeklyReflections">) => {
            const isExpanded = expandedId === r._id;
            return (
              <div
                key={r._id}
                style={{
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 14, overflow: "hidden",
                  transition: "border-color 0.15s",
                }}
              >
                {/* Collapsed header — click to expand */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r._id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "16px 20px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Calendar size={16} style={{ color: "var(--accent-light)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                      Week of {formatWeekLabel(r.weekStart)}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                      Submitted {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    style={{
                      color: "var(--text-muted)",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  />
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{
                    padding: "0 20px 20px",
                    borderTop: "1px solid var(--border)",
                    display: "flex", flexDirection: "column", gap: 16,
                    paddingTop: 16,
                  }}>
                    <div>
                      <p style={{
                        fontSize: 11, fontWeight: 600, color: "var(--accent-light)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        margin: "0 0 6px",
                      }}>
                        What I did last week
                      </p>
                      <p style={{
                        fontSize: 14, color: "var(--text)", margin: 0,
                        lineHeight: 1.6, whiteSpace: "pre-wrap",
                        background: "var(--surface2)", borderRadius: 8, padding: "10px 14px",
                      }}>
                        {r.didLastWeek || "—"}
                      </p>
                    </div>

                    <div>
                      <p style={{
                        fontSize: 11, fontWeight: 600, color: "var(--accent-light)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        margin: "0 0 6px",
                      }}>
                        What I need to do this week
                      </p>
                      <p style={{
                        fontSize: 14, color: "var(--text)", margin: 0,
                        lineHeight: 1.6, whiteSpace: "pre-wrap",
                        background: "var(--surface2)", borderRadius: 8, padding: "10px 14px",
                      }}>
                        {r.needThisWeek || "—"}
                      </p>
                    </div>

                    <div>
                      <p style={{
                        fontSize: 11, fontWeight: 600, color: "var(--accent-light)",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        margin: "0 0 6px",
                      }}>
                        What I forgot to do last week
                      </p>
                      <p style={{
                        fontSize: 14, color: "var(--text)", margin: 0,
                        lineHeight: 1.6, whiteSpace: "pre-wrap",
                        background: "var(--surface2)", borderRadius: 8, padding: "10px 14px",
                      }}>
                        {r.forgotLastWeek || "—"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
