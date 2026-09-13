import admin from 'firebase-admin';
import UserService from '../services/userService.js';

// ── Extension auth middleware (uses Firebase ID token — same as main app) ──
async function authenticateExtension(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split('Bearer ')[1];
        if (!token || token === 'null' || token === 'undefined') {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Verify Firebase ID token — same method as the main app's authenticateUser
        const decoded = await admin.auth().verifyIdToken(token);
        req.userId = decoded.uid;
        req.userEmail = decoded.email;
        next();
    } catch (error) {
        console.error('[Error] Extension auth middleware error:', error.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export default function setupExtensionRoutes(app) {

    // ── GET /extension-login ──
    // Serves a hosted Firebase auth page. The extension opens this in a tab,
    // the user signs in with Google, and the page redirects back with the
    // Firebase ID token in the URL hash. No GCP OAuth client config needed.
    app.get('/extension-login', (req, res) => {
        const firebaseConfig = {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
        };

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in to InspoAI</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0f0f5;background-image:radial-gradient(ellipse at 30% 20%,rgba(168,139,250,.12) 0%,transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(99,102,241,.1) 0%,transparent 60%);font-family:'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif}
    .stage{background:rgba(240,240,240,.65);backdrop-filter:blur(60px) saturate(1.5);-webkit-backdrop-filter:blur(60px) saturate(1.5);border:1px solid rgba(255,255,255,.55);border-radius:32px;padding:10px;box-shadow:0 0 0 .5px rgba(0,0,0,.04),0 8px 40px rgba(0,0,0,.08),0 2px 8px rgba(0,0,0,.04);width:360px;position:relative;animation:fadeUp .35s cubic-bezier(.22,1,.36,1) both}
    .stage::before{content:'';position:absolute;inset:0;border-radius:32px;padding:1px;background:linear-gradient(135deg,rgba(168,139,250,.25),rgba(200,200,255,.1),rgba(255,255,255,.2));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
    .card{background:rgba(255,255,255,.94);border-radius:26px;padding:36px 32px 28px;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 .5px 0 rgba(0,0,0,.03)}
    .logo-wrap{width:56px;height:56px;margin:0 auto 14px;border-radius:16px;background:linear-gradient(135deg,#0a0a0a,#1a1a1a);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.15)}
    .brand{font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-.4px;margin-bottom:4px}
    .subtitle{font-size:13.5px;color:#888;margin-bottom:28px;line-height:1.4}
    .btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:44px;padding:0 18px;background:#111;color:#fff;border:none;border-radius:14px;font-family:inherit;font-size:14.5px;font-weight:600;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;box-shadow:0 2px 8px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.1);letter-spacing:-.1px}
    .btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,.22)}
    .btn:active:not(:disabled){transform:translateY(0)}
    .btn:disabled{opacity:.5;cursor:not-allowed}
    .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:none;flex-shrink:0}
    .status{margin-top:16px;font-size:12.5px;color:#aaa;min-height:18px}
    .status.error{color:#e53e3e}.status.success{color:#38a169}
    .footer-text{font-size:11.5px;color:#bbb;margin-top:20px;line-height:1.5}
    .footer-text a{color:#7c6ff7;text-decoration:none}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  </style>
</head>
<body>
  <div class="stage"><div class="card">
    <div class="logo-wrap">
      <svg width="30" height="30" viewBox="0 0 128 128" fill="none">
        <rect x="16" y="40" width="96" height="48" rx="24" fill="url(#g)"/>
        <defs><linearGradient id="g" x1="16" y1="64" x2="144" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#111"/><stop offset="100%" stop-color="#00c896"/>
        </linearGradient></defs>
      </svg>
    </div>
    <div class="brand">InspoAI</div>
    <p class="subtitle">Sign in to use Screenshot&nbsp;to&nbsp;Figma</p>
    <button class="btn" id="signInBtn" onclick="signIn()">
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Continue with Google
      <div class="spinner" id="spinner"></div>
    </button>
    <p class="status" id="status"></p>
    <p class="footer-text">By signing in you agree to InspoAI's<br>
      <a href="https://inspoai.io/terms" target="_blank">Terms</a> &amp;
      <a href="https://inspoai.io/privacy" target="_blank">Privacy Policy</a>
    </p>
  </div></div>

  <script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
    import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

    const firebaseConfig = ${JSON.stringify(firebaseConfig)};
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    window.signIn = async function() {
      const btn = document.getElementById('signInBtn');
      const spinner = document.getElementById('spinner');
      const status = document.getElementById('status');

      btn.disabled = true;
      spinner.style.display = 'block';
      status.textContent = 'Opening Google sign-in...';
      status.className = 'status';

      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const idToken = await user.getIdToken();
        const refreshToken = user.refreshToken;

        status.textContent = 'Signed in! Connecting to InspoAI...';
        status.className = 'status success';

        const params = new URLSearchParams({
          token: idToken,
          refresh: refreshToken,
          email: user.email || '',
          name: user.displayName || '',
          photo: user.photoURL || ''
        });

        // Redirect to self with token in hash — extension watches for this
        window.location.hash = params.toString();

        setTimeout(() => {
          status.textContent = 'Authentication complete. This tab will close.';
        }, 500);
      } catch (err) {
        console.error('Sign-in error:', err);
        status.textContent = err.code === 'auth/popup-closed-by-user'
          ? 'Sign-in cancelled. Try again.'
          : 'Sign-in failed: ' + (err.message || 'Unknown error');
        status.className = 'status error';
        btn.disabled = false;
        spinner.style.display = 'none';
      }
    };
  </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    });

    // ── POST /api/extension/auth ──
    // Accepts EITHER:
    //   { accessToken } — old Google OAuth token path (chrome.identity)
    //   { idToken }     — new hosted-page path (Firebase ID token directly)
    // Both paths do the same MongoDB upsert and return user data.
    app.post('/api/extension/auth', async (req, res) => {
        try {
            const { accessToken, idToken, version } = req.body;

            if (!accessToken && !idToken) {
                return res.status(400).json({ error: 'accessToken or idToken is required' });
            }

            let uid, email, name, picture;

            if (idToken) {
                // ── Path A: Firebase ID token (from hosted auth page) ────────────
                // Already authenticated via Firebase — just verify and extract user info
                const decoded = await admin.auth().verifyIdToken(idToken);
                uid = decoded.uid;
                email = decoded.email;
                name = decoded.name;
                picture = decoded.picture;

                if (!email) {
                    return res.status(400).json({ error: 'Could not retrieve email from Firebase token' });
                }

                console.log(` Extension (idToken path): verified Firebase user ${email}`);
            } else {
                // ── Path B: Google access token (legacy chrome.identity path) ────
                const userInfoRes = await fetch(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );

                if (!userInfoRes.ok) {
                    return res.status(401).json({ error: 'Invalid Google access token' });
                }

                const googleUser = await userInfoRes.json();
                email = googleUser.email;
                name = googleUser.name;
                picture = googleUser.picture;

                if (!email) {
                    return res.status(400).json({ error: 'Could not retrieve email from Google' });
                }

                // Find or create Firebase Auth user
                let firebaseUser;
                try {
                    firebaseUser = await admin.auth().getUserByEmail(email);
                    console.log(` Extension (accessToken path): found existing Firebase user for ${email}`);
                } catch (err) {
                    if (err.code === 'auth/user-not-found') {
                        firebaseUser = await admin.auth().createUser({
                            email,
                            displayName: name || email.split('@')[0],
                            photoURL: picture || undefined,
                            emailVerified: true,
                        });
                        console.log(` Extension (accessToken path): created new Firebase user for ${email}`);
                    } else {
                        throw err;
                    }
                }
                uid = firebaseUser.uid;
            }

            // 3. Find or create Supabase user
            const now = new Date();
            let user = await UserService.findByUid(uid);

            if (!user) {
                user = await UserService.findByEmail(email);
                if (user) {
                    const linkUpdates = {};
                    if (!user.displayName && name) linkUpdates.displayName = name;
                    if (!user.photoURL && picture) linkUpdates.photoURL = picture;
                    user = await UserService.updateUser(user.id, linkUpdates);
                } else {
                    user = await UserService.createUser({
                        uid, email,
                        displayName: name || email.split('@')[0],
                        photoURL: picture || null,
                        role: 'trial',
                    });
                }
            }

            // Update extension tracking info
            const ext = { ...(user.extension || {}) };
            ext.installed = true;
            if (!ext.installedAt) ext.installedAt = now.toISOString();
            ext.version = version || ext.version || '1.0.0';
            ext.lastActiveAt = now.toISOString();
            await UserService.updateUser(user.id, { extension: ext });

            // ── Plan / Trial check ──
            // Return 403 if trial has expired so extension can show upgrade prompt
            if (user.role === 'trial' && user.isTrialExpired && user.isTrialExpired()) {
                return res.status(403).json({
                    error: 'PlanExpired',
                    planExpired: true,
                    message: 'Your 7-day trial has ended. Upgrade to continue using the extension.',
                    upgradeUrl: 'https://app.inspoai.io/pricing'
                });
            }

            // Log event
            await UserService.createExtensionEvent({
                userId: uid,
                email,
                eventType: ext.installedAt === now.toISOString() ? 'install' : 'sign_in',
                metadata: { version: version || '1.0.0' }
            });

            // Return user data. If idToken path, no customToken needed — extension already has the token.
            // If accessToken path, still generate customToken for backward compat.
            let customToken = null;
            if (!idToken) {
                customToken = await admin.auth().createCustomToken(uid);
            }

            res.json({
                ...(customToken && { customToken }),
                firebaseApiKey: process.env.FIREBASE_API_KEY,
                user: {
                    uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    role: user.role
                }
            });

            console.log(` Extension auth success for ${email} (uid: ${uid})`);
        } catch (error) {
            console.error('[Error] Extension auth error:', error.message);
            res.status(500).json({ error: 'Authentication failed' });
        }
    });

    // ── GET /api/extension/me ──
    // Uses Firebase ID token (same as main app)
    app.get('/api/extension/me', authenticateExtension, async (req, res) => {
        try {
            const user = await UserService.findByUid(req.userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Update last active
            const ext = { ...(user.extension || {}), lastActiveAt: new Date().toISOString() };
            await UserService.updateUser(user.id, { extension: ext });

            res.json({
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    role: user.role,
                    extension: user.extension
                }
            });
        } catch (error) {
            console.error('[Error] Extension /me error:', error.message);
            res.status(500).json({ error: 'Failed to fetch user' });
        }
    });

    // ── POST /api/extension/track ──
    // Uses Firebase ID token (same as main app)
    app.post('/api/extension/track', authenticateExtension, async (req, res) => {
        try {
            const { eventType, metadata = {} } = req.body;

            if (!eventType) {
                return res.status(400).json({ error: 'eventType is required' });
            }

            const validTypes = ['install', 'screenshot', 'capture_figma', 'sign_in', 'uninstall'];
            if (!validTypes.includes(eventType)) {
                return res.status(400).json({ error: `Invalid eventType. Must be one of: ${validTypes.join(', ')}` });
            }

            // Create event record
            await UserService.createExtensionEvent({
                userId: req.userId,
                email: req.userEmail,
                eventType,
                metadata
            });

            // Update user stats if it's a screenshot
            if (eventType === 'screenshot' || eventType === 'capture_figma') {
                const user = await UserService.findByUid(req.userId);
                if (user) {
                    const ext = { ...(user.extension || {}) };
                    ext.screenshotCount = (ext.screenshotCount || 0) + 1;
                    ext.lastActiveAt = new Date().toISOString();
                    await UserService.updateUser(user.id, { extension: ext });
                }
            }

            console.log(`Extension event: ${eventType} by ${req.userEmail}`);
            res.json({ message: 'Event tracked' });
        } catch (error) {
            console.error('[Error] Extension track error:', error.message);
            res.status(500).json({ error: 'Failed to track event' });
        }
    });

    console.log(' Extension routes registered (Firebase Auth)');
}
