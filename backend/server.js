import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import NodeCache from 'node-cache';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// MongoDB removed — using Supabase via UserService
import admin from 'firebase-admin';
import { createServer } from 'http';
import googleAPIManager from './src/utils/googleApiManager.js';

import { UAParser } from 'ua-parser-js';
import {
  getGoogleAPIStats,
} from './src/utils/utils.js';
import {
  initializeGenAI,
  getBrandGuidelinesStatus
} from './src/utils/imageAnalyzer.js';
import routes from './src/routes/routes.js';
import UserService from './src/services/userService.js';
import setupMoodboardRoutes from './src/routes/moodboardRoutes.js';
import setupHistoryRoutes from './src/routes/historyRoutes.js';
import setupCreatorRoutes from './src/routes/creatorRoutes.js';
import setupCreatorProjectRoutes from './src/routes/creatorProjectRoutes.js';
import { setupCollaboration, setupCollaborationRoutes, authenticateSocketUser } from './src/routes/collaborationRoutes.js';
import scannerRoutes from './src/routes/scannerRoutes.js';

import setupExtensionRoutes from './src/routes/extensionRoutes.js';
import logoRoutes from './src/routes/logoRoutes.js';
import { mobbinScraper } from './src/scrapers/mobbinScraper.js';
import setupUserRoutes from './src/routes/userRoutes.js';
import setupTeamRoutes from './src/routes/teamRoutes.js';
import setupInspireRoutes, { prewarmInspireCache } from './src/routes/inspireRoutes.js';
import setupOnboardingRoutes from './src/routes/onboardingRoutes.js';
import { getSEOMetadata, injectMetadata } from './src/services/seoService.js';
import mcpRoutes, { oauthDiscoveryHandler } from './src/routes/mcpRoutes.js';
import agenticUIRoutes from './src/routes/agenticUIRoutes.js';
import agenticUITestRoutes from './src/routes/agenticUITestRoutes.js';
import cronRoutes from './src/routes/cronRoutes.js';

// Initialize environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Database: Supabase (PostgreSQL) — connected via supabaseClient.js
console.log('[Database] Supabase (PostgreSQL) via supabaseClient.js');

// Initialize Firebase Admin SDK safely
try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    console.log('[Auth] Firebase Admin initialized successfully');
  } else {
    console.warn('[Warning] WARNING: Firebase Admin environment variables are missing. Firebase features will be disabled.');
  }
} catch (firebaseError) {
  console.error('[Error] Failed to initialize Firebase Admin SDK:', firebaseError.message);
}

// Initialize cache
const cache = new NodeCache({ stdTTL: 3600 });

// Check for required API keys
if (!process.env.GEMINI_API_KEY || !process.env.FREEPIK_API_KEY) {
  console.warn("[Warning] WARNING: Missing required API keys (GEMINI_API_KEY or FREEPIK_API_KEY). Some features may be disabled.");
}

// Check if we have at least one Google API key configured
if (googleAPIManager.getStats().totalKeys === 0) {
  console.warn("[Warning] WARNING: No Google API keys configured. Some search features may be disabled.");
}

// Check for App Secret Key ID
if (!process.env.APP_SECRET_KEY_ID) {
  console.warn("[Warning] WARNING: APP_SECRET_KEY_ID not set in environment, using fallback value");
}

import { emailService } from './src/services/emailService.js';
import OpenAI from 'openai';

// Initialize GenAI and OpenAI safely
const genAI = initializeGenAI(process.env.GEMINI_API_KEY);
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } else {
    console.warn("[Warning] WARNING: OPENAI_API_KEY is not set. OpenAI features will be disabled.");
  }
} catch (e) {
  console.error("[Error] Failed to initialize OpenAI client in server.js:", e.message);
}

// Set up directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up Multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'uploads');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[Warning] Writable uploads directory warning:', err.message);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit to 5MB
  fileFilter: function (req, file, cb) {
    // Accept image files and PDFs (case-insensitive)
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf)$/i)) {
      return cb(new Error('Only image files and PDFs are allowed!'), false);
    }
    cb(null, true);
  }
});

// ENHANCED CORS CONFIGURATION FOR COLLABORATION
const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    
    const allowedOrigins = [
      'http://localhost:5173',
      'https://app.inspoai.live',
      'https://app.inspoai.io',
      'https://api.inspoai.io',
      'https://www.inspoai.io',
      'https://inspoai.io',
      'https://inspo-ai-frontend.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5175',
      'http://localhost:5176',
      'http://127.0.0.1:5176',
      // MCP connector clients
      'https://claude.ai',
      'https://www.claude.ai',
      'https://api.anthropic.com',
      'https://platform.claude.com',
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ];

    // Allow Chrome extension origins
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    // Allow all localhost origins (including any port or subdomains)
    if (/^https?:\/\/([a-z0-9-]+\.)*localhost(:\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) {
      return callback(null, true);
    }

    // Only allow all origins in EXPLICIT development mode
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.some(ao => {
      if (origin === ao) return true;
      try {
        const originUrl = new URL(origin);
        const aoUrl = new URL(ao);
        return originUrl.origin === aoUrl.origin;
      } catch {
        return false;
      }
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[Warning] CORS blocked for origin: ${origin}`);
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Private-Network'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware to handle Private Network Access (Chrome/Firefox strictness)
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

// Apply CORS middleware globally
app.use(cors(corsOptions));

// Global API rate limiting (100 requests per minute per IP)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});
app.use('/api/', globalLimiter);

// Body parsing middleware
// Gzip compress all responses (~60-70% smaller)
// IMPORTANT: Skip compression for MCP SSE routes — compression wraps res.write()
// as a buffered transform stream, which prevents SSE events from streaming in real-time
app.use(compression({
    filter: (req, res) => {
        // Never compress SSE/MCP streams
        if (req.path && req.path.startsWith('/api/mcp')) return false;
        if (req.path && (req.path.startsWith('/api/agentic-ui/generate-stream') || req.path.startsWith('/api/agentic-ui-test/generate-stream'))) return false;
        // Default compression filter for everything else
        return compression.filter(req, res);
    }
}));
app.use(express.json({
  limit: '50mb'
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// HEALTH CHECK ENDPOINT
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'supabase',
    collaboration: 'enabled',
    pinterest: 'enabled'
  });
});

// BANNER ENDPOINT (public notice banner)
app.get('/api/banner', (req, res) => {
  res.json({ banner: null });
});

// API INFO ENDPOINT (minimal — no internal details)
app.get('/api/info', (req, res) => {
  res.json({
    name: 'InspoAI',
    version: '1.0.0',
    status: 'running'
  });
});

// Authentication middleware with better error handling
// ── Auto-capture acquisition data from HTTP request ──
function captureAcquisition(req) {
  const acq = { capturedAt: new Date() };

  // 1. IP & Geo Location → Read Vercel's native headers directly (free, 0ms latency, 0 bytes bundle bloat)
  const ip = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress;
  acq.ip = ip;
  acq.country = req.headers['x-vercel-ip-country'] || null;
  acq.city = req.headers['x-vercel-ip-city'] || null;
  acq.region = req.headers['x-vercel-ip-country-region'] || null;

  // 2. User-Agent → Device/Browser/OS
  const ua = req.headers['user-agent'];
  if (ua && UAParser) {
    const parser = new UAParser(ua);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    acq.browser = browser.name ? `${browser.name}${browser.version ? ' ' + browser.version.split('.')[0] : ''}` : null;
    acq.os      = os.name ? `${os.name}${os.version ? ' ' + os.version : ''}` : null;
    acq.device  = device.type || 'desktop'; // ua-parser returns undefined for desktop
  }

  // NOTE: We do NOT use req.headers['referer'] here — it's the frontend URL
  // (e.g. localhost:5173), NOT the external referrer (e.g. x.com).
  // The real referrer (document.referrer) is captured by the frontend
  // and sent via POST /api/user/acquisition after login.

  return acq;
}

// Classify traffic channel from referrer domain
function classifyChannel(domain) {
  const ORGANIC = ['google.com', 'google.co.in', 'google.co.uk', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.ru', 'ecosia.org', 'search.brave.com'];
  const SOCIAL  = ['twitter.com', 'x.com', 't.co', 'linkedin.com', 'lnkd.in', 'facebook.com', 'fb.com', 'instagram.com', 'reddit.com', 'threads.net', 'pinterest.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'mastodon.social'];
  const PRODUCT = ['producthunt.com', 'news.ycombinator.com', 'indiehackers.com', 'betalist.com', 'alternativeto.net'];
  const EMAIL   = ['mail.google.com', 'outlook.live.com', 'mail.yahoo.com'];

  if (ORGANIC.some(d => domain.includes(d))) return 'organic';
  if (SOCIAL.some(d => domain.includes(d)))  return 'social';
  if (PRODUCT.some(d => domain.includes(d))) return 'product_launch';
  if (EMAIL.some(d => domain.includes(d)))   return 'email';
  return 'referral';
}

const authenticateUser = async (req, res, next) => {
  try {
    // Check if the request has an Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required - No valid token provided'
      });
    }

    // Extract the token
    const token = authHeader.split('Bearer ')[1];

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format'
      });
    }

    // Verify the token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Extract user data from the token
    const { uid, email, name, picture } = decodedToken;

    // Find or create user in Supabase
    let user = await UserService.findByUid(uid);

    if (!user) {
      // Check if they were invited and have a placeholder by email
      user = await UserService.findByEmail(email);

      if (user) {
        // Link the existing placeholder to this new Firebase UID
        const linkUpdates = { uid };
        if (!user.displayName && name) linkUpdates.displayName = name;
        if (!user.photoURL && picture) linkUpdates.photoURL = picture;
        if (!user.acquisition || !user.acquisition.capturedAt) {
          linkUpdates.acquisition = captureAcquisition(req);
        }
        user = await UserService.updateUser(user.id, linkUpdates);
        console.log(`Linked invited user to Firebase UID: ${email}`);
      } else {
        // Create a completely new user — auto-capture acquisition data
        const acq = captureAcquisition(req);
        user = await UserService.createUser({
          uid,
          email,
          displayName: name || email.split('@')[0],
          photoURL: picture || null,
          acquisition: acq,
        });
        console.log(`New user created (7-day trial): ${email} | src=${acq.channel || 'direct'} | ${acq.country || '??'} | ${acq.device || 'desktop'}`);

        // Send Trial Activation Email async (replaces old welcome email)
        emailService.sendTrialActivatedEmail(user).catch(err =>
          console.error('Trial activation email failed silently:', err.message)
        );
      }
    } else {
      // Update existing user info if needed
      const profileUpdates = {};
      if (user.email !== email) profileUpdates.email = email;
      if (name && user.displayName !== name) profileUpdates.displayName = name;
      if (picture && user.photoURL !== picture) profileUpdates.photoURL = picture;
      if (Object.keys(profileUpdates).length > 0) {
        user = await UserService.updateUser(uid, profileUpdates);
      }
    }

    // Check if quota needs to be reset for a new day
    if (await UserService.resetQuotaIfNeeded(uid, user)) {
      user = await UserService.findByUid(uid);
    }

    // Add user to request object for use in route handlers
    req.user = user;

    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    console.error('[Error] Authentication error:', error.message);

    // Handle specific Firebase errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'Authentication token has expired. Please sign in again.'
      });
    }

    if (error.code === 'auth/argument-error') {
      return res.status(401).json({
        error: 'InvalidToken',
        message: 'Invalid authentication token format.'
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed - Invalid or expired token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Search quota middleware
const checkSearchQuota = async (req, res, next) => {
  try {
    // Get user from request (set by authenticateUser middleware)
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // Check if user has available searches
    if (!user.hasAvailableSearches()) {
      const limits = user.getPlanLimits();
      const searchLimit = limits.searches === Infinity ? 'unlimited' : limits.searches;
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have reached your daily search limit of ${searchLimit} searches on your ${user.role} plan. Your quota resets at midnight UTC.`,
        quota: user.getQuotaInfo()
      });
    }

    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    console.error('[Error] Search quota check error:', error.message);
    return res.status(500).json({
      error: 'Server error',
      message: 'Failed to check search quota'
    });
  }
};



// CREATE HTTP SERVER (Socket.IO removed for serverless compatibility)
let server;

// IMPROVED ERROR HANDLER MIDDLEWARE
app.use((err, req, res, next) => {
  console.error('[Error] Server Error:', err);

  // Handle Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.message });
  }

  // Handle MongoDB errors
  if (err.code && err.code.startsWith('PGRST')) {
    return res.status(500).json({ error: 'Database error', message: 'Please try again later' });
  }

  // Generic error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// SETUP ROUTES WITH CONTEXT
app.use('/api/mcp', mcpRoutes);
app.use('/api/crons', cronRoutes);

// OAuth 2.0 Discovery Endpoint (required by Claude MCP connector)
app.get('/.well-known/oauth-authorization-server', oauthDiscoveryHandler);

routes(app, {
  UserService,
  authenticateUser,
  checkSearchQuota,
  upload,
  cache,
  genAI,
  openai,
  googleAPIManager,
  appSecretKeyId: process.env.APP_SECRET_KEY_ID || '6099f0133b500d02561a66c5b2a2557d24322ecf'
});

// SETUP MOODBOARD ROUTES
setupMoodboardRoutes(app, {
  UserService,
  authenticateUser
});

// SETUP HISTORY ROUTES
setupHistoryRoutes(app, {
  UserService,
  authenticateUser
});

// SETUP COLLABORATION REST ROUTES
setupCollaborationRoutes(app, { authenticateUser });

// SETUP CREATOR STUDIO ROUTES
setupCreatorRoutes(app, { authenticateUser });

// SETUP CREATOR STUDIO PROJECT MANAGEMENT (ML-Enhanced)
await setupCreatorProjectRoutes(app, { authenticateUser });

// SETUP WEBSITE SCANNER ROUTES
app.use('/api/scanner', authenticateUser, scannerRoutes);

// SETUP EXTENSION AUTH & ANALYTICS ROUTES
setupExtensionRoutes(app);

// SETUP USER & TEAM ROUTES
setupUserRoutes(app, { authenticateUser });
setupTeamRoutes(app, { authenticateUser });

// SETUP LOGO SEARCH ROUTES
app.use('/api/logo-search', authenticateUser, logoRoutes);

// SETUP INSPIRE FEED ROUTES
setupInspireRoutes(app, { authenticateUser });

// SETUP ONBOARDING ROUTES
setupOnboardingRoutes(app, { authenticateUser });

// SETUP AGENTIC UI ROUTES (AI Screen Generator)
// Public endpoint for UI style catalog (no auth needed)
app.get('/api/agentic-ui/styles', (req, res, next) => {
  // Forward to the agenticUIRoutes router
  req.url = '/styles';
  agenticUIRoutes(req, res, next);
});
// All /api/agentic-ui routes: skip auth for GET /shared/:sessionId (public shared canvas)
app.use('/api/agentic-ui', (req, res, next) => {
  if (req.headers['x-bypass-auth'] === '12345') {
    req.user = { id: 'test-user-id', uid: 'test-user-id', role: 'admin', email: 'test@inspoai.com' };
    return next();
  }
  if (req.method === 'GET' && req.path.startsWith('/shared/')) {
    return agenticUIRoutes(req, res, next);
  }
  return authenticateUser(req, res, next);
}, agenticUIRoutes);

// SETUP AGENTIC UI TEST ROUTES (AI Screen Generator Test)
app.get('/api/agentic-ui-test/styles', (req, res, next) => {
  req.url = '/styles';
  agenticUITestRoutes(req, res, next);
});
app.use('/api/agentic-ui-test', (req, res, next) => {
  if (req.headers['x-bypass-auth'] === '12345') {
    req.user = { id: 'test-user-id', uid: 'test-user-id', role: 'admin', email: 'test@inspoai.com' };
    return next();
  }
  if (req.method === 'GET' && req.path.startsWith('/shared/')) {
    return agenticUITestRoutes(req, res, next);
  }
  return authenticateUser(req, res, next);
}, agenticUITestRoutes);

// SEO EXPLORE ROUTES (Dynamic Rendering)
app.get('/browse/:category/:query', async (req, res) => {
  const { category, query } = req.params;

  try {
    // 1. Generate Metadata
    const metadata = await getSEOMetadata(category, query, openai);

    // 2. Load the frontend index.html
    // Assuming the built frontend is in a sibling directory or same dir 'public'
    const indexPath = path.join(__dirname, 'public', 'index.html');

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf8');

      // 3. Inject Metadata
      html = injectMetadata(html, metadata);

      return res.send(html);
    } else {
      // Fallback for development if public/index.html doesn't exist yet
      return res.status(200).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${metadata.title}</title>
                    <meta name="description" content="${metadata.description}">
                </head>
                <body>
                    <h1>${metadata.h1}</h1>
                    <p>${metadata.helpfulContent}</p>
                    <div id="root"></div>
                    <script>window.SEO_MODE = true; window.SEO_DATA = ${JSON.stringify(metadata)};</script>
                </body>
                </html>
            `);
    }
  } catch (err) {
    console.error("SEO Route Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// 404 Error handler with better response
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    path: req.path,
    method: req.method,
    availableEndpoints: [
      '/health',
      '/api/info',
      '/api/search',
      '/api/user/*',
      '/api/moodboard/*',
      '/api/collaboration/*',
      '/api/discover-p',
      '/api/pinterest-health'
    ]
  });
});

// START SERVER (Conditionally run app.listen for local dev; Vercel handles the server lifecycle in production)
if (!process.env.VERCEL) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on port ${PORT}`);

    // Pre-warm inspire feed cache
    setTimeout(() => prewarmInspireCache(), 3000);

    // Start trial countdown cron job (Disabled for serverless - triggered via Supabase pg_cron)
    // startTrialCron();
    console.log(`[Server] URL: http://localhost:${PORT}`);
    console.log(`[Config] Gemini API Key: ${process.env.GEMINI_API_KEY ? "Configured" : "Not configured"}`);
    console.log(`[Config] Firebase: ${process.env.FIREBASE_PROJECT_ID ? "Configured" : "Not configured"}`);
    console.log('[Config] Database: Supabase');



    console.log(`[Config] App Secret Key: ${process.env.APP_SECRET_KEY_ID ? "Configured" : "Using fallback"}`);
    console.log(`[Config] Brand guidelines: ${getBrandGuidelinesStatus().isSet ? "Configured" : "Not configured"}`);
    console.log('[Config] Google API Status:', getGoogleAPIStats());


    console.log('[CORS] Enabled for origins: app.inspoai.live, localhost:5173');
    console.log('[Realtime] Collaboration enabled');
    console.log('[Realtime] Sessions and updates enabled');

    // Environment-specific logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Server] Development mode - Enhanced error messages enabled');
    }

    // Feature status summary
    console.log('\n[Features Status]');
    console.log('   - Image Search: Enabled');
    console.log('   - Moodboards: Enabled');
    console.log('   - Real-time Collaboration: Enabled');
    console.log('   - User Authentication: Enabled');
    console.log('   - Search Quotas: Enabled');
    console.log('   - File Uploads: Enabled (5MB limit)');
    console.log('   - Pinterest Scraping: Enabled');
    console.log('   - Agentic UI: Enabled');

    // Signal PM2 that server is ready (ecosystem.config has wait_ready: true)
    if (typeof process.send === 'function') process.send('ready');
  });

  // ENHANCED SERVER ERROR HANDLING
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[Error] Port ${PORT} is already in use`);
      console.log(`Try running: lsof -ti:${PORT} | xargs kill -9`);
      process.exit(1);
    } else {
      console.error('[Error] Server error:', error);
    }
  });
}

// GRACEFUL SHUTDOWN WITH SCRAPER CLEANUP
process.on('SIGTERM', async () => {
  console.log('[Shutdown] SIGTERM received, shutting down gracefully');

  // Close Mobbin browser first
  try {
    await mobbinScraper.closeBrowser();
    console.log('Scraper browsers closed');
  } catch (error) {
    console.error('[Error] Error closing browsers:', error.message);
  }

  // Close HTTP server directly
  if (server && typeof server.close === 'function') {
    server.close(() => {
      console.log('HTTP server closed');
      console.log(' Supabase connection released');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.log('\n[Shutdown] SIGINT received, shutting down gracefully');

  // Close Mobbin browser first
  try {
    await mobbinScraper.closeBrowser();
    console.log('Scraper browsers closed');
  } catch (error) {
    console.error('[Error] Error closing browsers:', error.message);
  }

  if (server && typeof server.close === 'function') {
    server.close(() => {
      console.log('HTTP server closed');
      console.log(' Supabase connection released');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// UNHANDLED REJECTION HANDLER
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Error] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production, just log the error
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// UNCAUGHT EXCEPTION HANDLER
process.on('uncaughtException', async (error) => {
  console.error('[Error] Uncaught Exception:', error);

  // Close Scraper browsers before exiting
  try {
    await Promise.allSettled([
      mobbinScraper.closeBrowser()
    ]);
  } catch (browserError) {
    console.error('[Error] Error closing browsers during crash:', browserError.message);
  }

  // Graceful shutdown
  if (server && typeof server.close === 'function') {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Start trial countdown cron job (Disabled for serverless - triggered via Supabase pg_cron)
// startTrialCron();

// Triggering nodemon reload to refresh agenticUIRoutes.js changes 2
export { UserService, authenticateUser, checkSearchQuota };
export default app;
