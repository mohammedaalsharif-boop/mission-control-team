"use client";

import { useState } from "react";
import { Repeat, X } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  taskId: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceInterval?: number;
  nextRecurrenceAt?: number;
}

export default function RecurrenceSection({
  taskId, isRecurring, recurrenceRule, recurrenceInterval, nextRecurrenceAt,
}: Props) {
  const { t } = useLocale();
  const setRecurrence    = useMutation(api.recurring.setRecurrence);
  const removeRecurrence = useMutation(api.recurring.removeRecurrence);

  const RULES = [
    { id: "daily",    label: t.recurrence.daily },
    { id: "weekly",   label: t.recurrence.weekly },
    { id: "biweekly", label: t.recurrence.biweekly },
    { id: "monthly",  label: t.recurrence.monthly },
    { id: "custom",   label: t.recurrence.custom },
  ] as const;

  const [editing, setEditing]           = useState(false);
  const [selectedRule, setSelectedRule]  = useState(recurrenceRule ?? "weekly");
  const [customDays, setCustomDays]     = useState(recurrenceInterval ?? 7);

  const handleSave = async () => {
    await setRecurrence({
      taskId: taskId as Id<"tasks">,
      recurrenceRule: selectedRule,
      ...(selectedRule === "custom" ? { recurrenceInterval: customDays } : {}),
    });
    setEditing(false);
  };

  const handleRemove = async () => {
    await removeRecurrence({ taskId: taskId as Id<"tasks"> });
    setEditing(false);
  };

  const ruleLabel = RULES.find((r) => r.id === recurrenceRule)?.label ?? recurrenceRule;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Repeat size={12} color="var(--text-muted)" />
        <span style={{
          fontSize: 10, color: "var(--text-muted)", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {t.recurrence.title}
        </span>
      </div>

      {isRecurring && !editing ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px", borderRadius: 6,
          background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
        }}>
          <Repeat size={11} color="var(--accent-light)" />
          <span style={{ fontSize: 11, color: "var(--accent-light)", fontWeight: 500, flex: 1 }}>
            {ruleLabel}
            {recurrenceRule === "custom" && recurrenceInterval
              ? ` (every ${recurrenceInterval} days)`
              : ""}
          </span>
          {nextRecurrenceAt && (
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
              {t.recurrence.nextLabel} {new Date(nextRecurrenceAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          <button
            onClick={() => { setEditing(true); setSelectedRule(recurrenceRule ?? "weekly"); }}
            style={{
              fontSize: 10, color: "var(--text-dim)", background: "none",
              border: "none", cursor: "pointer", fontFamily: "inherit",
              textDecoration: "underline",
            }}
          >
            {t.edit}
          </button>
          <button
            onClick={handleRemove}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-dim)", display: "flex", padding: 2,
            }}
          >
            <X size={11} />
          </button>
        </div>
      ) : editing ? (
        <div style={{
          padding: "8px 10px", borderRadius: 6,
          background: "var(--surface2)", border: "1px solid var(--border2)",
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {RULES.map((rule) => (
              <button
                key={rule.id}
                onClick={() => setSelectedRule(rule.id)}
                style={{
                  fontSize: 10, padding: "4px 10px", borderRadius: 5,
                  background: selectedRule === rule.id ? "var(--accent-bg)" : "var(--surface3)",
                  color: selectedRule === rule.id ? "var(--accent-light)" : "var(--text-dim)",
                  border: `1px solid ${selectedRule === rule.id ? "var(--accent-border)" : "var(--border2)"}`,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
                }}
              >
                {rule.label}
              </button>
            ))}
          </div>

          {selectedRule === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.recurrence.every}</span>
              <input
                type="number"
                min={1}
                max={365}
                value={customDays}
                onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value)))}
                style={{
                  width: 50, padding: "3px 6px", fontSize: 11,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 4, color: "var(--text)", textAlign: "center",
                  fontFamily: "inherit",
                }}
              />
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.recurrence.days}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={handleSave} style={{
              fontSize: 10, padding: "4px 12px", borderRadius: 5,
              background: "var(--accent)", color: "#fff", border: "none",
              cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}>{t.save}</button>
            <button onClick={() => setEditing(false)} style={{
              fontSize: 10, padding: "4px 10px", borderRadius: 5,
              background: "var(--surface3)", color: "var(--text-muted)",
              border: "none", cursor: "pointer", fontFamily: "inherit",
            }}>{t.cancel}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            fontSize: 11, color: "var(--text-dim)", background: "none",
            border: "1px dashed var(--border2)", borderRadius: 6,
            padding: "6px 10px", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 5, width: "100%",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-border)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
        >
          <Repeat size={11} /> {t.recurrence.makeRecurring}
        </button>
      )}
    </div>
  );
}
