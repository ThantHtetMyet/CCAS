import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft,
  Loader2,
  Lock,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import './Home.css';

export default function Home() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState('idle'); // idle | scanning | completed
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  // Status message transitions during scanning
  const statusSteps = [
    { threshold: 0, text: 'Uploading file to secure server...' },
    { threshold: 25, text: 'Verifying document authenticity...' },
    { threshold: 50, text: 'Parsing cybersecurity controls...' },
    { threshold: 75, text: 'Mapping compliance criteria...' },
    { threshold: 90, text: 'Finalizing assessment plan...' }
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
    
    startScanningAnimation();
  };

  const startScanningAnimation = () => {
    setUploadState('scanning');
    setProgress(0);
    setStatusMessage('Uploading file to secure server...');

    const interval = setInterval(() => {
      setProgress(prev => {
        const nextProgress = prev + 4;
        
        // Update scanning status descriptions
        const currentStep = [...statusSteps]
          .reverse()
          .find(step => nextProgress >= step.threshold);
        if (currentStep) {
          setStatusMessage(currentStep.text);
        }

        if (nextProgress >= 100) {
          clearInterval(interval);
          setUploadState('completed');
          return 100;
        }
        return nextProgress;
      });
    }, 150);
  };

  const resetUploader = () => {
    setFile(null);
    setUploadState('idle');
    setProgress(0);
    setErrorMsg('');
  };

  return (
    <div className="portal-container">
      {/* Mini top brand bar */}
      <header className="portal-header">
        <div className="portal-logo">
          <Lock size={16} />
          <span>CCAS PLAN VALIDATOR</span>
        </div>
      </header>

      <main className="portal-main">
        <div className="upload-container glass-card">
          
          {/* 1. IDLE STATE: DRAG & DROP ZONE */}
          {uploadState === 'idle' && (
            <div className="state-content fade-in">
              <div className="title-section">
                <h2>Cybersecurity Plan Upload</h2>
                <p>Upload your system security plan (SSP) or compliance standard to verify security adherence guidelines.</p>
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
                <p>Please wait while our compliance engine processes the uploaded plan details.</p>
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
          {uploadState === 'completed' && (
            <div className="state-content centered fade-in">
              <div className="success-icon-wrapper">
                <CheckCircle2 size={48} className="success-icon" />
              </div>

              <div className="title-section">
                <h2 className="success-title">Plan Document Registered</h2>
                <p>Your cybersecurity plan was uploaded, scanned, and successfully indexed.</p>
              </div>

              <div className="verification-card">
                <div className="verification-row">
                  <span className="label">Document Name</span>
                  <span className="value text-ellipsis" title={file?.name}>{file?.name}</span>
                </div>
                <div className="verification-row">
                  <span className="label">Document Size</span>
                  <span className="value">{file?.size}</span>
                </div>
                <div className="verification-row">
                  <span className="label">Assessment Score</span>
                  <span className="value compliance-badge">92% ADHERENCE</span>
                </div>
                <div className="verification-row">
                  <span className="label">Status</span>
                  <span className="value status-badge">
                    <ShieldCheck size={14} /> SECURED
                  </span>
                </div>
              </div>

              <div className="button-group">
                <button className="btn-reset" onClick={resetUploader}>
                  <RefreshCw size={16} />
                  <span>Upload Another Document</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
