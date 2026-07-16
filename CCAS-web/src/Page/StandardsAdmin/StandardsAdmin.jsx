import React from 'react';
import { BookOpenCheck, DatabaseZap, Download, Lock, ServerCog, Sparkles } from 'lucide-react';
import './StandardsAdmin.css';

export default function StandardsAdmin({ availableModels, selectedModel, onDownloadTemplate }) {
  const selectedLabel = availableModels.find((model) => model.value === selectedModel)?.label || selectedModel;

  return (
    <>
      <section className="page-hero">
        <div className="section-title admin-hero-title">
          <div>
            <div className="section-kicker">Standards & Admin</div>
            <h1 className="hero-title">Standards library constraints and runtime administration</h1>
            <p className="hero-subtitle">
              Preserve the reference IA while adapting the admin story for CCAS: one built-in standard, local runtime health, and model selection visibility.
            </p>
          </div>
          <button type="button" className="btn-primary admin-hero-download" onClick={onDownloadTemplate}>
            <Download size={16} />
            <span>Download template PDF</span>
          </button>
        </div>
      </section>

      <section className="two-column-grid">
        <div className="admin-card">
          <div className="section-title">
            <div>
              <h3>Standards library</h3>
              <p>Current CCAS scope compared with the reference project</p>
            </div>
          </div>

          <div className="admin-feature-list">
            <div className="admin-feature-item">
              <BookOpenCheck size={18} />
              <div>
                <h4 className="admin-title">Fixed CCoP v2.1 baseline</h4>
                <p className="admin-copy">The platform always uses the current internal CCAS standard. Users do not upload or manage multiple templates.</p>
              </div>
            </div>
            <div className="admin-feature-item">
              <Lock size={18} />
              <div>
                <h4 className="admin-title">Template uploads disabled</h4>
                <p className="admin-copy">This page communicates the constraint clearly so the UI still matches the reference structure without exposing unsupported actions.</p>
              </div>
            </div>
            <div className="admin-feature-item">
              <DatabaseZap size={18} />
              <div>
                <h4 className="admin-title">Consistent mapping source</h4>
                <p className="admin-copy">Every review uses the same curated control mapping, keeping all reports comparable and simplifying governance.</p>
              </div>
            </div>
            <div className="admin-feature-item admin-feature-item-actionable">
              <Download size={18} />
              <div className="admin-feature-content">
                <h4 className="admin-title">Download current template PDF</h4>
                <p className="admin-copy">Download the exact built-in CCoP template PDF used by the system so users can review the assessment basis.</p>
                <div className="admin-download-inline">Use the top download button for quick access.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="section-title">
            <div>
              <h3>AI runtime & knowledge</h3>
              <p>Operational visibility for the local runtime stack</p>
            </div>
          </div>

          <div className="admin-runtime-stack">
            <div className="admin-runtime-item">
              <ServerCog size={18} />
              <div>
                <div className="metric-label">Runtime target</div>
                <div className="metric-value admin-runtime-value">{selectedLabel}</div>
              </div>
            </div>
            <div className="admin-runtime-item">
              <Sparkles size={18} />
              <div>
                <div className="metric-label">Available models</div>
                <div className="admin-runtime-copy">{availableModels.map((model) => model.label).join(' · ')}</div>
              </div>
            </div>
            <div className="admin-runtime-item">
              <Lock size={18} />
              <div>
                <div className="metric-label">Policy</div>
                <div className="admin-runtime-copy">Standard content remains internal and fixed while runtime model selection stays user-controlled.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
