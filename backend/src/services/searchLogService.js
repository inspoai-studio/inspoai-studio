/**
 * searchLogService.js
 *
 * Background service to log user search queries to Supabase search_logs table.
 * Always fire-and-forget — never awaited at call site, zero impact on search speed.
 */

import { supabaseAdmin as supabase } from '../config/supabaseClient.js';

const TABLE = 'search_logs';

/**
 * Log a single search query in the background.
 * Call without await — fire-and-forget.
 *
 * @param {object} params
 * @param {string} params.userEmail   - authenticated user's email
 * @param {string} params.query       - the search query string
 * @param {string} params.searchMode  - 'ui' | 'web' | 'visual' | 'icon' | 'font'
 * @param {string} params.industry    - optional industry filter
 * @param {string} params.designStyle - optional design style filter
 * @param {string} params.color       - optional color filter
 * @param {number} params.resultCount - number of results returned
 * @param {number} params.page        - page number (0-indexed)
 */
export async function logSearchQuery({
    userEmail,
    query,
    searchMode,
    industry,
    designStyle,
    color,
    resultCount,
    page = 0,
}) {
    if (!supabase || !userEmail || !query) return;

    try {
        const { error } = await supabase.from(TABLE).insert([{
            user_email:   userEmail,
            query:        query.trim().substring(0, 500), // cap at 500 chars
            search_mode:  searchMode || null,
            industry:     industry   || null,
            design_style: designStyle || null,
            color:        color      || null,
            result_count: resultCount ?? null,
            page,
            searched_at:  new Date().toISOString(),
        }]);

        if (error) {
            console.error('[Warning] search_logs insert error:', error.message);
        } else {
            console.log(`search_log: "${query}" by ${userEmail} (${searchMode}, ${resultCount} results)`);
        }
    } catch (err) {
        console.error('[Error] searchLogService error:', err.message);
    }
}
