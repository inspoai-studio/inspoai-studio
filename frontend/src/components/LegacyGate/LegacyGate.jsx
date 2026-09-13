import React, { useState } from 'react';
import '../../styles/LegacyGate.css';

const LEGACY_PASSWORD = import.meta.env.VITE_LEGACY_PASSWORD || 'inspoai@v1';
const SESSION_KEY = 'inspo_legacy_unlocked';

const LegacyGate = ({ children }) => {
  const isUnlocked = sessionStorage.getItem(SESSION_KEY) === '1';
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === LEGACY_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setUnlocked(true);
    } else {
      setError('Incorrect password. Try again.');
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 600);
    }
  };

  if (unlocked) return children;

  return (
    <div className="legacy-gate-overlay">
      {/* Background grid */}
      <div className="legacy-gate-bg" />

      <div className={`legacy-gate-card ${shake ? 'shake' : ''}`}>
        {/* Lock icon */}
        <div className="legacy-gate-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div className="legacy-gate-badge">INTERNAL ACCESS</div>

        <h1 className="legacy-gate-title">InspoAI Legacy</h1>
        <p className="legacy-gate-subtitle">
          Full feature suite — restricted access
        </p>

        <form className="legacy-gate-form" onSubmit={handleSubmit}>
          <div className="legacy-gate-input-wrap">
            <input
              id="legacy-password-input"
              type={showPass ? 'text' : 'password'}
              className="legacy-gate-input"
              placeholder="Enter access password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              autoFocus
              autoComplete="off"
            />
            <button
              type="button"
              className="legacy-gate-eye"
              onClick={() => setShowPass(p => !p)}
              tabIndex={-1}
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {error && <p className="legacy-gate-error">{error}</p>}

          <button
            id="legacy-gate-submit"
            type="submit"
            className="legacy-gate-submit"
            disabled={!input}
          >
            <span>Unlock Access</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        <p className="legacy-gate-hint">
          This area contains the complete InspoAI feature set including History &amp; Moodboard.
        </p>
      </div>
    </div>
  );
};

export default LegacyGate;
