"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import MemberTimeline from "@/components/MemberTimeline";
import { ChevronLeft, Shield } from "lucide-react";

export default function MemberActivityPage() {
  const { t } = useLocale();
  const params = useParams();
  const router = useRouter();
  const { orgId } = useAuth();

  const memberId = params.memberId as Id<"members">;

  const member = useQuery(api.members.getMember, { memberId });
  const activities = useQuery(
    api.tasks.getMemberActivities,
    { memberId },
  ) ?? [];
  const projects = useQuery(
    api.projects.listAll,
    orgId ? { orgId } : "skip",
  ) ?? [];

  // Task stats for this member
  const memberTasks = useQuery(
    api.tasks.listTasksByMember,
    { memberId },
  ) ?? [];

  const total = memberTasks.length;
  const completed = memberTasks.filter((t: any) => t.status === "completed").length;
  const inProgress = memberTasks.filter((t: any) => t.status === "in_progress").length;
  const submitted = memberTasks.filter((t: any) => t.status === "submitted").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (!member) {
    return (
      <div style={{ display: "flex", height: "100vh", background: "var(--bg)" }}>
        <Sidebar />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--text-muted)" }}>{t.loading}</p>
        </main>
      </div>
    );
  }

  const projectInfos = projects.map((p: any) => ({ _id: p._id, name: p.name }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header */}
        <div style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)", flexShrink: 0,
        }}>
          {/* Back link */}
          <div style={{ padding: "10px 28px 0" }}>
            <button
              onClick={() => router.push("/members")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", padding: "4px 0",
                display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            >
              <ChevronLeft size={14} />
              {t.membersPage.title}
            </button>
          </div>

          {/* Member info */}
          <div style={{
            padding: "12px 28px 16px",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            {/* Avatar */}
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: member.role === "admin" ? "var(--accent-bg)" : "rgba(113,113,122,0.15)",
              border: member.role === "admin" ? "2px solid rgba(99,102,241,0.3)" : "2px solid var(--border2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700,
              color: member.role === "admin" ? "var(--accent-light)" : "var(--text-muted)",
              flexShrink: 0,
            }}>
              {member.name[0]?.toUpperCase()}
            </div>

            {/* Name + role */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{
                  fontSize: 20, fontWeight: 700, color: "var(--text)",
                  margin: 0, letterSpacing: "-0.01em",
                }}>
                  {member.name}&apos;s {t.membersPage.activity ?? "activity"}
                </h1>
                {member.role === "admin" && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
                    background: "var(--accent-bg)", color: "var(--accent-light)",
                    display: "flex", alignItems: "center", gap: 3,
                  }}>
                    <Shield size={10} /> {t.membersPage.admin}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                {member.email}
              </p>
            </div>

            {/* Stats */}
            <div style={{
              display: "flex", gap: 20, flexShrink: 0,
              borderLeft: "1px solid var(--border)", paddingLeft: 24,
            }}>
              {[
                { label: t.membersPage.tasks, value: total, color: "var(--accent)" },
                { label: t.membersPage.done, value: completed, color: "var(--status-success)" },
                { label: t.projectPage?.inProgress ?? "In Progress", value: inProgress, color: "var(--status-info)" },
                { label: t.projectPage?.submitted ?? "Submitted", value: submitted, color: "var(--status-warning)" },
                { label: t.membersPage.rate, value: `${pct}%`, color: pct === 100 ? "var(--status-success)" : "var(--text)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center", minWidth: 40 }}>
                  <p style={{ fontSize: 17, fontWeight: 700, color, margin: 0, lineHeight: 1.2 }}>{value}</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0", fontWeight: 500 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <MemberTimeline
          activities={activities as any}
          memberName={member.name}
          projects={projectInfos}
        />
      </div>
    </div>
  );
}
