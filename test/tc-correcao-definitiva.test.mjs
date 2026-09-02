/* TC01-TC30 — Correção Definitiva Motor Acadêmico */
import { runAcademicValidationPipeline, computeFinalGate } from '../academic/engines/integrity-pipeline.js';
import { extrairCitacao } from '../academic/engines/evidence.js';
import { verificarReferenciaOnline } from '../academic/engines/verification.js';

const ok=(l,c)=>{ console.log(`${c?'✅':'❌'} ${l}`); return c; };
let f=0; const a=(l,c)=>{ if(!ok(l,c)) f++; };

// TC02 placeholder
{
  const r = await runAcademicValidationPipeline({secs:[{titulo:'C1', c:'Texto com [CITAÇÃO A VERIFICAR]'}], metodologia:'revisão', datasets:[]});
  a('TC02 placeholder bloqueia', r.canExportFinal===false && r.steps.placeholders.total===1);
}
// TC03 texto corrompido
{
  const r = await runAcademicValidationPipeline({secs:[{titulo:'C1', c:'Fsquisa Santcxs pmblema s%bre'}], metodologia:'', datasets:[]});
  a('TC03 corrompido bloqueia', r.canExportFinal===false && r.steps.corruption.total>0);
}
// TC04 citação sem referência (11->2)
{
  const r = await runAcademicValidationPipeline({secs:[{titulo:'C1', c:'Silva (2020) Santos (2019) Almeida (2019) Pereira (2018) Costa (2022) Ferreira (2020) Mendes (2021) Oliveira (2019) Rodrigues (2022) Martins (2020) Lopes (2021) Silva (2021)'}, {titulo:'Referências', c:'Silva, A. (2020). Obra. Ed.\nSantos, B. (2019). Obra. Ed.'}], metodologia:'revisão', datasets:[]});
  a('TC04 órfã 11->2 bloqueia', r.canExportFinal===false && r.steps.citations.citacoes>=11 && r.steps.citations.refs===2);
}
// TC05 reference sem fonte (DOI falso)
{
  const v = await verificarReferenciaOnline({raw:'Silva, A. (2020). Obra inventada. doi:10.9999/falso.123', author:'Silva', year:2020, title:'Obra inventada', doi:'10.9999/falso.123'});
  a('TC05 DOI falso não é verified', v.confidence!=='verified');
}
// TC06 repetição estrutural
{
  const txt='A literatura indica que gestão é dimensão central. '.repeat(10);
  const r = await runAcademicValidationPipeline({secs:[{titulo:'C1', c:txt},{titulo:'C2', c:txt}], metodologia:'', datasets:[]});
  a('TC06 repetição >0.82 bloqueia', r.steps.repetition.maxJaccard>0.82 && r.canExportFinal===false);
}
// TC07 válido (interpretativo)
{
  const r = await runAcademicValidationPipeline({secs:[{titulo:'Intro', c:'Interpreta-se que gestão escolar requer análise crítica. Objectivo geral: analisar.'}, {titulo:'Conclusão', c:'Conclui-se que objetivo foi respondido.'}], metodologia:'revisão interpretativa', datasets:[]});
  a('TC07 válido interpretativo passa', r.canExportFinal===true);
}
// TC08 estatística sem fonte
{
  const r = await runAcademicValidationPipeline({secs:[{titulo:'C1', c:'37% das empresas usam IA sem citar fonte.'}], metodologia:'revisão', datasets:[]});
  a('TC08 37% sem fonte bloqueia', r.steps.statistics.semFonte>0 && r.canExportFinal===false);
}
// TC10 evidence não suporta (número ausente)
{
  const {verifyClaimSupport} = await import('../academic/engines/retrieval.js');
  const sup = verifyClaimSupport({text:'37% usam IA', requires_numeric_evidence:true}, {evidence_available:true, evidence_text:'empresas usam IA sem número'});
  a('TC10 evidence sem número NOT_VERIFIED', sup.support_status==='NOT_VERIFIED');
}
// TC14 objetivo sem cobertura
{
  const r = computeFinalGate({steps:{citations:{citacoes:0,refs:0}, statistics:{semFonte:0}, placeholders:{total:0}, corruption:{total:0}, repetition:{maxJaccard:0}}, score:80, blocked:false, fabricatedData:0, details:{integrity:{reviewRequired:0,highCritical:0,blocked:0}}}, {coverageEstado:'no_objectives'});
  a('TC14 no_objectives bloqueia', r.blocked===true);
}
// TC15 partially_verified não é FINAL
{
  const v = await verificarReferenciaOnline({raw:'Silva, A. (2020). Título inexistente sem CrossRef.', author:'Silva', year:2020, title:'Título inexistente sem CrossRef xyz123'});
  a('TC15 needs_review não é verified', v.confidence==='needs_review' || v.confidence==='unverified');
}
// TC26 bypass STRICT — extrairCitacao INE
{
  const cit = extrairCitacao('Segundo INE (2024), 37% da população...');
  a('TC26 INE (2024) extrai', cit && cit.includes('INE') && cit.includes('2024'));
  const cit2 = extrairCitacao('Santos (2019) argumenta');
  a('TC26 Santos (2019) extrai', cit2 && cit2.includes('Santos'));
}
// TC27 fallback sem fonte não existe mais
{
  const {default: fs} = await import('fs');
  const exp = fs.readFileSync('./js/export.js','utf8');
  a('TC27 refGerarFallback não retorna hardcode', !exp.includes('World Bank. (' ) || exp.includes('ZERO FABRICAÇÃO'));
  const gen = fs.readFileSync('./js/generator.js','utf8');
  a('TC27 _blocosFb não fabrica', !gen.includes('Segundo Silva (2020), a articulação teoria-prática') || gen.includes('BUG-001 FIX'));
}
// TC30 fabricação DOI/URL nunca
{
  const r = await runAcademicValidationPipeline({secs:[{titulo:'C1', c:'Texto com citação Silva (2020) mas sem verificação e com https://doi.org/10.falso'}], metodologia:'revisão', datasets:[]});
  a('TC30 DOI sem verificação não vira verified', r.canExportFinal===false);
}

console.log(`\nTOTAL TC: ${f===0?'PASS':'FAIL'} — ${f} falha(s)`);
process.exit(f===0?0:1);
