"use client";

import { useState } from "react";
import { Sliders, Check } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  taskId: string;
  orgId:  Id<"organizations"> | null;
}

export default function CustomFieldsSection({ taskId, orgId }: Props) {
  const { t } = useLocale();
  const fieldDefs = useQuery(api.customFields.listDefs, orgId ? { orgId } : "skip") ?? [];
  const fieldVals = useQuery(api.customFields.getTaskValues, { taskId: taskId as Id<"tasks"> }) ?? [];
  const setValue  = useMutation(api.customFields.setValue);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue,    setEditValue]    = useState("");

  if (fieldDefs.length === 0) return null;

  const valMap = new Map(fieldVals.map((v) => [v.fieldId as string, v.value]));

  const handleSave = async (fieldId: string) => {
    await setValue({
      taskId:  taskId as Id<"tasks">,
      fieldId: fieldId as Id<"customFieldDefs">,
      value:   editValue,
    });
    setEditingField(null);
    setEditValue("");
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Sliders size={12} color="var(--text-muted)" />
        <span style={{
          fontSize: 10, color: "var(--text-muted)", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {t.customFields.title}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {fieldDefs.map((def) => {
          const currentVal = valMap.get(def._id as string) ?? "";
          const isEditing  = editingField === def._id;

          return (
            <div key={def._id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "4px 0",
            }}>
              <span style={{
                fontSize: 11, color: "var(--text-dim)", fontWeight: 500,
                width: 90, flexShrink: 0, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {def.name}
              </span>

              {isEditing ? (
                <div style={{ flex: 1, display: "flex", gap: 4 }}>
                  {def.fieldType === "select" && def.options ? (
                    <select
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSave(def._id)}
                      style={{
                        flex: 1, padding: "4px 6px", fontSize: 11,
                        background: "var(--surface2)", border: "1px solid var(--border2)",
                        borderRadius: 4, color: "var(--text)", fontFamily: "inherit",
                      }}
                    >
                      <option value="">—</option>
                      {def.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : def.fieldType === "checkbox" ? (
                    <button
                      onClick={() => {
                        const next = currentVal === "true" ? "false" : "true";
                        setEditValue(next);
                        setValue({
                          taskId: taskId as Id<"tasks">,
                          fieldId: def._id,
                          value: next,
                        });
                        setEditingField(null);
                      }}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center",
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: 3,
                        border: `1.5px solid ${currentVal === "true" ? "var(--accent)" : "var(--border2)"}`,
                        background: currentVal === "true" ? "var(--accent)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {currentVal === "true" && <Check size={9} color="#fff" />}
                      </div>
                    </button>
                  ) : (
                    <input
                      autoFocus
                      type={def.fieldType === "number" ? "number" : def.fieldType === "date" ? "date" : "text"}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSave(def._id)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(def._id); if (e.key === "Escape") setEditingField(null); }}
                      style={{
                        flex: 1, padding: "4px 6px", fontSize: 11,
                        background: "var(--surface2)", border: "1px solid var(--border2)",
                        borderRadius: 4, color: "var(--text)", outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { setEditingField(def._id); setEditValue(currentVal); }}
                  style={{
                    flex: 1, textAlign: "left", padding: "4px 6px",
                    fontSize: 11, color: currentVal ? "var(--text)" : "var(--text-dim)",
                    background: "none", border: "1px solid transparent",
                    borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                >
                  {def.fieldType === "checkbox"
                    ? (currentVal === "true" ? t.yes : t.no)
                    : (currentVal || t.customFields.setValuePlaceholder)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
