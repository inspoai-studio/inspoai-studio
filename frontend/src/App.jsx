import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useExtensionBridge } from './hooks/useExtensionBridge';
import { AppModeProvider } from './context/AppModeContext';
import { Lock } from 'lucide-react';
import './styles/AuthScreen.css';

// Lazy load components for performance
const Login = lazy(() => import('./pages/Login'));
const MainScreen = lazy(() => import('./pages/MainScreen'));
const MoodboardViewer = lazy(() => import('./pages/MoodboardViewer'));
const ImageDetails = lazy(() => import('./pages/ImageDetails'));
const MoodboardLibrary = lazy(() => import('./components/Moodboard/MoodboardLibrary'));
const LiveBoard = lazy(() => import('./components/Moodboard/LiveCollab/LiveBoard'));
const TermsAndConditions = lazy(() => import('./pages/legal/termsandcondition'));
const PrivacyPolicy = lazy(() => import('./pages/legal/privacy-policy'));
const ContactUs = lazy(() => import('./pages/legal/contact-us'));
const FairUsePolicy = lazy(() => import('./pages/legal/FairUsePolicy'));

const OnboardingModal = lazy(() => import('./components/Onboarding/OnboardingModal'));
const PricingModal = lazy(() => import('./components/PricingModal'));

const Maintenance = lazy(() => import('./pages/Maintenance'));
const SharedCanvas = lazy(() => import('./components/AgenticUI/SharedCanvas'));
const LegacyGate = lazy(() => import('./components/LegacyGate/LegacyGate'));
import GlobalBanner from './components/GlobalBanner';

// Hero skeleton — matches real layout so it feels instant
const Loading = () => (
  <div style={{
    display: 'flex',
    width: '100vw',
    height: '100vh',
    backgroundImage: 'radial-gradient(#d9d9d9 1px, transparent 0)',
    backgroundSize: '18px 18px',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '24px',
    overflow: 'hidden',
  }}>
    {/* Pulsing title skeleton */}
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: '420px', height: '42px', borderRadius: '8px',
        background: 'linear-gradient(90deg, #ececec 25%, #e0e0e0 50%, #ececec 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.4s infinite',
      }} />
      <div style={{
        width: '300px', height: '20px', borderRadius: '6px',
        background: 'linear-gradient(90deg, #ececec 25%, #e0e0e0 50%, #ececec 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.4s infinite 0.15s',
      }} />
    </div>
    {/* Search bar skeleton */}
    <div style={{
      width: '520px', height: '56px', borderRadius: '16px',
      background: 'linear-gradient(90deg, #f5f5f5 25%, #ebebeb 50%, #f5f5f5 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonShimmer 1.4s infinite 0.3s',
      border: '1px solid #e8e8e8',
    }} />
    <style>{`
      @keyframes skeletonShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  </div>
);

// Protected Route Component using Context
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Plan-gated Route — requires a minimum plan tier
const PLAN_LEVELS = { trial: 0, free: 0, lite: 1, lite_annual: 1, solo: 1, solo_annual: 1, freelancer: 2, freelancer_annual: 2, team: 3, team_annual: 3, lifetime: 4, admin: 5 };

const PlanProtectedRoute = ({ children, requiredPlan = 'team' }) => {
  const { user, userData, loading } = useAuth();
  const location = useLocation();
  const navigate = React.useRef(null);

  if (loading) return <Loading />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = userData?.role || 'free';
  const userLevel = PLAN_LEVELS[userRole] ?? 0;
  const requiredLevel = PLAN_LEVELS[requiredPlan] ?? 99;

  if (userLevel < requiredLevel) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f9fafb', gap: '16px', fontFamily: "'Geist', sans-serif", textAlign: 'center', padding: '24px'
      }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111' }}>
          <Lock size={28} />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111', margin: 0 }}>Creator Studio is a Pro Plan Feature</h2>
        <p style={{ fontSize: '15px', color: '#666', maxWidth: '380px', margin: 0, lineHeight: 1.6 }}>
          You're currently on the <strong>{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</strong> plan.
          Upgrade to <strong>Pro</strong> or <strong>Lifetime</strong> to unlock Creator Studio.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={() => window.history.back()}
            style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            ← Go Back
          </button>
          <button
            onClick={() => { window.location.href = '/search'; }}
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#111', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            View Plans ✦
          </button>
        </div>
      </div>
    );
  }

  return children;
};

// Routes Definition
function AppRoutes() {
  const { user, userData, loading, error, userQuota, refreshUser } = useAuth();
  const location = useLocation();
  const from = location.state?.from || '/';
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [showPricing, setShowPricing] = React.useState(false);
  const [onboardingChecked, setOnboardingChecked] = React.useState(false);

  // Once userData is available, decide whether to show onboarding
  React.useEffect(() => {
    const isForceOnboarding = new URLSearchParams(location.search).get('onboarding') === 'true';
    if (isForceOnboarding) {
      setShowOnboarding(true);
      return;
    }

    if (userData && !onboardingChecked) {
      setOnboardingChecked(true);
      // Skip for view or extension mode
      if (
        location.pathname.startsWith('/view') ||
        sessionStorage.getItem('inspo_extension_mode') === 'true'
      ) return;

      // Check both DB flag and localStorage fallback for reliability
      const localDone = localStorage.getItem(`onboarding_done_${userData.uid || user?.uid}`);
      if (!userData.onboardingComplete && !localDone) {
        setShowOnboarding(true);
      }
    }
  }, [userData, onboardingChecked, location.pathname, location.search]);

  const handleOnboardingComplete = () => {
    // Mark in localStorage immediately so re-renders don't re-show it
    const uid = userData?.uid || user?.uid;
    if (uid) localStorage.setItem(`onboarding_done_${uid}`, '1');
    setShowOnboarding(false);
    setShowPricing(false);
    refreshUser(); // Refresh userData so onboardingComplete is updated
  };

  if (loading && location.pathname !== '/view' && !location.pathname.startsWith('/agent-screen')) {
    return <Loading />;
  }


  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route
            path="/login"
            element={!user ? <Login loading={loading} error={error} /> : <Navigate to={from} replace />}
          />
          <Route path='/terms-and-conditions' element={<TermsAndConditions />} />
          <Route path='/terms-of-service' element={<TermsAndConditions />} />
          <Route path='/privacy-policy' element={<PrivacyPolicy />} />
          <Route path='/privacy' element={<PrivacyPolicy />} />
          <Route path='/contact-us' element={<ContactUs />} />
          <Route path='/fair-use' element={<FairUsePolicy />} />
          <Route path='/fair-use-policy' element={<FairUsePolicy />} />

          {/* Public Routes */}
          <Route path="/view" element={<MoodboardViewer />} />
          <Route path="/browse/:category/:query" element={<MainScreen user={userData || user} quota={userQuota} isPublic={true} />} />

          {/* ──────────────────────────────────────────────────────────────
              LEGACY MODE — Full original UI behind password gate
              Single wildcard route captures ALL sub-paths:
                /inspoai/v1/allfeature
                /inspoai/v1/allfeature/history
                /inspoai/v1/allfeature/moodboard
                /inspoai/v1/allfeature/search  … etc.
              All internal navigation stays within this prefix.
          ────────────────────────────────────────────────────────────── */}
          <Route
            path="/inspoai/v1/allfeature/*"
            element={
              <ProtectedRoute>
                <LegacyGate>
                  <MainScreen user={userData || user} quota={userQuota} legacyMode={true} />
                </LegacyGate>
              </ProtectedRoute>
            }
          />

          {/* Protected Routes — New UI (no sidebar, notch bar) */}
          <Route path="/moodboard" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/creator-studio" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/scanner" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/developer" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/mcp" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/docs" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/docs/*" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />

          <Route path="/agentic-ui" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/agentic-ui-test" element={<ProtectedRoute><MainScreen user={userData || user} quota={userQuota} /></ProtectedRoute>} />
          <Route path="/agent-screen/:sessionId" element={<SharedCanvas />} />

          {/* Live Collaboration Route */}
          <Route path="/live/:inviteCode" element={<ProtectedRoute><LiveBoard user={userData || user} quota={userQuota} /></ProtectedRoute>} />

          <Route path="/onboarding" element={<ProtectedRoute><OnboardingModal user={userData || user} onComplete={() => window.location.href = '/agentic-ui'} /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/agentic-ui" replace />} />
          <Route path="/details" element={<ProtectedRoute><ImageDetails user={userData || user} quota={userQuota} /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Onboarding overlay — non-skippable, shown once for new users */}
      {showOnboarding && user && (
        <Suspense fallback={null}>
          <OnboardingModal user={user} onComplete={handleOnboardingComplete} />
        </Suspense>
      )}

      {/* Pricing modal — shown immediately after onboarding completes */}
      {showPricing && (
        <Suspense fallback={null}>
          <PricingModal isOpen={true} onClose={() => setShowPricing(false)} />
        </Suspense>
      )}
    </>
  );
}

function App() {
  // Register Chrome extension bridge — listens for INSPO_ADD_IMAGE postMessages
  useExtensionBridge();

  // Detect if we are running in extension mode and persist it for the session
  // Done at top level to ensure it's available for immediate redirects/renders
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'extension') {
    sessionStorage.setItem('inspo_extension_mode', 'true');
  }

  return (
    <Router>
      <AuthProvider>
        <AppModeProvider>
          <GlobalBanner />
          <AppRoutes />
        </AppModeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;