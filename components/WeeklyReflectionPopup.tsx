"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./AuthProvider";
import { Id } from "@/convex/_generated/dataModel";
import { ArrowRight, Sparkles, X } from "lucide-react";

function getCurrentSunday(): string {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  return sunday.toISOString().split("T")[0]!;
}

function isSunday(): boolean {
  return new Date().getDay() === 0;
}

const questions = [
  {
    key: "didLastWeek" as const,
    number: "01",
    emoji: "\u{1F4CB}",
    label: "What did you do last week?",
    placeholder: "What did you actually accomplish — not what was on the list, but what got done...",
  },
  {
    key: "needThisWeek" as const,
    number: "02",
    emoji: "\u{1F3AF}",
    label: "What do you need to do this week?",
    placeholder: "If this week could only have 3 wins, what would they be...",
  },
  {
    key: "forgotLastWeek" as const,
    number: "03",
    emoji: "\u{1F4AD}",
    label: "What did you forget to do last week?",
    placeholder: "No judgment. What slipped through the cracks...",
  },
];

/* ── Inline keyframe styles ─────────────────────────────────────────────── */
const popupAnimations = `
  @keyframes reflectionSlideUp {
    from { opacity: 0; transform: translateY(24px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes reflectionFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes reflectionPulse {
    0%, 100% { opacity: 0.6; }
    50%      { opacity: 1; }
  }
  @keyframes reflectionSuccessScale {
    0%   { transform: scale(0.8); opacity: 0; }
    50%  { transform: scale(1.05); }
    100% { transform: scale(1); opacity: 1; }
  }
  .reflection-textarea:focus {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important;
  }
  .reflection-btn:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 28px rgba(99,102,241,0.45) !important;
  }
  .reflection-btn:not(:disabled):active {
    transform: translateY(0px);
  }
  .reflection-close:hover {
    background: var(--surface3) !important;
    color: var(--text) !important;
  }
  .reflection-question:hover {
    border-color: var(--border3) !important;
  }
`;

export default function WeeklyReflectionPopup() {
  const { user, orgId } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [answers, setAnswers] = useState({
    didLastWeek: "",
    needThisWeek: "",
    forgotLastWeek: "",
  });

  const weekStart = getCurrentSunday();

  const existing = useQuery(
    api.weeklyReflections.getForWeek,
    user ? { memberId: user.memberId as Id<"members">, weekStart } : "skip"
  );

  const submitReflection = useMutation(api.weeklyReflections.submit);

  const shouldShow =
    isSunday() &&
    !dismissed &&
    !submitted &&
    existing === null &&
    user !== null &&
    orgId !== null;

  useEffect(() => {
    if (existing && existing !== null) {
      setSubmitted(true);
    }
  }, [existing]);

  useEffect(() => {
    if (shouldShow) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [shouldShow]);

  const canSubmit =
    answers.didLastWeek.trim() ||
    answers.needThisWeek.trim() ||
    answers.forgotLastWeek.trim();

  const handleSubmit = async () => {
    if (!user || !orgId || !canSubmit) return;
    setSubmitting(true);
    try {
      await submitReflection({
        orgId: orgId as Id<"organizations">,
        memberId: user.memberId as Id<"members">,
        weekStart,
        didLastWeek: answers.didLastWeek.trim(),
        needThisWeek: answers.needThisWeek.trim(),
        forgotLastWeek: answers.forgotLastWeek.trim(),
      });
      setShowSuccess(true);
      setTimeout(() => setSubmitted(true), 2200);
    } catch (err) {
      console.error("Failed to submit reflection:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!shouldShow) return null;

  const firstName = user?.name?.split(" ")[0] ?? "";

  // ── Success state ──────────────────────────────────────────────────────────
  if (showSuccess) {
    return (
      <>
        <style>{popupAnimations}</style>
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.82)", backdropFilter: "blur(20px)",
          animation: "reflectionFadeIn 0.3s ease-out",
        }}>
          <div style={{
            textAlign: "center", padding: 48,
            animation: "reflectionSuccessScale 0.5s ease-out",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 28px",
              boxShadow: "0 0 60px rgba(99,102,241,0.4), 0 0 120px rgba(139,92,246,0.2)",
            }}>
              <Sparkles size={32} style={{ color: "#fff" }} />
            </div>
            <h2 style={{
              fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 10px",
              letterSpacing: "-0.02em",
            }}>
              You&apos;re locked in{firstName ? `, ${firstName}` : ""}.
            </h2>
            <p style={{
              fontSize: 16, color: "rgba(255,255,255,0.5)", margin: 0,
              fontWeight: 400,
            }}>
              Go make this week count.
            </p>
          </div>
        </div>
      </>
    );
  }

  // ── Main popup ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{popupAnimations}</style>
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.82)", backdropFilter: "blur(20px)",
        animation: "reflectionFadeIn 0.25s ease-out",
      }}>
        <div style={{
          width: "100%", maxWidth: 540, margin: "0 20px",
          maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          background: "var(--surface)",
          border: "1px solid var(--border2)",
          borderRadius: 20,
          boxShadow: "0 48px 100px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
          animation: "reflectionSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
        }}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={{
            padding: "36px 36px 28px",
            position: "relative", flexShrink: 0,
            borderBottom: "1px solid var(--border)",
          }}>
            {/* Decorative gradient blob */}
            <div style={{
              position: "absolute", top: -40, right: -40,
              width: 180, height: 180, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* Close */}
            <button
              className="reflection-close"
              onClick={() => setDismissed(true)}
              title="Skip this week"
              style={{
                position: "absolute", top: 20, right: 20,
                background: "none", border: "none",
                width: 32, height: 32,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-dim)",
                borderRadius: 8, transition: "all 0.15s",
              }}
            >
              <X size={18} />
            </button>

            {/* Tag */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--accent-bg)",
              border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: 20, padding: "5px 12px 5px 10px",
              marginBottom: 20,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--accent-light)",
                animation: "reflectionPulse 2s ease-in-out infinite",
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600, color: "var(--accent-light)",
                letterSpacing: "0.04em",
              }}>
                Sunday Check-in
              </span>
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: 28, fontWeight: 800, color: "var(--text)",
              margin: "0 0 14px", lineHeight: 1.15,
              letterSpacing: "-0.03em",
            }}>
              I want you to think.
            </h2>

            <p style={{
              fontSize: 14.5, color: "var(--text-muted)",
              margin: 0, lineHeight: 1.7,
            }}>
              Turn off the phone. No WhatsApp, no Instagram, no Snapchat.
              <br />
              Just{" "}
              <span style={{
                color: "var(--text)", fontWeight: 600,
                background: "linear-gradient(to top, rgba(99,102,241,0.18) 40%, transparent 40%)",
                padding: "0 2px",
              }}>
                be here
              </span>{" "}
              for a moment.
            </p>
          </div>

          {/* ── Scrollable form ────────────────────────────────────────── */}
          <div style={{
            flex: 1, overflowY: "auto",
            padding: "24px 36px 16px",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            {questions.map((q) => (
              <div
                key={q.key}
                className="reflection-question"
                style={{
                  border: "1px solid var(--border2)",
                  borderRadius: 14,
                  padding: "18px 18px 14px",
                  transition: "border-color 0.2s",
                  background: "var(--surface)",
                }}
              >
                {/* Label */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 12,
                }}>
                  <span style={{ fontSize: 16 }}>{q.emoji}</span>
                  <span style={{
                    fontSize: 13.5, fontWeight: 600, color: "var(--text)",
                    lineHeight: 1.3,
                  }}>
                    {q.label}
                  </span>
                </div>

                {/* Textarea */}
                <textarea
                  className="reflection-textarea"
                  value={answers[q.key]}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                  placeholder={q.placeholder}
                  rows={2}
                  style={{
                    width: "100%",
                    background: "var(--surface2)",
                    border: "1.5px solid var(--border)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontSize: 13.5,
                    color: "var(--text)",
                    outline: "none",
                    resize: "none",
                    fontFamily: "inherit",
                    lineHeight: 1.65,
                    boxSizing: "border-box",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              </div>
            ))}
          </div>

          {/* ── Sticky footer ──────────────────────────────────────────── */}
          <div style={{
            padding: "18px 36px 28px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
            background: "var(--surface)",
          }}>
            {/* Motivational line */}
            <p style={{
              fontSize: 12.5, color: "var(--text-dim)",
              margin: "0 0 16px", textAlign: "center",
              lineHeight: 1.6, fontStyle: "italic",
            }}>
              We know this sounds obvious, but it will force you to take charge of this week.
            </p>

            {/* Submit */}
            <button
              className="reflection-btn"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 12,
                fontSize: 14, fontWeight: 600,
                background: submitting || !canSubmit
                  ? "var(--surface3)" : "linear-gradient(135deg, #6366f1, #7c3aed)",
                color: submitting || !canSubmit ? "var(--text-dim)" : "#fff",
                border: submitting || !canSubmit ? "1px solid var(--border2)" : "none",
                cursor: submitting || !canSubmit ? "default" : "pointer",
                fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s ease",
                boxShadow: submitting || !canSubmit ? "none" : "0 4px 20px rgba(99,102,241,0.3)",
              }}
            >
              {submitting ? "Submitting..." : "Start Your Week"}
              {!submitting && canSubmit && <ArrowRight size={16} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
