import React, { useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import '../styles/AuthScreen.css';

const TESTIMONIAL = {
  quote: "Saved my time 10x",
  body: "We at Untitled Studio used to spend hours searching for moodboard references. With InspoAI it's just saved my time 10x — from finding the right UI to sharing it as a moodboard. It's crazy.",
  name: "Raghavendra Sagar",
  title: "Co-founder & Director, Untitled Studio",
  avatar: "/testimonial-sagar.jpg",
  linkedin: "https://www.linkedin.com/in/raghavendermfa/",
};

const FREE_FEATURES = [
  {
    text: "15 free searches per day",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    text: "Free moodboard creation",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    text: "Free brand scanner",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    text: "Free design audit",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },
];

const Auth = ({ loading, error }) => {
  const googleProvider = new GoogleAuthProvider();

  // Trustpilot script removed — using custom badge instead

  const leftPanelRef = React.useRef(null);
  const gridRef = React.useRef(null);

  const handleMouseMove = (e) => {
    const panel = leftPanelRef.current;
    const grid = gridRef.current;
    if (!panel || !grid) return;
    const rect = panel.getBoundingClientRect();
    // Offset from center, scaled down for a subtle effect
    const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 24;
    const dy = ((e.clientY - rect.top)  / rect.height - 0.5) * 24;
    grid.style.setProperty('--dx', `${dx}px`);
    grid.style.setProperty('--dy', `${dy}px`);
  };

  const handleMouseLeave = () => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.style.setProperty('--dx', '0px');
    grid.style.setProperty('--dy', '0px');
  };
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign in error:', err);
    }
  };

  return (
    <div className="auth-root">
      {/* ── Right panel — sign in form (first in DOM → top on mobile) ── */}
      <div className="auth-right">
        <div className="auth-form">
          {/* Logo above heading */}
          <div className="auth-form__logo">
            <img src="/LogoInspo.svg" alt="InspoAI" height="34" />
          </div>

          <hgroup className="auth-form__hgroup">
            <h1 className="auth-form__title">Welcome back</h1>
            <div className="auth-social-proof">
              <div className="auth-avatars">
                {['/avatar-1.jpg', '/avatar-2.jpg', '/avatar-3.jpg', '/avatar-4.jpg'].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Designer ${i + 1}`}
                    className="auth-avatars__img"
                    style={{ zIndex: 4 - i }}
                  />
                ))}
              </div>
              <span className="auth-form__sub">Join 1,000+ designers using InspoAI</span>
            </div>
          </hgroup>

          <button
            className="auth-google-btn"
            onClick={handleSignIn}
            disabled={loading}
          >
            <img src="/google-icon.svg" alt="Google" width="18" height="18" />
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {error && <div className="auth-error">{error}</div>}

          {/* Free tier features list */}
          <ul className="auth-features">
            {FREE_FEATURES.map((f, i) => (
              <li key={i} className="auth-features__item">
                <span className="auth-features__icon">{f.icon}</span>
                {f.text}
              </li>
            ))}
          </ul>

          {/* Trustpilot 4.2 badge */}
          <a
            href="https://www.trustpilot.com/review/inspoai.io"
            target="_blank"
            rel="noopener noreferrer"
            className="trustpilot-badge"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#00B67A"/>
            </svg>
            <span className="trustpilot-badge__rating">4.2</span>
            <span className="trustpilot-badge__sep">on</span>
            <img src="/trustpilot-logo.png" alt="Trustpilot" className="trustpilot-badge__logo" />
          </a>

          <p className="auth-form__terms">
            By continuing you agree to our{' '}
            <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer">Terms</a>
            {' '}and{' '}
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* ── Left panel — second in DOM, shown below on mobile ── */}
      <div
        className="auth-left"
        ref={leftPanelRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="auth-left__grid" ref={gridRef} aria-hidden />

        <div className="auth-left__content">
          <div className="auth-testimonial">
            <div className="auth-testimonial__stars" aria-label="5 stars">
              {[...Array(5)].map((_, i) => (
                <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#F5A623" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ))}
            </div>

            <p className="auth-testimonial__highlight">"{TESTIMONIAL.quote}"</p>
            <p className="auth-testimonial__body">"{TESTIMONIAL.body}"</p>

            <div className="auth-testimonial__author">
              <a href={TESTIMONIAL.linkedin} target="_blank" rel="noopener noreferrer" className="auth-testimonial__avatar-link">
                <img
                  src={TESTIMONIAL.avatar}
                  alt={TESTIMONIAL.name}
                  className="auth-testimonial__avatar"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </a>
              <div className="auth-testimonial__meta">
                <span className="auth-testimonial__name">{TESTIMONIAL.name}</span>
                <span className="auth-testimonial__title">{TESTIMONIAL.title}</span>
              </div>
            </div>
          </div>

          <p className="auth-left__tagline">Trusted by designers worldwide.</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;