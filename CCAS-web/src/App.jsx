import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from './Page/AppShell/AppShell';
import Dashboard from './Page/Dashboard/Dashboard';
import ReviewWorkspace from './Page/ReviewWorkspace/ReviewWorkspace';
import Reports from './Page/Reports/Reports';
import StandardsAdmin from './Page/StandardsAdmin/StandardsAdmin';
import { backendApiBaseUrl } from './config/api';
import './Page/Dashboard/Dashboard.css';
import './Page/ReviewWorkspace/ReviewWorkspace.css';
import './Page/Reports/Reports.css';
import './Page/StandardsAdmin/StandardsAdmin.css';

const availableModels = [
  { value: 'ornith-1.0-35b', label: 'Ornith 35B' },
  { value: 'qwen-3-14b-instruct', label: 'Qwen 3 14B Instruct' }
];

const passiveScanLogs = [
  { id: 'leadership', type: 'ok', text: 'Section 3.1 - Leadership and Oversight matched' },
  { id: 'access', type: 'warn', text: 'Section 5.1 - Access Control under semantic review' },
  { id: 'bcp', type: 'info', text: 'Section 8.2 - BCP/DRP cross-referencing related clauses' },
  { id: 'awareness', type: 'ok', text: 'Section 9.1 - Awareness Programme confirmed' },
  { id: 'threat', type: 'fail', text: 'Section 6.3 - Threat Hunting evidence gap detected' }
];

const statusSteps = [
  { threshold: 0, text: 'Uploading file to local CCAS-Agent...' },
  { threshold: 20, text: 'Extracting text and structure content...' },
  { threshold: 45, text: 'Mapping standard controls against CCoP v2.1 reference template...' },
  { threshold: 70, text: 'Executing selected AI model compliance audit...' },
  { threshold: 90, text: 'Finalizing analysis and checking AI response quality...' }
];

const estimatedScanDurationSeconds = 12 * 60;
const DEFAULT_REVIEW_FLOW_STATE = {
  acknowledged: false,
  selectedTemplateId: '',
  templateConfirmed: false
};
const ccopTemplateOptions = [
  {
    id: 'ccop-v21',
    name: 'CCoP v2.1 Assessment Template',
    summary: 'Built-in CCAS template used for every compliance assessment run.',
    format: 'PDF'
  }
];

function App() {
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [auditResult, setAuditResult] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scanStartTime, setScanStartTime] = useState('');
  const [scanEndTime, setScanEndTime] = useState('');
  const [scanDuration, setScanDuration] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedCompleteTime, setEstimatedCompleteTime] = useState('');
  const [logRotationIndex, setLogRotationIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState('ornith-1.0-35b');
  const [runtimeHealth, setRuntimeHealth] = useState({
    reachable: false,
    label: 'Checking LM Studio...'
  });
  const [workspaceHistory, setWorkspaceHistory] = useState([]);
  const [allWorkspaceReports, setAllWorkspaceReports] = useState([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState('');
  const [currentWorkspaceName, setCurrentWorkspaceName] = useState('');
  const [currentWorkspaceReports, setCurrentWorkspaceReports] = useState([]);
  const [currentReportId, setCurrentReportId] = useState('');
  const [currentReportName, setCurrentReportName] = useState('');
  const [reportFlowStateMap, setReportFlowStateMap] = useState({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isWorkspaceSaving, setIsWorkspaceSaving] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [newReportName, setNewReportName] = useState('');
  const [isReportSaving, setIsReportSaving] = useState(false);
  const [workspaceDeletingId, setWorkspaceDeletingId] = useState('');
  const [deleteWorkspaceTarget, setDeleteWorkspaceTarget] = useState(null);

  const fileInputRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const scanStartTimestampRef = useRef(null);
  const apiBaseRef = useRef(backendApiBaseUrl);

  useEffect(() => {
    let interval = null;
    if (uploadState === 'scanning') {
      const startTicks = Date.now();
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTicks) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [uploadState]);

  useEffect(() => {
    if (uploadState !== 'scanning') {
      setLogRotationIndex(0);
      return undefined;
    }

    const rotationInterval = setInterval(() => {
      setLogRotationIndex((prev) => (prev + 1) % passiveScanLogs.length);
    }, 1600);

    return () => clearInterval(rotationInterval);
  }, [uploadState]);

  useEffect(() => () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceHistory();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRuntimeHealth = async () => {
      try {
        const response = await fetch(`${apiBaseRef.current}/api/runtime/health`);
        const payload = await response.json();
        if (!cancelled) {
          setRuntimeHealth({
            reachable: Boolean(payload.reachable),
            label: payload.label || (payload.reachable ? 'LM Studio reachable' : 'LM Studio offline')
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRuntimeHealth({
            reachable: false,
            label: 'LM Studio offline'
          });
        }
      }
    };

    loadRuntimeHealth();
    const intervalId = window.setInterval(loadRuntimeHealth, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const orderedPassiveScanLogs = passiveScanLogs.length
    ? [
      ...passiveScanLogs.slice(logRotationIndex % passiveScanLogs.length),
      ...passiveScanLogs.slice(0, logRotationIndex % passiveScanLogs.length)
    ]
    : [];

  const scanLogs = [
    ...orderedPassiveScanLogs,
    {
      id: 'active-scan',
      type: 'scan',
      text: `Analyzing: ${statusMessage || 'CCoP compliance checklist mappings'}`
    }
  ];

  const selectedModelLabel = availableModels.find((model) => model.value === selectedModel)?.label || selectedModel;

  const resolveModelLabel = (modelValue) => (
    availableModels.find((model) => model.value === modelValue)?.label || modelValue || 'Unknown model'
  );

  const buildStoredFile = (documentName, size = '', raw = null) => {
    if (!documentName) return null;
    const extension = documentName.includes('.') ? documentName.split('.').pop().toLowerCase() : '';
    return {
      name: documentName,
      size,
      type: extension,
      raw
    };
  };

  const clearSelectedReportState = () => {
    setCurrentReportId('');
    setCurrentReportName('');
    setFile(null);
    setUploadState('idle');
    setProgress(0);
    setStatusMessage('');
    setErrorMsg('');
    setAuditResult(null);
    setCurrentPage(1);
    setExpandedSections({});
    setScanStartTime('');
    setScanEndTime('');
    setScanDuration(0);
    setElapsedSeconds(0);
    setEstimatedCompleteTime('');
    setLogRotationIndex(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateReportFlowState = (reportId, updates) => {
    if (!reportId) return;
    setReportFlowStateMap((prev) => ({
      ...prev,
      [reportId]: {
        ...DEFAULT_REVIEW_FLOW_STATE,
        ...(prev[reportId] || {}),
        ...updates
      }
    }));
  };

  const currentReportFlow = currentReportId
    ? {
      ...DEFAULT_REVIEW_FLOW_STATE,
      ...(reportFlowStateMap[currentReportId] || {})
    }
    : DEFAULT_REVIEW_FLOW_STATE;

  const selectWorkspaceReport = (report, nextNav = 'Review Workspace') => {
    if (!report) {
      clearSelectedReportState();
      setActiveNav('Review Workspace');
      return;
    }

    const reportTimestamp = report.updated_at || report.created_at || '';
    const reportDate = reportTimestamp ? new Date(reportTimestamp) : null;
    const reportTime = reportDate && !Number.isNaN(reportDate.getTime())
      ? reportDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '';

    if (report.report_id && (report.audit_result || report.document_name || report.status === 'completed')) {
      updateReportFlowState(report.report_id, {
        acknowledged: true,
        selectedTemplateId: 'ccop-v21',
        templateConfirmed: true
      });
    }

    setCurrentReportId(report.report_id || '');
    setCurrentReportName(report.report_name || '');
    setSelectedModel(report.model || selectedModel);
    setFile(buildStoredFile(report.document_name || ''));
    setAuditResult(report.audit_result || null);
    setErrorMsg('');
    setCurrentPage(1);
    setExpandedSections({});

    if (report.audit_result) {
      setUploadState('completed');
      setProgress(100);
      setStatusMessage('Analysis complete!');
      setScanStartTime(reportTime);
      setScanEndTime(reportTime);
      setScanDuration(0);
      setActiveNav(nextNav);
      return;
    }

    setUploadState('idle');
    setProgress(0);
    setStatusMessage('');
    setScanStartTime('');
    setScanEndTime('');
    setScanDuration(0);
    setElapsedSeconds(0);
    setEstimatedCompleteTime('');
    setLogRotationIndex(0);
    setActiveNav('Review Workspace');
  };

  const normalizeStatus = (section) => {
    if (section.status) return section.status;
    if (section.overall_status) return section.overall_status;
    if (section.compliant === true) return 'compliant';
    return 'non-compliant';
  };

  const auditSections = useMemo(() => {
    if (!auditResult) return [];

    return auditResult.sections || (() => {
      const flat = auditResult.all_sections || [
        ...(auditResult.matches || []).map((item) => ({ ...item, status: 'compliant' })),
        ...(auditResult.gaps || []).map((item) => ({ ...item, status: 'non-compliant' })),
      ];

      return flat.map((item, index) => ({
        section_num: index + 1,
        section_title: item.title,
        overall_status: normalizeStatus(item),
        subsections: [{
          id: item.id,
          title: item.title,
          status: normalizeStatus(item),
          description: item.description,
          proposed_solution: item.proposed_solution
        }]
      }));
    })();
  }, [auditResult]);

  const metrics = useMemo(() => {
    const total = auditSections.reduce((acc, section) => acc + (section.subsections?.length || 0), 0);
    const compliant = auditSections.reduce((acc, section) => acc + (section.subsections?.filter((sub) => normalizeStatus(sub) === 'compliant').length || 0), 0);
    const partial = auditSections.reduce((acc, section) => acc + (section.subsections?.filter((sub) => normalizeStatus(sub) === 'partial').length || 0), 0);
    const nonCompliant = total - compliant - partial;

    return { total, compliant, partial, nonCompliant };
  }, [auditSections]);

  const totalPages = Math.max(1, Math.ceil(auditSections.length / 4));

  const statusConfig = (status) => {
    if (status === 'compliant') return { bg: 'rgba(34, 197, 94, 0.12)', border: '#10b981', text: '#86efac', label: 'COMPLIANT', dot: '#10b981' };
    if (status === 'partial') return { bg: 'rgba(245, 158, 11, 0.12)', border: '#f59e0b', text: '#fcd34d', label: 'PARTIALLY COMPLIANT', dot: '#f59e0b' };
    return { bg: 'rgba(239, 68, 68, 0.12)', border: '#ef4444', text: '#fca5a5', label: 'NON-COMPLIANT', dot: '#ef4444' };
  };

  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB'];
    const index = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, index)).toFixed(dm))} ${sizes[index]}`;
  };

  const formatElapsedTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins <= 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const buildReportFileName = (originalName) => {
    const baseName = (originalName || 'audit_report').replace(/\.[^/.]+$/, '');
    const simpleName = baseName
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_') || 'audit_report';

    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const timestamp = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    return `${simpleName}_${timestamp}.pdf`;
  };

  const loadAllWorkspaceReports = async (workspaces) => {
    if (!Array.isArray(workspaces) || workspaces.length === 0) {
      setAllWorkspaceReports([]);
      return;
    }

    try {
      const payloads = await Promise.all(
        workspaces.map(async (workspace) => {
          const response = await fetch(`${apiBaseRef.current}/api/workspaces/${workspace.workspace_id}`);
          if (!response.ok) return null;
          return response.json();
        })
      );

      const combinedReports = payloads
        .filter(Boolean)
        .flatMap((payload) => (Array.isArray(payload.reports) ? payload.reports.map((report) => ({
          ...report,
          workspace_id: payload.workspace_id,
          workspace_name: payload.workspace_name
        })) : []))
        .sort((left, right) => {
          const leftStamp = left.updated_at || left.created_at || '';
          const rightStamp = right.updated_at || right.created_at || '';
          return rightStamp.localeCompare(leftStamp);
        });

      setAllWorkspaceReports(combinedReports);
    } catch (error) {
      console.error('Portfolio reports load failed:', error);
      setAllWorkspaceReports([]);
    }
  };

  const loadWorkspaceHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const response = await fetch(`${apiBaseRef.current}/api/workspaces`);
      if (!response.ok) {
        throw new Error('Failed to load workspace history');
      }
      const data = await response.json();
      const workspaces = Array.isArray(data.workspaces) ? data.workspaces : [];
      setWorkspaceHistory(workspaces);
      await loadAllWorkspaceReports(workspaces);
    } catch (error) {
      console.error('Workspace history load failed:', error);
      setAllWorkspaceReports([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const applyWorkspacePayload = (payload, nextNav = 'Review Workspace', preferredReportId = '') => {
    const reports = Array.isArray(payload.reports) ? payload.reports : [];
    setCurrentWorkspaceId(payload.workspace_id || payload.summary?.workspace_id || '');
    setCurrentWorkspaceName(payload.workspace_name || payload.summary?.workspace_name || '');
    setCurrentWorkspaceReports(reports);
    setSelectedModel(payload.model || payload.summary?.model || selectedModel);

    let targetReport = null;
    if (preferredReportId) {
      targetReport = reports.find((report) => report.report_id === preferredReportId) || null;
    } else if (nextNav === 'Reports') {
      targetReport = reports.find((report) => Boolean(report.audit_result)) || null;
    }

    if (targetReport) {
      selectWorkspaceReport(targetReport, nextNav);
      return;
    }

    clearSelectedReportState();
    setActiveNav('Review Workspace');
  };

  const openWorkspaceFromHistory = async (workspaceId, nextNav = null, preferredReportId = '') => {
    try {
      const response = await fetch(`${apiBaseRef.current}/api/workspaces/${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to load workspace details');
      }
      const payload = await response.json();
      applyWorkspacePayload(payload, nextNav || 'Review Workspace', preferredReportId);
    } catch (error) {
      console.error('Workspace detail load failed:', error);
      setErrorMsg('Failed to open the saved workspace.');
      setActiveNav('Review Workspace');
    }
  };

  const persistPdfReport = async (workspaceId, reportId, pdfBlob, pdfFileName) => {
    if (!workspaceId || !reportId || !pdfBlob) return;

    const formData = new FormData();
    formData.append('report', new File([pdfBlob], pdfFileName, { type: 'application/pdf' }));
    formData.append('report_id', reportId);

    try {
      await fetch(`${apiBaseRef.current}/api/workspaces/${workspaceId}/report`, {
        method: 'POST',
        body: formData
      });
      await loadWorkspaceHistory();
      await openWorkspaceFromHistory(workspaceId, 'Reports', reportId);
    } catch (error) {
      console.error('Failed to persist PDF report:', error);
    }
  };

  const createWorkspaceDraft = async () => {
    const trimmedWorkspaceName = newWorkspaceName.trim();
    if (!trimmedWorkspaceName) {
      setErrorMsg('Please enter a workspace name.');
      return;
    }

    try {
      setErrorMsg('');
      setIsWorkspaceSaving(true);
      const response = await fetch(`${apiBaseRef.current}/api/workspaces/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, workspace_name: trimmedWorkspaceName })
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace. Please restart the CCAS-Agent backend and try again.');
      }

      const payload = await response.json();
      setIsWorkspaceModalOpen(false);
      setNewWorkspaceName('');
      applyWorkspacePayload(payload, 'Review Workspace');
      await loadWorkspaceHistory();
    } catch (error) {
      console.error('Workspace creation failed:', error);
      setErrorMsg(error.message || 'Failed to create a new workspace.');
    } finally {
      setIsWorkspaceSaving(false);
    }
  };

  const openCreateWorkspaceModal = () => {
    setErrorMsg('');
    setNewWorkspaceName(`CCAS Workspace ${new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '')}_${new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/:/g, '')}`);
    setIsWorkspaceModalOpen(true);
  };

  const closeCreateWorkspaceModal = () => {
    if (isWorkspaceSaving) return;
    setIsWorkspaceModalOpen(false);
    setNewWorkspaceName('');
  };

  const openCreateReportModal = () => {
    setErrorMsg('');
    setNewReportName(`CCAS Report ${new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '')}_${new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/:/g, '')}`);
    setIsReportModalOpen(true);
  };

  const closeCreateReportModal = () => {
    if (isReportSaving) return;
    setIsReportModalOpen(false);
    setNewReportName('');
  };

  const createWorkspaceReport = async () => {
    const trimmedReportName = newReportName.trim();
    if (!trimmedReportName || !currentWorkspaceId) {
      setErrorMsg('Please enter a report name.');
      return;
    }

    try {
      setErrorMsg('');
      setIsReportSaving(true);
      const response = await fetch(`${apiBaseRef.current}/api/workspaces/${currentWorkspaceId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_name: trimmedReportName, model: selectedModel })
      });

      if (!response.ok) {
        throw new Error('Failed to create report.');
      }

      const payload = await response.json();
      setIsReportModalOpen(false);
      setNewReportName('');
      if (payload.report?.report_id) {
        updateReportFlowState(payload.report.report_id, DEFAULT_REVIEW_FLOW_STATE);
      }
      applyWorkspacePayload(payload.workspace, 'Review Workspace', payload.report?.report_id || '');
      await loadWorkspaceHistory();
    } catch (error) {
      console.error('Report creation failed:', error);
      setErrorMsg(error.message || 'Failed to create the report.');
    } finally {
      setIsReportSaving(false);
    }
  };

  const goBackToWorkspaceList = async ({ reload = false } = {}) => {
    setCurrentWorkspaceId('');
    setCurrentWorkspaceName('');
    setCurrentWorkspaceReports([]);
    clearSelectedReportState();
    setActiveNav('Review Workspace');
    if (reload) {
      await loadWorkspaceHistory();
    }
  };

  const goBackToReportList = () => {
    clearSelectedReportState();
    setActiveNav('Review Workspace');
  };

  const downloadWorkspaceReport = (report, workspaceIdOverride = '') => {
    const targetWorkspaceId = workspaceIdOverride || report?.workspace_id || currentWorkspaceId;
    if (!targetWorkspaceId || !report?.report_id || !report?.report_file_path) {
      setErrorMsg('Generated PDF report is not available for this row yet.');
      return;
    }

    setErrorMsg('');
    const downloadLink = document.createElement('a');
    downloadLink.href = `${apiBaseRef.current}/api/workspaces/${targetWorkspaceId}/reports/${report.report_id}/download`;
    downloadLink.target = '_blank';
    downloadLink.rel = 'noreferrer';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const requestDeleteWorkspace = (workspace) => {
    setErrorMsg('');
    setDeleteWorkspaceTarget(workspace);
  };

  const closeDeleteWorkspaceModal = () => {
    if (workspaceDeletingId) return;
    setDeleteWorkspaceTarget(null);
  };

  const confirmDeleteWorkspace = async () => {
    if (!deleteWorkspaceTarget?.workspace_id) return;

    const workspaceId = deleteWorkspaceTarget.workspace_id;
    try {
      setErrorMsg('');
      setWorkspaceDeletingId(workspaceId);
      const response = await fetch(`${apiBaseRef.current}/api/workspaces/${workspaceId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete workspace.');
      }

      if (workspaceId === currentWorkspaceId) {
        goBackToWorkspaceList();
      }

      await loadWorkspaceHistory();
    } catch (error) {
      console.error('Workspace deletion failed:', error);
      setErrorMsg(error.message || 'Failed to delete the workspace.');
    } finally {
      setWorkspaceDeletingId('');
      setDeleteWorkspaceTarget(null);
    }
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const validateAndProcessFile = (selectedFile) => {
    setErrorMsg('');
    const ext = selectedFile.name.split('.').pop().toLowerCase();

    if (ext !== 'pdf' && ext !== 'docx') {
      setErrorMsg('Invalid file format. Please upload a PDF or DOCX plan document.');
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 25MB limit.');
      return;
    }

    setFile({
      name: selectedFile.name,
      size: formatBytes(selectedFile.size),
      type: ext,
      raw: selectedFile
    });
  };

  const removeSelectedFile = () => {
    setFile(null);
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      validateAndProcessFile(event.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      validateAndProcessFile(event.target.files[0]);
    }
  };

  const resetUploader = () => {
    setFile(null);
    setUploadState('idle');
    setProgress(0);
    setStatusMessage('');
    setErrorMsg('');
    setAuditResult(null);
    setCurrentPage(1);
    setScanStartTime('');
    setScanEndTime('');
    setScanDuration(0);
    setElapsedSeconds(0);
    setEstimatedCompleteTime('');
    setLogRotationIndex(0);
    setExpandedSections({});
    setActiveNav('Review Workspace');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const acknowledgeCurrentReport = () => {
    updateReportFlowState(currentReportId, { acknowledged: true });
    setErrorMsg('');
  };

  const selectReviewTemplate = (templateId) => {
    updateReportFlowState(currentReportId, { selectedTemplateId: templateId });
    setErrorMsg('');
  };

  const confirmSelectedTemplate = () => {
    if (!currentReportFlow.selectedTemplateId) {
      setErrorMsg('Please choose the CCoP template before continuing.');
      return;
    }

    updateReportFlowState(currentReportId, { templateConfirmed: true });
    setErrorMsg('');
  };

  const goBackToAcknowledgeStep = () => {
    updateReportFlowState(currentReportId, {
      acknowledged: false,
      selectedTemplateId: '',
      templateConfirmed: false
    });
    setErrorMsg('');
  };

  const goBackToTemplateStep = () => {
    updateReportFlowState(currentReportId, { templateConfirmed: false });
    setErrorMsg('');
  };

  const downloadAssessmentTemplate = () => {
    const downloadLink = document.createElement('a');
    downloadLink.href = `${apiBaseRef.current}/api/templates/ccop/download`;
    downloadLink.target = '_blank';
    downloadLink.rel = 'noreferrer';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const toggleSection = (num) => {
    setExpandedSections((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const downloadPdfReport = () => {
    if (!auditResult || !file) return;

    const totalSubs = metrics.total;
    const compliantSubs = metrics.compliant;
    const partialSubs = metrics.partial;
    const nonSubs = metrics.nonCompliant;
    const generatedAt = new Date();
    const footerDateTime = `${String(generatedAt.getDate()).padStart(2, '0')}/${String(generatedAt.getMonth() + 1).padStart(2, '0')}/${generatedAt.getFullYear()} ${String(generatedAt.getHours()).padStart(2, '0')}:${String(generatedAt.getMinutes()).padStart(2, '0')}:${String(generatedAt.getSeconds()).padStart(2, '0')}`;

    const loadHtml2Pdf = () => new Promise((resolve) => {
      if (window.html2pdf) {
        resolve(window.html2pdf);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve(window.html2pdf);
      document.head.appendChild(script);
    });

    const sectionsHtml = auditSections.map((section) => {
      const compliantCount = (section.subsections || []).filter((sub) => normalizeStatus(sub) === 'compliant').length;
      const partialCount = (section.subsections || []).filter((sub) => normalizeStatus(sub) === 'partial').length;
      const nonCompliantCount = (section.subsections || []).length - compliantCount - partialCount;

      const statusSummaryHtml = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <span class="badge compliant">Compliance: ${compliantCount}</span>
          <span class="badge partial">Partial: ${partialCount}</span>
          <span class="badge non-compliant">Non-Compliance: ${nonCompliantCount}</span>
        </div>
      `;

      const subsectionsHtml = (section.subsections || []).map((sub) => {
        const subStatus = normalizeStatus(sub);
        const subBadgeCls = subStatus === 'compliant' ? 'compliant' : subStatus === 'partial' ? 'partial' : 'non-compliant';
        const subBadgeText = subStatus === 'compliant' ? 'Compliant' : subStatus === 'partial' ? 'Partially Compliant' : 'Non-Compliant';
        const subActionLabel = subStatus === 'partial' ? 'Action Required:' : 'Proposed Solution to Comply:';

        return `
          <div class="subsection-row" style="margin-left:20px;border-left:3px solid #e2e8f0;padding-left:15px;margin-bottom:15px;page-break-inside:avoid;break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;gap:14px;">
              <strong style="font-size:0.88rem;color:#1e293b;">${sub.id} - ${sub.title}</strong>
              <span class="badge ${subBadgeCls}" style="font-size:0.65rem;padding:2px 6px;">${subBadgeText}</span>
            </div>
            <p class="desc" style="margin:0;font-size:0.8rem;color:#475569;line-height:1.5;">${sub.description || ''}</p>
            ${(subStatus === 'partial' || subStatus === 'non-compliant') && sub.proposed_solution ? `
              <div class="remediation" style="margin-top:8px;padding:8px 10px;background-color:${subStatus === 'partial' ? '#fffbeb' : '#fef2f2'};border-left:3px solid ${subStatus === 'partial' ? '#f59e0b' : '#ef4444'};border-radius:8px;font-size:0.78rem;">
                <strong style="color:${subStatus === 'partial' ? '#b45309' : '#b91c1c'};display:block;margin-bottom:2px;font-size:0.68rem;text-transform:uppercase;">${subActionLabel}</strong>
                <p style="margin:0;color:${subStatus === 'partial' ? '#78350f' : '#7f1d1d'};line-height:1.5;">${sub.proposed_solution}</p>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="section-row" style="border:1.5px solid #cbd5e1;border-radius:14px;padding:18px;margin-bottom:20px;page-break-inside:avoid;break-inside:avoid;background:#ffffff;">
          <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #ea580c;padding-bottom:8px;margin-bottom:15px;gap:14px;">
            <span class="section-name" style="font-weight:800;font-size:1rem;color:#0f172a;">Section ${section.section_num}: ${section.section_title}</span>
            ${statusSummaryHtml}
          </div>
          ${subsectionsHtml}
        </div>
      `;
    }).join('');

    const htmlContent = `
      <div style="width:100%;max-width:182mm;margin:0 auto;font-family:'Segoe UI',system-ui,sans-serif;padding:0mm 6mm 10mm 6mm;color:#0f172a;line-height:1.5;box-sizing:border-box;background:#ffffff;">
        <style>
          .badge { padding:3px 8px; border-radius:999px; font-size:0.72rem; font-weight:700; text-transform:uppercase; white-space:nowrap; }
          .badge.compliant { background-color:#d1fae5; color:#065f46; border:1px solid #a7f3d0; }
          .badge.partial { background-color:#fef3c7; color:#92400e; border:1px solid #fde68a; }
          .badge.non-compliant { background-color:#fee2e2; color:#991b1b; border:1px solid #fca5a5; }
        </style>

        <div style="height:245mm;page-break-after:always;box-sizing:border-box;display:grid;grid-template-rows:auto 1fr;align-items:stretch;">
          <div class="header-container" style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #ea580c;padding:4mm 0 15px 0;gap:18px;">
            <div class="header-title" style="min-width:0;">
              <h1 style="font-size:1.75rem;margin:0;color:#0f172a;font-weight:800;">CCAS Compliance Assessment Report</h1>
              <p style="font-size:0.82rem;color:#475569;margin:4px 0 0 0;">Automated Cybersecurity Audit Matrix against CCoP v2.1 Standards</p>
            </div>
            <div class="score-circle" style="width:78px;height:78px;border-radius:50%;border:4px solid #ffedd5;background:#fff7ed;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;">
              <span class="score-num" style="font-size:1.5rem;font-weight:800;color:#ea580c;line-height:1;">${auditResult.compliance_percentage}%</span>
              <span class="score-lbl" style="font-size:0.55rem;color:#ea580c;text-transform:uppercase;font-weight:bold;margin-top:2px;">Adherent</span>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:center;min-height:0;padding:0 0 18mm 0;">
            <div style="width:100%;max-width:158mm;page-break-inside:avoid;break-inside:avoid;">
              <h2 style="font-size:1.2rem;font-weight:800;color:#0f172a;margin:0 0 15px 0;border-bottom:1.5px solid #e2e8f0;padding-bottom:8px;text-align:center;">Executive Compliance Summary</h2>
              <table style="width:100%;margin:0 auto;border-collapse:collapse;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;font-size:0.88rem;background:#ffffff;">
                <thead>
                  <tr style="background-color:#f8fafc;border-bottom:2px solid #cbd5e1;text-align:left;">
                    <th style="padding:12px 15px;font-weight:bold;color:#334155;width:50%;">Status Category</th>
                    <th style="padding:12px 15px;font-weight:bold;color:#334155;text-align:center;width:25%;">Control Count</th>
                    <th style="padding:12px 15px;font-weight:bold;color:#334155;text-align:center;width:25%;">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #cbd5e1;">
                    <td style="padding:12px 15px;color:#0f172a;font-weight:600;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:#10b981;margin-right:8px;vertical-align:middle;"></span>Compliance</td>
                    <td style="padding:12px 15px;text-align:center;font-weight:700;color:#065f46;">${compliantSubs}</td>
                    <td style="padding:12px 15px;text-align:center;color:#065f46;font-weight:600;">${totalSubs ? Math.round((compliantSubs / totalSubs) * 100) : 0}%</td>
                  </tr>
                  <tr style="border-bottom:1px solid #cbd5e1;">
                    <td style="padding:12px 15px;color:#0f172a;font-weight:600;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:#f59e0b;margin-right:8px;vertical-align:middle;"></span>Partial Compliance</td>
                    <td style="padding:12px 15px;text-align:center;font-weight:700;color:#92400e;">${partialSubs}</td>
                    <td style="padding:12px 15px;text-align:center;color:#92400e;font-weight:600;">${totalSubs ? Math.round((partialSubs / totalSubs) * 100) : 0}%</td>
                  </tr>
                  <tr style="border-bottom:1px solid #cbd5e1;">
                    <td style="padding:12px 15px;color:#0f172a;font-weight:600;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:#ef4444;margin-right:8px;vertical-align:middle;"></span>Non-Compliance</td>
                    <td style="padding:12px 15px;text-align:center;font-weight:700;color:#991b1b;">${nonSubs}</td>
                    <td style="padding:12px 15px;text-align:center;color:#991b1b;font-weight:600;">${totalSubs ? Math.round((nonSubs / totalSubs) * 100) : 0}%</td>
                  </tr>
                  <tr style="background-color:#f8fafc;font-weight:bold;border-top:2px solid #cbd5e1;">
                    <td style="padding:12px 15px;color:#0f172a;">Total Audited Controls</td>
                    <td style="padding:12px 15px;text-align:center;color:#0f172a;">${totalSubs}</td>
                    <td style="padding:12px 15px;text-align:center;color:#0f172a;">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            </div>
          </div>

        <div style="margin-top:0;">
          <div class="checklist-title" style="font-size:1.2rem;font-weight:800;margin-bottom:20px;color:#0f172a;border-bottom:1.5px solid #e2e8f0;padding-bottom:8px;text-align:center;">Detailed Sections Breakdown</div>
          ${sectionsHtml}
        </div>
      </div>
    `;

    const optContainer = document.createElement('div');
    optContainer.innerHTML = htmlContent;
    document.body.appendChild(optContainer);

    loadHtml2Pdf().then((html2pdf) => {
      const opt = {
        margin: 15,
        filename: buildReportFileName(file.name),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(optContainer).toPdf().get('pdf').then(async (pdf) => {
        const totalPdfPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        for (let page = 1; page <= totalPdfPages; page += 1) {
          pdf.setPage(page);
          pdf.setFontSize(8);
          pdf.setTextColor(148, 163, 184);
          pdf.text(`Generated: ${footerDateTime}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }
        const pdfBlob = pdf.output('blob');
        await persistPdfReport(currentWorkspaceId, currentReportId, pdfBlob, buildReportFileName(file.name));
      }).save().then(() => {
        optContainer.remove();
      }).catch((err) => {
        console.error('PDF generation error: ', err);
        optContainer.remove();
      });
    });
  };

  const uploadAndAudit = async (selectedFile) => {
    setUploadState('scanning');
    setActiveNav('Review Workspace');
    setProgress(0);
    setStatusMessage('Uploading file to local CCAS-Agent...');
    setErrorMsg('');

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setScanStartTime(timeString);
    scanStartTimestampRef.current = Date.now();

    const estDone = new Date(now.getTime() + estimatedScanDurationSeconds * 1000);
    setEstimatedCompleteTime(estDone.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setCurrentPage(1);
    setExpandedSections({});

    let currentProgress = 0;
    progressIntervalRef.current = setInterval(() => {
      currentProgress += 2;
      if (currentProgress > 90) currentProgress = 90;

      setProgress(currentProgress);

      const step = [...statusSteps].reverse().find((item) => currentProgress >= item.threshold);
      if (step) setStatusMessage(step.text);
    }, 200);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('model', selectedModel);
    if (currentWorkspaceId) {
      formData.append('workspace_id', currentWorkspaceId);
    }
    if (currentReportId) {
      formData.append('report_id', currentReportId);
    }
    if (currentReportName) {
      formData.append('report_name', currentReportName);
    }

    try {
      const response = await fetch(`${apiBaseRef.current}/api/analyze`, {
        method: 'POST',
        body: formData
      });

      const responseContentType = response.headers.get('content-type') || '';
      const isJsonResponse = responseContentType.includes('application/json');
      const responsePayload = isJsonResponse ? await response.json() : await response.text();

      if (!response.ok) {
        const backendMessage = isJsonResponse
          ? responsePayload?.error || responsePayload?.message
          : '';
        throw new Error(
          backendMessage
            || 'Run review failed. Backend returned a non-JSON error response. Please restart CCAS-Agent backend and try again.'
        );
      }

      if (!isJsonResponse || !responsePayload || typeof responsePayload !== 'object') {
        throw new Error('Run review failed. Backend did not return valid JSON.');
      }

      const results = responsePayload;
      const endTicks = Date.now();
      const startTicks = scanStartTimestampRef.current || endTicks;
      const durationSeconds = Math.round((endTicks - startTicks) / 1000);
      const end = new Date(endTicks);

      setScanEndTime(end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setScanDuration(durationSeconds);

      clearInterval(progressIntervalRef.current);
      setProgress(100);
      setStatusMessage('Analysis complete!');
      setAuditResult(results);
      setCurrentWorkspaceId(results.workspace_id || '');
      setCurrentWorkspaceName(results.workspace_name || '');
      setCurrentReportId(results.report_id || '');
      setCurrentReportName(results.report_name || '');

      await loadWorkspaceHistory();
      await openWorkspaceFromHistory(results.workspace_id, 'Review Workspace', results.report_id || '');

      setTimeout(() => {
        setUploadState('completed');
        setActiveNav('Review Workspace');
      }, 500);
    } catch (err) {
      console.error(err);
      clearInterval(progressIntervalRef.current);
      setUploadState('idle');
      setActiveNav('Review Workspace');
      setErrorMsg(err.message || 'Failed to connect to CCAS-Agent backend. Please make sure Flask (port 5000) and LM Studio are active.');
    }
  };

  const handleStartScan = () => {
    if (!currentReportId) {
      setErrorMsg('Please create or open a report before running the review.');
      return;
    }

    if (!file?.raw) {
      setErrorMsg('Please select a PDF or DOCX document before scanning.');
      return;
    }

    uploadAndAudit(file.raw);
  };

  const openWorkspaceListView = async () => {
    await goBackToWorkspaceList({ reload: true });
  };

  const handlePrimaryNavigation = async (nextNav) => {
    if (nextNav === 'Review Workspace') {
      await openWorkspaceListView();
      return;
    }
    setActiveNav(nextNav);
  };

  const activeReviewStep = auditResult && currentReportId
    ? 5
    : uploadState === 'scanning'
      ? 4
      : !currentReportId
        ? 0
        : !currentReportFlow.acknowledged
          ? 1
          : !currentReportFlow.templateConfirmed
            ? 2
            : 3;

  const projectTitle = 'CCAS Built-in Compliance Assessment';
  const projectSubtitle = '';
  const projectBackHandler = activeNav === 'Review Workspace' && currentWorkspaceId
    ? (currentReportId ? goBackToReportList : () => goBackToWorkspaceList({ reload: true }))
    : null;

  return (
    <AppShell
      activeNav={activeNav}
      onNavigate={handlePrimaryNavigation}
      projectTitle={projectTitle}
      projectSubtitle={projectSubtitle}
      onProjectBack={projectBackHandler}
      projectBackLabel="Back"
      runtimeLabel={runtimeHealth.label}
      runtimeReady={runtimeHealth.reachable}
      reviewerName="CCAS Operator"
    >
      {activeNav === 'Dashboard' && (
        <Dashboard
          metrics={metrics}
          auditResult={auditResult}
          selectedModelLabel={selectedModelLabel}
          onOpenWorkspace={openWorkspaceListView}
          onOpenReports={() => setActiveNav('Reports')}
          workspaceHistory={workspaceHistory}
          onOpenHistoryWorkspace={(workspaceId) => openWorkspaceFromHistory(workspaceId, 'Reports')}
          resolveModelLabel={resolveModelLabel}
        />
      )}

      {activeNav === 'Review Workspace' && (
        activeReviewStep === 5 && auditResult ? (
          <Reports
            activeReviewStep={activeReviewStep}
            auditResult={auditResult}
            auditSections={auditSections}
            file={file}
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            normalizeStatus={normalizeStatus}
            statusConfig={statusConfig}
            scanStartTime={scanStartTime}
            scanEndTime={scanEndTime}
            scanDuration={scanDuration}
            downloadPdfReport={downloadPdfReport}
            resetUploader={resetUploader}
            allReports={allWorkspaceReports}
            onOpenPortfolioReport={(report) => openWorkspaceFromHistory(report.workspace_id, 'Reports', report.report_id)}
            onDownloadPortfolioReport={(report) => downloadWorkspaceReport(report, report.workspace_id)}
            hidePortfolio={true}
          />
        ) : (
          <ReviewWorkspace
            activeReviewStep={activeReviewStep}
            file={file}
            isDragging={isDragging}
            errorMsg={errorMsg}
            uploadState={uploadState}
            progress={progress}
            statusMessage={statusMessage}
            selectedModel={selectedModel}
            selectedModelLabel={selectedModelLabel}
            availableModels={availableModels}
            availableTemplates={ccopTemplateOptions}
            selectedTemplateId={currentReportFlow.selectedTemplateId}
            onModelChange={setSelectedModel}
            onStartScan={handleStartScan}
            onAcknowledge={acknowledgeCurrentReport}
            onSelectTemplate={selectReviewTemplate}
            onConfirmTemplate={confirmSelectedTemplate}
            onBackToAcknowledgeStep={goBackToAcknowledgeStep}
            onBackToTemplateStep={goBackToTemplateStep}
            onDownloadTemplate={downloadAssessmentTemplate}
            currentWorkspaceReports={currentWorkspaceReports}
            currentReportId={currentReportId}
            currentReportName={currentReportName}
            onOpenWorkspaceReport={(report) => selectWorkspaceReport(report, 'Review Workspace')}
            onDownloadWorkspaceReport={downloadWorkspaceReport}
            onCreateReport={openCreateReportModal}
            onConfirmCreateReport={createWorkspaceReport}
            onCloseReportModal={closeCreateReportModal}
            onBackToReportList={goBackToReportList}
            onOpenReports={() => setActiveNav('Reports')}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
            onRemoveFile={removeSelectedFile}
            fileInputRef={fileInputRef}
            scanStartTime={scanStartTime}
            elapsedSeconds={elapsedSeconds}
            estimatedCompleteTime={estimatedCompleteTime}
            scanLogs={scanLogs}
            formatElapsedTime={formatElapsedTime}
            workspaceHistory={workspaceHistory}
            isHistoryLoading={isHistoryLoading}
            onOpenWorkspaceHistory={(workspaceId) => openWorkspaceFromHistory(workspaceId)}
            onCreateWorkspace={openCreateWorkspaceModal}
            onConfirmCreateWorkspace={createWorkspaceDraft}
            onCloseWorkspaceModal={closeCreateWorkspaceModal}
            onDeleteWorkspace={requestDeleteWorkspace}
            onConfirmDeleteWorkspace={confirmDeleteWorkspace}
            onCloseDeleteWorkspaceModal={closeDeleteWorkspaceModal}
            onBackToWorkspaceList={() => goBackToWorkspaceList({ reload: true })}
            currentWorkspaceId={currentWorkspaceId}
            currentWorkspaceName={currentWorkspaceName}
            isWorkspaceModalOpen={isWorkspaceModalOpen}
            newWorkspaceName={newWorkspaceName}
            onWorkspaceNameChange={setNewWorkspaceName}
            isWorkspaceSaving={isWorkspaceSaving}
            isReportModalOpen={isReportModalOpen}
            newReportName={newReportName}
            onReportNameChange={setNewReportName}
            isReportSaving={isReportSaving}
            workspaceDeletingId={workspaceDeletingId}
            deleteWorkspaceTarget={deleteWorkspaceTarget}
            resolveModelLabel={resolveModelLabel}
          />
        )
      )}

      {activeNav === 'Reports' && (
        <Reports
          activeReviewStep={activeReviewStep}
          auditResult={auditResult}
          auditSections={auditSections}
          file={file}
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          normalizeStatus={normalizeStatus}
          statusConfig={statusConfig}
          scanStartTime={scanStartTime}
          scanEndTime={scanEndTime}
          scanDuration={scanDuration}
          downloadPdfReport={downloadPdfReport}
          resetUploader={resetUploader}
          allReports={allWorkspaceReports}
          onOpenPortfolioReport={(report) => openWorkspaceFromHistory(report.workspace_id, 'Reports', report.report_id)}
          onDownloadPortfolioReport={(report) => downloadWorkspaceReport(report, report.workspace_id)}
        />
      )}

      {activeNav === 'Standards & Admin' && (
        <StandardsAdmin
          availableModels={availableModels}
          selectedModel={selectedModel}
          onDownloadTemplate={downloadAssessmentTemplate}
        />
      )}
    </AppShell>
  );
}

export default App;
