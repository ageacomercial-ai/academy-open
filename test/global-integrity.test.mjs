import { runAcademicValidationPipeline } from '../academic/engines/integrity-pipeline.js';
const ok=(l,c,e='')=>{console.log(`${c?'✅':'❌'} ${l}${e?' — '+e:''}`); return c;};
let f=0; const a=(l,c,e)=>{ if(!ok(l,c,e)) f++; };

// GI1: global não bloqueia sem fabricados
{
  const r = await runAcademicValidationPipeline({ secs: [{ titulo: 'Cap 1', c: 'Revisão com Silva (2020).' }, { titulo: 'Referências', c: 'Silva, A. (2020). Obra. Editora.' }], metodologia: 'revisão bibliográfica', datasets: [] });
  a('GI1: global limpo não bloqueia', r.blocked===false);
}

// GI2: fabricado bloqueia
{
  const r = await runAcademicValidationPipeline({ secs: [{ titulo: 'Resultados', c: '100 participantes, 60% homens, média 4.5' }], metodologia: 'pesquisa com 100 participantes', datasets: [] });
  a('GI2: fabricado bloqueia', r.blocked===true && r.fabricatedData>0);
}

// GI3: DRAFT vs FINAL
{
  const r1 = await runAcademicValidationPipeline({ secs: [{ titulo: 'Cap 1', c: 'Texto simples.' }], metodologia: 'revisão', datasets: [] });
  const r2 = await runAcademicValidationPipeline({ secs: [{ titulo: 'Resultados', c: '62% dos 100 entrevistados...' }], metodologia: 'n=100', datasets: [] });
  a('GI3: DRAFT quando bloqueado', r2.blocked===true);
  a('GI3: score fabricado <40', r2.score<40);
  a('GI3: score limpo não bloqueado', r1.blocked===false);
}

console.log(`\n${f===0?'✅ GLOBAL INTEGRITY PASSOU':`❌ ${f} falha(s)`}`);
process.exit(f===0?0:1);
