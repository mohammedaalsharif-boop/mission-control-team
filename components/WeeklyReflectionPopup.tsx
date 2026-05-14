"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./AuthProvider";
import { Id } from "@/convex/_generated/dataModel";
import { ArrowUp, Sparkles, X } from "lucide-react";

function getCurrentSunday(): string {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  return sunday.toISOString().split("T")[0]!;
}

function isSunday(): boolean {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("reflection")) return true;
  return new Date().getDay() === 0;
}

const questions = [
  {
    key: "didLastWeek" as const,
    emoji: "📋",
    label: "What did you do last week?",
    placeholder: "What did you actually accomplish — not what was on the list, but what got done...",
  },
  {
    key: "needThisWeek" as const,
    emoji: "🎯",
    label: "What do you need to do this week?",
    placeholder: "If this week could only have 3 wins, what would they be...",
  },
  {
    key: "forgotLastWeek" as const,
    emoji: "💭",
    label: "What did you forget to do last week?",
    placeholder: "No judgment. What slipped through the cracks...",
  },
];

const css = `
  @keyframes rfSlideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes rfFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes rfPulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1;   }
  }
  @keyframes rfSuccess {
    0%   { transform: scale(0.8); opacity: 0; }
    60%  { transform: scale(1.06); }
    100% { transform: scale(1);   opacity: 1; }
  }
  .rf-textarea {
    width: 100%;
    background: transparent;
    border: none;
    color: #e4e4e7;
    font-size: 14px;
    outline: none;
    resize: none;
    font-family: inherit;
    line-height: 1.7;
    box-sizing: border-box;
  }
  .rf-textarea::placeholder { color: #52525b; }
  .rf-textarea:focus::placeholder { color: #3f3f46; }
  .rf-close:hover { background: #2e2e32 !important; color: #e4e4e7 !important; }
  .rf-send:not(:disabled):hover { background: #e4e4e7 !important; transform: scale(1.08); }
  .rf-send:not(:disabled):active { transform: scale(0.96); }
`;

/* Auto-resize textarea */
function AutoTextarea({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="rf-textarea"
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export default function WeeklyReflectionPopup() {
  const { user, orgId } = useAuth();
  const [dismissed,   setDismissed]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [answers, setAnswers] = useState({
    didLastWeek:    "",
    needThisWeek:   "",
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
    if (existing && existing !== null) setSubmitted(true);
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
        orgId:          orgId as Id<"organizations">,
        memberId:       user.memberId as Id<"members">,
        weekStart,
        didLastWeek:    answers.didLastWeek.trim(),
        needThisWeek:   answers.needThisWeek.trim(),
        forgotLastWeek: answers.forgotLastWeek.trim(),
      });
      setShowSuccess(true);
      setTimeout(() => setSubmitted(true), 2400);
    } catch (err) {
      console.error("Failed to submit reflection:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!shouldShow) return null;

  const firstName = user?.name?.split(" ")[0] ?? "";

  /* ── Overlay shared styles ─────────────────────────────────────────────── */
  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.75)", backdropFilter: "blur(20px)",
    animation: "rfFadeIn 0.25s ease-out",
  };

  /* ── Success screen ────────────────────────────────────────────────────── */
  if (showSuccess) {
    return (
      <>
        <style>{css}</style>
        <div style={overlay}>
          <div style={{ textAlign: "center", padding: 48, animation: "rfSuccess 0.5s ease-out" }}>
            <div style={{
              width: 68, height: 68, borderRadius: "50%",
              background: "linear-gradient(135deg,#6366f1,#7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
              boxShadow: "0 0 60px rgba(99,102,241,0.4)",
            }}>
              <Sparkles size={30} color="#fff" />
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#f4f4f5", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
              You&apos;re locked in{firstName ? `, ${firstName}` : ""}.
            </h2>
            <p style={{ fontSize: 15, color: "#71717a", margin: 0 }}>Go make this week count.</p>
          </div>
        </div>
      </>
    );
  }

  /* ── Main popup ────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{css}</style>
      <div style={overlay}>
        <div style={{
          width: "100%", maxWidth: 540, margin: "0 20px",
          maxHeight: "90vh", display: "flex", flexDirection: "column",
          background: "#1c1c1f",
          border: "1px solid #2e2e32",
          borderRadius: 20,
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset",
          animation: "rfSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
          overflow: "hidden",
        }}>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid #27272a", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.18)",
                borderRadius: 20, padding: "4px 11px 4px 9px",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#818cf8",
                  animation: "rfPulse 2s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#818cf8", letterSpacing: "0.05em" }}>
                  Sunday Check-in
                </span>
              </div>

              {/* Close */}
              <button
                className="rf-close"
                onClick={() => setDismissed(true)}
                title="Skip this week"
                style={{
                  background: "transparent", border: "none",
                  width: 30, height: 30, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#52525b", transition: "all 0.15s",
                }}
              >
                <X size={16} />
              </button>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f4f4f5", margin: "0 0 6px", letterSpacing: "-0.025em" }}>
              I want you to think.
            </h2>
            <p style={{ fontSize: 13, color: "#71717a", margin: 0, lineHeight: 1.65 }}>
              Turn off the phone. No distractions.{" "}
              <span style={{ color: "#a1a1aa", fontWeight: 500 }}>Just be here for a moment.</span>
            </p>
          </div>

          {/* ── Questions ────────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {questions.map((q, i) => (
              <div key={q.key}>
                {i > 0 && (
                  <div style={{ height: 1, background: "#27272a", margin: "0 22px" }} />
                )}
                <div style={{ padding: "16px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                    <span style={{ fontSize: 14, lineHeight: 1 }}>{q.emoji}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "#71717a", letterSpacing: "0.03em" }}>
                      {q.label}
                    </span>
                  </div>
                  <AutoTextarea
                    value={answers[q.key]}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [q.key]: v }))}
                    placeholder={q.placeholder}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div style={{
            padding: "12px 16px 16px",
            borderTop: "1px solid #27272a",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <p style={{ fontSize: 12, color: "#3f3f46", margin: 0, fontStyle: "italic" }}>
              This will force you to take charge of this week.
            </p>

            {/* Send button */}
            <button
              className="rf-send"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              title={canSubmit ? "Submit reflection" : "Answer at least one question"}
              style={{
                width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                background: canSubmit && !submitting ? "#ffffff" : "#27272a",
                border: "none",
                cursor: canSubmit && !submitting ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}
            >
              <ArrowUp
                size={16}
                color={canSubmit && !submitting ? "#09090b" : "#3f3f46"}
                strokeWidth={2.5}
              />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
