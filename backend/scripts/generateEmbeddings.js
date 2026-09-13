#!/usr/bin/env node
/**
 * generateEmbeddings.js
 * One-time script to embed all 91k design_assets using OpenAI text-embedding-3-small.
 * Run: node scripts/generateEmbeddings.js
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    // Use service role key for accurate counts and writes (no RLS restrictions)
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 200;
const EMBED_BATCH = 200;
const EMBEDDING_MODEL = 'text-embedding-3-small';

function buildEmbedText(row) {
    const parts = [
        row.title || '',
        row.site_name || '',
        row.source || '',
        row.platform ? `platform:${row.platform}` : '',
        Array.isArray(row.tags) ? row.tags.join(' ') : '',
        Array.isArray(row.ux_patterns) ? row.ux_patterns.join(' ') : '',
        Array.isArray(row.ui_elements) ? row.ui_elements.join(' ') : '',
        Array.isArray(row.page_types) ? row.page_types.join(' ') : '',
        Array.isArray(row.fonts) ? row.fonts.join(' ') : '',
    ].filter(Boolean);
    return parts.join(' ').trim().substring(0, 8000);
}

async function embedTexts(texts) {
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts });
    return res.data.map(d => d.embedding);
}

async function main() {
    console.log('InspoAI Embedding Generator');
    console.log(` Model: ${EMBEDDING_MODEL} (1536 dims)\n`);

    const [{ count: totalAll }, { count: totalEmbedded }] = await Promise.all([
        supabase.from('design_assets').select('*', { count: 'exact', head: true }),
        supabase.from('design_assets').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
    ]);

    const remaining = totalAll - (totalEmbedded || 0);
    console.log(`Total: ${totalAll} | Already done: ${totalEmbedded || 0} | To embed: ${remaining}`);

    if (remaining <= 0) {
        console.log('[Success] All records already have embeddings!');
        return;
    }

    let processed = 0;
    let writeErrors = 0;
    const startTime = Date.now();

    while (true) {
        // Always fetch from the top — embedded records drop out of this filter automatically
        const { data: rows, error: fetchErr } = await supabase
            .from('design_assets')
            .select('id, title, site_name, source, platform, tags, ux_patterns, ui_elements, page_types, fonts')
            .is('embedding', null)
            .limit(BATCH_SIZE);

        if (fetchErr) { console.error(`\n[Error] Fetch error:`, fetchErr.message); break; }
        if (!rows || rows.length === 0) break;

        // Embed all texts in this batch
        const texts = rows.map(buildEmbedText);
        const allEmbeddings = [];
        for (let i = 0; i < texts.length; i += EMBED_BATCH) {
            try {
                const embs = await embedTexts(texts.slice(i, i + EMBED_BATCH));
                allEmbeddings.push(...embs);
            } catch (err) {
                console.error(`\n[Error] OpenAI error:`, err.message);
                allEmbeddings.push(...Array(Math.min(EMBED_BATCH, texts.length - i)).fill(null));
            }
        }

        // Write each embedding with .update() — does NOT touch src or other NOT NULL cols
        await Promise.all(rows.map(async (row, i) => {
            if (!allEmbeddings[i]) return;
            const { error } = await supabase
                .from('design_assets')
                .update({ embedding: allEmbeddings[i] })
                .eq('id', row.id);
            if (error) writeErrors++;
        }));

        processed += rows.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const eta = (remaining - processed) / rate;

        process.stdout.write(
            `\r${processed}/${remaining} (${Math.round(processed / remaining * 100)}%) | ` +
            `${Math.round(rate)}/s | ETA: ${Math.round(eta / 60)}m${Math.round(eta % 60)}s | ` +
            `Errors: ${writeErrors}   `
        );
    }

    const t = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n\n[Success] Done! ${processed} records embedded in ${Math.floor(t / 60)}m ${t % 60}s`);
    if (writeErrors > 0) console.log(`[Warning] ${writeErrors} write errors (records skipped)`);
    console.log('\nNow run this in Supabase SQL Editor to create the search index:');
    console.log('   CREATE INDEX design_assets_embedding_idx');
    console.log('   ON design_assets USING ivfflat (embedding vector_cosine_ops)');
    console.log('   WITH (lists = 200);');
}

main().catch(console.error);
