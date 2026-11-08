// Provider-neutral AI access over the OpenAI-compatible "chat completions" API.
// Default provider: Google Gemini (https://generativelanguage.googleapis.com/v1beta/openai).
// Secrets live in the database environment (supplied at publish time from the gitignored .env,
// never in source or clients). Switch provider by changing AI_BASE_URL / AI_API_KEY / AI_MODEL.
import { t } from 'spacetimedb/server';
import { TimeDuration, type Identity, type Timestamp } from 'spacetimedb';
import spacetimedb, { AiResult, type AiResultT, type Db, type Env, type Tx } from './schema';

const DefaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
const DefaultModel = 'gemini-3.5-flash'; // accurate, ~3 s
const DefaultFallbackModel = 'gemini-3.5-flash-lite'; // ~1 s, used when the main model is overloaded
const MaxPromptChars = 4000;
const AiCooldownMicros = 3_000_000n; // one AI call per player every 3 s (protects API credits)

export type AiConfig = { key: string; baseUrl: string; model: string; visionModel: string; fallbackModel: string };

/** What the AI client needs from a procedure or HTTP handler context. */
export type HttpClient = { fetch: (url: string, init?: any) => any };
export type TxHost = { http: HttpClient; withTx<T>(body: (tx: Tx) => T): T; env: Env };

export function loadAiConfig(env: Env): AiConfig | null {
  const key = env.AI_API_KEY;
  if (!key) return null;
  const baseUrl = trimEndChar(env.AI_BASE_URL || DefaultBaseUrl, '/');
  const model = env.AI_MODEL || DefaultModel;
  const visionModel = env.AI_VISION_MODEL || model;
  const fallbackModel = env.AI_FALLBACK_MODEL || DefaultFallbackModel;
  return { key, baseUrl, model, visionModel, fallbackModel };
}

// Connectivity + key check: lists the models this key can use.
export const aiPing = spacetimedb.procedure(AiResult, ctx => {
  const cfg = loadAiConfig(ctx.env);
  if (!cfg) return notConfigured();
  let response;
  try {
    response = ctx.http.fetch(`${cfg.baseUrl}/models`, {
      method: 'GET',
      headers: { authorization: `Bearer ${cfg.key}` },
      body: '',
    });
  } catch (e) {
    return fail(`HTTP error: ${errorMessage(e)}`);
  }
  const body = response.text();
  if (response.status !== 200) return fail(`HTTP ${response.status}: ${trim(body, 300)}`);
  const doc = JSON.parse(body);
  const ids = (doc.data as any[]).map(m => (typeof m.id === 'string' ? m.id : '')).filter(id => id.length > 0);
  return { ok: true, text: ids.join('\n'), model: cfg.model, latencyMs: 0 };
});

// Send one prompt. Rate-limited per identity; the key never leaves the server.
export const aiAsk = spacetimedb.procedure({ system: t.string(), prompt: t.string() }, AiResult, (ctx, { system, prompt }) => {
  if (!prompt || prompt.trim().length === 0) return fail('Empty prompt');
  if (prompt.length > MaxPromptChars || (system ?? '').length > MaxPromptChars) return fail('Prompt too long');
  const cfg = loadAiConfig(ctx.env);
  if (!cfg) return notConfigured();
  const sender = ctx.sender;
  if (!ctx.withTx(tx => takeAiQuota(tx.db, sender, tx.timestamp))) return fail('Slow down a little — try again in a few seconds');
  return complete(ctx.http, cfg, cfg.model, m => chatPayload(m, system ?? '', prompt));
});

// Rate limit (one AI call per identity every few seconds). Run it in a short transaction before any network I/O.
export function takeAiQuota(db: Db, who: Identity, now: Timestamp): boolean {
  const usage = db.aiUsage.identity.find(who);
  if (usage && now.microsSinceUnixEpoch - usage.lastCall.microsSinceUnixEpoch < AiCooldownMicros) return false;
  if (usage) db.aiUsage.identity.update({ ...usage, lastCall: now, calls: usage.calls + 1 });
  else db.aiUsage.insert({ identity: who, lastCall: now, calls: 1 });
  return true;
}

// Calls the model; if it's overloaded (429/5xx), retries once with the fallback model
// (skipped when fallbackTimeoutMs is zero, e.g. when the webhook has no time left).
export function complete(
  http: HttpClient,
  cfg: AiConfig,
  model: string,
  payloadFor: (model: string) => string,
  firstTimeoutMs: number | null = null,
  fallbackTimeoutMs: number | null = null
): AiResultT {
  const first = completeOnce(http, cfg, model, payloadFor(model), firstTimeoutMs ?? 12_000);
  const fallback = fallbackTimeoutMs ?? 20_000;
  if (first.result.ok || !first.retryable || cfg.fallbackModel === model || fallback <= 0) return first.result;
  console.info(`AI: ${model} unavailable, falling back to ${cfg.fallbackModel}`);
  return completeOnce(http, cfg, cfg.fallbackModel, payloadFor(cfg.fallbackModel), fallback).result;
}

function completeOnce(
  http: HttpClient,
  cfg: AiConfig,
  model: string,
  payload: string,
  timeoutMs: number
): { result: AiResultT; retryable: boolean } {
  let response;
  try {
    response = http.fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      timeout: TimeDuration.fromMillis(timeoutMs),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
      body: payload,
    });
  } catch (e) {
    return { result: fail(`AI request failed: ${errorMessage(e)}`), retryable: true };
  }
  const body: string = response.text();
  if (response.status !== 200) {
    const overloaded = response.status === 429 || response.status >= 500;
    console.warn(`AI HTTP ${response.status} (${model}): ${trim(body.replace(/\s+/g, ' '), 600)}`);
    return { result: fail(`AI service error (HTTP ${response.status})`), retryable: overloaded };
  }
  const doc = JSON.parse(body);
  const content = doc.choices[0].message.content;
  if (content != null && typeof content !== 'string') throw new Error('AI reply content is not a string');
  const text = (content ?? '') as string;
  return { result: { ok: true, text: text.trim(), model, latencyMs: 0 }, retryable: false };
}

function chatPayload(model: string, system: string, prompt: string): string {
  const messages: { role: string; content: string }[] = [];
  if (system.length > 0) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  return JSON.stringify({ model, temperature: 0.6, messages });
}

export function notConfigured(): AiResultT {
  return fail('AI is not configured on the server (AI_API_KEY missing)');
}
export function fail(message: string): AiResultT {
  return { ok: false, text: message, model: '', latencyMs: 0 };
}
export function trim(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '…';
}

// ---------- Small string helpers shared by the other files (C# char/string equivalents) ----------

/** char.IsControl: Unicode category Cc (U+0000-U+001F, U+007F-U+009F). */
export function isControl(c: string): boolean {
  const n = c.charCodeAt(0);
  return n <= 0x1f || (n >= 0x7f && n <= 0x9f);
}

/** string.TrimEnd(char). */
export function trimEndChar(s: string, c: string): string {
  let end = s.length;
  while (end > 0 && s[end - 1] === c) end--;
  return s.slice(0, end);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
