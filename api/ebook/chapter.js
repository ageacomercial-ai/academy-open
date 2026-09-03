/* EBOOK API — Chapter generation */
import { orchestrate, validateJSON } from '../../ebook/ai/orchestrator.js';
import { buildChapterPrompt } from '../../ebook/prompts/chapter.js';

function repairAST(raw, capNum, capTitle, subs) {
  let ast=null;
  if (raw && typeof raw==='object') ast=raw;
  else if (typeof raw==='string') { try { ast=JSON.parse(raw.replace(/```(?:json)?\s*/gi,'').replace(/```/g,'').trim()); } catch { const m=raw.match(/(\{[\s\S]*\})/); if(m) try{ast=JSON.parse(m[1]);}catch{}}}
  const base={ chapter_id:String(capNum), title:capTitle||`Capítulo ${capNum}`, sections:[] };
  if (!ast) {
    return { ...base, sections:(subs||['Introdução','Desenvolvimento','Conclusão']).map((s,i)=>({section_id:`${capNum}.${i+1}`,title:s,paragraphs:[]})), _repaired:true };
  }
  ast.chapter_id=ast.chapter_id||base.chapter_id;
  ast.title=ast.title||base.title;
  if (!Array.isArray(ast.sections) || ast.sections.length===0) { ast.sections=base.sections; ast._repaired=true; }
  else { ast.sections=ast.sections.map((sec,i)=>{ if(!sec.section_id) sec.section_id=`${capNum}.${i+1}`; if(!sec.title) sec.title=subs?.[i]||`${capNum}.${i+1}`; if(!Array.isArray(sec.paragraphs)) sec.paragraphs= sec.content? String(sec.content).split('\n\n'):[]; return sec; }); }
  return ast;
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  let body; try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({ok:false,error:'INVALID_JSON'});}
  const { briefing, chapter, outline, previousChapters } = body;
  if(!briefing||!chapter) return res.status(400).json({ok:false,error:'briefing e chapter obrigatórios'});
  const capNum = parseInt(chapter.num)||1;
  const capTitle = chapter.title||`Capítulo ${capNum}`;
  const subs = Array.isArray(chapter.subs)?chapter.subs:[];
  const { system, user, maxTokens, temperature } = buildChapterPrompt({ briefing, chapter:{num:capNum,title:capTitle,subs}, outline: outline||{chapters:[]}, previousChapters: previousChapters||[] });
  const systemJSON = system + `\nEsquema: {"chapter_id":"${capNum}","title":"${capTitle}","sections":[{"section_id":"${capNum}.1","title":"...","paragraphs":["..."]}]}  \nResposta DEVE ser exclusivamente esse objeto JSON.`;
  try{
    const result = await orchestrate({
      task:'writing',
      messages:[{role:'system',content:systemJSON},{role:'user',content:user}],
      max_tokens: Math.min(maxTokens, 8000),
      temperature,
      response_format:{type:'json_object'},
      validate:(text)=>{ const j=validateJSON(text); return j; }
    });
    const ast = repairAST(result.parsed || result.text, capNum, capTitle, subs);
    // validar mínimo
    const totalParas = (ast.sections||[]).reduce((a,s)=>a+(s.paragraphs||[]).length,0);
    if(totalParas<2) return res.status(503).json({ok:false,error:'CAPITULO_INVALIDO', retry:true, data:{ast, reason:'paragrafos insuficientes'}});
    return res.json({ ok:true, data: ast, meta:{ model:result.model, provider:result.provider, duration_ms:result.duration_ms }});
  }catch(e){
    return res.status(503).json({ ok:false, error:'AI_INDISPONIVEL', retry:true, details:e.message });
  }
}
