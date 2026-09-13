/**
 * generateWebEmbeddings.js
 * 
 * One-time script to embed lapa_websites + landbook_websites using Vertex AI
 * and store vectors in Pinecone 'inspoai-websites' index for semantic search.
 * 
 * Run: node scripts/generateWebEmbeddings.js
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
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || 'pcsk_3M3TG2_rsMyTqF9USg8HEJDxHwBHsLKbdGjzyurvLKGCWz4g1ABMLFWou3Jh66kj4EGFZ';
const PINECONE_INDEX = process.env.PINECONE_WEB_INDEX || 'inspoai-websites';
const GCP_PROJECT = 'inspoaibackendinfra';
const GCP_LOCATION = 'us-central1';
const GCP_KEY_FILE = join(__dirname, '..', 'gcp-service-account.json');
const EMBEDDING_MODEL = 'text-embedding-005';
const BATCH_SIZE = 100;   // Records per Pinecone upsert batch
const EMBED_BATCH = 5;    // Texts per embedding API call
const RATE_LIMIT_MS = 200;

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
const auth = new GoogleAuth({
    keyFile: GCP_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

// ── Embed via Vertex AI REST API ──────────────────────────────────────
let _authClient = null;
async function getAuthToken() {
    if (!_authClient) _authClient = await auth.getClient();
    const { token } = await _authClient.getAccessToken();
    return token;
}

async function embedTexts(texts) {
    const token = await getAuthToken();
    const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}/locations/${GCP_LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instances: texts.map(t => ({ content: t, task_type: 'RETRIEVAL_DOCUMENT' })),
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Vertex AI error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.predictions.map(p => p.embeddings.values);
}

// ── Build text to embed for each row ─────────────────────────────────
function buildLapaText(row) {
    const parts = [
        'Lapa Ninja',
        row.title || row.slug || '',
        row.description || '',
        (row.categories || []).length > 0 ? `Categories: ${row.categories.join(', ')}` : '',
        (row.colors || []).length > 0 ? `Colors: ${row.colors.join(', ')}` : '',
        (row.typefaces || []).length > 0 ? `Typefaces: ${row.typefaces.join(', ')}` : '',
        row.platform ? `Platform: ${row.platform}` : '',
        row.published_year ? `Year: ${row.published_year}` : '',
    ];
    return parts.filter(Boolean).join(' | ');
}

function buildLandbookText(row) {
    const parts = [
        'Land-book',
        row.title || row.slug || '',
        (row.categories || []).length > 0 ? `Categories: ${row.categories.join(', ')}` : '',
        (row.colors || []).length > 0 ? `Colors: ${row.colors.join(', ')}` : '',
        (row.components || []).length > 0 ? `Components: ${row.components.join(', ')}` : '',
    ];
    return parts.filter(Boolean).join(' | ');
}

// ── Fetch all rows from a table (paginated) ───────────────────────────
async function fetchAllRows(table, buildText, idPrefix) {
    const PAGE = 500;
    let offset = 0;
    const allRows = [];

    while (true) {
        try {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .range(offset, offset + PAGE - 1);

            if (error) {
                console.error(`[Error] Fetch error at offset ${offset} from ${table}:`, error.message);
                offset += PAGE;
                continue;
            }

            if (!data || data.length === 0) break;

            for (const row of data) {
                allRows.push({
                    id: `${idPrefix}-${row.id}`,
                    text: buildText(row),
                    metadata: {
                        source: idPrefix === 'lapa' ? 'Lapa Ninja' : 'Land-book',
                        id: String(row.id),
                    },
                });
            }

            offset += PAGE;
            if (data.length < PAGE) break;

        } catch (err) {
            console.error(`[Error] Unexpected error at offset ${offset} from ${table}:`, err.message);
            offset += PAGE;
        }
    }

    return allRows;
}

// ── Upsert vectors to Pinecone in batches ────────────────────────────
async function upsertBatch(vectors) {
    if (vectors.length === 0) return;
    console.log(`Upserting ${vectors.length} vectors...`);
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, i + BATCH_SIZE);
        await index.upsert(batch.map(v => ({
            id: v.id,
            values: v.values,
            metadata: v.metadata,
        })));
    }
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
    console.log('Starting web embedding pipeline...');
    console.log(`Pinecone index: ${PINECONE_INDEX}`);

    // 1. Fetch all rows from both tables
    console.log('\n Fetching from lapa_websites...');
    const lapaRows = await fetchAllRows('lapa_websites', buildLapaText, 'lapa');
    console.log(`   [Success] ${lapaRows.length} Lapa Ninja rows fetched`);

    console.log('\n Fetching from landbook_websites...');
    const landbookRows = await fetchAllRows('landbook_websites', buildLandbookText, 'landbook');
    console.log(`   [Success] ${landbookRows.length} Land-book rows fetched`);

    const allRows = [...lapaRows, ...landbookRows];
    const total = allRows.length;
    console.log(`\nTotal rows to embed: ${total}`);

    // 2. Embed and upsert in batches
    let embedded = 0;
    let errors = 0;
    const vectors = [];

    for (let i = 0; i < total; i += EMBED_BATCH) {
        const batch = allRows.slice(i, i + EMBED_BATCH);
        try {
            const embeddings = await embedTexts(batch.map(r => r.text));
            for (let j = 0; j < batch.length; j++) {
                const emb = embeddings[j];
                if (!emb || emb.length !== 768) continue;
                vectors.push({ ...batch[j], values: emb });
                embedded++;
            }

            // Upsert when accumulated enough
            if (vectors.length >= BATCH_SIZE) {
                await upsertBatch(vectors.splice(0, BATCH_SIZE));
            }

            // Progress log every 500 records
            if ((i + EMBED_BATCH) % 500 === 0 || i + EMBED_BATCH >= total) {
                const pct = ((i + EMBED_BATCH) / total * 100).toFixed(1);
                console.log(`  [Success] ${Math.min(i + EMBED_BATCH, total)}/${total} (${pct}%) — embedded: ${embedded}, errors: ${errors}`);
            }

            await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

        } catch (err) {
            errors += batch.length;
            console.error(`  [Error] Embed error at i=${i}:`, err.message);
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Upsert any remaining vectors
    if (vectors.length > 0) {
        await upsertBatch(vectors);
    }

    console.log('\n Done!');
    console.log(`   Total processed: ${total}`);
    console.log(`   Embedded: ${embedded}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Pinecone vectors: ${embedded}`);
    process.exit(0);
}

main().catch(err => {
    console.error('[Error] Fatal:', err);
    process.exit(1);
});
