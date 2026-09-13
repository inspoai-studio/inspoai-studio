import express from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "cross-fetch";

const router = express.Router();

const transports = new Map();
const servers = new Map();

// Tool Definitions
const INSPIRE_FILTERS_TOOL = {
    name: "get_inspire_filters",
    description: "Get available filter categories and sources for the inspire feed.",
    inputSchema: { type: "object", properties: {} },
};

const INSPIRE_FEED_TOOL = {
    name: "get_inspire_feed",
    description: "Get a paginated feed of curated design inspiration. Returns design names with inline image previews.",
    inputSchema: {
        type: "object",
        properties: {
            limit: { type: "number", description: "Number of results to return (default 20)." },
            offset: { type: "number", description: "Offset for pagination (default 0)." },
        },
    },
};

const SEARCH_VISUAL_GRAPHICS_TOOL = {
    name: "search_visual_graphics",
    description: "Search for UI screens and visual design inspiration (e.g., 'saas landing page', 'fintech dashboard'). Returns design names with inline image previews.",
    inputSchema: {
        type: "object",
        properties: {
            topic: { type: "string", description: "The search query/topic." },
            limit: { type: "number", description: "Maximum number of results to return (max 50, default 20)." },
        },
        required: ["topic"],
    },
};

const SEARCH_UI_SCREENS_TOOL = {
    name: "search_ui_screens",
    description: "Search for UI screens and real-world mobile app flows (e.g., 'onboarding flow', 'login screen'). Returns design names with inline image previews.",
    inputSchema: {
        type: "object",
        properties: {
            topic: { type: "string", description: "The search query/topic." },
            limit: { type: "number", description: "Maximum number of results to return (max 30, default 20)." },
        },
        required: ["topic"],
    },
};

const SEARCH_LANDING_PAGES_TOOL = {
    name: "search_landing_pages",
    description: "Search for website and landing page layout inspiration (e.g., 'saas pricing page', 'portfolio site'). Returns design names with inline image previews.",
    inputSchema: {
        type: "object",
        properties: {
            topic: { type: "string", description: "The search query/topic." },
            limit: { type: "number", description: "Maximum number of results to return (max 30, default 20)." },
        },
        required: ["topic"],
    },
};

const SEARCH_ICONS_TOOL = {
    name: "search_icons",
    description: "Search for SVG icons by name or concept.",
    inputSchema: {
        type: "object",
        properties: {
            query: { type: "string", description: "The search query." },
            limit: { type: "number", description: "Maximum number of results to return (max 80, default 40)." },
        },
        required: ["query"],
    },
};

// Request Helper
async function makeApiRequest(method, endpoint, body = null, apiKey = null) {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const host = process.env.INSPO_BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${host}${endpoint}`;

    const options = { method, headers };
    if (body && (method === "POST" || method === "PUT")) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${data.error || data.message || JSON.stringify(data)}`);
    }
    return data;
}

// Setup MCP Server instance
function setupMcpServer(server, apiKeyObj, rawKey) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                INSPIRE_FILTERS_TOOL,
                INSPIRE_FEED_TOOL,
                SEARCH_VISUAL_GRAPHICS_TOOL,
                SEARCH_UI_SCREENS_TOOL,
                SEARCH_LANDING_PAGES_TOOL,
                SEARCH_ICONS_TOOL,
            ],
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        // Format search results as a numbered text list with clickable image URLs
        function formatSearchResults(data, query) {
            if (!data?.results?.length) return `No results found for "${query}".`;

            const lines = [`Found ${data.total_count || data.results.length} design references for "${query}":\n`];
            data.results.forEach((item, i) => {
                const title = item.title || 'Untitled';
                const url = item.image_url || '';
                if (url) {
                    lines.push(`${i + 1}. **${title}** — [View Screenshot](${url})`);
                } else {
                    lines.push(`${i + 1}. **${title}**`);
                }
            });
            return lines.join('\n');
        }

        // Format feed results as a numbered text list
        function formatFeedResults(data) {
            if (!data?.results?.length) return 'No feed items available.';

            const lines = [`${data.results.length} inspiration items:\n`];
            data.results.forEach((item, i) => {
                const title = item.title || 'Untitled';
                const url = item.image_url || '';
                if (url) {
                    lines.push(`${i + 1}. **${title}** — [View Screenshot](${url})`);
                } else {
                    lines.push(`${i + 1}. **${title}**`);
                }
            });
            return lines.join('\n');
        }

        try {
            switch (name) {
                case "get_inspire_filters": {
                    const data = await makeApiRequest("GET", "/api/inspire/filters", null, rawKey);
                    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
                }
                case "get_inspire_feed": {
                    const queryParams = new URLSearchParams();
                    if (args?.limit !== undefined) queryParams.append("limit", String(args.limit));
                    if (args?.offset !== undefined) queryParams.append("offset", String(args.offset));
                    const queryString = queryParams.toString();
                    const endpoint = `/v1/feed${queryString ? `?${queryString}` : ""}`;
                    const data = await makeApiRequest("GET", endpoint, null, rawKey);
                    return { content: [{ type: "text", text: formatFeedResults(data) }] };
                }
                case "search_visual_graphics": {
                    const queryParams = new URLSearchParams({
                        query: String(args?.topic || ""),
                        mode: "ui",
                        limit: String(args?.limit || 20)
                    });
                    const data = await makeApiRequest("GET", `/api/search?${queryParams.toString()}`, null, rawKey);
                    return { content: [{ type: "text", text: formatSearchResults(data, args?.topic) }] };
                }
                case "search_ui_screens": {
                    const queryParams = new URLSearchParams({
                        query: String(args?.topic || ""),
                        mode: "ui",
                        limit: String(args?.limit || 20)
                    });
                    const data = await makeApiRequest("GET", `/api/search?${queryParams.toString()}`, null, rawKey);
                    return { content: [{ type: "text", text: formatSearchResults(data, args?.topic) }] };
                }
                case "search_landing_pages": {
                    const queryParams = new URLSearchParams({
                        query: String(args?.topic || ""),
                        mode: "web",
                        limit: String(args?.limit || 20)
                    });
                    const data = await makeApiRequest("GET", `/api/search?${queryParams.toString()}`, null, rawKey);
                    return { content: [{ type: "text", text: formatSearchResults(data, args?.topic) }] };
                }
                case "search_icons": {
                    const queryParams = new URLSearchParams({
                        query: String(args?.query || ""),
                        mode: "icons",
                        limit: String(args?.limit || 40)
                    });
                    const data = await makeApiRequest("GET", `/api/search?${queryParams.toString()}`, null, rawKey);
                    // Icons stay text-only (SVGs don't need previews)
                    const lines = data?.results?.length
                        ? data.results.map((item, i) => `${i+1}. ${item.title || 'Untitled'} — ${item.image_url || ''}`).join('\n')
                        : 'No icons found.';
                    return { content: [{ type: "text", text: lines }] };
                }
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true,
            };
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// OAuth 2.0 Authorization Server
// Required by Claude's MCP connector (and other OAuth-aware MCP clients)
// ─────────────────────────────────────────────────────────────────────────────

// In-memory store: authCode -> { apiKey, expiresAt, codeChallenge, codeChallengeMethod }
const authCodes = new Map();

// In-memory store: dynamic client registrations
const registeredClients = new Map();

// Clean up expired codes every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [code, data] of authCodes) {
        if (data.expiresAt < now) authCodes.delete(code);
    }
}, 10 * 60 * 1000);

/**
 * OAuth 2.0 Discovery Endpoint
 * Mounted at root level (/.well-known/oauth-authorization-server) in server.js
 * Tells OAuth clients (like Claude) where to find auth and token endpoints.
 */
export const oauthDiscoveryHandler = (req, res) => {
    const baseUrl = process.env.PUBLIC_URL
        || (process.env.NODE_ENV === 'production' ? 'https://api.inspoai.io' : `http://localhost:${process.env.PORT || 3000}`);

    res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
        token_endpoint: `${baseUrl}/api/mcp/token`,
        registration_endpoint: `${baseUrl}/api/mcp/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256', 'plain'],
        token_endpoint_auth_methods_supported: ['none'],
        scopes_supported: ['mcp'],
    });
};

/**
 * POST /api/mcp/register
 * Dynamic Client Registration (RFC7591) — required by MCP spec.
 * Claude's connector calls this to register itself before starting OAuth.
 */
router.post('/register', express.json(), async (req, res) => {
    const { redirect_uris, client_name, grant_types, response_types, token_endpoint_auth_method } = req.body;

    // Generate a client_id for this registration
    const { randomBytes } = await import('node:crypto');
    const client_id = `inspoai_${randomBytes(16).toString('hex')}`;

    const clientData = {
        client_id,
        client_name: client_name || 'MCP Client',
        redirect_uris: redirect_uris || [],
        grant_types: grant_types || ['authorization_code'],
        response_types: response_types || ['code'],
        token_endpoint_auth_method: token_endpoint_auth_method || 'none',
        created_at: Date.now(),
    };

    registeredClients.set(client_id, clientData);
    console.log(`MCP Dynamic Client Registration: ${client_id} (${clientData.client_name})`);

    return res.status(201).json({
        client_id: clientData.client_id,
        client_name: clientData.client_name,
        redirect_uris: clientData.redirect_uris,
        grant_types: clientData.grant_types,
        response_types: clientData.response_types,
        token_endpoint_auth_method: clientData.token_endpoint_auth_method,
    });
});

/**
 * GET /api/mcp/authorize
 * Shows a branded HTML page asking the user to enter their InspoAI API key.
 * On submit, POSTs back to this route which validates the key and redirects
 * to the client's redirect_uri with an authorization code.
 */
router.get('/authorize', (req, res) => {
    const { redirect_uri, state, client_id, code_challenge, code_challenge_method } = req.query;

    if (!redirect_uri) {
        return res.status(400).send('<h2>Missing redirect_uri parameter.</h2>');
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect InspoAI to Claude</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e5e5ea;
      border-radius: 20px;
      padding: 40px 36px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
    }
    .logo {
      margin-bottom: 32px;
    }
    .logo svg { height: 28px; width: auto; }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #1d1d1f;
      letter-spacing: -0.4px;
    }
    .subtitle {
      color: #86868b;
      font-size: 14px;
      margin-bottom: 28px;
      line-height: 1.6;
    }
    label {
      display: block;
      font-size: 13px;
      color: #6e6e73;
      margin-bottom: 8px;
      font-weight: 500;
    }
    input[type=text] {
      width: 100%;
      background: #f5f5f7;
      border: 1.5px solid #e5e5ea;
      border-radius: 12px;
      padding: 14px 16px;
      color: #1d1d1f;
      font-size: 14px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      margin-bottom: 20px;
    }
    input[type=text]:focus {
      border-color: #1d1d1f;
      box-shadow: 0 0 0 3px rgba(29,29,31,0.08);
    }
    input[type=text]::placeholder { color: #aeaeb2; }
    .btn {
      width: 100%;
      background: #1d1d1f;
      border: none;
      border-radius: 12px;
      padding: 14px;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      letter-spacing: -0.2px;
    }
    .btn:hover { background: #333336; }
    .btn:active { transform: scale(0.98); }
    .hint {
      font-size: 12px;
      color: #aeaeb2;
      margin-top: 20px;
      text-align: center;
      line-height: 1.7;
    }
    .hint a { color: #1d1d1f; font-weight: 500; text-decoration: underline; text-underline-offset: 2px; }
    .hint a:hover { color: #86868b; }
    .divider {
      height: 1px;
      background: #e5e5ea;
      margin: 20px 0;
    }
    .security-note {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #86868b;
      justify-content: center;
    }
    .security-note svg { flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg width="134" height="31" viewBox="0 0 134 31" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0)">
          <path d="M94.7036 9.41028C98.1257 9.41028 100.878 12.1628 100.878 15.5848C100.878 19.0069 98.1257 21.7594 94.7036 21.7594H79.0813C75.6592 21.7594 72.9067 19.0069 72.9067 15.5848C72.9067 12.1628 75.6592 9.41028 79.0813 9.41028H94.7036ZM94.7036 5.69067H79.0813C73.5763 5.69067 69.1871 10.1542 69.1871 15.5848C69.1871 21.0154 73.6507 25.479 79.0813 25.479H94.7036C100.209 25.479 104.598 21.0154 104.598 15.5848C104.598 10.1542 100.134 5.69067 94.7036 5.69067Z" fill="url(#paint0)"/>
          <path d="M126.538 25.7035H122.616V23.5914C122.616 23.5914 122.54 23.6668 122.465 23.6668L122.39 23.7423C122.39 23.7423 122.39 23.7423 122.314 23.7423C120.579 24.9492 118.618 25.6281 116.506 25.6281C113.79 25.6281 111.376 24.6475 109.415 22.7617C107.454 20.8759 106.473 18.5375 106.473 15.7465C106.473 12.9555 107.454 10.6171 109.415 8.65589C111.376 6.69466 113.79 5.78947 116.506 5.78947C119.221 5.78947 121.56 6.77009 123.521 8.65589C125.482 10.6171 126.538 12.9555 126.538 15.7465V25.6281V25.7035ZM120.655 19.9707C121.786 18.8392 122.314 17.406 122.314 15.7465C122.314 14.087 121.786 12.7292 120.655 11.5223C119.523 10.3154 118.165 9.71193 116.506 9.71193C114.846 9.71193 113.413 10.3154 112.282 11.5223C111.15 12.7292 110.622 14.087 110.622 15.7465C110.622 17.406 111.226 18.7638 112.282 19.9707C113.413 21.1776 114.846 21.7056 116.506 21.7056C118.165 21.7056 119.523 21.1022 120.655 19.9707Z" fill="#1d1d1f"/>
          <path d="M128.904 3.9058H133.716V7.50462H128.904V3.9058ZM133.716 25.6552V9.30403H128.904V25.577H133.716V25.6552Z" fill="#1d1d1f"/>
          <path d="M23.8849 15.7455C23.8849 14.1614 23.2814 12.7282 22.15 11.5213C21.0185 10.3144 19.6607 9.7864 18.0012 9.7864C16.3417 9.7864 14.9839 10.3899 13.8524 11.5213C12.721 12.6528 12.1175 14.086 12.1175 15.7455V25.6271H7.96875V15.7455C7.96875 13.03 8.94936 10.6161 10.9106 8.65492C12.8718 6.69369 15.2856 5.78851 18.0012 5.78851C20.7167 5.78851 23.1306 6.76912 25.0918 8.65492C27.053 10.6161 28.0336 12.9545 28.0336 15.7455V25.6271H23.8849V15.7455Z" fill="#1d1d1f"/>
          <path d="M39.5745 13.7839C40.4042 13.7839 41.1586 13.9348 41.9129 14.2365C42.6672 14.5382 43.2706 14.9908 43.7987 15.5188C44.3267 16.0469 44.7039 16.6503 45.081 17.4046C45.3827 18.0835 45.5336 18.9133 45.5336 19.6676C45.5336 20.4219 45.3827 21.2517 45.081 22.006C44.7793 22.6849 44.3267 23.3638 43.7987 23.8918C43.2706 24.4198 42.6672 24.8724 41.9129 25.1741C41.234 25.4759 40.4042 25.6267 39.5745 25.6267H30.1455V21.7043H39.6499C40.1779 21.7043 40.6305 21.4025 41.0077 21.0254C41.3848 20.6482 41.5357 20.1956 41.5357 19.6676C41.5357 19.1396 41.3094 18.6116 40.9323 18.2344C40.5551 17.8572 40.0271 17.6309 39.4991 17.6309H35.8029C34.9731 17.6309 34.2188 17.4046 33.5399 17.1029C32.7856 16.8012 32.1822 16.3486 31.6541 15.8206C31.1261 15.2925 30.7489 14.6891 30.4472 13.9348C30.1455 13.1805 29.9946 12.4261 29.9946 11.6718C29.9946 10.9175 30.1455 10.0877 30.4472 9.33342C30.7489 8.57911 31.2015 7.97565 31.7296 7.44763C32.2576 6.9196 32.861 6.46701 33.6154 6.16528C34.2942 5.86356 35.124 5.71269 35.9538 5.71269H41.4603V9.63515H35.9538C35.4257 9.63515 34.8977 9.86145 34.5205 10.2386C34.1434 10.6158 33.9171 11.0684 33.9171 11.6718C33.9171 12.2753 34.1434 12.7279 34.5205 13.105C34.8977 13.4822 35.3503 13.7085 35.9538 13.7085H39.5745V13.7839Z" fill="#1d1d1f"/>
          <path d="M64.3917 8.73012C66.353 10.6914 67.3336 13.0297 67.3336 15.8207C67.3336 18.6117 66.353 20.9501 64.3917 22.8359C62.4305 24.7971 60.0167 25.7023 57.3011 25.7023C55.1136 25.7023 53.1524 25.0988 51.4174 23.8165V30.0774H47.2687V15.8207C47.2687 13.1052 48.2493 10.7668 50.2105 8.73012C52.1718 6.76889 54.5101 5.86371 57.3011 5.86371C60.0921 5.86371 62.4305 6.84432 64.3917 8.73012ZM61.5253 20.0449C62.6568 18.9134 63.1848 17.4802 63.1848 15.8207C63.1848 14.1612 62.6568 12.8034 61.5253 11.5965C60.3938 10.3896 59.0361 9.8616 57.3766 9.8616C55.7171 9.8616 54.3593 10.4651 53.2278 11.5965C52.0963 12.8034 51.5683 14.1612 51.5683 15.8207C51.5683 17.4802 52.0963 18.9134 53.2278 20.0449C54.3593 21.1764 55.7171 21.7798 57.3766 21.7798C59.0361 21.7798 60.3938 21.1764 61.5253 20.0449Z" fill="#1d1d1f"/>
          <path d="M0.332031 3.90554H5.14385V7.50436H0.332031V3.90554ZM5.14385 25.655V9.30377H0.332031V25.5767H5.14385V25.655Z" fill="#1d1d1f"/>
        </g>
        <defs>
          <linearGradient id="paint0" x1="104.598" y1="15.5848" x2="69.1871" y2="15.5848" gradientUnits="userSpaceOnUse">
            <stop stop-color="#41F461"/><stop offset="0.5" stop-color="#008CFF"/><stop offset="0.856676" stop-color="#0D0D0D"/>
          </linearGradient>
          <clipPath id="clip0"><rect width="133.977" height="30.136" fill="white"/></clipPath>
        </defs>
      </svg>
    </div>
    <h1>Connect to Claude</h1>
    <p class="subtitle">Enter your InspoAI API key to allow Claude to access design inspiration tools on your behalf.</p>

    <form method="POST" action="/api/mcp/authorize">
      <input type="hidden" name="redirect_uri" value="${encodeURIComponent(redirect_uri)}">
      <input type="hidden" name="state" value="${encodeURIComponent(state || '')}">
      <input type="hidden" name="code_challenge" value="${encodeURIComponent(code_challenge || '')}">
      <input type="hidden" name="code_challenge_method" value="${encodeURIComponent(code_challenge_method || '')}">

      <label for="apiKey">Your InspoAI API Key</label>
      <input type="text" id="apiKey" name="apiKey" placeholder="insp_live_..." autocomplete="off" spellcheck="false">
      <button type="submit" class="btn">Allow Access →</button>
    </form>

    <div class="divider"></div>
    <p class="hint">
      Don't have a key? <a href="https://app.inspoai.io/api" target="_blank">Generate one at app.inspoai.io</a>
    </p>
    <div style="height: 12px;"></div>
    <div class="security-note">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      <span>Your key is never stored — it's only used to verify your identity.</span>
    </div>
  </div>
</body>
</html>`);
});

/**
 * POST /api/mcp/authorize
 * Validates the API key, creates a short-lived auth code, and redirects
 * back to Claude's redirect_uri with ?code=...&state=...
 */
router.post('/authorize', express.urlencoded({ extended: false }), async (req, res) => {
    const { apiKey, redirect_uri: encodedRedirectUri, state: encodedState, code_challenge, code_challenge_method } = req.body;

    const redirect_uri = decodeURIComponent(encodedRedirectUri || '');
    const state = decodeURIComponent(encodedState || '');

    if (!redirect_uri) {
        return res.status(400).send('<h2>Missing redirect_uri.</h2>');
    }

    if (!apiKey || !apiKey.trim()) {
        return res.status(400).send(buildErrorPage('API key is required.', redirect_uri));
    }

    try {  
        const requiredKey = process.env.MCP_API_KEY;
        if (requiredKey && apiKey.trim() !== requiredKey) {
            return res.status(400).send(buildErrorPage('Invalid API key. Please check your MCP_API_KEY configuration.', redirect_uri));
        }

        // Generate a secure one-time auth code
        const { randomBytes } = await import('node:crypto');
        const code = randomBytes(32).toString('hex');

        // Store code → apiKey with 5-minute expiry (+ PKCE challenge for validation)
        authCodes.set(code, {
            apiKey: apiKey.trim(),
            expiresAt: Date.now() + 5 * 60 * 1000,
            codeChallenge: code_challenge ? decodeURIComponent(code_challenge) : null,
            codeChallengeMethod: code_challenge_method ? decodeURIComponent(code_challenge_method) : null,
        });

        // Redirect back to Claude with the code
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);

        return res.redirect(redirectUrl.toString());

    } catch (err) {
        console.error('MCP OAuth authorize error:', err.message);
        return res.status(500).send(buildErrorPage('Server error during authorization. Please try again.', redirect_uri));
    }
});

/**
 * POST /api/mcp/token
 * Exchanges an authorization code for an access token (= validated API key).
 * Claude sends this request server-to-server after the user completes /authorize.
 */
router.post('/token', express.json(), express.urlencoded({ extended: false }), async (req, res) => {
    const { grant_type, code, code_verifier, client_id } = req.body;

    if (grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    if (!code) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'Missing code parameter.' });
    }

    const stored = authCodes.get(code);

    if (!stored) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code not found or already used.' });
    }

    if (stored.expiresAt < Date.now()) {
        authCodes.delete(code);
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code has expired.' });
    }

    // PKCE verification (required by OAuth 2.1 / MCP spec)
    if (stored.codeChallenge && code_verifier) {
        const { createHash } = await import('node:crypto');
        let computedChallenge;
        if (stored.codeChallengeMethod === 'S256') {
            computedChallenge = createHash('sha256')
                .update(code_verifier)
                .digest('base64url');
        } else {
            computedChallenge = code_verifier; // plain method
        }
        if (computedChallenge !== stored.codeChallenge) {
            authCodes.delete(code);
            return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE code_verifier mismatch.' });
        }
    }

    // Consume the code (one-time use)
    authCodes.delete(code);

    return res.json({
        access_token: stored.apiKey,
        token_type: 'bearer',
        expires_in: 86400,
        scope: 'mcp',
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: error page HTML
// ─────────────────────────────────────────────────────────────────────────────
function buildErrorPage(message, redirect_uri) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authorization Error – InspoAI</title>
  <style>
    body { font-family: -apple-system,sans-serif; background:#0f0f10; color:#e8e8ea; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#1a1a1e; border:1px solid #2e2e36; border-radius:20px; padding:40px; max-width:400px; text-align:center; }
    h2 { color:#ff6b6b; margin-bottom:12px; }
    p { color:#888; margin-bottom:24px; font-size:14px; }
    a { display:inline-block; background:#7c6aff; color:#fff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:600; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Authorization Failed</h2>
    <p>${message}</p>
    <a href="/api/mcp/authorize?redirect_uri=${encodeURIComponent(redirect_uri)}">Try Again</a>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP-specific auth middleware
// Wraps publicApiAuth and adds the WWW-Authenticate header Claude needs in
// order to trigger the OAuth flow when the bearer token is missing/invalid.
// ─────────────────────────────────────────────────────────────────────────────
const mcpAuth = (req, res, next) => {
    const requiredKey = process.env.MCP_API_KEY;
    if (!requiredKey) {
        req.apiKey = { key_name: 'open-source-mcp', calls_used: 0, calls_limit: Infinity };
        return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader && (authHeader.includes(requiredKey) || authHeader.split(' ')[1] === requiredKey)) {
        req.apiKey = { key_name: 'configured-mcp', calls_used: 0, calls_limit: Infinity };
        return next();
    }

    const baseUrl = process.env.PUBLIC_URL
        || (process.env.NODE_ENV === 'production' ? 'https://api.inspoai.io' : `http://localhost:${process.env.PORT || 3000}`);

    res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="InspoAI", resource_metadata="${baseUrl}/.well-known/oauth-authorization-server"`
    );
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid MCP authorization key.' });
};

// Routes
router.get('/sse', mcpAuth, async (req, res) => {
    try {
        // ── IMPORTANT: Don't put sessionId in the URL! ──────────────────
        // SSEServerTransport generates its OWN UUID and adds it via
        // searchParams.set('sessionId', this._sessionId). If we add our own
        // sessionId, the SDK REPLACES it with its UUID — causing a mismatch
        // when we try to look up the transport in the /messages handler.
        const messagesEndpoint = `/api/mcp/messages`;

        // ── SSE streaming fixes ──────────────────────────────────────────
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('Content-Encoding', 'identity');
        if (req.socket) {
            req.socket.setNoDelay(true);
            req.socket.setTimeout(0);
        }

        const transport = new SSEServerTransport(messagesEndpoint, res);

        const mcpServer = new Server(
            { name: "inspo-mcp-server", version: "2.0.0" },
            { capabilities: { tools: {} } }
        );

        // Re-construct the raw token for making internal API calls
        const authHeader = req.headers.authorization || '';
        const rawKey = authHeader.split(' ')[1] || authHeader.split(' ')[2] || 'mcp-internal';
        setupMcpServer(mcpServer, req.apiKey, rawKey);

        await mcpServer.connect(transport);

        // ── Use the SDK's sessionId (UUID) as the storage key ────────────
        // transport.sessionId is the UUID that SSEServerTransport sends to
        // the client in the `endpoint` event. Claude will POST messages to
        // /api/mcp/messages?sessionId=<this-uuid>, so we MUST store under
        // this exact key.
        const sdkSessionId = transport.sessionId;
        transports.set(sdkSessionId, transport);
        servers.set(sdkSessionId, mcpServer);
        transports.set(`auth_${sdkSessionId}`, { apiKey: req.apiKey, rawKey });

        console.log(`[Success] MCP SSE session started: ${sdkSessionId}`);

        res.on('close', () => {
            transports.delete(sdkSessionId);
            transports.delete(`auth_${sdkSessionId}`);
            servers.delete(sdkSessionId);
            console.log(`MCP SSE session closed: ${sdkSessionId}`);
        });
    } catch (e) {
        console.error("MCP SSE Error:", e);
        if (!res.headersSent) res.status(500).json({ error: "Failed to initialize MCP SSE stream." });
    }
});

router.post('/messages', async (req, res) => {
    try {
        const sessionId = req.query.sessionId;
        const transport = transports.get(sessionId);

        if (!transport) {
            return res.status(404).json({ error: 'Session not found or has expired.' });
        }

        // Verify auth using cached session data (faster than re-running publicApiAuth)
        const cachedAuth = transports.get(`auth_${sessionId}`);
        if (!cachedAuth) {
            return res.status(401).json({ error: 'Session authentication expired.' });
        }

        // Pass req.body as parsedBody (3rd arg) because Express's global
        // express.json() middleware has already consumed the raw body stream.
        // Without this, SSEServerTransport tries to read the stream via raw-body
        // and gets "stream is not readable" error.
        await transport.handlePostMessage(req, res, req.body);
    } catch (e) {
        console.error("MCP Messages Error:", e);
        if (!res.headersSent) res.status(500).json({ error: "Failed to handle message." });
    }
});

export default router;
