"use client";

import { Component, ReactNode } from "react";
import { useLocale } from "@/components/LocaleProvider";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

function ErrorDisplay({ error }: { error: Error }) {
  const { t } = useLocale();
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a0a", padding: 24,
    }}>
      <div style={{
        maxWidth: 600, background: "#1a1a1a", border: "1px solid #3a3a3a",
        borderRadius: 12, padding: 24,
      }}>
        <h2 style={{ color: "#f87171", margin: "0 0 12px", fontSize: 16 }}>
          {t.errorBoundary.title}
        </h2>
        <pre style={{
          fontSize: 11, color: "#a1a1aa", whiteSpace: "pre-wrap",
          wordBreak: "break-all", margin: 0,
        }}>
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <ErrorDisplay error={this.state.error} />;
    }
    return this.props.children;
  }
}
