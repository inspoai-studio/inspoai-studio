/**
 * pineconeService.js
 * 
 * Semantic vector search via Pinecone + Vertex AI embeddings.
 * Used by assetService to find design assets by meaning, not just keywords.
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
const PINECONE_INDEX = 'inspoai-designs';
const GCP_PROJECT = 'inspoaibackendinfra';
const GCP_LOCATION = 'us-central1';
const EMBEDDING_MODEL = 'text-embedding-005';
const GCP_KEY_FILE = join(__dirname, 'gcp-service-account.json');

// ── Initialize ────────────────────────────────────────────────────────
let pineconeIndex = null;
let authClient = null;
let serviceReady = false;

try {
    if (fs.existsSync(GCP_KEY_FILE)) {
        const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
        pineconeIndex = pinecone.index(PINECONE_INDEX);

        const auth = new GoogleAuth({
            keyFile: GCP_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        authClient = auth;
        serviceReady = true;
        console.log('[Success] Pinecone semantic search initialized');
    } else {
        console.warn('[Warning] GCP key not found — semantic search disabled');
    }
} catch (err) {
    console.warn('[Warning] Pinecone init failed:', err.message);
}

// ── Cached GCP auth client ────────────────────────────────────────────
let _client = null;
async function getClient() {
    if (!_client) _client = await authClient.getClient();
    return _client;
}

/**
 * Embed a search query for retrieval (RETRIEVAL_QUERY task type).
 * Uses the same model as the document embeddings but with query-optimized task type.
 */
async function embedQuery(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('embedQuery: empty or invalid text input');
    }
    // Sanitize: truncate long queries and remove control characters
    const sanitized = text.trim().replace(/[\x00-\x1f]/g, ' ').substring(0, 2000);

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
            instances: [{ content: sanitized, task_type: 'RETRIEVAL_QUERY' }],
        }),
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => 'no body');
        throw new Error(`Vertex AI embed error: ${response.status} — ${errBody.substring(0, 200)}`);
    }

    const data = await response.json();
    return data.predictions[0].embeddings.values;
}

/**
 * Search Pinecone for semantically similar design assets.
 * 
 * @param {string} query - User's natural language search query
 * @param {number} topK - Number of results to return (default 80)
 * @param {object} filter - Optional Pinecone metadata filter (e.g. { platform: 'ios' })
 * @returns {Array<{id, score, metadata}>} Ranked results
 */
export async function semanticSearch(query, topK = 80, filter = null) {
    if (!serviceReady || !pineconeIndex) {
        return [];
    }

    try {
        const startTime = Date.now();

        // 1. Embed the query
        const queryEmbedding = await embedQuery(query);

        // 2. Query Pinecone
        const queryParams = {
            vector: queryEmbedding,
            topK,
            includeMetadata: true,
        };
        if (filter) queryParams.filter = filter;

        const results = await pineconeIndex.query(queryParams);
        const duration = Date.now() - startTime;

        console.log(`Semantic search: "${query}" → ${results.matches?.length || 0} results (${duration}ms)`);

        return (results.matches || []).map(match => ({
            id: match.id,
            score: match.score,
            metadata: match.metadata || {},
        }));

    } catch (err) {
        console.error('[Error] Semantic search error:', err.message);
        return [];
    }
}

/**
 * Check if semantic search is available.
 */
export function isSemanticSearchReady() {
    return serviceReady;
}
