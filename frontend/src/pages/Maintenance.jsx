import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Maintenance = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const googleProvider = new GoogleAuthProvider();

  const handleSignIn = async () => {
    setLoading(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign in error:', err);
      setAuthError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Subtle glowing animated backgrounds */}
      <div style={styles.radialBlur1}></div>
      <div style={styles.radialBlur2}></div>
      <div style={styles.gridOverlay}></div>

      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <img src="/LogoInspo.svg" alt="InspoAI" style={styles.logo} />
        </div>

        <div style={styles.statusBadge}>
          <span style={styles.pulseDot}></span>
          Scheduled Maintenance
        </div>

        <h1 style={styles.title}>Upgrading InspoAI</h1>
        
        <p style={styles.description}>
          We are currently performing server migrations and system updates to improve performance. The workspace will be back online shortly.
        </p>

        {user ? (
          <div style={styles.authSection}>
            <div style={styles.unauthorizedBox}>
              <div style={styles.lockIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3 style={styles.unauthorizedTitle}>Access Restricted</h3>
              <div style={styles.emailBadge}>
                {user.email}
              </div>
            </div>
            
            <button 
              onClick={handleSignOut} 
              disabled={loading} 
              style={styles.signOutButton}
            >
              {loading ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        ) : (
          <div style={styles.authSection}>
            <p style={styles.adminTip}>
              Are you an administrator? Sign in to bypass maintenance mode.
            </p>
            <button 
              onClick={handleSignIn} 
              disabled={loading} 
              style={styles.loginButton}
            >
              <img src="/google-icon.svg" alt="Google" style={styles.googleIcon} />
              {loading ? 'Authenticating...' : 'Sign in as Admin'}
            </button>
          </div>
        )}

        {authError && <div style={styles.errorText}>{authError}</div>}

        <div style={styles.footer}>
          © {new Date().getFullYear()} InspoAI. All rights reserved.
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    fontFamily: "'Geist', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  radialBlur1: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    width: '50vw',
    height: '50vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(108, 92, 231, 0.08) 0%, transparent 70%)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  radialBlur2: {
    position: 'absolute',
    bottom: '-10%',
    right: '-10%',
    width: '50vw',
    height: '50vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  gridOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(circle, #e2e8f0 1.5px, transparent 1.5px)',
    backgroundSize: '28px 28px',
    opacity: 0.65,
    zIndex: 2,
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: '440px',
    padding: '40px 48px',
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(235, 235, 235, 0.8)',
    borderRadius: '24px',
    boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.01)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: '28px',
  },
  logo: {
    height: '38px',
    width: 'auto',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '100px',
    background: 'rgba(0, 0, 0, 0.04)',
    color: '#555',
    fontSize: '0.8rem',
    fontWeight: '600',
    letterSpacing: '-0.1px',
    marginBottom: '20px',
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#E11D48',
    animation: 'pulse 2s infinite',
    display: 'inline-block',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '750',
    color: '#111',
    letterSpacing: '-0.7px',
    margin: '0 0 12px 0',
  },
  description: {
    fontSize: '0.92rem',
    color: '#666',
    lineHeight: '1.6',
    margin: '0 0 32px 0',
  },
  authSection: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  adminTip: {
    fontSize: '0.78rem',
    color: '#888',
    margin: '0 0 4px 0',
  },
  loginButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '14px 20px',
    border: '1.5px solid #e0e0e0',
    borderRadius: '14px',
    background: '#fff',
    color: '#111',
    fontSize: '0.9rem',
    fontWeight: '600',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  },
  googleIcon: {
    width: '18px',
    height: '18px',
  },
  unauthorizedBox: {
    width: '100%',
    padding: '20px 24px',
    background: '#FFF5F5',
    border: '1px solid #FFE4E4',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    boxSizing: 'border-box',
  },
  lockIcon: {
    color: '#E11D48',
    marginBottom: '4px',
  },
  unauthorizedTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#111',
    margin: 0,
  },
  unauthorizedText: {
    fontSize: '0.8rem',
    color: '#666',
    margin: 0,
    lineHeight: '1.4',
  },
  emailBadge: {
    fontSize: '0.82rem',
    fontWeight: '600',
    color: '#E11D48',
    background: 'rgba(225, 29, 72, 0.06)',
    padding: '4px 10px',
    borderRadius: '8px',
    wordBreak: 'break-all',
  },
  signOutButton: {
    width: '100%',
    padding: '14px 20px',
    border: 'none',
    borderRadius: '14px',
    background: '#111',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: '600',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  errorText: {
    fontSize: '0.8rem',
    color: '#E11D48',
    marginTop: '12px',
  },
  footer: {
    fontSize: '0.72rem',
    color: '#AAA',
    marginTop: '40px',
  }
};

// Add standard keyframe styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.5);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 8px rgba(225, 29, 72, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(225, 29, 72, 0);
      }
    }
  `;
  document.head.appendChild(styleEl);
}

export default Maintenance;
