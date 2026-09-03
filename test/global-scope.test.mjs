import { determinarEscopo, PLATFORM_SCOPE } from '../academic/policies/scope.js';
import { detectarContextoGeo, gerarInstrucaoGeo } from '../academic/prompts/system.js';
import { montarPromptCapitulo } from '../academic/prompts/chapters.js';
import { PERFIL_NIVEL, PERFIL_AREA } from '../academic/prompts/system.js';

const ok = (label, cond, extra='') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ' — '+extra : ''}`);
  return cond;
};
let fails=0;
const assert=(l,c,e)=>{ if(!ok(l,c,e)) fails++; };

console.log(`PLATFORM_SCOPE=${PLATFORM_SCOPE}\n`);
assert('G0: PLATFORM_SCOPE deve ser GLOBAL', PLATFORM_SCOPE==='GLOBAL');

// G1: global
{
  const e = determinarEscopo({ tema: 'Impacto da inteligência artificial no mercado de trabalho' });
  assert('G1: tema global → global_scope true', e.global_scope===true, JSON.stringify(e));
  assert('G1: geographic_scope vazio', e.geographic_scope.length===0);
  assert('G1: geoCtx global', e.geoCtx==='global');
  const geo = gerarInstrucaoGeo('Impacto da inteligência artificial no mercado de trabalho');
  assert('G1: instrução não menciona Angola', !/angola/i.test(geo) || /NUNCA.*Angola/.test(geo));
}

// G2: Brasil
{
  const e = determinarEscopo({ tema: 'Empreendedorismo digital no Brasil' });
  assert('G2: Brasil → geographic_scope inclui brasil', e.geographic_scope.includes('brasil'), JSON.stringify(e.geographic_scope));
  assert('G2: global_scope pode ser false ou ter foco', e.geographic_scope.length>0);
  // fontes internacionais permitidas → instrução menciona internacionais
  const geo = gerarInstrucaoGeo('Empreendedorismo digital no Brasil');
  assert('G2: Brasil usa fontes brasileiras + internacionais', /brasileiras.*internacionais/i.test(geo));
}

// G3: Angola
{
  const e = determinarEscopo({ tema: 'Negócios digitais em Angola' });
  assert('G3: Angola → geographic_scope inclui angola', e.geographic_scope.includes('angola'));
  const geo = gerarInstrucaoGeo('Negócios digitais em Angola');
  assert('G3: Angola aceita internacionais', /angolanas.*internacionais/i.test(geo));
}

// G4: Global com usuário Angola (não deve injetar)
{
  const e = determinarEscopo({ tema: 'Impacto da inteligência artificial no mercado de trabalho' });
  // simula usuário em Angola mas tema global → não deve virar angola
  const ctx = detectarContextoGeo('Impacto da inteligência artificial no mercado de trabalho', 'angola');
  assert('G4: usuário Angola + tema global → ctx global (não angola)', ctx==='global', `ctx=${ctx}`);
  assert('G4: determinarEscopo ignora usuário', e.geographic_scope.length===0);
}

// G5: EUA não deve virar Angola
{
  const ctx = detectarContextoGeo('Market analysis in the USA', 'angola');
  assert('G5: tema EUA → eua, não angola', ctx==='eua', `ctx=${ctx}`);
  const e = determinarEscopo({ tema: 'Market analysis in the USA' });
  assert('G5: geographic_scope inclui eua', e.geographic_scope.includes('eua'));
}

// G6: Global permite internacionais sem autor angolano
{
  const p = montarPromptCapitulo({
    tema: 'Impacto da inteligência artificial no mercado de trabalho', tipo:'Artigo', nivel:'licenciatura', inst:'', prof:'', area:'',
    capNum:1, capTit:'Introdução', totalCaps:5, totalPags:15, capSubs:['Contexto'], nivelKey:'licenciatura', areaKey:'gestao', pNivel:PERFIL_NIVEL['licenciatura'], pArea:PERFIL_AREA['gestao'], geoCtx:'global',
    palavras:300, subs:'1.1 Contexto', maxTok:6000, instrucaoSubtitulos:''
  });
  assert('G6: prompt global contém PLATFORM_SCOPE=GLOBAL', /PLATFORM_SCOPE=GLOBAL/.test(p));
  assert('G6: prompt global não força autor angolano', !/force.*angolano/i.test(p));
  assert('G6: prompt global menciona literatura internacional', /internacional/i.test(p));
}

// BUG específico: Almeida (2021) etc sem verificação → NOT_VERIFIED
{
  const p = montarPromptCapitulo({
    tema: 'O conceito de negócios digitais tem evoluído...', tipo:'Artigo', nivel:'licenciatura', inst:'', prof:'', area:'',
    capNum:2, capTit:'Desenvolvimento', totalCaps:5, totalPags:15, capSubs:['Conceito'], nivelKey:'licenciatura', areaKey:'gestao', pNivel:PERFIL_NIVEL['licenciatura'], pArea:PERFIL_AREA['gestao'], geoCtx:'global',
    palavras:300, subs:'2.1 Conceito', maxTok:6000, instrucaoSubtitulos:''
  });
  assert('BUG: prompt contém STRICT não invente', /Nunca invente.*DOI/i.test(p) || /NUNCA.*invente/i.test(p));
}

console.log(`\n${fails===0 ? '✅ TODOS G1-G6 PASSARAM' : `❌ ${fails} falha(s)`}`);
process.exit(fails===0?0:1);
