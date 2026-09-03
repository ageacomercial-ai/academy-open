/* EBOOK API — Outline */
import { orchestrate, validateJSON } from '../../ebook/ai/orchestrator.js';
import { buildOutlinePrompt } from '../../ebook/prompts/outline.js';
import { validateOutline } from '../../ebook/schemas/outline.schema.js';
import { validateBriefing } from '../../ebook/schemas/briefing.schema.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  if (req.method==='OPTIONS') return res.status(204).end();
  if (req.method!=='POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });
  let body; try { body = typeof req.body==='string'? JSON.parse(req.body): req.body; } catch { return res.status(400).json({ ok:false, error:'INVALID_JSON' }); }
  const briefingRaw = body.briefing || body;
  const v = validateBriefing(briefingRaw);
  if (!v.ok) return res.status(400).json({ ok:false, error:v.error });
  const briefing = v.data;
  const { system, user, maxTokens, temperature } = buildOutlinePrompt(briefing);
  try {
    const result = await orchestrate({
      task:'outline',
      messages: [{role:'system', content: system}, {role:'user', content:user}],
      max_tokens: maxTokens,
      temperature,
      response_format: { type:'json_object' },
      validate: (text)=> {
        const j = validateJSON(text);
        if (!j.ok) return j;
        return validateOutline(j.data);
      }
    });
    return res.json({ ok:true, data: result.parsed, meta:{ model: result.model, provider: result.provider, duration_ms: result.duration_ms }});
  } catch (e) {
    return res.status(503).json({ ok:false, error:'AI_INDISPONIVEL', retry:true, details: e.message });
  }
}
