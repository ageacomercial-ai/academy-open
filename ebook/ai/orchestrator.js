/* ═══════════════════════════════════════════════════════════
   EBOOK CREATOR — AI Orchestrator
   Serviço central: seleciona modelo → monta prompts → chama → valida → retry → custo
   NUNCA chamado direto do frontend — só via /api/ebook/*
   ═══════════════════════════════════════════════════════════ */

import { generate as aiGenerate } from '../../api/ai-router.js';
import { modelForTask, tierForTask } from './model-router.js';

const DEFAULT_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '90000', 10);
const DEFAULT_MAX_RETRIES = 1;

/**
 * Executa uma chamada de IA estruturada.
 * @param {object} opts
 * @param {string} opts.task - tarefa (outline/writing/rewriting...)
 * @param {Array} opts.messages - [{role, content}]
 * @param {number} [opts.max_tokens]
 * @param {number} [opts.temperature]
 * @param {object} [opts.response_format] - {type:'json_object'}
 * @param {string} [opts.model] - override
 * @param {Function} [opts.validate] - (text) => {ok, data, error}
 * @returns {Promise<{text:string, model:string, provider:string, usage:object, cost:object, duration_ms:number}>}
 */
export async function orchestrate({ task = 'writing', messages, max_tokens = 4000, temperature = 0.7, response_format, model, validate, timeoutMs }) {
  const chosenModel = model || modelForTask(task);
  const tier = tierForTask(task);
  const t0 = Date.now();
  let lastError = null;

  for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);

      // ai-router generate já tem fallback hierárquico + cost
      const result = await aiGenerate(messages, {
        max_tokens,
        temperature,
        response_format,
        model: chosenModel,
        tier,
      });
      clearTimeout(t);

      if (validate) {
        const v = validate(result.text);
        if (!v.ok) throw new Error(v.error || 'VALIDATION_FAILED');
        // attach parsed
        result.parsed = v.data;
      }

      return {
        ...result,
        duration_ms: Date.now() - t0,
        task,
        attempt,
      };
    } catch (e) {
      lastError = e;
      const isTransient = /429|5\d\d|timeout|abort|AI_INDISPONIVEL/i.test(String(e.message || ''));
      if (attempt < DEFAULT_MAX_RETRIES && isTransient) {
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  const err = new Error(lastError?.message || 'AI_ORCHESTRATOR_FAILED');
  err.cause = lastError;
  err.task = task;
  err.model = chosenModel;
  throw err;
}

/**
 * Helper: validar JSON + schema simples
 */
export function validateJSON(text, schema) {
  try {
    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    const m = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const raw = m ? m[1] : cleaned;
    const data = JSON.parse(raw);
    if (schema && typeof schema === 'function') {
      const r = schema(data);
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, data: r.data || data };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: 'JSON invalido: ' + e.message };
  }
}

export async function logUsage({ ebook_id, task, model, usage, cost, duration_ms, user_id }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    await fetch(`${url}/rest/v1/ai_logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
      body: JSON.stringify({
        ebook_id: ebook_id || null,
        task,
        model,
        tokens_in: usage?.prompt_tokens || 0,
        tokens_out: usage?.completion_tokens || 0,
        cost_estimated: cost?.total || 0,
        duration_ms: duration_ms || 0,
        user_id: user_id || null,
        created_at: new Date().toISOString(),
      }),
      signal: ctrl.signal,
    });
  } catch {}
}
