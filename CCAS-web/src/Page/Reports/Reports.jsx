import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileSearch,
  FolderKanban,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import './Reports.css';

export default function Reports({
  activeReviewStep,
  auditResult,
  auditSections,
  file,
  currentPage,
  totalPages,
  setCurrentPage,
  expandedSections,
  toggleSection,
  normalizeStatus,
  statusConfig,
  scanStartTime,
  scanEndTime,
  scanDuration,
  downloadPdfReport,
  resetUploader,
  allReports,
  onOpenPortfolioReport,
  onDownloadPortfolioReport,
  hidePortfolio = false,
}) {
  const reviewSteps = [
    { id: 'acknowledge', title: 'Acknowledge', copy: 'Accept the review conditions before continuing' },
    { id: 'template', title: 'Template', copy: 'Choose and download the built-in CCoP template' },
    { id: 'evidence', title: 'Evidence', copy: 'Upload one PDF or DOCX cybersecurity plan' },
    { id: 'scan', title: 'Scan', copy: 'Execute the local AI model and watch progress' },
    { id: 'result', title: 'Result', copy: 'Review the structured compliance findings' },
  ];

  const portfolioReports = Array.isArray(allReports) ? allReports : [];
  const completedPortfolioReports = portfolioReports.filter((report) => report.status === 'completed' && report.audit_result);
  const averageScore = completedPortfolioReports.length
    ? Math.round(completedPortfolioReports.reduce((sum, report) => sum + (report.compliance_percentage ?? 0), 0) / completedPortfolioReports.length)
    : 0;
  const draftCount = portfolioReports.filter((report) => report.status !== 'completed').length;
  const bestReport = completedPortfolioReports.reduce((best, report) => (
    !best || (report.compliance_percentage ?? 0) > (best.compliance_percentage ?? 0) ? report : best
  ), null);

  if (!auditResult && portfolioReports.length === 0) {
    return (
      <section className="empty-state-panel">
        <div className="section-kicker">Reports</div>
        <h3 className="empty-state-title">No completed report yet</h3>
        <p className="muted-copy">
          Run a review from the workspace first. The generated CCAS report will appear here for drill-down and PDF export.
        </p>
      </section>
    );
  }

  const pct = auditResult?.compliance_percentage ?? 0;
  const pctColor = pct >= 85 ? '#86efac' : pct >= 60 ? '#fcd34d' : '#fca5a5';
  const totalSubs = Array.isArray(auditSections) ? auditSections.reduce((acc, section) => acc + (section.subsections?.length || 0), 0) : 0;
  const compliantSubs = Array.isArray(auditSections) ? auditSections.reduce((acc, section) => acc + (section.subsections?.filter((sub) => normalizeStatus(sub) === 'compliant').length || 0), 0) : 0;
  const partialSubs = Array.isArray(auditSections) ? auditSections.reduce((acc, section) => acc + (section.subsections?.filter((sub) => normalizeStatus(sub) === 'partial').length || 0), 0) : 0;
  const nonSubs = totalSubs - compliantSubs - partialSubs;
  const displayedSections = Array.isArray(auditSections) ? auditSections.slice((currentPage - 1) * 4, currentPage * 4) : [];

  return (
    <>
      {auditResult && (
        <section className="review-steps-grid">
          {reviewSteps.map((step, index) => (
            <div key={step.id} className={`step-card ${activeReviewStep === index + 1 ? 'step-card-active' : ''}`}>
              <div className="step-index">0{index + 1}</div>
              <div className="step-title">{step.title}</div>
              <div className="step-copy">{step.copy}</div>
            </div>
          ))}
        </section>
      )}

      {!hidePortfolio && (
        <>
          <section className="page-hero">
            <div className="section-kicker">Reports</div>
            <h1 className="hero-title">All report visualizations and portfolio analytics</h1>
            <p className="hero-subtitle">
              Review all saved CCAS reports, compare scores, and open any generated result for drill-down or export.
            </p>
          </section>

          <section className="kpi-grid report-portfolio-kpis">
            <div className="kpi-card">
              <div className="kpi-label">Saved Reports</div>
              <div className="kpi-value">{portfolioReports.length}</div>
              <div className="kpi-foot">All workspace report rows</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Completed</div>
              <div className="kpi-value">{completedPortfolioReports.length}</div>
              <div className="kpi-foot">Generated result sets available</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Average Score</div>
              <div className="kpi-value">{averageScore}%</div>
              <div className="kpi-foot">Across completed reports</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Draft Reports</div>
              <div className="kpi-value">{draftCount}</div>
              <div className="kpi-foot">Awaiting or in-progress review</div>
            </div>
          </section>

          <section className="two-column-grid">
            <div className="report-section-card">
              <div className="section-title">
                <div>
                  <h3>Score distribution</h3>
                  <p>Compliance percentage for each generated report</p>
                </div>
                <span className="status-pill accent">
                  <BarChart3 size={14} />
                  <span>Portfolio chart</span>
                </span>
              </div>
              <div className="report-score-bars">
                {completedPortfolioReports.length === 0 ? (
                  <div className="workspace-history-empty">No completed report yet for score visualization.</div>
                ) : completedPortfolioReports.map((report) => (
                  <div key={report.report_id} className="report-score-bar-row">
                    <div className="report-score-bar-meta">
                      <div className="report-score-bar-title">{report.report_name}</div>
                      <div className="report-score-bar-copy">{report.workspace_name || 'Workspace'} · {report.document_name || 'No document'}</div>
                    </div>
                    <div className="report-score-bar-track">
                      <div className="report-score-bar-fill" style={{ width: `${Math.max(6, report.compliance_percentage ?? 0)}%` }} />
                    </div>
                    <div className="report-score-bar-value">{report.compliance_percentage ?? 0}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="report-section-card">
              <div className="section-title">
                <div>
                  <h3>Portfolio summary</h3>
                  <p>Quick insight across all saved workspace reports</p>
                </div>
                <span className="status-pill accent">
                  <FolderKanban size={14} />
                  <span>Cross-workspace</span>
                </span>
              </div>
              <div className="report-meta-grid">
                <div>
                  <div className="metric-label">Best Score</div>
                  <div className="report-meta-value">{bestReport ? `${bestReport.compliance_percentage ?? 0}%` : '--'}</div>
                </div>
                <div>
                  <div className="metric-label">Top Report</div>
                  <div className="report-meta-value">{bestReport?.report_name || 'No completed report yet'}</div>
                </div>
                <div>
                  <div className="metric-label">Workspaces Covered</div>
                  <div className="report-meta-value">{new Set(portfolioReports.map((report) => report.workspace_id)).size}</div>
                </div>
                <div>
                  <div className="metric-label">Latest Update</div>
                  <div className="report-meta-value mono-text">{portfolioReports[0]?.updated_at || '--'}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="report-section-card">
            <div className="section-title">
              <div>
                <h3>All saved reports</h3>
                <p>Open any existing report detail or download its generated PDF</p>
              </div>
              <span className="status-pill accent">
                <FileSearch size={14} />
                <span>Report library</span>
              </span>
            </div>
            {portfolioReports.length === 0 ? (
              <div className="workspace-history-empty">No report rows saved yet.</div>
            ) : (
              <div className="workspace-history-table-wrap">
                <div className="workspace-history-table report-portfolio-table">
                  <div className="workspace-history-row workspace-history-head report-portfolio-row">
                    <span>Report</span>
                    <span>Workspace</span>
                    <span>Status</span>
                    <span>Score</span>
                    <span>Updated</span>
                    <span>View</span>
                    <span>Download</span>
                  </div>
                  {portfolioReports.map((report) => (
                    <div
                      key={`${report.workspace_id}-${report.report_id}`}
                      className="workspace-history-row workspace-history-data report-portfolio-row"
                      onDoubleClick={() => onOpenPortfolioReport(report)}
                    >
                      <span className="workspace-history-name">{report.report_name || 'Report'}</span>
                      <span>{report.workspace_name || '--'}</span>
                      <span className={`workspace-status-pill ${report.status === 'completed' ? 'completed' : 'draft'}`}>
                        {report.status || 'draft'}
                      </span>
                      <span>{report.compliance_percentage ?? 0}%</span>
                      <span>{report.updated_at || report.created_at || '--'}</span>
                      <button
                        type="button"
                        className="workspace-view-button"
                        onClick={() => onOpenPortfolioReport(report)}
                        title="View report"
                        aria-label="View report"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        className="workspace-report-download"
                        onClick={() => onDownloadPortfolioReport(report)}
                        disabled={!report.report_file_path}
                        title={report.report_file_path ? 'Download generated PDF report' : 'Generated PDF not available yet'}
                        aria-label={report.report_file_path ? 'Download generated PDF report' : 'Generated PDF not available yet'}
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {auditResult && (
      <section className="two-column-grid report-summary-grid">
        <div className="report-section-card report-score-card">
          <div className="report-score-ring" style={{ '--score-color': pctColor, '--score-value': pct }} >
            <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="8" />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke={pctColor}
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={2 * Math.PI * 40 * (1 - pct / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="report-score-text">
              <span>{pct}%</span>
              <small>score</small>
            </div>
          </div>

          <div className="report-score-copy">
            <h3>Overall compliance score</h3>
            <p className="muted-copy">
              {pct >= 85
                ? 'Plan aligns strongly with the built-in CCAS baseline.'
                : pct >= 60
                  ? 'Moderate adherence with important remediation actions required.'
                  : 'Low adherence. Significant remediation is required before acceptance.'}
            </p>
            <div className="report-badge-row">
              <span className="badge ready">Compliance: {compliantSubs}</span>
              <span className="badge warn">Partial: {partialSubs}</span>
              <span className="badge danger">Non-compliance: {nonSubs}</span>
            </div>
          </div>
        </div>

        <div className="report-section-card report-metadata-card">
          <div className="report-meta-grid">
            <div>
              <div className="metric-label">Document</div>
              <div className="report-meta-value">{file?.name || 'Unavailable'}</div>
            </div>
            <div>
              <div className="metric-label">Started</div>
              <div className="report-meta-value mono-text">{scanStartTime || '--:--:--'}</div>
            </div>
            <div>
              <div className="metric-label">Finished</div>
              <div className="report-meta-value mono-text">{scanEndTime || '--:--:--'}</div>
            </div>
            <div>
              <div className="metric-label">Duration</div>
              <div className="report-meta-value mono-text">
                {scanDuration ? `${Math.floor(scanDuration / 60) > 0 ? `${Math.floor(scanDuration / 60)}m ` : ''}${scanDuration % 60}s` : '--s'}
              </div>
            </div>
          </div>

          <div className="button-row report-button-row">
            <button type="button" className="btn-primary" onClick={downloadPdfReport}>
              <Download size={16} />
              <span>Download PDF</span>
            </button>
            <button type="button" className="btn-secondary" onClick={resetUploader}>
              <RefreshCw size={16} />
              <span>Rescan</span>
            </button>
          </div>
        </div>
      </section>
      )}

      {auditResult && (
      <section className="report-section-card">
        <div className="section-title">
          <div>
            <h3>Clause results</h3>
            <p>{auditSections.length} sections mapped against the CCAS baseline</p>
          </div>
          <span className="status-pill accent">
            <FileSearch size={14} />
            <span>Structured drill-down</span>
          </span>
        </div>

        <div className="report-list">
          {displayedSections.map((section) => {
            const secStatus = section.overall_status || normalizeStatus(section);
            const cfg = statusConfig(secStatus);
            const isOpen = !!expandedSections[section.section_num];
            const subsections = section.subsections || [];
            const compliantCount = subsections.filter((sub) => normalizeStatus(sub) === 'compliant').length;
            const partialCount = subsections.filter((sub) => normalizeStatus(sub) === 'partial').length;
            const nonCompliantCount = subsections.filter((sub) => normalizeStatus(sub) === 'non-compliant').length;

            return (
              <div key={section.section_num} className="report-section-entry" style={{ '--entry-border': cfg.border, '--entry-bg': cfg.bg }}>
                <button type="button" className="report-section-toggle" onClick={() => toggleSection(section.section_num)}>
                  <div className="report-section-left">
                    <span className="report-section-dot" style={{ background: cfg.dot }} />
                    <div>
                      <div className="report-section-title">Section {section.section_num}: {section.section_title}</div>
                      <div className="report-section-subcopy">{cfg.label}</div>
                    </div>
                  </div>

                  <div className="report-section-right">
                    {compliantCount > 0 && <span className="badge ready">Compliance: {compliantCount}/{subsections.length}</span>}
                    {partialCount > 0 && <span className="badge warn">Partial: {partialCount}/{subsections.length}</span>}
                    {nonCompliantCount > 0 && <span className="badge danger">Non: {nonCompliantCount}/{subsections.length}</span>}
                    {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="report-subsection-list">
                    {subsections.map((sub) => {
                      const subStatus = normalizeStatus(sub);
                      const subCfg = statusConfig(subStatus);
                      return (
                        <div key={sub.id} className="report-subsection-card" style={{ '--sub-border': subCfg.border, '--sub-dot': subCfg.dot }}>
                          <div className="report-subsection-head">
                            <div className="report-subsection-title">{sub.id} {sub.title}</div>
                            <span className={`badge ${subStatus === 'compliant' ? 'ready' : subStatus === 'partial' ? 'warn' : 'danger'}`}>
                              {subCfg.label}
                            </span>
                          </div>
                          <p className="muted-copy">{sub.description}</p>

                          {(subStatus === 'partial' || subStatus === 'non-compliant') && sub.proposed_solution && (
                            <div className="report-remediation-card">
                              <div className="report-remediation-head">
                                <AlertTriangle size={14} />
                                <span>{subStatus === 'partial' ? 'Remediation action required' : 'Proposed solution to comply'}</span>
                              </div>
                              <p>{sub.proposed_solution}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="report-pagination">
            <button type="button" className="btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}>
              Prev
            </button>
            <div className="report-page-pills">
              {Array.from({ length: totalPages }).map((_, index) => {
                const pageNum = index + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    className={`report-page-pill ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}>
              Next
            </button>
          </div>
        )}
      </section>
      )}
    </>
  );
}
