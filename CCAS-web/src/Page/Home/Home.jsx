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
  Info
} from 'lucide-react';
import './Home.css';

export default function Home() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState('idle'); // idle | scanning | completed
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
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
          ${allSections.map(sec => `
            <div class="section-row">
              <div class="section-header">
                <span class="section-name">${sec.id} - ${sec.title}</span>
                <span class="badge ${sec.compliant ? 'compliant' : 'non-compliant'}">
                  ${sec.compliant ? 'Compliant' : 'Non-Compliant'}
                </span>
              </div>
              <p class="desc">${sec.description}</p>
              ${!sec.compliant && sec.proposed_solution ? `
                <div class="remediation">
                  <strong>Proposed Solution to Comply:</strong>
                  <p>${sec.proposed_solution}</p>
                </div>
              ` : ''}
            </div>
          `).join('')}
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

  // Compile full sorted list of all standard controls for UI display
  const allSections = auditResult ? (
    auditResult.all_sections || [
      ...(auditResult.matches || []).map(m => ({ ...m, compliant: true })),
      ...(auditResult.gaps || []).map(g => ({ ...g, compliant: false }))
    ]
  ).sort((a, b) => a.id.localeCompare(b.id)) : [];

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
        <div className={`upload-container glass-card ${uploadState === 'completed' ? 'expanded' : ''}`}>
          
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

          {/* 2. SCANNING STATE: ANIMATION UI */}
          {uploadState === 'scanning' && (
            <div className="state-content centered fade-in">
              <div className="title-section">
                <h2>Analyzing Document</h2>
                <p>Running compliance tests against standard controls on LM Studio...</p>
              </div>

              {/* Glowing animated scanner container */}
              <div className="animation-box">
                <div className="scanning-outer-ring">
                  <div className="scanning-core">
                    <Loader2 size={36} className="spinner-icon" />
                  </div>
                </div>
                {/* Horizontal scan light line */}
                <div className="scanning-line"></div>
              </div>

              <div className="file-details-strip">
                <FileText size={18} className="file-icon" />
                <span className="file-name" title={file?.name}>{file?.name}</span>
                <span className="file-size">({file?.size})</span>
              </div>

              <div className="progress-section">
                <div className="progress-meta">
                  <span className="status-log">{statusMessage}</span>
                  <span className="percent-text">{progress}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
          )}

          {/* 3. COMPLETED STATE: VERIFIED DISPLAY */}
          {uploadState === 'completed' && auditResult && (
            <div className="state-content fade-in">
              <div className="success-header">
                <div className="success-icon-wrapper">
                  <CheckCircle2 size={36} className="success-icon" />
                </div>
                <div className="title-section" style={{ flex: 1 }}>
                  <h2 className="success-title">Audit Report Generated</h2>
                  <p>Analyzed: <strong>{file?.name}</strong> ({file?.size})</p>
                </div>
              </div>

              {/* Compliance score header card */}
              <div className="score-summary-card">
                <div className="radial-score-box">
                  <span className="score-val" style={{
                    color: auditResult.compliance_percentage >= 85 ? 'var(--success)' : auditResult.compliance_percentage >= 60 ? 'var(--primary)' : 'var(--danger)'
                  }}>
                    {auditResult.compliance_percentage}%
                  </span>
                  <span className="score-lbl">Adherence</span>
                </div>
                <div className="score-details">
                  <h4>Assessment Verdict</h4>
                  <p>
                    {auditResult.compliance_percentage >= 85 
                      ? 'The plan aligns with target CCoP mandates. Review the minor gaps identified below.' 
                      : auditResult.compliance_percentage >= 60 
                      ? 'Action required. The plan contains critical gaps that must be addressed.' 
                      : 'Non-Compliant. Critical security controls are absent or not defined.'}
                  </p>
                </div>
              </div>

              {/* Checklist list title */}
              <div className="section-title-wrapper">
                <Info size={16} style={{ color: 'var(--primary)' }} />
                <h4>Control Checklist Assessment ({allSections.length} sections)</h4>
              </div>

              {/* Checklist items list */}
              <div className="list-wrapper">
                <div className="items-list">
                  {allSections.map((sec, index) => (
                    <div key={index} className={`list-card ${sec.compliant ? 'match-card' : 'gap-card'}`}>
                      <div className="card-header">
                        <div className={`card-badge ${sec.compliant ? 'success' : ''}`} style={{
                          color: sec.compliant ? 'var(--success)' : 'var(--primary)',
                          background: sec.compliant ? 'var(--success-glow)' : 'var(--primary-glow)'
                        }}>
                          {sec.id || 'SECTION'} • {sec.compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
                        </div>
                        <h5>{sec.title}</h5>
                      </div>
                      <p className="card-desc">{sec.description}</p>
                      
                      {/* Proposed solution for non-compliant areas */}
                      {!sec.compliant && sec.proposed_solution && (
                        <div className="remediation-box fade-in">
                          <strong>Proposed Solution to Comply:</strong>
                          <p>{sec.proposed_solution}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

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
          )}

        </div>
      </main>
    </div>
  );
}
