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
  Info,
  ExternalLink,
  BookOpen
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
  const [activeTab, setActiveTab] = useState('gaps'); // gaps | matches
  
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
                <p>Upload your cybersecurity plan to analyze its compliance against CCoP v2.1 standards using local Qwen AI.</p>
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

              {/* Tabs for details list */}
              <div className="tabs-container">
                <button 
                  className={`tab-btn ${activeTab === 'gaps' ? 'active' : ''}`}
                  onClick={() => setActiveTab('gaps')}
                >
                  Identified Gaps ({auditResult.gaps ? auditResult.gaps.length : 0})
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
                  onClick={() => setActiveTab('matches')}
                >
                  Compliant Controls ({auditResult.matches ? auditResult.matches.length : 0})
                </button>
              </div>

              {/* Tab results list */}
              <div className="list-wrapper">
                {activeTab === 'gaps' && (
                  (!auditResult.gaps || auditResult.gaps.length === 0) ? (
                    <div className="empty-tab-state">
                      <ShieldCheck size={28} className="success-icon" />
                      <p>No gaps identified! Your plan fully complies with CCoP requirements.</p>
                    </div>
                  ) : (
                    <div className="items-list">
                      {auditResult.gaps.map((gap, index) => (
                        <div key={index} className="list-card gap-card">
                          <div className="card-header">
                            <div className="card-badge" style={{
                              color: gap.level === 'high' ? 'var(--danger)' : 'var(--primary)',
                              background: gap.level === 'high' ? 'var(--danger-glow)' : 'var(--primary-glow)'
                            }}>
                              {gap.id || 'GAP'} • {gap.level || 'medium'} severity
                            </div>
                            <h5>{gap.title}</h5>
                          </div>
                          <p className="card-desc">{gap.description}</p>
                          {gap.proposed_solution && (
                            <div className="remediation-box">
                              <strong>Proposed Solution:</strong>
                              <p>{gap.proposed_solution}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {activeTab === 'matches' && (
                  (!auditResult.matches || auditResult.matches.length === 0) ? (
                    <div className="empty-tab-state">
                      <AlertTriangle size={28} style={{ color: 'var(--text-muted)' }} />
                      <p>No compliant controls mapped in the analysis.</p>
                    </div>
                  ) : (
                    <div className="items-list">
                      {auditResult.matches.map((match, index) => (
                        <div key={index} className="list-card match-card">
                          <div className="card-header">
                            <div className="card-badge success">
                              {match.id || 'OK'} • Compliant
                            </div>
                            <h5>{match.title}</h5>
                          </div>
                          <p className="card-desc">{match.description}</p>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              <div className="button-group">
                <button className="btn-reset" onClick={resetUploader}>
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
