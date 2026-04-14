import React from "react";
import type { OwlData } from "../../hooks/useOwlData.js";

export function DesignQC({ data }: { data: OwlData }) {
  const { designqcReport } = data;
  const hasCaptures = designqcReport && designqcReport.captures && designqcReport.captures.length > 0;

  return (
    <div>
      <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-medium mb-3" style={{ color: "var(--text-secondary)" }}>How Design QC Works</h3>
        <div className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <p>1. Run <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--bg-base)" }}>openowl designqc --url http://localhost:3000</code></p>
          <p>2. OpenOwl captures compressed screenshots of your app</p>
          <p>3. In your OpenCode session, ask the AI to evaluate the screenshots</p>
          <p>4. The AI sees the images, evaluates design, and can fix issues right in your session</p>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <h3 className="font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Last Capture</h3>
        {!hasCaptures ? (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No screenshots captured yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm mb-3">
              <span style={{ color: "var(--text-faint)" }}>Captured: {designqcReport.captured_at || "-"}</span>
              <span style={{ color: "var(--text-faint)" }}>Size: {designqcReport.total_size_kb || 0}KB</span>
              <span style={{ color: "var(--text-faint)" }}>Est. tokens: ~{designqcReport.estimated_tokens || 0}</span>
            </div>
            {designqcReport.captures.map((cap: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "var(--bg-base)" }}>
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>{cap.file}</span>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>{cap.viewport} - {cap.route}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
