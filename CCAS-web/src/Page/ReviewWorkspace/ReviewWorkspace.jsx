import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  FileText,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import './ReviewWorkspace.css';

const reviewSteps = [
  { id: 'acknowledge', title: 'Acknowledge', copy: 'Accept the review conditions before continuing' },
  { id: 'template', title: 'Template', copy: 'Choose and download the built-in CCoP template' },
  { id: 'evidence', title: 'Evidence', copy: 'Upload one PDF or DOCX cybersecurity plan' },
  { id: 'scan', title: 'Scan', copy: 'Execute the local AI model and watch progress' },
  { id: 'result', title: 'Result', copy: 'Review the structured compliance findings' },
];

const MODAL_EXIT_DURATION_MS = 180;

function useModalTransition(isOpen) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return undefined;
    }

    if (!shouldRender) {
      return undefined;
    }

    setIsClosing(true);
    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, MODAL_EXIT_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, shouldRender]);

  return { shouldRender, isClosing };
}

export default function ReviewWorkspace({
  activeReviewStep,
  file,
  isDragging,
  errorMsg,
  uploadState,
  progress,
  statusMessage,
  selectedModel,
  selectedModelLabel,
  availableModels,
  availableTemplates,
  selectedTemplateId,
  onModelChange,
  onStartScan,
  onAcknowledge,
  onSelectTemplate,
  onConfirmTemplate,
  onBackToAcknowledgeStep,
  onBackToTemplateStep,
  onDownloadTemplate,
  onCreateReport,
  onConfirmCreateReport,
  onCloseReportModal,
  onOpenWorkspaceReport,
  onDownloadWorkspaceReport,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  onRemoveFile,
  fileInputRef,
  scanStartTime,
  elapsedSeconds,
  estimatedCompleteTime,
  scanLogs,
  formatElapsedTime,
  workspaceHistory,
  isHistoryLoading,
  onOpenWorkspaceHistory,
  onCreateWorkspace,
  onConfirmCreateWorkspace,
  onCloseWorkspaceModal,
  onDeleteWorkspace,
  onConfirmDeleteWorkspace,
  onCloseDeleteWorkspaceModal,
  onBackToWorkspaceList,
  currentWorkspaceId,
  currentWorkspaceName,
  currentWorkspaceReports,
  currentReportId,
  currentReportName,
  isWorkspaceModalOpen,
  newWorkspaceName,
  onWorkspaceNameChange,
  isWorkspaceSaving,
  isReportModalOpen,
  newReportName,
  onReportNameChange,
  isReportSaving,
  workspaceDeletingId,
  deleteWorkspaceTarget,
  resolveModelLabel,
}) {
  const hasActiveWorkspace = Boolean(currentWorkspaceId);
  const hasSelectedReport = Boolean(currentReportId);
  const workspaceReports = Array.isArray(currentWorkspaceReports) ? currentWorkspaceReports : [];
  const workspaceModalState = useModalTransition(isWorkspaceModalOpen);
  const reportModalState = useModalTransition(isReportModalOpen);
  const deleteModalState = useModalTransition(Boolean(deleteWorkspaceTarget));

  return (
    <>
      {!hasActiveWorkspace && (
        <section className="review-workspace-manager">
          <div className="admin-card workspace-manager-panel">
            <div className="section-title">
              <div>
                <h3>Created workspaces</h3>
                <p>Create a new workspace or open an existing one from the Database record list</p>
              </div>
              <button type="button" className="btn-primary workspace-create-button" onClick={onCreateWorkspace}>
                <Plus size={16} />
                <span>Create workspace</span>
              </button>
            </div>

            {errorMsg && (
              <div className="workspace-alert workspace-manager-alert">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {isHistoryLoading ? (
              <div className="workspace-history-empty">Loading saved workspaces...</div>
            ) : workspaceHistory.length === 0 ? (
              <div className="workspace-history-empty-card">
                <div className="workspace-history-empty">
                  No saved workspace yet. Click `Create workspace` to start a new review workspace.
                </div>
              </div>
            ) : (
              <div className="workspace-history-table-wrap">
                <div className="workspace-history-table">
                  <div className="workspace-history-row workspace-history-head workspace-list-row">
                    <span>Name</span>
                    <span>Reports</span>
                    <span>Updated</span>
                    <span>Action</span>
                  </div>
                  {workspaceHistory.map((workspace) => (
                    <div
                      key={workspace.workspace_id}
                      className="workspace-history-row workspace-history-data workspace-list-row"
                      onDoubleClick={() => onOpenWorkspaceHistory(workspace.workspace_id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpenWorkspaceHistory(workspace.workspace_id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="workspace-history-name">{workspace.workspace_name || 'Workspace'}</span>
                      <span>{workspace.report_count ?? 0}</span>
                      <span>{workspace.updated_at || workspace.created_at || '--'}</span>
                      <div className="workspace-row-actions">
                        <button
                          type="button"
                          className="workspace-view-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenWorkspaceHistory(workspace.workspace_id);
                          }}
                          title="View workspace"
                          aria-label="View workspace"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="workspace-delete-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteWorkspace(workspace);
                          }}
                          disabled={workspaceDeletingId === workspace.workspace_id}
                          title={workspaceDeletingId === workspace.workspace_id ? 'Deleting workspace' : 'Delete workspace'}
                          aria-label={workspaceDeletingId === workspace.workspace_id ? 'Deleting workspace' : 'Delete workspace'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {hasActiveWorkspace && !hasSelectedReport && (
        <>
          <section className="review-workspace-manager">
            <div className="admin-card workspace-manager-panel">
              <div className="section-title">
                <div>
                  <h3>Reports in workspace</h3>
                  <p>Create a report entry first, then upload and run the review inside that report.</p>
                </div>
                <button type="button" className="btn-primary workspace-create-button" onClick={onCreateReport}>
                  <span>Create</span>
                </button>
              </div>

              {errorMsg && (
                <div className="workspace-alert workspace-manager-alert">
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {workspaceReports.length === 0 ? (
                <div className="workspace-history-empty-card">
                  <div className="workspace-history-empty">
                    No report in this workspace yet. Click `Create report` to add the first report row.
                  </div>
                </div>
              ) : (
                <div className="workspace-history-table-wrap">
                  <div className="workspace-history-table workspace-report-table">
                    <div className="workspace-history-row workspace-history-head workspace-report-row">
                      <span>Report</span>
                      <span>Document</span>
                      <span>Model</span>
                      <span>Status</span>
                      <span>Updated</span>
                      <span>Score</span>
                      <span>View</span>
                      <span>Download</span>
                    </div>
                    {workspaceReports.map((report) => (
                      <div
                        key={report.report_id}
                        className="workspace-history-row workspace-history-data workspace-report-row"
                        onDoubleClick={() => onOpenWorkspaceReport(report)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onOpenWorkspaceReport(report);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="workspace-history-name">{report.report_name || 'Report'}</span>
                        <span>{report.document_name || '--'}</span>
                        <span>{resolveModelLabel(report.model)}</span>
                        <span className={`workspace-status-pill ${report.status === 'completed' ? 'completed' : 'draft'}`}>
                          {report.status || 'draft'}
                        </span>
                        <span>{report.updated_at || report.created_at || '--'}</span>
                        <span>{report.compliance_percentage ?? 0}%</span>
                        <button
                          type="button"
                          className="workspace-view-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenWorkspaceReport(report);
                          }}
                          title="View report details"
                          aria-label="View report details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="workspace-report-download"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDownloadWorkspaceReport(report);
                          }}
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
            </div>
          </section>
        </>
      )}

      {hasActiveWorkspace && hasSelectedReport && (
        <>
          <section className="review-steps-grid">
            {reviewSteps.map((step, index) => (
              <div key={step.id} className={`step-card ${activeReviewStep === index + 1 ? 'step-card-active' : ''}`}>
                <div className="step-index">0{index + 1}</div>
                <div className="step-title">{step.title}</div>
                <div className="step-copy">{step.copy}</div>
              </div>
            ))}
          </section>
        </>
      )}

      {hasActiveWorkspace && hasSelectedReport && activeReviewStep === 1 && uploadState !== 'scanning' && (
        <section className="review-workspace-simple">
          <div className="upload-command-panel simple-review-panel review-flow-panel">
            <div className="section-title">
              <div>
                <h3>Acknowledge review conditions</h3>
                <p>{currentReportName || 'Selected report'} must confirm the built-in review conditions before continuing.</p>
              </div>
            </div>

            <div className="review-flow-card">
              <div className="review-flow-copy">
                This review uses the fixed internal CCoP v2.1 assessment baseline. Uploaded evidence is evaluated only against that controlled template and the selected local LM Studio model.
              </div>
              <div className="review-ack-list">
                <div className="review-ack-item">I understand this report follows the built-in CCoP v2.1 assessment flow.</div>
                <div className="review-ack-item">I understand the uploaded plan document must align with the selected assessment template.</div>
                <div className="review-ack-item">I understand scan results are generated from the current local AI runtime and stored under this workspace report.</div>
              </div>
            </div>

            <div className="workspace-action-row review-flow-actions">
              <button type="button" className="btn-primary" onClick={onAcknowledge}>
                <span>Acknowledge</span>
              </button>
            </div>

            {errorMsg && (
              <div className="workspace-alert">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {hasActiveWorkspace && hasSelectedReport && activeReviewStep === 2 && uploadState !== 'scanning' && (
        <section className="review-workspace-simple">
          <div className="upload-command-panel simple-review-panel review-flow-panel">
            <div className="section-title">
              <div>
                <h3>Choose assessment template</h3>
                <p>Select the CCoP template used for this report, download it if needed, then continue to evidence upload.</p>
              </div>
            </div>

            <div className="template-selection-hint">
              Click anywhere on the template card below to select it for this report.
            </div>

            <div className="template-choice-grid">
              {availableTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`template-choice-card ${selectedTemplateId === template.id ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectTemplate(template.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectTemplate(template.id);
                    }
                  }}
                >
                  <div className="template-choice-head">
                    <div className="template-choice-title-group">
                      <span className={`template-choice-indicator ${selectedTemplateId === template.id ? 'selected' : ''}`} />
                      <div className="template-choice-title">{template.name}</div>
                    </div>
                    <span className="badge accent">{template.format}</span>
                  </div>
                  <div className="template-choice-copy">{template.summary}</div>
                  <div className="template-choice-actions">
                    <div className="template-choice-action-group">
                      <span className={`template-select-button ${selectedTemplateId === template.id ? 'selected' : ''}`}>
                        {selectedTemplateId === template.id ? 'Selected' : 'Select template'}
                      </span>
                      <span className="template-choice-state">
                        {selectedTemplateId === template.id ? 'This template will be used for the next step.' : 'Click the card or the Select template button area to choose it.'}
                      </span>
                    </div>
                    <button type="button" className="template-download-link" onClick={(event) => {
                      event.stopPropagation();
                      onDownloadTemplate();
                    }}
                    >
                      Download template
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="workspace-action-row review-flow-actions review-flow-actions-split">
              <button type="button" className="btn-secondary" onClick={onBackToAcknowledgeStep}>
                <span>Back</span>
              </button>
              <button type="button" className="btn-primary" onClick={onConfirmTemplate}>
                <span>Next</span>
              </button>
            </div>

            {errorMsg && (
              <div className="workspace-alert">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {hasActiveWorkspace && hasSelectedReport && activeReviewStep === 3 && uploadState !== 'scanning' && (
        <section className="review-workspace-simple">
          <div className="upload-command-panel simple-review-panel">
            <div className="section-title">
              <div>
                <h3>Evidence intake</h3>
                <p>{currentReportName || 'Selected report'} · upload one plan document and choose the local model for the scan</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />

            {!file ? (
              <div
                className={`review-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="review-dropzone-icon">
                  <UploadCloud size={34} />
                </div>
                <h4>Select your plan document</h4>
                <p>Drag and drop your PDF or DOCX file here, or click to browse.</p>
                <span className="badge warn">PDF or DOCX · max 25MB</span>
              </div>
            ) : (
              <div className="review-uploaded-file">
                <div className="review-uploaded-meta">
                  <div className="review-uploaded-icon">
                    <FileText size={24} />
                  </div>
                  <div>
                    <div className="review-uploaded-title">{file.name}</div>
                    <div className="review-uploaded-copy">
                      {file.size || 'Selected document'} {file.type ? `· ${String(file.type).toUpperCase()}` : ''}
                    </div>
                  </div>
                </div>
                <button type="button" className="review-uploaded-remove" onClick={onRemoveFile}>
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="workspace-field">
              <label htmlFor="workspace-model" className="workspace-label">Scan model</label>
              <select
                id="workspace-model"
                className="workspace-select"
                value={selectedModel}
                onChange={(event) => onModelChange(event.target.value)}
              >
                {availableModels.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="workspace-action-row">
              <button type="button" className="btn-secondary" onClick={onBackToTemplateStep}>
                <span>Back</span>
              </button>
              <button type="button" className="btn-primary" onClick={onStartScan} disabled={!file}>
                <ShieldCheck size={16} />
                <span>Run review</span>
              </button>
            </div>

            {errorMsg && (
              <div className="workspace-alert">
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {uploadState === 'scanning' && (
        <section className="scan-dashboard-panel">
          <div className="scan-dashboard-head">
            <div>
              <div className="section-kicker">AI Compliance Engine</div>
              <h3>Analyzing document</h3>
              <p className="muted-copy">
                Semantic audit against CCoP v2.1 · {currentReportName || 'Selected report'} · {file?.name} · {selectedModelLabel || selectedModel}
              </p>
            </div>
            <span className="status-pill ready">Runtime active</span>
          </div>

          <div className="scan-grid">
            <div className="scan-visual-panel">
              <div className="scan-radar">
                <div className="scan-ring ring-1" />
                <div className="scan-ring ring-2" />
                <div className="scan-ring ring-3" />
                <div className="scan-radar-dot dot-1" />
                <div className="scan-radar-dot dot-2" />
                <div className="scan-radar-dot dot-3" />
                <div className="scan-radar-dot dot-4" />
                <div className="scan-sweep" />
                <div className="scan-center">
                  <ShieldCheck size={26} />
                </div>
              </div>

              <div className="scan-progress-copy">
                <div className="scan-progress-text">{statusMessage}</div>
                <div className="scan-progress-value">{progress}%</div>
              </div>

              <div className="scan-progress-bar">
                <div className="scan-progress-fill" style={{ width: `${progress}%` }} />
              </div>

              <div className="three-column-grid scan-metrics-grid">
                <div className="scan-metric-card">
                  <div className="metric-label">Started</div>
                  <div className="metric-value mono-text scan-metric-value">{scanStartTime || '--:--:--'}</div>
                </div>
                <div className="scan-metric-card">
                  <div className="metric-label">Elapsed</div>
                  <div className="metric-value mono-text scan-metric-value">{formatElapsedTime(elapsedSeconds)}</div>
                </div>
                <div className="scan-metric-card">
                  <div className="metric-label">Est. done</div>
                  <div className="metric-value mono-text scan-metric-value">{estimatedCompleteTime || '--:--:--'}</div>
                </div>
              </div>
            </div>

            <div className="scan-log-wrapper">
              <div className="section-title">
                <div>
                  <h3>Audit process logs</h3>
                  <p>Reference-inspired rotating review activity stream</p>
                </div>
              </div>
              <div className="scan-log-panel-alt">
                {scanLogs.map((log, index) => {
                  const isActive = index === scanLogs.length - 1;
                  const tagText = log.type === 'ok' ? 'PASS' : log.type === 'warn' ? 'EVAL' : log.type === 'fail' ? 'FAIL' : 'SCAN';
                  const tagClass = log.type === 'ok' ? 'ready' : log.type === 'warn' ? 'warn' : log.type === 'fail' ? 'danger' : 'accent';

                  return (
                    <div key={log.id} className={`scan-log-item ${isActive ? 'active' : ''}`}>
                      <span className={`badge ${tagClass}`}>{tagText}</span>
                      <span className={`scan-log-copy ${isActive ? 'active' : ''}`}>{log.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {workspaceModalState.shouldRender && (
        <div
          className={`workspace-modal-overlay ${workspaceModalState.isClosing ? 'closing' : 'opening'}`}
          onClick={onCloseWorkspaceModal}
        >
          <div
            className={`workspace-modal ${workspaceModalState.isClosing ? 'closing' : 'opening'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-modal-head">
              <div>
                <h3>Create workspace</h3>
                <p>Enter the workspace name before starting the CCAS review flow.</p>
              </div>
              <button type="button" className="workspace-modal-close" onClick={onCloseWorkspaceModal} disabled={isWorkspaceSaving}>
                <X size={18} />
              </button>
            </div>

            <div className="workspace-modal-body">
              <label htmlFor="workspace-name" className="workspace-label">Workspace name</label>
              <input
                id="workspace-name"
                className="workspace-name-input"
                type="text"
                value={newWorkspaceName}
                onChange={(event) => onWorkspaceNameChange(event.target.value)}
                placeholder="Enter workspace name"
                autoFocus
              />
            </div>

            <div className="workspace-modal-actions">
              <button type="button" className="btn-secondary" onClick={onCloseWorkspaceModal} disabled={isWorkspaceSaving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={onConfirmCreateWorkspace} disabled={isWorkspaceSaving}>
                <span>{isWorkspaceSaving ? 'Creating...' : 'Create'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {reportModalState.shouldRender && (
        <div
          className={`workspace-modal-overlay ${reportModalState.isClosing ? 'closing' : 'opening'}`}
          onClick={onCloseReportModal}
        >
          <div
            className={`workspace-modal ${reportModalState.isClosing ? 'closing' : 'opening'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-modal-head">
              <div>
                <h3>Create report</h3>
                <p>Enter the report name before opening the upload and review page.</p>
              </div>
              <button type="button" className="workspace-modal-close" onClick={onCloseReportModal} disabled={isReportSaving}>
                <X size={18} />
              </button>
            </div>

            <div className="workspace-modal-body">
              <label htmlFor="report-name" className="workspace-label">Report name</label>
              <input
                id="report-name"
                className="workspace-name-input"
                type="text"
                value={newReportName}
                onChange={(event) => onReportNameChange(event.target.value)}
                placeholder="Enter report name"
                autoFocus
              />
            </div>

            <div className="workspace-modal-actions">
              <button type="button" className="btn-secondary" onClick={onCloseReportModal} disabled={isReportSaving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={onConfirmCreateReport} disabled={isReportSaving}>
                <span>{isReportSaving ? 'Creating...' : 'Create'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalState.shouldRender && (
        <div
          className={`workspace-modal-overlay ${deleteModalState.isClosing ? 'closing' : 'opening'}`}
          onClick={onCloseDeleteWorkspaceModal}
        >
          <div
            className={`workspace-modal workspace-delete-modal ${deleteModalState.isClosing ? 'closing' : 'opening'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-modal-head">
              <div>
                <h3>Delete workspace</h3>
                <p>This will remove the workspace record, all report rows, uploaded files, and saved PDF reports permanently.</p>
              </div>
              <button
                type="button"
                className="workspace-modal-close"
                onClick={onCloseDeleteWorkspaceModal}
                disabled={Boolean(workspaceDeletingId)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="workspace-modal-body">
              <div className="workspace-delete-summary">
                <div className="workspace-delete-name">{deleteWorkspaceTarget.workspace_name || 'Workspace'}</div>
                <div className="workspace-delete-copy">
                  This workspace and all linked reports will be deleted.
                </div>
              </div>
            </div>

            <div className="workspace-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={onCloseDeleteWorkspaceModal}
                disabled={Boolean(workspaceDeletingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="workspace-delete-confirm"
                onClick={onConfirmDeleteWorkspace}
                disabled={Boolean(workspaceDeletingId)}
              >
                <Trash2 size={16} />
                <span>{workspaceDeletingId ? 'Deleting...' : 'Delete workspace'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
