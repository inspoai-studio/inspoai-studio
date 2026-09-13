/**
 * webPineconeService.js
 * 
 * Semantic search for web inspiration (Lapa Ninja + Land-book)
 * Uses a SEPARATE Pinecone index 'inspoai-websites' — completely isolated from
 * design_assets / UI inspo (inspoai-designs).
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleAuth } from 'google-auth-library';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || 'pcsk_3M3TG2_rsMyTqF9USg8HEJDxHwBHsLKbdGjzyurvLKGCWz4g1ABMLFWou3Jh66kj4EGFZ';
const PINECONE_INDEX = process.env.PINECONE_WEB_INDEX || 'inspoai-websites';
const GCP_PROJECT = 'inspoaibackendinfra';
const GCP_LOCATION = 'us-central1';
const EMBEDDING_MODEL = 'text-embedding-005';
const GCP_KEY_FILE = join(__dirname, 'gcp-service-account.json');

// ── Initialize ────────────────────────────────────────────────────────
let webPineconeIndex = null;
let authClient = null;
let webServiceReady = false;

try {
    if (fs.existsSync(GCP_KEY_FILE)) {
        const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
        webPineconeIndex = pinecone.index(PINECONE_INDEX);

        const auth = new GoogleAuth({
            keyFile: GCP_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        authClient = auth;
        webServiceReady = true;
        console.log('[Success] Pinecone web semantic search initialized (inspoai-websites)');
    } else {
        console.warn('[Warning] GCP key not found — web semantic search disabled');
    }
} catch (err) {
    console.warn('[Warning] Web Pinecone init failed:', err.message);
}

// ── Cached GCP auth client ────────────────────────────────────────────
let _client = null;
async function getClient() {
    if (!_client) _client = await authClient.getClient();
    return _client;
}

/**
 * Embed a search query using Vertex AI (RETRIEVAL_QUERY optimized).
 */
async function embedQuery(text) {
    const client = await getClient();
    const token = await client.getAccessToken();

    const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}/locations/${GCP_LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instances: [{ content: text, task_type: 'RETRIEVAL_QUERY' }],
        }),
    });

    if (!response.ok) {
        throw new Error(`Vertex AI embed error: ${response.status}`);
    }

    const data = await response.json();
    return data.predictions[0].embeddings.values;
}

/**
 * Search web inspiration assets semantically (Lapa + Landbook).
 * Queries inspoai-websites — COMPLETELY SEPARATE from inspoai-designs.
 * 
 * @param {string} query - Natural language query
 * @param {number} topK - Results per page (default 60)
 * @param {number} page - 0-indexed page (0 = first load, 1+ = show more)
 * @returns {Array<{id, score, metadata}>} - id is 'lapa-{n}' or 'landbook-{n}'
 */
export async function webSemanticSearch(query, topK = 60, page = 0) {
    if (!webServiceReady || !webPineconeIndex) {
        return [];
    }

    try {
        const startTime = Date.now();
        const queryEmbedding = await embedQuery(query);

        // Page offset: fetch enough vectors to slice the right page.
        // page=0: fetch topK (0-59)
        // page=1: fetch topK*2 (0-119), return last 60
        // page=2+: skip semantic pagination (too many vectors), return [] so scrapers handle it
        if (page >= 2) {
            console.log(`Web semantic: page=${page} too far — skipping, scrapers will cover`);
            return [];
        }

        const fetchK = Math.min(topK * (page + 1), 300); // cap at 300
        const results = await webPineconeIndex.query({
            vector: queryEmbedding,
            topK: fetchK,
            includeMetadata: true,
        });

        const duration = Date.now() - startTime;
        const allMatches = results.matches || [];

        // Slice to the correct page window
        const startIdx = topK * page;
        const pageMatches = allMatches.slice(startIdx, startIdx + topK);

        console.log(`Web semantic search: "${query}" page=${page} → ${pageMatches.length}/${allMatches.length} results (${duration}ms)`);

        return pageMatches.map(match => ({
            id: match.id,
            score: match.score,
            metadata: match.metadata || {},
        }));

    } catch (err) {
        console.error('[Error] Web semantic search error:', err.message);
        return [];
    }
}

/**
 * Check if web semantic search is available.
 */
export function isWebSemanticReady() {
    return webServiceReady;
}
