import { montarPromptCapitulo } from './academic/prompts/chapters.js';
import { gerarInstrucaoGeo, gerarInstrucaoAntiIA } from './academic/prompts/system.js';
const fs=await import('fs');
const K=fs.readFileSync('.env','utf8').match(/GROQ_API_KEY=(.+)/)?.[1].trim();
const pNivel={label:'Licenciatura',profundidade:'Profundidade: análise crítica com referências teóricas, discussão de autores, dados quantificados.',citacoes:'Citações obrigatórias: pelo menos 1 (Autor, Ano) em cada parágrafo.'};
const pArea={label:'Ciências da Educação e Tecnologias Educativas',instrucoes:'Instruções de área: aplicar conceitos de tecnologia educativa.'};
const geoCtx=await gerarInstrucaoGeo('Impacto das TIC no rendimento académico em Angola',null,{pais:'ANG'});
const subs='1.1 Contextualização do Tema\n1.2 Justificativa da Pesquisa\n1.3 Objetivos da Investigação';
const prompt=montarPromptCapitulo({
  tema:'Impacto das TIC no rendimento académico em Angola',tipo:'Outro Trabalho',nivel:'Licenciatura',
  capNum:1,capTit:'Introdução',totalCaps:5,totalPags:15,capSubs:['Contextualização do Tema','Justificativa da Pesquisa','Objetivos da Investigação'],
  nivelKey:'licenciatura',areaKey:'edu',pNivel,pArea,geoCtx:{pais:'ANG'},palavras:600,subs,maxTok:3000,
  instrucaoSubtitulos:'Cada subtópico em capSubs DEVE aparecer como subtítulo numerado em linha própria.'
});
const systemJSON=`Gera APENAS um objeto JSON com este esquema EXACTO (sem markdown, sem texto adicional):
{"chapter_id":"1","title":"Introdução","total_paragraphs":7,"sections":[{"section_id":"1.1","title":"<subtítulo>","paragraphs":["<parágrafo 1>","<parágrafo 2>","<parágrafo 3>"]}]}
REGRAS:
- sections: UMA entrada por subtópico obrigatório do prompt do utilizador, na mesma ordem e numeração.
- paragraphs: 3-5 parágrafos completos (3-5 frases cada), texto corrido, sem markdown, sem bullets.
- Resposta DEVE ser exclusivamente esse objeto JSON.`;
console.log('=== PROMPT tamanho:',prompt.length,'chars ===');
const ini=Date.now();
const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+K},body:JSON.stringify({model:'openai/gpt-oss-120b',messages:[{role:'system',content:systemJSON},{role:'user',content:prompt}],temperature:0.65,max_tokens:3000,response_format:{type:'json_object'}})});
const txt=await r.text();
console.log('status:',r.status,'em',((Date.now()-ini)/1000).toFixed(1)+'s');
if(r.status===200){ const d=JSON.parse(txt); const c=d.choices?.[0]?.message?.content||''; console.log('chars:',c.length); console.log('PRIMEIROS 400:',c.substring(0,400)); try{ const j=JSON.parse(c.replace(/```(?:json)?\s*/gi,'').replace(/```/g,'')); console.log('sections:',j.sections?.length); const paras=j.sections?.reduce((a,s)=>a+(s.paragraphs||[]).length,0); console.log('paras:',paras); }catch{ console.log('NAO-JSON DIRETO'); } } else console.log(txt.substring(0,300));
