import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';

export default function FairUsePolicy() {
  const navigate = useNavigate();

  const containerStyle = {
    maxWidth: '840px',
    margin: '0 auto',
    padding: '60px 24px',
    fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    lineHeight: '1.65',
    color: '#18181b',
    backgroundColor: '#ffffff'
  };

  const headerStyle = {
    marginBottom: '40px',
    borderBottom: '1px solid #e4e4e7',
    paddingBottom: '24px'
  };

  const backButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '100px',
    border: '1px solid #e4e4e7',
    background: '#f4f4f5',
    color: '#18181b',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '24px',
    transition: 'all 0.2s ease'
  };

  const titleStyle = {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: '#09090b',
    letterSpacing: '-0.02em',
    marginBottom: '12px'
  };

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    padding: '4px 12px',
    borderRadius: '100px',
    fontSize: '12px',
    fontWeight: '700',
    marginBottom: '16px'
  };

  const sectionStyle = {
    marginBottom: '36px'
  };

  const sectionTitleStyle = {
    fontSize: '1.35rem',
    fontWeight: '750',
    color: '#09090b',
    marginBottom: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  };

  const paragraphStyle = {
    color: '#3f3f46',
    fontSize: '15px',
    marginBottom: '14px'
  };

  const calloutBoxStyle = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '20px 24px',
    marginBottom: '24px'
  };

  const warningBoxStyle = {
    background: '#fff1f2',
    border: '1px solid #ffe4e6',
    borderRadius: '16px',
    padding: '20px 24px',
    marginBottom: '24px'
  };

  return (
    <div style={containerStyle}>
      <button style={backButtonStyle} onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div style={headerStyle}>
        <div style={badgeStyle}>
          <ShieldAlert size={14} /> Strict Enforcement Policy
        </div>
        <h1 style={titleStyle}>Fair Use & Abuse Prevention Policy</h1>
        <p style={{ color: '#71717a', fontSize: '14px' }}>
          Last Updated: August 2026 · Effective Immediately for all InspoAI accounts
        </p>
      </div>

      <div style={warningBoxStyle}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: '0 0 6px', color: '#9f1239', fontSize: '15px', fontWeight: '700' }}>
              Zero-Tolerance Multi-Account & Farming Policy
            </h4>
            <p style={{ margin: 0, color: '#881337', fontSize: '13.5px', lineHeight: '1.5' }}>
              InspoAI provides <strong>5 free daily AI generation credits</strong> to support legitimate creators, developers, and designers worldwide. Any attempt to bypass daily quotas via multi-accounting, disposable emails, headless scripts, or automated farms will result in an <strong>immediate and permanent ban</strong> of all related accounts and IP/device fingerprints.
            </p>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          <CheckCircle2 size={20} color="#10b981" /> 1. One Account Per Human User
        </h2>
        <p style={paragraphStyle}>
          Every user is permitted exactly <strong>one active InspoAI account</strong>. Your 5 free daily AI credits refresh automatically every 24 hours at midnight UTC (generating up to 40–50 complete screens per day across all sessions).
        </p>
        <p style={paragraphStyle}>
          Creating secondary accounts (using throwaway emails, alias forwarding, or multiple Google accounts) to bypass credit thresholds is strictly classified as theft of compute resources.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          <Lock size={20} color="#3b82f6" /> 2. Prohibited Activities
        </h2>
        <div style={calloutBoxStyle}>
          <ul style={{ paddingLeft: '20px', margin: 0, color: '#334155', fontSize: '14px', lineHeight: '1.7' }}>
            <li><strong>Automated Scraping & Headless Bots:</strong> Using Puppeteer, Playwright, Selenium, or custom cURL loops to scrape InspoAI's 200K+ design index or trigger generation endpoints.</li>
            <li><strong>Reverse Engineering Internal APIs:</strong> Calling private backend endpoints outside of the official InspoAI web interface.</li>
            <li><strong>Disposable Email Services:</strong> Registering via temporary mail providers (e.g. 10minutemail, tempmail) to generate one-off accounts.</li>
            <li><strong>Malicious Code Generation:</strong> Generating phishing interfaces, credential harvesters, illegal platforms, or deceptive UI clones.</li>
            <li><strong>Account Reselling:</strong> Transferring or selling pre-authenticated InspoAI sessions or accounts.</li>
          </ul>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          <ShieldAlert size={20} color="#f59e0b" /> 3. Automated Telemetry & Detection
        </h2>
        <p style={paragraphStyle}>
          InspoAI employs real-time behavioral telemetry, browser fingerprinting, and network anomaly detection. Our systems continuously evaluate:
        </p>
        <ul style={{ paddingLeft: '20px', color: '#52525b', fontSize: '14px', lineHeight: '1.7', marginBottom: '14px' }}>
          <li>Simultaneous multi-session generation bursts from matching subnet ranges.</li>
          <li>Identical prompt patterns originating from newly spawned accounts.</li>
          <li>Synthetic mouse trajectories and headless browser signatures.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          <AlertTriangle size={20} color="#ef4444" /> 4. Penalties for Violations
        </h2>
        <p style={paragraphStyle}>
          If an account is flagged for fair use violations:
        </p>
        <ol style={{ paddingLeft: '20px', color: '#52525b', fontSize: '14px', lineHeight: '1.7', marginBottom: '14px' }}>
          <li><strong>Immediate Suspension:</strong> The account and all associated saved moodboards, canvases, and generated assets are permanently revoked.</li>
          <li><strong>Device & IP Blacklist:</strong> Associated IP ranges, device fingerprints, and authentication credentials will be blacklisted across all InspoAI services.</li>
          <li><strong>No Appeal for Scripted Farming:</strong> Automated farming accounts are purged permanently without reinstatement.</li>
        </ol>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>5. Questions & Legitimate High-Volume Requests</h2>
        <p style={paragraphStyle}>
          If you are an agency, startup, or educational organization needing higher generation volume or dedicated enterprise capacity, please reach out to our team at <a href="mailto:support@inspoai.io" style={{ color: '#09090b', fontWeight: '600' }}>support@inspoai.io</a> rather than creating duplicate accounts.
        </p>
      </div>
    </div>
  );
}
