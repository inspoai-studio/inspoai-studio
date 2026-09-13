/**
 * generateGeminiEmbeddings.js
 * 
 * One-time script to embed all design_assets using Gemini Embedding 2 (Vertex AI)
 * and store vectors in Pinecone for semantic search.
 * 
 * Run: node scripts/generateGeminiEmbeddings.js
 */

import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// ── Config ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const PINECONE_API_KEY = 'pcsk_3M3TG2_rsMyTqF9USg8HEJDxHwBHsLKbdGjzyurvLKGCWz4g1ABMLFWou3Jh66kj4EGFZ';
const PINECONE_INDEX = 'inspoai-designs';
const GCP_PROJECT = 'inspoaibackendinfra';
const GCP_LOCATION = 'us-central1';
const GCP_KEY_FILE = join(__dirname, '..', 'gcp-service-account.json');
const EMBEDDING_MODEL = 'text-embedding-005';  // Stable GA model, 768 dims
const EMBEDDING_DIMS = 768;
const BATCH_SIZE = 100;        // Records per Pinecone upsert batch
const EMBED_BATCH = 5;         // Texts per embedding API call  
const RATE_LIMIT_MS = 200;     // Delay between embedding API calls

// ── Validate ──────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[Error] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}
if (!fs.existsSync(GCP_KEY_FILE)) {
    console.error('[Error] GCP service account key not found at:', GCP_KEY_FILE);
    process.exit(1);
}

// ── Clients ───────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const index = pinecone.index(PINECONE_INDEX);

// Google Auth for Vertex AI REST API
const auth = new GoogleAuth({
    keyFile: GCP_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

// ── Embed via Vertex AI REST API ──────────────────────────────────────
let _cachedClient = null;
async function getAuthClient() {
    if (!_cachedClient) _cachedClient = await auth.getClient();
    return _cachedClient;
}

async function embedTexts(texts) {
    const client = await getAuthClient();
    const token = await client.getAccessToken();

    const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}/locations/${GCP_LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

    const instances = texts.map(text => ({
        content: text,
        task_type: 'RETRIEVAL_DOCUMENT',
    }));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instances }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Vertex AI error ${response.status}: ${err}`);
    }

    const data = await response.json();
    if (!data.predictions || data.predictions.length === 0) {
        throw new Error(`No predictions returned. Response keys: ${Object.keys(data)}`);
    }

    const embeddings = data.predictions.map(p => {
        if (p.embeddings && p.embeddings.values) return p.embeddings.values;
        if (p.values) return p.values;
        throw new Error(`Unexpected prediction format: ${JSON.stringify(Object.keys(p))}`);
    });

    return embeddings;
}

// ── Build text description for embedding ──────────────────────────────
function buildTextForAsset(asset) {
    const parts = [];
    if (asset.title) parts.push(asset.title);
    if (asset.site_name) parts.push(`by ${asset.site_name}`);
    if (asset.platform) parts.push(`Platform: ${asset.platform}`);
    if (asset.page_types?.length) parts.push(`Page: ${asset.page_types.join(', ')}`);
    if (asset.ux_patterns?.length) parts.push(`UX: ${asset.ux_patterns.join(', ')}`);
    if (asset.ui_elements?.length) parts.push(`Elements: ${asset.ui_elements.join(', ')}`);
    if (asset.tags?.length) parts.push(`Tags: ${asset.tags.join(', ')}`);
    if (asset.query) parts.push(asset.query);
    return parts.join(' | ') || 'UI design screenshot';
}

// ── Sleep helper ──────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
    console.log('InspoAI Semantic Embedding Generator');
    console.log(` Model: ${EMBEDDING_MODEL} (${EMBEDDING_DIMS} dims)`);
    console.log(`  Storage: Pinecone (${PINECONE_INDEX})\n`);

    // 1. Count total records
    const { count, error: countErr } = await supabase
        .from('design_assets')
        .select('*', { count: 'exact', head: true });

    if (countErr) {
        console.error('[Error] Count error:', countErr.message);
        process.exit(1);
    }
    console.log(`Total design_assets: ${count}`);

    // 2. Check how many are already in Pinecone
    const stats = await index.describeIndexStats();
    const existingVectors = stats.totalRecordCount || 0;
    console.log(`Existing vectors in Pinecone: ${existingVectors}`);

    if (existingVectors >= count) {
        console.log('[Success] All records already have embeddings in Pinecone!');
        return;
    }

    // 3. Fetch in pages and embed
    const PAGE_SIZE = 500;
    let processed = 0;
    let embedded = 0;
    let errors = 0;
    let offset = 0;

    // Get existing IDs from Pinecone to skip (sample-based for efficiency)
    console.log(`\nStarting embedding generation...\n`);

    while (offset < count) {
        // Fetch batch from Supabase
        const { data: assets, error: fetchErr } = await supabase
            .from('design_assets')
            .select('id, title, site_name, site_domain, source, platform, page_types, ux_patterns, ui_elements, tags, query')
            .range(offset, offset + PAGE_SIZE - 1)
            .order('id');

        if (fetchErr) {
            console.error(`[Error] Fetch error at offset ${offset}:`, fetchErr.message);
            offset += PAGE_SIZE;
            continue;
        }

        if (!assets || assets.length === 0) break;

        // Process in embedding batches
        const vectors = [];
        for (let i = 0; i < assets.length; i += EMBED_BATCH) {
            const batch = assets.slice(i, i + EMBED_BATCH);
            const texts = batch.map(a => buildTextForAsset(a));

            try {
                const embeddings = await embedTexts(texts);
                for (let j = 0; j < batch.length; j++) {
                    vectors.push({
                        id: batch[j].id,
                        values: embeddings[j],
                        metadata: {
                            title: (batch[j].title || '').slice(0, 200),
                            site_name: batch[j].site_name || '',
                            platform: batch[j].platform || '',
                            page_types: (batch[j].page_types || []).slice(0, 5),
                            ux_patterns: (batch[j].ux_patterns || []).slice(0, 5),
                            source: batch[j].source || '',
                        },
                    });
                    embedded++;
                }
            } catch (err) {
                console.error(`  [Warning] Embed error (batch ${i}): ${err.message}`);
                errors += EMBED_BATCH;
            }

            await sleep(RATE_LIMIT_MS);
        }

        // Upsert to Pinecone in batches
        if (vectors.length > 0) {
            console.log(`  Upserting ${vectors.length} vectors (dims: ${vectors[0].values.length})...`);
            for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
                const upsertBatch = vectors.slice(i, i + BATCH_SIZE);
                if (upsertBatch.length === 0) continue;
                try {
                    await index.upsert(upsertBatch);
                } catch (err) {
                    console.error(`  [Warning] Pinecone upsert error: ${err.message}`);
                }
            }
        } else {
            console.log(`  [Warning] No vectors to upsert for this page`);
        }

        processed += assets.length;
        offset += PAGE_SIZE;

        const pct = ((processed / count) * 100).toFixed(1);
        console.log(`  [Success] ${processed}/${count} (${pct}%) — embedded: ${embedded}, errors: ${errors}`);
    }

    // Final stats
    const finalStats = await index.describeIndexStats();
    console.log(`\n Done!`);
    console.log(`   Total processed: ${processed}`);
    console.log(`   Embedded: ${embedded}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Pinecone vectors: ${finalStats.totalRecordCount}`);
}

main().catch(err => {
    console.error(' Fatal error:', err);
    process.exit(1);
});
