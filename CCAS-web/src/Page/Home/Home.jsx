import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  ShieldCheck,
  RefreshCw,
  Download,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import './Home.css';
import { backendApiBaseUrl } from '../../config/api';


export default function Home() {


  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState('idle'); // idle | scanning | completed
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedSections, setExpandedSections] = useState({}); // track open/close per section

  // Real API audit result state
  const [auditResult, setAuditResult] = useState(null);

  // Pagination & Scan Timer states
  const [currentPage, setCurrentPage] = useState(1);
  const [scanStartTime, setScanStartTime] = useState('');
  const [scanEndTime, setScanEndTime] = useState('');
  const [scanDuration, setScanDuration] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedCompleteTime, setEstimatedCompleteTime] = useState('');
  const [logRotationIndex, setLogRotationIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState('ornith-1.0-35b');



  const fileInputRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const scanStartTimestampRef = useRef(null);


  // Status message transitions during scanning
  const statusSteps = [
    { threshold: 0, text: 'Uploading file to local CCAS-Agent...' },
    { threshold: 20, text: 'Extracting text and structure content...' },
    { threshold: 45, text: 'Mapping standard controls against CCoP v2.1 reference template...' },
    { threshold: 70, text: 'Executing selected AI model compliance audit...' },
    { threshold: 90, text: 'Finalizing analysis and checking AI response quality...' }
  ];
  const estimatedScanDurationSeconds = 12 * 60;
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

  // Timer effect for active scanning
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
  }, [uploadState, passiveScanLogs.length]);

  const formatBytes = (bytes, decimals = 1) => {

    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
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

  const handleStartScan = () => {
    if (!file?.raw) {
      setErrorMsg('Please select a PDF or DOCX document before scanning.');
      return;
    }

    uploadAndAudit(file.raw);
  };

  const uploadAndAudit = async (selectedFile) => {
    setUploadState('scanning');
    setProgress(0);
    setStatusMessage('Uploading file to local CCAS-Agent...');

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setScanStartTime(timeString);
    scanStartTimestampRef.current = Date.now();

    // Show a longer expected completion window for the audit run.
    const estDone = new Date(now.getTime() + estimatedScanDurationSeconds * 1000);
    const estDoneString = estDone.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEstimatedCompleteTime(estDoneString);

    setCurrentPage(1);


    // 1. Start progress visual ticker (goes up to 90% and waits for completion)
    let currentProgress = 0;
    progressIntervalRef.current = setInterval(() => {
      currentProgress += 2;
      if (currentProgress > 90) {
        currentProgress = 90; // Wait for LLM backend response
      }

      setProgress(currentProgress);

      // Update text details
      const step = [...statusSteps]
        .reverse()
        .find(s => currentProgress >= s.threshold);
      if (step) {
        setStatusMessage(step.text);
      }
    }, 200);

    // 2. Prepare Form Data
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('model', selectedModel);

    try {
      // Send file to Flask server endpoint
      const response = await fetch(`${backendApiBaseUrl}/api/analyze`, {
        method: 'POST',
        body: formData
      });




      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server returned an error');
      }

      const results = await response.json();

      const endTicks = Date.now();
      const startTicks = scanStartTimestampRef.current || endTicks;
      const durationSeconds = Math.round((endTicks - startTicks) / 1000);
      const end = new Date(endTicks);
      const endTimeString = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setScanEndTime(endTimeString);
      setScanDuration(durationSeconds);

      // Clear ticker interval and complete to 100
      clearInterval(progressIntervalRef.current);


      // Finish progress to 100%
      setProgress(100);
      setStatusMessage('Analysis complete!');
      setAuditResult(results);

      setTimeout(() => {
        setUploadState('completed');
      }, 500);

    } catch (err) {
      console.error(err);
      clearInterval(progressIntervalRef.current);
      setUploadState('idle');
      setErrorMsg(err.message || 'Failed to connect to CCAS-Agent backend. Please make sure Flask (port 5000) and LM Studio are active.');
    }
  };

  const resetUploader = () => {
    setFile(null);
    setUploadState('idle');
    setProgress(0);
    setErrorMsg('');
    setAuditResult(null);
    setCurrentPage(1);
    setScanStartTime('');
    setScanEndTime('');
    setScanDuration(0);
    setElapsedSeconds(0);
    setEstimatedCompleteTime('');
    setLogRotationIndex(0);
  };



  // Generate printable PDF report with direct download bypassing print dialog
  const downloadPdfReport = () => {
    if (!auditResult || !file) return;

    // Calculate metrics for summary table
    const totalSubs = auditSections.reduce((acc, s) => acc + (s.subsections?.length || 0), 0);
    const compliantSubs = auditSections.reduce((acc, s) => acc + (s.subsections?.filter(sub => normalizeStatus(sub) === 'compliant').length || 0), 0);
    const partialSubs = auditSections.reduce((acc, s) => acc + (s.subsections?.filter(sub => normalizeStatus(sub) === 'partial').length || 0), 0);
    const nonSubs = totalSubs - compliantSubs - partialSubs;
    const generatedAt = new Date();
    const footerDateTime = `${String(generatedAt.getDate()).padStart(2, '0')}/${String(generatedAt.getMonth() + 1).padStart(2, '0')}/${generatedAt.getFullYear()} ${String(generatedAt.getHours()).padStart(2, '0')}:${String(generatedAt.getMinutes()).padStart(2, '0')}:${String(generatedAt.getSeconds()).padStart(2, '0')}`;

    // Load html2pdf from CDN dynamically
    const loadHtml2Pdf = () => {
      return new Promise((resolve) => {
        if (window.html2pdf) {
          resolve(window.html2pdf);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => resolve(window.html2pdf);
        document.head.appendChild(script);
      });
    };

    // Build the hierarchical HTML structure
    const sectionsHtml = auditSections.map(sec => {
      const st = sec.overall_status || normalizeStatus(sec);
      const badgeCls = st === 'compliant' ? 'compliant' : st === 'partial' ? 'partial' : 'non-compliant';
      const compliantCount = (sec.subsections || []).filter(sub => normalizeStatus(sub) === 'compliant').length;
      const partialCount = (sec.subsections || []).filter(sub => normalizeStatus(sub) === 'partial').length;
      const nonCompliantCount = (sec.subsections || []).length - compliantCount - partialCount;
      const statusSummaryHtml = `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
          <span class="badge compliant">Compliance: ${compliantCount}</span>
          <span class="badge partial">Partial: ${partialCount}</span>
          <span class="badge non-compliant">Non-Compliance: ${nonCompliantCount}</span>
        </div>
      `;

      const subsectionsHtml = (sec.subsections || []).map(sub => {
        const subSt = normalizeStatus(sub);
        const subBadgeCls = subSt === 'compliant' ? 'compliant' : subSt === 'partial' ? 'partial' : 'non-compliant';
        const subBadgeTxt = subSt === 'compliant' ? 'Compliant' : subSt === 'partial' ? 'Partially Compliant' : 'Non-Compliant';
        const subActionLabel = subSt === 'partial' ? 'Action Required:' : 'Proposed Solution to Comply:';

        return `
          <div class="subsection-row" style="margin-left: 20px; border-left: 3px solid #e2e8f0; padding-left: 15px; margin-bottom: 15px; page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
              <strong style="font-size: 0.88rem; color: #1e293b;">${sub.id} - ${sub.title}</strong>
              <span class="badge ${subBadgeCls}" style="font-size: 0.65rem; padding: 2px 6px;">${subBadgeTxt}</span>
            </div>
            <p class="desc" style="margin: 0; font-size: 0.8rem; color: #475569; line-height: 1.45;">${sub.description || ''}</p>
            ${(subSt === 'partial' || subSt === 'non-compliant') && sub.proposed_solution ? `
              <div class="remediation" style="margin-top: 8px; padding: 8px 10px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 0.78rem;">
                <strong style="color: #b45309; display: block; margin-bottom: 2px; font-size: 0.68rem; text-transform: uppercase;">${subActionLabel}</strong>
                <p style="margin: 0; color: #78350f; line-height: 1.45;">${sub.proposed_solution}</p>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="section-row" style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 18px; margin-bottom: 20px; page-break-inside: avoid;">
          <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 8px; margin-bottom: 15px;">
            <span class="section-name" style="font-weight: 800; font-size: 1rem; color: #0f172a;">Section ${sec.section_num}: ${sec.section_title}</span>
            ${statusSummaryHtml}
          </div>
          ${subsectionsHtml}
        </div>
      `;
    }).join('');

    const htmlContent = `
      <div style="width: 100%; max-width: 180mm; margin: 0 auto; font-family: 'Segoe UI', system-ui, sans-serif; padding: 8mm 6mm 10mm 6mm; color: #0f172a; line-height: 1.5; box-sizing: border-box;">
        
        <!-- HEADER & COMPLIANCE SUMMARY TABLE -->
        <div>
          <div>
            <div class="header-container" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ea580c; padding-bottom: 15px; margin-bottom: 25px;">
              <div class="header-title">
                <h1 style="font-size: 1.75rem; margin: 0; color: #0f172a; font-weight: 800;">CCAS Compliance Assessment Report</h1>
                <p style="font-size: 0.82rem; color: #475569; margin: 4px 0 0 0;">Automated Cybersecurity Audit Matrix against CCoP v2.1 Standards</p>
              </div>
              <div class="score-circle" style="width: 75px; height: 75px; border-radius: 50%; border: 4px solid #fff7ed; background: #fff7ed; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;">
                <span class="score-num" style="font-size: 1.5rem; font-weight: 800; color: #ea580c; line-height: 1;">${auditResult.compliance_percentage}%</span>
                <span class="score-lbl" style="font-size: 0.55rem; color: #ea580c; text-transform: uppercase; font-weight: bold; margin-top: 2px;">Adherent</span>
              </div>
            </div>

            <div style="width: 100%; max-width: 156mm; margin: 18px auto 0 auto;">
              <h2 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-bottom: 15px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px; text-align: center;">Executive Compliance Summary</h2>
              <table style="width: 100%; margin: 0 auto; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; font-size: 0.88rem;">
                <thead>
                  <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left;">
                    <th style="padding: 12px 15px; font-weight: bold; color: #334155; width: 50%;">Status Category</th>
                    <th style="padding: 12px 15px; font-weight: bold; color: #334155; text-align: center; width: 25%;">Control Count</th>
                    <th style="padding: 12px 15px; font-weight: bold; color: #334155; text-align: center; width: 25%;">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 12px 15px; color: #0f172a; font-weight: 600;">
                      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; margin-right: 8px; vertical-align: middle;"></span>
                      Compliance
                    </td>
                    <td style="padding: 12px 15px; text-align: center; font-weight: 700; color: #065f46;">${compliantSubs}</td>
                    <td style="padding: 12px 15px; text-align: center; color: #065f46; font-weight: 600;">${totalSubs ? Math.round((compliantSubs / totalSubs) * 100) : 0}%</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 12px 15px; color: #0f172a; font-weight: 600;">
                      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #f59e0b; margin-right: 8px; vertical-align: middle;"></span>
                      Partial Compliance
                    </td>
                    <td style="padding: 12px 15px; text-align: center; font-weight: 700; color: #92400e;">${partialSubs}</td>
                    <td style="padding: 12px 15px; text-align: center; color: #92400e; font-weight: 600;">${totalSubs ? Math.round((partialSubs / totalSubs) * 100) : 0}%</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 12px 15px; color: #0f172a; font-weight: 600;">
                      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #ef4444; margin-right: 8px; vertical-align: middle;"></span>
                      Non-Compliance
                    </td>
                    <td style="padding: 12px 15px; text-align: center; font-weight: 700; color: #991b1b;">${nonSubs}</td>
                    <td style="padding: 12px 15px; text-align: center; color: #991b1b; font-weight: 600;">${totalSubs ? Math.round((nonSubs / totalSubs) * 100) : 0}%</td>
                  </tr>
                  <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                    <td style="padding: 12px 15px; color: #0f172a;">Total Audited Controls</td>
                    <td style="padding: 12px 15px; text-align: center; color: #0f172a;">${totalSubs}</td>
                    <td style="padding: 12px 15px; text-align: center; color: #0f172a;">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- DETAILED SECTION COMPLIANCE AUDIT -->
        <div style="margin-top: 26px;">
          <div class="checklist-title" style="font-size: 1.2rem; font-weight: 800; margin-bottom: 20px; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px; text-align: center;">Detailed Sections Breakdown</div>
          
          <style>
            .badge { padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: bold; text-transform: uppercase; white-space: nowrap; }
            .badge.compliant { background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
            .badge.partial { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
            .badge.non-compliant { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          </style>

          ${sectionsHtml}
        </div>
      </div>
    `;

    // Create a temporary hidden container element
    const optContainer = document.createElement('div');
    optContainer.innerHTML = htmlContent;
    document.body.appendChild(optContainer);

    // Call html2pdf bundle for direct download
    loadHtml2Pdf().then((html2pdf) => {
      const opt = {
        margin: 15,
        filename: buildReportFileName(file.name),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(optContainer).toPdf().get('pdf').then((pdf) => {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        for (let page = 1; page <= totalPages; page += 1) {
          pdf.setPage(page);
          pdf.setFontSize(8);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`Generated: ${footerDateTime}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }
      }).save().then(() => {
        optContainer.remove();
      }).catch((err) => {
        console.error("PDF generation error: ", err);
        optContainer.remove();
      });
    });
  };



  // Normalize subsection/section status
  const normalizeStatus = (sec) => {
    if (sec.status) return sec.status;
    if (sec.overall_status) return sec.overall_status;
    if (sec.compliant === true) return 'compliant';
    return 'non-compliant';
  };

  // Get color config for a given status
  const statusConfig = (status) => {
    if (status === 'compliant') return { bg: '#d1fae5', border: '#10b981', text: '#065f46', label: 'COMPLIANT', dot: '#10b981' };
    if (status === 'partial') return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', label: 'PARTIALLY COMPLIANT', dot: '#f59e0b' };
    return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', label: 'NON-COMPLIANT', dot: '#ef4444' };
  };

  // Toggle a section open/closed
  const toggleSection = (num) => {
    setExpandedSections(prev => ({ ...prev, [num]: !prev[num] }));
  };

  // Derive sections list from API response — supports new hierarchical format OR old flat format
  const auditSections = auditResult
    ? (auditResult.sections || (() => {
      // Fallback: convert old flat all_sections into grouped sections
      const flat = auditResult.all_sections || [
        ...(auditResult.matches || []).map(m => ({ ...m, status: 'compliant' })),
        ...(auditResult.gaps || []).map(g => ({ ...g, status: 'non-compliant' })),
      ];
      return flat.map((s, i) => ({
        section_num: i + 1,
        section_title: s.title,
        overall_status: normalizeStatus(s),
        subsections: [{ id: s.id, title: s.title, status: normalizeStatus(s), description: s.description, proposed_solution: s.proposed_solution }]
      }));
    })())
    : [];


  return (
    <div className="portal-container">
      {/* Mini top brand bar */}
      <header className="portal-header">
        <div className="portal-logo">
          <Lock size={16} />
          <span>CCAS COMPLIANCE AUDITOR</span>
        </div>
      </header>

      <main className="portal-main">
        <div className={`upload-container glass-card ${uploadState === 'completed' || uploadState === 'scanning' ? 'expanded' : ''}`}>


          {/* 1. IDLE STATE: DRAG & DROP ZONE */}
          {uploadState === 'idle' && (
            <div className="state-content fade-in">
              <div className="title-section">
                <h2>Cybersecurity Plan Uploader</h2>
                <p>Upload your plan document to review compliance rules and map adherence parameters against CCoP v2.1.</p>
              </div>

              <div
                className={`dropzone-area ${isDragging ? 'dragging' : ''}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx"
                  style={{ display: 'none' }}
                />

                <div className="icon-pulse-wrapper">
                  <UploadCloud size={40} className="upload-icon" />
                </div>

                <h3>Select your plan document</h3>
                <p>Drag and drop your PDF or DOCX file here, or click to browse</p>
                <div className="limit-badge">PDF or DOCX • Max 25MB</div>
              </div>

              <div className="scan-config-panel">
                <div className="scan-config-field">
                  <label htmlFor="model-select" className="scan-config-label">Scan Model</label>
                  <select
                    id="model-select"
                    className="scan-model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    {availableModels.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>

                {file && (
                  <div className="selected-file-pill">
                    <FileText size={15} />
                    <span>{file.name}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="btn-scan"
                  onClick={handleStartScan}
                  disabled={!file}
                >
                  <ShieldCheck size={16} />
                  <span>Scan Document</span>
                </button>
              </div>

              {errorMsg && (
                <div className="alert-message error fade-in">
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* 2. SCANNING STATE: PROFESSIONAL WHITE-THEME ANIMATION */}
          {uploadState === 'scanning' && (
            <div className="state-content fade-in" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>

              {/* Light header bar */}
              <div style={{
                background: 'linear-gradient(135deg, #fff7ed 0%, #fff 100%)',
                padding: '1.1rem 1.5rem',
                borderBottom: '1.5px solid #fed7aa'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#f97316', boxShadow: '0 0 8px #f9731680',
                    animation: 'pulse-dot 1.2s ease-in-out infinite',
                    flexShrink: 0
                  }} />
                  <span style={{ color: '#ea580c', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>
                    AI Compliance Engine · Active
                  </span>
                </div>
                <h2 style={{ color: '#1e293b', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Analyzing Document</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.15rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Semantic audit against CCoP v2.1 · {file?.name} · {availableModels.find((model) => model.value === selectedModel)?.label || selectedModel}
                </p>
              </div>

              {/* White scanner body containing two-column dashboard grid */}
              <div style={{
                background: '#f8fafc',
                padding: '1.75rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
              }}>

                <div className="scan-dashboard-grid">
                  {/* Left Column: Radar and Progress Details */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    height: '350px',
                    boxSizing: 'border-box'
                  }}>


                    {/* Radar — light theme */}
                    <div className="radar-container">
                      <div className="radar-ring radar-ring-1" />
                      <div className="radar-ring radar-ring-2" />
                      <div className="radar-ring radar-ring-3" />
                      <div className="radar-crosshair radar-crosshair-h" />
                      <div className="radar-crosshair radar-crosshair-v" />
                      <div className="radar-sweep" />
                      <div className="radar-center" />
                      <div className="radar-blip" style={{ top: '22%', left: '62%', animationDelay: '0.4s' }} />
                      <div className="radar-blip" style={{ top: '65%', left: '30%', animationDelay: '1.1s' }} />
                      <div className="radar-blip" style={{ top: '40%', left: '75%', animationDelay: '1.8s' }} />
                      <div className="radar-blip" style={{ top: '70%', left: '60%', animationDelay: '0.9s' }} />
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 5
                      }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" style={{ filter: 'drop-shadow(0 0 5px #f9731688)' }}>
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </div>
                    </div>

                    {/* Status message details */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      background: '#f8fafc', border: '1px solid #cbd5e1',
                      borderRadius: '8px', padding: '0.6rem 0.9rem', width: '100%'
                    }}>
                      <div className="pulse-spinner" />
                      <span style={{
                        color: '#475569',
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1
                      }}>
                        {statusMessage || 'Initializing AI audit engine...'}
                      </span>
                      <span style={{ marginLeft: '0.5rem', color: '#ea580c', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 }}>
                        {progress}%
                      </span>

                    </div>

                    {/* Segmented progress bar */}
                    <div style={{ display: 'flex', gap: '3px', height: '6px', width: '100%' }}>
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} style={{
                          flex: 1, borderRadius: '2px',
                          background: (i / 20) * 100 < progress ? '#f97316' : '#e2e8f0',
                          boxShadow: (i / 20) * 100 < progress ? '0 0 4px #f9731666' : 'none',
                          transition: 'background 0.3s ease'
                        }} />
                      ))}
                    </div>

                    {/* Beautiful Scan Timing Metric Blocks */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.5rem',
                      width: '100%',
                      marginTop: '0.25rem',
                      textAlign: 'center'
                    }}>
                      <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '6px', padding: '6px 4px' }}>
                        <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', color: '#9a3412', fontWeight: 700, letterSpacing: '0.5px' }}>Started At</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#431407', fontFamily: 'monospace', marginTop: '2px' }}>{scanStartTime || '--:--:--'}</div>
                      </div>
                      <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '6px', padding: '6px 4px' }}>
                        <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', color: '#166534', fontWeight: 700, letterSpacing: '0.5px' }}>Elapsed</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#14532d', fontFamily: 'monospace', marginTop: '2px' }}>{formatElapsedTime(elapsedSeconds)}</div>
                      </div>
                      <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '6px', padding: '6px 4px' }}>
                        <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', color: '#1e40af', fontWeight: 700, letterSpacing: '0.5px' }}>Est. Done</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#172554', fontFamily: 'monospace', marginTop: '2px' }}>{estimatedCompleteTime || '--:--:--'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: High-contrast colorful logs taking full height */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    height: '350px',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Audit Process Logs
                    </div>
                    {/* Log panel — white, matching height of left container */}
                    <div className="scan-log-panel" style={{ height: '326px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }}>
                      {scanLogs.map((log, index) => {
                        const isLast = index === scanLogs.length - 1;
                        const tagClass = log.type === 'ok' ? 'ok' : log.type === 'warn' ? 'warn' : log.type === 'fail' ? 'fail' : 'info';
                        const tagText = log.type === 'ok' ? 'PASS' : log.type === 'warn' ? 'EVAL' : log.type === 'fail' ? 'FAIL' : 'SCAN';

                        if (isLast) {
                          return (
                            <div key={log.id} className="scan-log-line scan-log-line-active active-pulse-row" style={{
                              background: 'linear-gradient(90deg, #fff7ed 0%, #ffffff 100%)',
                              borderBottomLeftRadius: '7px',
                              borderBottomRightRadius: '7px',
                              animationDelay: '0.15s'
                            }}>
                              <span className="scan-log-orb scan-log-orb-active" />
                              <span className="log-tag warn">SCAN</span>
                              <span className="scan-log-text-active" style={{ fontWeight: 600, color: '#ea580c' }}>
                                {log.text}
                              </span>
                              <span className="blinking-cursor">|</span>
                            </div>
                          );
                        }

                        return (
                          <div key={log.id} className="scan-log-line" style={{
                            borderBottom: '1px solid #f1f5f9',
                            animationDelay: `${index * 0.12}s`
                          }}>
                            <span className="scan-log-orb" />
                            <span className={`log-tag ${tagClass}`}>{tagText}</span>
                            <span className="scan-log-text">
                              {log.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}



          {/* 3. COMPLETED STATE: COLLAPSIBLE SECTION BARS */}

          {uploadState === 'completed' && auditResult && (() => {
            const pct = auditResult.compliance_percentage ?? 0;
            const pctColor = pct >= 85 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
            const totalSubs = auditSections.reduce((acc, s) => acc + (s.subsections?.length || 0), 0);
            const compliantSubs = auditSections.reduce((acc, s) => acc + (s.subsections?.filter(sub => normalizeStatus(sub) === 'compliant').length || 0), 0);
            const partialSubs = auditSections.reduce((acc, s) => acc + (s.subsections?.filter(sub => normalizeStatus(sub) === 'partial').length || 0), 0);
            const nonSubs = totalSubs - compliantSubs - partialSubs;

            const sectionsPerPage = 4;
            const totalPages = Math.ceil(auditSections.length / sectionsPerPage);
            const displayedSections = auditSections.slice(
              (currentPage - 1) * sectionsPerPage,
              currentPage * sectionsPerPage
            );


            return (
              <div className="state-content fade-in">

                {/* Header */}
                <div className="success-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="success-icon-wrapper">
                      <CheckCircle2 size={28} className="success-icon" />
                    </div>
                    <div className="title-section">
                      <h2 className="success-title" style={{ margin: 0 }}>Audit Report Generated</h2>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                        Analyzed: <strong>{file?.name}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Timing metrics on the right side */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', paddingRight: '0.75rem' }}>
                      <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Started</div>
                      <div style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: 700, fontFamily: 'monospace' }}>{scanStartTime || '--:--:--'}</div>
                    </div>
                    <div style={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', paddingRight: '0.75rem' }}>
                      <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Finished</div>
                      <div style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: 700, fontFamily: 'monospace' }}>{scanEndTime || '--:--:--'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.6rem', color: '#ea580c', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Duration</div>
                      <div style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 800, fontFamily: 'monospace' }}>
                        {scanDuration ? `${Math.floor(scanDuration / 60) > 0 ? `${Math.floor(scanDuration / 60)}m ` : ''}${scanDuration % 60}s` : '--s'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Percentage Gauge ── */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  marginTop: '1.25rem'
                }}>
                  {/* Circular score */}
                  <div style={{
                    position: 'relative',
                    width: '80px', height: '80px', flexShrink: 0
                  }}>
                    <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke={pctColor} strokeWidth="7"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                      />
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex',
                      flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: pctColor, lineHeight: 1 }}>{pct}%</span>
                      <span style={{ fontSize: '0.52rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Score</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                      Overall Compliance Score
                    </div>
                    <div style={{ fontSize: '0.78rem', color: pctColor, fontWeight: 600, marginBottom: '0.65rem' }}>
                      {pct >= 85 ? 'Plan aligns with CCoP v2.1 mandates.'
                        : pct >= 60 ? 'Action required — critical compliance gaps identified.'
                          : 'Non-compliant — major required controls missing.'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px',
                        borderRadius: '4px', background: '#d1fae5', color: '#065f46',
                        border: '1px solid #a7f3d0', whiteSpace: 'nowrap'
                      }}>
                        compliance: {compliantSubs}
                      </span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px',
                        borderRadius: '4px', background: '#fef3c7', color: '#92400e',
                        border: '1px solid #fde68a', whiteSpace: 'nowrap'
                      }}>
                        partial compliance: {partialSubs}
                      </span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px',
                        borderRadius: '4px', background: '#fee2e2', color: '#991b1b',
                        border: '1px solid #fca5a5', whiteSpace: 'nowrap'
                      }}>
                        noncompliance: {nonSubs}
                      </span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px',
                        borderRadius: '4px', background: '#f1f5f9', color: '#475569',
                        border: '1px solid #e2e8f0', whiteSpace: 'nowrap'
                      }}>
                        total: {totalSubs}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Section title row with download & rescan icons ── */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  marginTop: '1.25rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '1.5px solid #f1f5f9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={15} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
                      CCoP v2.1 Section Compliance ({auditSections.length} sections)
                    </h4>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={downloadPdfReport}
                      title="Download PDF Report"
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #ea580c',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ea580c',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 2px rgba(234, 88, 12, 0.05)'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#fff7ed'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                    >
                      <Download size={15} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Download PDF</span>
                    </button>
                    <button
                      onClick={resetUploader}
                      title="Analyze Another Plan"
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                    >
                      <RefreshCw size={15} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Rescan</span>
                    </button>
                  </div>
                </div>

                {/* ── Collapsible Section Bars (Paginated) ── */}
                <div className="list-wrapper" style={{ maxHeight: '380px', marginTop: '0.25rem' }}>
                  <div className="items-list">
                    {displayedSections.map((section) => {
                      const secStatus = section.overall_status || normalizeStatus(section);
                      const cfg = statusConfig(secStatus);
                      const isOpen = !!expandedSections[section.section_num];

                      // Calculate breakdown counts
                      const subs = section.subsections || [];
                      const compliantCount = subs.filter(s => normalizeStatus(s) === 'compliant').length;
                      const partialCount = subs.filter(s => normalizeStatus(s) === 'partial').length;
                      const nonCompliantCount = subs.filter(s => normalizeStatus(s) === 'non-compliant').length;

                      return (
                        <div key={section.section_num} style={{ borderRadius: '8px', overflow: 'hidden', border: `1.5px solid ${cfg.border}` }}>

                          {/* Section header bar — click to toggle */}
                          <button
                            onClick={() => toggleSection(section.section_num)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center',
                              gap: '0.6rem', padding: '0.75rem 1rem',
                              background: cfg.bg, border: 'none', cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            {/* Status dot */}
                            <span style={{
                              width: '10px', height: '10px', borderRadius: '50%',
                              background: cfg.dot, flexShrink: 0, boxShadow: `0 0 6px ${cfg.dot}88`
                            }} />

                            <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                              Section {section.section_num}: {section.section_title}
                            </span>

                            {/* Subsection breakdown counts */}
                            <div style={{ display: 'flex', gap: '0.4rem', marginRight: '0.75rem', alignItems: 'center' }}>
                              {compliantCount > 0 && (
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  background: '#d1fae5',
                                  color: '#065f46',
                                  border: '1px solid #a7f3d0',
                                  whiteSpace: 'nowrap'
                                }}>
                                  compliance: {compliantCount}/{subs.length}
                                </span>
                              )}
                              {partialCount > 0 && (
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  border: '1px solid #fde68a',
                                  whiteSpace: 'nowrap'
                                }}>
                                  partial: {partialCount}/{subs.length}
                                </span>
                              )}
                              {nonCompliantCount > 0 && (
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  border: '1px solid #fca5a5',
                                  whiteSpace: 'nowrap'
                                }}>
                                  noncompliance: {nonCompliantCount}/{subs.length}
                                </span>
                              )}
                            </div>

                            <span style={{ color: cfg.text, flexShrink: 0 }}>
                              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </span>
                          </button>


                          {/* Expanded subsections */}
                          {isOpen && (
                            <div style={{ background: '#fafafa', borderTop: `1px solid ${cfg.border}44`, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              {subs.map((sub) => {
                                const subStatus = normalizeStatus(sub);
                                const subCfg = statusConfig(subStatus);
                                return (
                                  <div key={sub.id} style={{
                                    background: '#ffffff', border: `1px solid ${subCfg.border}44`,
                                    borderLeft: `3px solid ${subCfg.dot}`, borderRadius: '6px',
                                    padding: '0.75rem 0.95rem'
                                  }}>

                                    {/* Subtitle Header Row with left sub-title and right status badge */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '1rem',
                                      marginBottom: '0.5rem'
                                    }}>
                                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                                        {sub.id} {sub.title}
                                      </div>
                                      <span style={{
                                        fontSize: '0.62rem', fontWeight: 800, padding: '3px 8px',
                                        borderRadius: '4px', background: subCfg.bg, color: subCfg.text,
                                        border: `1px solid ${subCfg.border}44`,
                                        whiteSpace: 'nowrap',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        {subCfg.label}
                                      </span>
                                    </div>

                                    <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, margin: 0 }}>{sub.description}</p>

                                    {/* Structured child container proposed solutions */}
                                    {(subStatus === 'partial' || subStatus === 'non-compliant') && sub.proposed_solution && (
                                      <div style={{
                                        marginTop: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        background: subStatus === 'partial' ? '#fffbeb' : '#fef2f2',
                                        border: subStatus === 'partial' ? '1px solid #fef3c7' : '1px solid #fee2e2',
                                        borderLeft: subStatus === 'partial' ? '3.5px solid #f59e0b' : '3.5px solid #ef4444',
                                        borderRadius: '6px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                      }}>
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.4rem',
                                          marginBottom: '0.35rem',
                                          color: subStatus === 'partial' ? '#b45309' : '#991b1b',
                                          fontWeight: 700,
                                          fontSize: '0.7rem',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px'
                                        }}>
                                          <AlertTriangle size={13} />
                                          <span>{subStatus === 'partial' ? 'Remediation Action Required' : 'Proposed Solution to Comply'}</span>
                                        </div>
                                        <p style={{
                                          margin: 0,
                                          fontSize: '0.78rem',
                                          lineHeight: 1.45,
                                          color: subStatus === 'partial' ? '#78350f' : '#7f1d1d'
                                        }}>{sub.proposed_solution}</p>
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
                </div>

                {/* ── Pagination Controls ── */}
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginTop: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1.5px solid #f1f5f9'
                  }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      style={{
                        background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
                        padding: '5px 10px', fontSize: '0.72rem', fontWeight: 700,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        color: currentPage === 1 ? '#94a3b8' : '#ea580c',
                        opacity: currentPage === 1 ? 0.5 : 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      Prev
                    </button>

                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      const isCurrent = currentPage === pageNum;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px',
                            border: isCurrent ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                            background: isCurrent ? '#fff7ed' : '#ffffff',
                            color: isCurrent ? '#ea580c' : '#475569',
                            fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      style={{
                        background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
                        padding: '5px 10px', fontSize: '0.72rem', fontWeight: 700,
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        color: currentPage === totalPages ? '#94a3b8' : '#ea580c',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}

              </div>
            );
          })()}


        </div>
      </main>
    </div>
  );
}
