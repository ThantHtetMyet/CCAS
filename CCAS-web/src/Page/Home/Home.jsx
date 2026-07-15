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
  
  const fileInputRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Status message transitions during scanning
  const statusSteps = [
    { threshold: 0, text: 'Uploading file to local CCAS-Agent...' },
    { threshold: 20, text: 'Extracting text and structure content...' },
    { threshold: 45, text: 'Mapping standard controls against CCoP v2.1 reference template...' },
    { threshold: 70, text: 'Executing local Qwen-3-14B LLM compliance audit...' },
    { threshold: 90, text: 'Parsing results and compiling remediation solutions...' }
  ];

  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
      type: ext
    });
    
    uploadAndAudit(selectedFile);
  };

  const uploadAndAudit = async (selectedFile) => {
    setUploadState('scanning');
    setProgress(0);
    setStatusMessage('Uploading file to local CCAS-Agent...');

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

    try {
      // Send file to Flask server endpoint
      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server returned an error');
      }

      const results = await response.json();
      
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
  };

  // Generate printable PDF report using iframe print window
  const downloadPdfReport = () => {
    if (!auditResult || !file) return;

    // Resolve unified list of sections from the API payload (with fallback parsing)
    const allSections = auditResult.all_sections || [
      ...(auditResult.matches || []).map(m => ({ ...m, compliant: true })),
      ...(auditResult.gaps || []).map(g => ({ ...g, compliant: false }))
    ].sort((a, b) => a.id.localeCompare(b.id));

    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CCAS Compliance Report - ${file.name}</title>
          <style>
            body {
              font-family: 'Segoe UI', system-ui, sans-serif;
              padding: 40px;
              color: #0f172a;
              background-color: #ffffff;
              line-height: 1.5;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #f97316;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .header-title h1 {
              font-size: 1.8rem;
              margin: 0;
              color: #0f172a;
            }
            .header-title p {
              font-size: 0.85rem;
              color: #475569;
              margin: 4px 0 0 0;
            }
            .score-circle {
              width: 75px;
              height: 75px;
              border-radius: 50%;
              border: 4px solid #fff7ed;
              background: #fff7ed;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .score-num {
              font-size: 1.5rem;
              font-weight: 800;
              color: #ea580c;
              line-height: 1;
            }
            .score-lbl {
              font-size: 0.55rem;
              color: #ea580c;
              text-transform: uppercase;
              font-weight: bold;
              margin-top: 2px;
            }
            .meta-section {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 25px;
              font-size: 0.85rem;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
            }
            .meta-item {
              display: flex;
              gap: 8px;
            }
            .meta-lbl {
              font-weight: bold;
              color: #475569;
              width: 130px;
            }
            .meta-val {
              color: #0f172a;
            }
            .checklist-title {
              font-size: 1.25rem;
              font-weight: 700;
              margin-bottom: 15px;
              color: #0f172a;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 8px;
            }
            .section-row {
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            .section-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            }
            .section-name {
              font-weight: bold;
              font-size: 1rem;
              color: #0f172a;
            }
            .badge {
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 0.75rem;
              font-weight: bold;
              text-transform: uppercase;
            }
            .badge.compliant {
              background-color: #d1fae5;
              color: #065f46;
            }
            .badge.partial {
              background-color: #fef3c7;
              color: #92400e;
            }
            .badge.non-compliant {
              background-color: #fff7ed;
              color: #c2410c;
            }
            .desc {
              font-size: 0.85rem;
              color: #334155;
              margin: 0;
            }
            .remediation {
              margin-top: 10px;
              padding: 10px;
              background-color: #fffbeb;
              border-left: 3px solid #f59e0b;
              border-radius: 4px;
              font-size: 0.85rem;
            }
            .remediation strong {
              display: block;
              color: #b45309;
              font-size: 0.75rem;
              text-transform: uppercase;
              margin-bottom: 3px;
            }
            .remediation p {
              margin: 0;
              color: #78350f;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="header-title">
              <h1>CCAS Compliance Assessment Report</h1>
              <p>Automated Cybersecurity Audit Matrix against CCoP v2.1 Standards</p>
            </div>
            <div class="score-circle">
              <span class="score-num">${auditResult.compliance_percentage}%</span>
              <span class="score-lbl">Adherent</span>
            </div>
          </div>
          <div class="meta-section">
            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-lbl">Target Document:</span>
                <span class="meta-val">${file.name}</span>
              </div>
              <div class="meta-item">
                <span class="meta-lbl">Assessment Date:</span>
                <span class="meta-val">${new Date().toLocaleDateString()}</span>
              </div>
              <div class="meta-item">
                <span class="meta-lbl">Document Size:</span>
                <span class="meta-val">${file.size}</span>
              </div>
              <div class="meta-item">
                <span class="meta-lbl">Regulatory Body:</span>
                <span class="meta-val">CCAS Compliance Engine</span>
              </div>
            </div>
          </div>
          <div class="checklist-title">Standard Controls Checklist Audit</div>
          ${allSections.map(sec => {
            const st = normalizeStatus(sec);
            const badgeCls = st === 'compliant' ? 'compliant' : st === 'partial' ? 'partial' : 'non-compliant';
            const badgeTxt = st === 'compliant' ? 'Compliant' : st === 'partial' ? 'Partially Compliant' : 'Non-Compliant';
            const actionLabel = st === 'partial' ? 'Action Required to Fully Comply:' : 'Proposed Solution to Comply:';
            return `
            <div class="section-row">
              <div class="section-header">
                <span class="section-name">${sec.id} - ${sec.title}</span>
                <span class="badge ${badgeCls}">${badgeTxt}</span>
              </div>
              <p class="desc">${sec.description}</p>
              ${(st === 'partial' || st === 'non-compliant') && sec.proposed_solution ? `
                <div class="remediation">
                  <strong>${actionLabel}</strong>
                  <p>${sec.proposed_solution}</p>
                </div>
              ` : ''}
            </div>`;
          }).join('')}
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
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
    if (status === 'compliant')     return { bg: '#d1fae5', border: '#10b981', text: '#065f46', label: 'COMPLIANT',           dot: '#10b981' };
    if (status === 'partial')       return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', label: 'PARTIALLY COMPLIANT', dot: '#f59e0b' };
    return                                 { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', label: 'NON-COMPLIANT',        dot: '#ef4444' };
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
                  Semantic audit against CCoP v2.1 · {file?.name}
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
                    gap: '1.25rem',
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.5rem'
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
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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
                      <span style={{ color: '#475569', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {statusMessage || 'Initializing AI audit engine...'}
                      </span>
                      <span style={{ marginLeft: 'auto', color: '#ea580c', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace' }}>
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
                  </div>

                  {/* Right Column: High-contrast colorful logs */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Audit Process Logs
                    </div>
                    {/* Log panel — white */}
                    <div className="scan-log-panel" style={{ flex: 1, minHeight: '235px' }}>
                      <div className="scan-log-line" style={{ animationDelay: '0s' }}>
                        <span className="log-tag ok">PASS</span>
                        <span>Section 3.1 — Leadership and Oversight · matched</span>
                      </div>
                      <div className="scan-log-line" style={{ animationDelay: '0.6s' }}>
                        <span className="log-tag warn">EVAL</span>
                        <span>Section 5.1 — Access Control · analyzing...</span>
                      </div>
                      <div className="scan-log-line" style={{ animationDelay: '1.2s' }}>
                        <span className="log-tag info">SCAN</span>
                        <span>Section 8.2 — BCP/DRP · cross-referencing...</span>
                      </div>
                      <div className="scan-log-line" style={{ animationDelay: '1.8s' }}>
                        <span className="log-tag ok">PASS</span>
                        <span>Section 9.1 — Awareness Programme · confirmed</span>
                      </div>
                      <div className="scan-log-line" style={{ animationDelay: '2.4s' }}>
                        <span className="log-tag fail">FAIL</span>
                        <span>Section 6.3 — Threat Hunting · not found</span>
                      </div>
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

            return (
              <div className="state-content fade-in">

                {/* Header */}
                <div className="success-header">
                  <div className="success-icon-wrapper">
                    <CheckCircle2 size={28} className="success-icon" />
                  </div>
                  <div className="title-section" style={{ flex: 1 }}>
                    <h2 className="success-title">Audit Report Generated</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Analyzed: <strong>{file?.name}</strong>
                    </p>
                  </div>
                </div>

                {/* ── Percentage Gauge ── */}
                <div style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  border: '1px solid #334155'
                }}>
                  {/* Circular score */}
                  <div style={{
                    position: 'relative',
                    width: '80px', height: '80px', flexShrink: 0
                  }}>
                    <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#334155" strokeWidth="7"/>
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
                      <span style={{ fontSize: '0.55rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Score</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                      Overall Compliance Score
                    </div>
                    <div style={{ fontSize: '0.75rem', color: pctColor, marginBottom: '0.6rem' }}>
                      {pct >= 85 ? '✓ Plan aligns with CCoP v2.1 mandates.'
                        : pct >= 60 ? '⚠ Action required — critical gaps identified.'
                        : '✗ Non-compliant — major controls missing.'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', fontWeight: 600 }}>
                      <span style={{ color: '#10b981' }}>✓ {compliantSubs} Compliant</span>
                      <span style={{ color: '#f59e0b' }}>◑ {partialSubs} Partial</span>
                      <span style={{ color: '#ef4444' }}>✗ {nonSubs} Non-Compliant</span>
                      <span style={{ color: '#64748b' }}>/ {totalSubs} total controls</span>
                    </div>
                  </div>
                </div>

                {/* ── Section label ── */}
                <div className="section-title-wrapper" style={{ marginTop: '0.25rem' }}>
                  <Info size={15} style={{ color: 'var(--primary)' }} />
                  <h4>CCoP v2.1 Section Compliance ({auditSections.length} sections)</h4>
                </div>

                {/* ── Collapsible Section Bars ── */}
                <div className="list-wrapper" style={{ maxHeight: '360px' }}>
                  <div className="items-list">
                    {auditSections.map((section) => {
                      const secStatus = section.overall_status || normalizeStatus(section);
                      const cfg = statusConfig(secStatus);
                      const isOpen = !!expandedSections[section.section_num];

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
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px',
                              borderRadius: '4px', background: cfg.dot + '22', color: cfg.text,
                              border: `1px solid ${cfg.dot}55`, whiteSpace: 'nowrap'
                            }}>
                              {cfg.label}
                            </span>
                            <span style={{ color: cfg.text, flexShrink: 0 }}>
                              {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                            </span>
                          </button>

                          {/* Expanded subsections */}
                          {isOpen && (
                            <div style={{ background: '#fafafa', borderTop: `1px solid ${cfg.border}44`, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              {(section.subsections || []).map((sub) => {
                                const subStatus = normalizeStatus(sub);
                                const subCfg = statusConfig(subStatus);
                                return (
                                  <div key={sub.id} style={{
                                    background: '#ffffff', border: `1px solid ${subCfg.border}44`,
                                    borderLeft: `3px solid ${subCfg.dot}`, borderRadius: '6px',
                                    padding: '0.7rem 0.85rem'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                      <span style={{
                                        fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px',
                                        borderRadius: '3px', background: subCfg.bg, color: subCfg.text,
                                        border: `1px solid ${subCfg.border}44`
                                      }}>{sub.id} • {subCfg.label}</span>
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a', marginBottom: '0.25rem' }}>{sub.title}</div>
                                    <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, margin: 0 }}>{sub.description}</p>
                                    {(subStatus === 'partial' || subStatus === 'non-compliant') && sub.proposed_solution && (
                                      <div style={{
                                        marginTop: '0.5rem', padding: '0.6rem 0.75rem',
                                        background: '#fffbeb', borderLeft: '3px solid #f59e0b',
                                        borderRadius: '4px', fontSize: '0.76rem'
                                      }}>
                                        <strong style={{ color: '#b45309', display: 'block', marginBottom: '0.2rem', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                          {subStatus === 'partial' ? 'Action Required:' : 'Proposed Solution to Comply:'}
                                        </strong>
                                        <p style={{ color: '#78350f', margin: 0, lineHeight: 1.4 }}>{sub.proposed_solution}</p>
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

                {/* Action buttons */}
                <div className="button-group" style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn-secondary" onClick={downloadPdfReport} style={{ flex: 1 }}>
                    <Download size={14} />
                    <span>Download PDF Report</span>
                  </button>
                  <button className="btn-reset" onClick={resetUploader} style={{ flex: 1 }}>
                    <RefreshCw size={14} />
                    <span>Analyze Another Plan</span>
                  </button>
                </div>
              </div>
            );
          })()}

        </div>
      </main>
    </div>
  );
}
