import React from 'react';
import { Activity, ArrowLeft, Shield } from 'lucide-react';
import './AppShell.css';

const navItems = ['Dashboard', 'Review Workspace', 'Reports', 'Standards & Admin'];

export default function AppShell({
  activeNav,
  onNavigate,
  projectTitle,
  projectSubtitle,
  onProjectBack,
  projectBackLabel = 'Back',
  runtimeLabel,
  runtimeReady,
  children,
}) {
  return (
    <div className="ccas-shell">
      <div className="ccas-main">
        <header className="ccas-topbar">
          <div className="ccas-brand">
            <div className="ccas-brand-mark" aria-hidden="true">
              <Shield size={28} />
            </div>
            <div className="ccas-brand-wordmark" aria-label="CCAS">
              <span className="ccas-brand-text">CCΛS</span>
            </div>
          </div>
          <div className="topbar-status">
            <span className={`status-pill ${runtimeReady ? 'ready' : 'danger'}`}>
              <Activity size={14} />
              <span>{runtimeLabel}</span>
            </span>
          </div>
        </header>

        <nav className="primary-nav">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`nav-pill ${activeNav === item ? 'active' : ''}`}
              onClick={() => onNavigate(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <section className={`project-context-bar ${onProjectBack ? 'with-back' : ''}`}>
          <div className="project-context-back-slot">
            {onProjectBack && (
              <button type="button" className="btn-secondary project-context-back" onClick={onProjectBack}>
                <ArrowLeft size={16} />
                <span>{projectBackLabel}</span>
              </button>
            )}
          </div>
          <div className="project-context-main">
            <div className="context-title">{projectTitle}</div>
          </div>
          {projectSubtitle ? (
            <div className="context-copy project-context-copy">{projectSubtitle}</div>
          ) : (
            <div className="project-context-copy project-context-copy-empty" />
          )}
        </section>

        <main className="ccas-page">{children}</main>
      </div>
    </div>
  );
}
