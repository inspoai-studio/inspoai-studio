import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import defaultAvatar from '../../assets/User.svg';
import { LogOut, Gift, User, CreditCard, ChevronDown, Code2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const UserManagement = ({ user, userQuota, onUpgradeClick, onProfileClick, onDeveloperClick, onMcpClick, expanded }) => {
  const { userData, userQuota: contextUserQuota } = useAuth();
  const effectiveUser = userData || user;
  const effectiveUserQuota = contextUserQuota || userQuota;

  const [avatarSrc, setAvatarSrc] = useState(effectiveUser?.photoURL || defaultAvatar);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync avatarSrc when user prop changes
  useEffect(() => {
    if (user?.photoURL) {
      setAvatarSrc(user.photoURL);
    } else {
      setAvatarSrc(defaultAvatar);
    }
  }, [user]);

  const clearAllMoodboardData = () => {
    localStorage.removeItem('moodboard_guest');
    localStorage.removeItem('moodboardImages');
    localStorage.removeItem('moodboardColorPalette');
    localStorage.removeItem('moodboardFontPairs');
    localStorage.removeItem('searchHistory');

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('moodboard_')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem('inspo_search_state');
    window.dispatchEvent(new CustomEvent('userLoggedOut'));
  };

  const handleSignOutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmSignOut = async () => {
    try {
      clearAllMoodboardData();
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setShowLogoutConfirm(false);
    }
  };

  const cancelSignOut = () => {
    setShowLogoutConfirm(false);
  };

  const isAdmin = (user) =>
    user &&
    (user.role === 'admin' ||
      user.isAdmin === true ||
      (user.claims && user.claims.admin === true));

  const userIsAdmin = isAdmin(effectiveUser);
  const userPlan = effectiveUser?.role || 'free';
  const isPaid = ['lite', 'lite_annual', 'freelancer', 'freelancer_annual', 'solo', 'solo_annual', 'team', 'team_annual', 'lifetime', 'admin'].includes(userPlan);

  const used = effectiveUserQuota?.used ?? 0;
  const limit = effectiveUserQuota?.limit ?? 0;
  const percent = limit > 0 ? (used / limit) * 100 : 0;

  return (
    <div className="user-quota-bar">
      <div className="divider" />

      {/* Quota info — moved above user info */}
      {expanded && (
        <div className="quota-section-top">
          <div className="quota-info">
            <div className="quota-text">
              {effectiveUserQuota?.isUnlimited
                ? 'Unlimited Credits'
                : `Credits: ${used}/${limit || 5} daily`}
            </div>

            {!effectiveUserQuota?.isUnlimited && (
              <div className="quota-progress">
                <div
                  className="quota-progress-bar"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>

          {userPlan === 'free' && (
            <div
              className="referral-shortcut"
              onClick={(e) => { e.stopPropagation(); onProfileClick(); }}
              style={{
                marginTop: '12px',
                fontSize: '11px',
                color: '#8b5cf6',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '600',
                padding: '4px 0',
                transition: 'opacity 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Gift size={12} />
              <span>Refer & get 50 credits</span>
            </div>
          )}

          {/* Team shortcut removed from sidebar as per request */}
        </div>
      )}

      <div className="user-info" ref={dropdownRef} style={{ position: 'relative' }}>
        {/* avatar-container + admin flag */}
        <div
          className={`avatar-container${userIsAdmin ? ' admin' : ''}`}
          onClick={() => setShowDropdown(!showDropdown)}
          style={{ cursor: 'pointer' }}
        >
          <img
            src={avatarSrc}
            alt={effectiveUser?.displayName || 'User'}
            className="user-avatar"
            onError={() => setAvatarSrc(defaultAvatar)}
            referrerPolicy="no-referrer"
          />

          {userIsAdmin && (
            <div className="admin-crown">
              <img src="/crown.svg" alt="Admin" className="crown-icon" />
            </div>
          )}
        </div>

        {expanded && (
          <div
            className="user-details"
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden' }}>
              <span className="user-name">{effectiveUser?.displayName || 'Anonymous'}</span>
              {userIsAdmin ? (
                <span className="admin-badge">Admin</span>
              ) : isPaid ? (
                <span className={`user-plan-badge plan-${userPlan}`}>
                  {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                </span>
              ) : (
                <span className="upgrade-to-pro" onClick={(e) => { e.stopPropagation(); onUpgradeClick(); }}>
                  Upgrade to Plus ✦
                </span>
              )}
            </div>
            <ChevronDown size={16} color="#666" style={{ transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </div>
        )}

        {/* Profile Dropdown Menu */}
        {showDropdown && expanded && (
          <div
            className="profile-dropdown-menu"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 12px)',
              left: '0',
              right: '0',
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              padding: '8px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div className="dropdown-header" style={{ padding: '8px 12px', borderBottom: '1px solid #eee', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#111', display: 'block' }}>{user?.displayName || 'Anonymous'}</span>
              <span style={{ fontSize: '12px', color: '#666' }}>{user?.email}</span>
            </div>

            {userPlan === 'free' && (
              <button
                className="dropdown-item"
                onClick={() => { setShowDropdown(false); if (onProfileClick) onProfileClick(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: '#111' }}
              >
                <Gift size={16} /> Refer & get 50 credits
              </button>
            )}

            <button
              className="dropdown-item"
              onClick={() => { setShowDropdown(false); if (onProfileClick) onProfileClick(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: '#111' }}
            >
              <User size={16} /> Profile
            </button>

            <div
              className="dropdown-item"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'transparent', borderRadius: '6px', fontSize: '13px', color: '#111' }}
            >
              <CreditCard size={16} /> Free Plan · 5 Daily Credits
            </div>

            <button
              className="dropdown-item"
              onClick={() => { setShowDropdown(false); if (onMcpClick) onMcpClick(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: '#111' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plug"><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></svg>
              MCP Connector
            </button>

            {isPaid && userPlan !== 'lifetime' && userPlan !== 'admin' && (
              <button
                className="dropdown-item"
                onClick={() => { setShowDropdown(false); window.location.href = 'mailto:support@inspoai.live?subject=Cancel Plan Request'; }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: '#ef4444' }}
              >
                Cancel Plan
              </button>
            )}

            <div style={{ height: '1px', background: '#eee', margin: '4px 0' }}></div>

            <button
              className="dropdown-item"
              onClick={() => { setShowDropdown(false); handleSignOutClick(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: '#111' }}
            >
              <LogOut size={16} /> Log Out
            </button>
          </div>
        )}
      </div>

      {/* Logout Confirmation Popup */}
      {showLogoutConfirm && (
        <div className="logout-popup-overlay">
          <div className="logout-popup">
            <h3>Confirm Sign Out</h3>
            <p>Are you sure you want to sign out?</p>
            <div className="logout-buttons">
              <button className="cancel-button" onClick={cancelSignOut}>Cancel</button>
              <button className="confirm-button" onClick={confirmSignOut}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;