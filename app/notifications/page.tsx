"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import { Bell, CheckCheck, CheckCircle, XCircle, Send, CalendarCheck, CalendarClock, AtSign } from "lucide-react";

const TYPE_ICON: Record<string, JSX.Element> = {
  task_submitted:         <Send size={14} style={{ color: "var(--accent)" }} />,
  task_approved:          <CheckCircle size={14} style={{ color: "var(--status-success)" }} />,
  task_rejected:          <XCircle size={14} style={{ color: "var(--status-danger)" }} />,
  task_mention:           <AtSign size={14} style={{ color: "var(--accent-light)" }} />,
  weekly_digest_thursday: <CalendarCheck size={14} style={{ color: "var(--status-success)" }} />,
  weekly_digest_sunday:   <CalendarClock size={14} style={{ color: "var(--status-warning)" }} />,
};

const TIME_AGO = (ts: number, t: any) => {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return t.notificationsPage.justNow;
  if (mins < 60)  return `${mins}${t.notificationsPage.mAgo}`;
  if (hours < 24) return `${hours}${t.notificationsPage.hAgo}`;
  return `${days}${t.notificationsPage.dAgo}`;
};

export default function NotificationsPage() {
  const { user, isAdmin, isLoading, orgId } = useAuth();
  const { t } = useLocale();
  const markRead    = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const adminNotifs  = useQuery(
    api.notifications.listAdminNotifications,
    isAdmin && orgId ? { orgId } : "skip"
  ) ?? [];
  const memberNotifArgs = !isAdmin && user && orgId ? { memberId: user.memberId as Id<"members"> } : "skip" as const;
  const memberNotifs = useQuery(
    api.notifications.listMemberNotifications,
    memberNotifArgs
  ) ?? [];

  const notifications = isAdmin ? adminNotifs : memberNotifs;

  if (isLoading || !user) return null;

  const unread = notifications.filter((n) => !n.read).length;

  const handleMarkAll = () => {
    if (!orgId) return;
    markAllRead({
      orgId,
      role:     isAdmin ? "admin" : "member",
      memberId: !isAdmin ? (user.memberId as Id<"members">) : undefined,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div style={{ padding: "28px 32px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.notificationsPage.title}</h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                {unread > 0 ? `${unread} ${t.notificationsPage.unread}` : t.notificationsPage.allCaughtUp}
              </p>
            </div>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  color: "var(--text-muted)", cursor: "pointer",
                }}
              >
                <CheckCheck size={13} /> {t.notificationsPage.markAllRead}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{
              border: "1px dashed var(--border2)", borderRadius: 14,
              padding: "48px 24px", textAlign: "center",
            }}>
              <Bell size={32} style={{ color: "var(--text-dim)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>{t.notificationsPage.noNotificationsYet}</p>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{t.notificationsPage.noNotificationsHint}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => !n.read && markRead({ notificationId: n._id })}
                  style={{
                    background: n.read ? "var(--surface)" : "var(--surface2)",
                    border: `1px solid ${n.read ? "var(--border)" : "var(--border2)"}`,
                    borderRadius: 12, padding: "14px 18px",
                    display: "flex", alignItems: "flex-start", gap: 12,
                    cursor: n.read ? "default" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--surface3)", border: "1px solid var(--border2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {TYPE_ICON[n.type] ?? <Bell size={14} style={{ color: "var(--text-muted)" }} />}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{n.title}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{TIME_AGO(n.createdAt, t)}</span>
                        {!n.read && (
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "3px 0 0", lineHeight: 1.5 }}>
                      {n.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
