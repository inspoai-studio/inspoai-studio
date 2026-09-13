/**
 * agentic-v3/llm.js — minimal DeepSeek client for the v3 pipeline.
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
export const DEFAULT_MODEL = process.env.AGENTIC_V3_MODEL || 'deepseek-chat';

export async function chat(systemPrompt, userPrompt, { maxTokens = 8000, temperature = 0.7, model = DEFAULT_MODEL, attempt = 1 } = {}) {
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');
  const started = Date.now();

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    stream: false
  };
  if (model !== 'deepseek-reasoner') {
    body.max_tokens = Math.min(maxTokens, 8192);
    body.temperature = attempt > 1 ? Math.max(temperature - 0.2, 0.2) : temperature;
    if (attempt > 1) body.frequency_penalty = 0.4;
  }

  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000)
  });

  if (!res.ok) {
    const err = await res.text();
    if ((res.status >= 500 || err.includes('looping content')) && attempt <= 2) {
      return chat(systemPrompt, userPrompt, { maxTokens, temperature, model, attempt: attempt + 1 });
    }
    throw new Error(`DeepSeek ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  console.log(`   [v3] DeepSeek ${model} ${Date.now() - started}ms, ${data.usage?.total_tokens ?? '?'} tok`);

  if (/looping content|flagged for looping/i.test(content) && attempt <= 2) {
    return chat(systemPrompt, userPrompt, { maxTokens, temperature, model, attempt: attempt + 1 });
  }
  return content;
}

/**
 * Streaming chat — calls onDelta(fullTextSoFar) as tokens arrive.
 * Falls back to a non-streaming call on transport errors.
 */
export async function chatStream(systemPrompt, userPrompt, { maxTokens = 8000, temperature = 0.7, model = DEFAULT_MODEL, onDelta } = {}) {
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');
  const started = Date.now();
  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: true,
        max_tokens: Math.min(maxTokens, 8192),
        temperature
      }),
      signal: AbortSignal.timeout(300000)
    });
    if (!res.ok || !res.body) throw new Error(`DeepSeek stream ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const payload = s.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            if (onDelta) onDelta(full);
          }
        } catch { /* keepalive or partial line */ }
      }
    }
    console.log(`   [v3] DeepSeek ${model} (stream) ${Date.now() - started}ms, ${full.length} chars`);
    if (!full) throw new Error('empty stream');
    return full;
  } catch (err) {
    console.warn(`  [Warning] [v3] stream failed (${err.message}) — falling back to non-streaming`);
    return chat(systemPrompt, userPrompt, { maxTokens, temperature, model });
  }
}

/** Chat call that must return JSON — parses defensively, one retry on garbage. */
export async function chatJSON(systemPrompt, userPrompt, opts = {}) {
  const raw = await chat(systemPrompt, userPrompt, opts);
  const parsed = tryParseJSON(raw);
  if (parsed) return parsed;
  const retry = await chat(
    systemPrompt + '\n\nIMPORTANT: your last answer was not valid JSON. Output ONLY a valid JSON object, no markdown fences, no commentary.',
    userPrompt,
    { ...opts, attempt: 2 }
  );
  const parsed2 = tryParseJSON(retry);
  if (parsed2) return parsed2;
  throw new Error('DeepSeek returned unparseable JSON');
}

export function tryParseJSON(raw = '') {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch {}
  // Salvage the outermost object
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch {}
  }
  return null;
}

/** Strip markdown fences from an HTML response. */
export function cleanHtmlResponse(raw = '') {
  let s = raw.trim();
  s = s.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '');
  // Some models narrate before the markup — cut anything before the first tag
  const firstTag = s.search(/<(!DOCTYPE|html|body|div|main|header|section|nav|aside|footer)\b/i);
  if (firstTag > 0) s = s.slice(firstTag);
  return s.trim();
}
