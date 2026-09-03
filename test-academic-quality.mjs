import { montarPromptCapitulo, montarPromptRetry } from './academic/prompts/chapters.js';
import { gerarInstrucaoAntiIA, PERFIL_NIVEL, PERFIL_AREA } from './academic/prompts/system.js';
import { montarPromptReferencias } from './academic/prompts/references.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

let falhas = 0;
const ok = (label, cond, extra='') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) falhas++;
};

// ── 1. PBE: verificar PBE.PALAVRAS_MIN_CAP = 300 ──
console.log('\n── PBE ──');
{
  const txt = fs.readFileSync(path.join(ROOT,'js/pbe.js'),'utf8');
  const m = txt.match(/PALAVRAS_MIN_CAP:\s*(\d+)/);
  ok('PALAVRAS_MIN_CAP = 300', m && parseInt(m[1]) === 300, m ? m[1] : 'não encontrado');
  ok('piso mínimo garantido 200', /Math\.max\(\s*200,\s*Math\.min/.test(txt));
}

// ── 2. Backend engine: mínimo 300 palavras ──
console.log('\n── Backend engine.js ──');
{
  const txt = fs.readFileSync(path.join(ROOT,'api/engine.js'),'utf8');
  const count300 = (txt.match(/Math\.max\(parseInt\(p\.palavrasPorCap\)\|\|palavrasCalc,\s*300\)/g) || []).length;
  ok('doCapitulo mínimo 300 palavras', count300 >= 1, `ocorrências: ${count300}`);
  ok('systemJSON 4-6 parágrafos', txt.includes('4-6 parágrafos completos'));
  ok('systemJSON palavras/80', txt.includes('palavras / 80'));
  ok('Quality gate 6-12 parágrafos', txt.includes('Math.max(6, Math.min(12'));
  ok('Readiness 8-18 parágrafos', txt.includes("'ensino médio': 8"));
}

// ── 3. montarPromptCapitulo ──
console.log('\n── montarPromptCapitulo ──');
{
  const p1 = montarPromptCapitulo({
    tema: 'Gestão de turismo em Angola', tipo: 'Monografia', nivel: 'licenciatura',
    inst: 'UAN', prof: 'Dr. Silva', area: 'gestão',
    capNum: 1, capTit: 'Introdução', totalCaps: 5, totalPags: 15,
    capSubs: ['Contextualização','Problema','Objetivos'], nivelKey: 'licenciatura', areaKey: 'gestao',
    pNivel: PERFIL_NIVEL['licenciatura'], pArea: PERFIL_AREA['gestao'], geoCtx: 'angola',
    palavras: 400, subs: '1.1 Contextualização\n1.2 Problema\n1.3 Objetivos', maxTok: 6000, instrucaoSubtitulos: ''
  });
  ok('Cap 1 contém Problema de pesquisa', /Problema de pesquisa/.test(p1));
  ok('Cap 1 contém Objectivos', /Objectivos geral/.test(p1));
  ok('Cap 1 contém Metodologia', /Metodologia/.test(p1));
  ok('Cap 1 contém 2 citações por parágrafo', /2 citações/.test(p1));

  const p3 = montarPromptCapitulo({
    tema: 'Gestão de turismo em Angola', tipo: 'Monografia', nivel: 'licenciatura',
    inst: '', prof: '', area: '',
    capNum: 3, capTit: 'Desenvolvimento', totalCaps: 5, totalPags: 15,
    capSubs: ['Análise','Discussão'], nivelKey: 'licenciatura', areaKey: 'gestao',
    pNivel: PERFIL_NIVEL['licenciatura'], pArea: PERFIL_AREA['gestao'], geoCtx: 'global',
    palavras: 400, subs: '3.1 Análise\n3.2 Discussão', maxTok: 6000, instrucaoSubtitulos: ''
  });
  ok('Cap intermédio contém análise crítica', /Análise crítica/.test(p3) || /Comparação de perspectivas/.test(p3));

  const p5 = montarPromptCapitulo({
    tema: 'Gestão de turismo em Angola', tipo: 'Monografia', nivel: 'licenciatura',
    inst: '', prof: '', area: '',
    capNum: 5, capTit: 'Conclusão', totalCaps: 5, totalPags: 15,
    capSubs: ['Síntese','Recomendações'], nivelKey: 'licenciatura', areaKey: 'gestao',
    pNivel: PERFIL_NIVEL['licenciatura'], pArea: PERFIL_AREA['gestao'], geoCtx: 'global',
    palavras: 400, subs: '5.1 Síntese\n5.2 Recomendações', maxTok: 6000, instrucaoSubtitulos: ''
  });
  ok('Último cap contém Síntese', /Síntese/.test(p5));
  ok('Último cap contém Recomendações', /Recomendações/.test(p5));
}

// ── 4. montarPromptRetry ──
console.log('\n── montarPromptRetry ──');
{
  const r = montarPromptRetry(2, 'Teste', 'Tema X', ['Sub 1','Sub 2'], 500);
  ok('Retry 4-6 parágrafos', /4 parágrafos/.test(r) && /80-150 palavras/.test(r));
  ok('Retry 80-150 palavras', /80-150 palavras/.test(r));
}

// ── 5. gerarInstrucaoAntiIA ──
console.log('\n── gerarInstrucaoAntiIA ──');
{
  const instr = gerarInstrucaoAntiIA(2, 5, 'global', 'Gestão e Economia');
  ok('Anti-IA tem 20 regras', (instr.match(/\n\d+\./g) || []).length >= 18, `${(instr.match(/\n\d+\./g) || []).length} regras`);
  ok('Anti-IA proíbe actualidade', /actualmente/.test(instr));
  ok('Anti-IA proíbe vocabulário IA', /multifacetado/.test(instr));
  ok('Anti-IA usa pAreaLabel', /Gestão e Economia/.test(instr));
}

// ── 6. Referências ──
console.log('\n── montarPromptReferencias ──');
{
  const ref = montarPromptReferencias({ tema: 'Turismo', tipo: 'Monografia', nivel: 'licenciatura', area: 'gestao', totalPags: 15, autoresCitados: [{autor:'Santos', ano:'2020'}] });
  ok('Referências numRefs calculado', ref.numRefs >= 9 && ref.numRefs <= 18, `numRefs=${ref.numRefs}`);
  ok('Referências contém autores citados', ref.promptPadrao(false).includes('Santos (2020)'));
}

// ── 7. Service Worker ──
console.log('\n── Service Worker ──');
{
  const txt = fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  ok('Cache academy-v106', txt.includes('academy-v106'));
  ok('academic-ui.js no cache', txt.includes('academic-ui.js'));
}

// ── 8. verificarQualidadeAcademica limiares ──
console.log('\n── verificarQualidadeAcademica ──');
{
  const txt = fs.readFileSync(path.join(ROOT,'js/generator.js'),'utf8');
  ok('Limite capítulo 150 palavras', txt.includes("palavras < 150"));
  ok('Recomendado 300 palavras', txt.includes("palavras < 300"));
  ok('Conclusão 100 palavras', txt.includes("concPalavras < 100"));
  ok('Verifica dados quantitativos', txt.includes("dadosQuantitativos"));
  ok('Verifica vocabulário IA', txt.includes("vocabularioIA"));
}

console.log(`\n═══════════ RESULTADO: ${falhas === 0 ? 'TODOS PASSARAM ✅' : falhas + ' falha(s) ❌'} ═══════════`);
process.exit(falhas === 0 ? 0 : 1);
