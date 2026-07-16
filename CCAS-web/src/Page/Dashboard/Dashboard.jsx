import React from 'react';
import { ArrowRight, BarChart3, FileCheck2, ShieldCheck, Sparkles } from 'lucide-react';
import './Dashboard.css';

export default function Dashboard({
  metrics,
  auditResult,
  selectedModelLabel,
  onOpenWorkspace,
  onOpenReports,
  workspaceHistory,
  onOpenHistoryWorkspace,
  resolveModelLabel,
}) {
  return (
    <>
      <section className="page-hero">
        <div className="section-kicker">Dashboard</div>
        <h1 className="hero-title">Portfolio cockpit for CCAS document review</h1>
        <p className="hero-subtitle">
          Mirror the enterprise review flow with a single built-in CCoP v2.1 standard, local AI runtime,
          and one-click progression from upload to report export.
        </p>
        <div className="button-row dashboard-hero-actions">
          <button type="button" className="btn-primary" onClick={onOpenWorkspace}>
            Launch Review Workspace
          </button>
          <button type="button" className="btn-secondary" onClick={onOpenReports}>
            Open Reports
          </button>
        </div>
      </section>

      <section className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Active Standard</div>
          <div className="kpi-value">CCoP v2.1</div>
          <div className="kpi-foot">Built-in baseline locked for every review</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Selected Model</div>
          <div className="kpi-value dashboard-kpi-small">{selectedModelLabel}</div>
          <div className="kpi-foot">LM Studio runtime target for the next scan</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Last Compliance Score</div>
          <div className="kpi-value">{auditResult?.compliance_percentage ?? 0}%</div>
          <div className="kpi-foot">{auditResult ? 'Latest report available for inspection' : 'No completed review yet'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Audited Controls</div>
          <div className="kpi-value">{metrics.total}</div>
          <div className="kpi-foot">Compliance {metrics.compliant} · Partial {metrics.partial} · Non {metrics.nonCompliant}</div>
        </div>
      </section>

      <section className="two-column-grid">
        <div className="glass-panel dashboard-panel">
          <div className="section-title">
            <div>
              <h3>Live status strip</h3>
              <p>Reference-style summary cards for current review readiness</p>
            </div>
          </div>
          <div className="three-column-grid dashboard-status-grid">
            <div className="workflow-command ready-tone">
              <Sparkles size={18} />
              <h4 className="workflow-title">Runtime ready</h4>
              <p className="workflow-copy">LM Studio and CCAS-Agent are prepared for local document review.</p>
            </div>
            <div className="workflow-command caution-tone">
              <ShieldCheck size={18} />
              <h4 className="workflow-title">Fixed standard scope</h4>
              <p className="workflow-copy">No template library upload. Reviews always use the current built-in CCAS baseline.</p>
            </div>
            <div className="workflow-command accent-tone">
              <FileCheck2 size={18} />
              <h4 className="workflow-title">Report channel</h4>
              <p className="workflow-copy">Completed reviews are pushed into the dedicated Reports page for PDF export and breakdown.</p>
            </div>
          </div>
        </div>

        <div className="glass-panel dashboard-panel">
          <div className="section-title">
            <div>
              <h3>Review launch command</h3>
              <p>Single-path workflow adapted from the reference project</p>
            </div>
          </div>
          <div className="workflow-command dashboard-launch-card">
            <BarChart3 size={18} />
            <h4 className="workflow-title">Review workspace</h4>
            <p className="workflow-copy">
              Upload one cybersecurity plan, choose the local model, run semantic control matching, then inspect the structured report.
            </p>
            <button type="button" className="btn-primary dashboard-inline-button" onClick={onOpenWorkspace}>
              Continue to workspace
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel dashboard-panel">
        <div className="section-title">
          <div>
            <h3>Created workspaces</h3>
            <p>Saved workspace history loaded from the text database</p>
          </div>
        </div>

        {workspaceHistory.length === 0 ? (
          <div className="dashboard-history-empty">No saved workspaces yet.</div>
        ) : (
          <div className="dashboard-history-list">
            {workspaceHistory.slice(0, 6).map((workspace) => (
              <button
                key={workspace.workspace_id}
                type="button"
                className="dashboard-history-item"
                onClick={() => onOpenHistoryWorkspace(workspace.workspace_id)}
              >
                <div>
                  <div className="dashboard-history-title">{workspace.workspace_name || 'Workspace'}</div>
                  <div className="dashboard-history-copy">
                    {workspace.report_count ?? 0} reports · {workspace.updated_at || workspace.created_at || 'Saved'}
                  </div>
                </div>
                <span className="badge accent">Workspace</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
