import fetch from 'node-fetch';
import { supabaseAdmin } from '../config/supabaseClient.js';
import 'dotenv/config';

/**
 * Savee.it Mass Scavenger
 * Goal: 100,000 items with Titles, AI Tags, and High-Res URLs
 */

const TARGET_COUNT = 100000;
const BATCH_SIZE = 50;
const GQL_URL = 'https://api.savee.it/graphql';

// Stealth Headers
const HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Referer': 'https://savee.it/pop',
    'Origin': 'https://savee.it',
};

// Optimized GraphQL Query
const SAVEE_QUERY = `
  query GetFeed($page: Int, $limit: Int) {
    items(page: $page, limit: $limit) {
      uuid
      title
      asset {
        image_url
        width
        height
      }
      tags
      colors
      source_link
    }
  }
`;

async function scrapeBatch(page) {
    try {
        const response = await fetch(GQL_URL, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                query: SAVEE_QUERY,
                variables: { page, limit: BATCH_SIZE }
            })
        });

        const body = await response.json();
        if (body.errors) {
            console.error(`[Error] GQL Errors on page ${page}:`, body.errors);
            return [];
        }
        return body.data?.items || [];
    } catch (err) {
        console.error(`[Error] Batch failed on page ${page}:`, err.message);
        return [];
    }
}

function upgradeImageUrl(url) {
    if (!url) return url;
    // Upgrade w420/w600 thumbnails to w1000 or originals
    return url.replace(/\/w\d+\//, '/w1000/');
}

async function runScavenger() {
    console.log("Starting Savee.it 100k Scavenger...");
    console.log(`Target: ${TARGET_COUNT} items | Batch Size: ${BATCH_SIZE}`);

    let totalSaved = 0;
    let page = 1;
    let consecutiveErrors = 0;

    while (totalSaved < TARGET_COUNT && consecutiveErrors < 5) {
        console.log(`\nFetching Page ${page}...`);
        const items = await scrapeBatch(page);

        if (items.length === 0) {
            console.warn(`[Warning] No items returned on page ${page}. Attempting retry or finalization.`);
            consecutiveErrors++;
            await new Promise(r => setTimeout(r, 5000));
            page++;
            continue;
        }

        consecutiveErrors = 0;

        // Normalize data for Supabase
        const rows = items.map(item => ({
            image_url: upgradeImageUrl(item.asset?.image_url),
            title: item.title || '',
            tags: item.tags || [],
            colors: item.colors || null,
            width: item.asset?.width || 0,
            height: item.asset?.height || 0,
            source_url: `https://savee.it/i/${item.uuid}/`
        }));

        // Upsert into savee_assets
        const { error } = await supabaseAdmin
            .from('savee_assets')
            .upsert(rows, { onConflict: 'image_url' });

        if (error) {
            console.error(`[Error] Supabase Error on page ${page}:`, error.message);
        } else {
            totalSaved += rows.length;
            console.log(`[Success] Progress: ${totalSaved}/${TARGET_COUNT} (+${rows.length} from page ${page})`);
        }

        // Stealth Throttling
        const delay = 1000 + Math.random() * 1000;
        await new Promise(r => setTimeout(r, delay));

        page++;
    }

    console.log(`\n Scavenger Complete. Total saved: ${totalSaved}`);
}

runScavenger();
