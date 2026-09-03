import { extractEvidence, verifyClaimSupport, retrieveSource } from '../academic/engines/retrieval.js';
const ok=(l,c,e='')=>{console.log(`${c?'✅':'❌'} ${l}${e?' — '+e:''}`); return c;};
let f=0; const a=(l,c,e)=>{ if(!ok(l,c,e)) f++; };

// E1: claim com % extraído
{
  const ev = extractEvidence({ abstract: 'A adoção aumentou 37% na amostra de 2022, conforme estudo.' }, { text: 'A adoção aumentou 37%.' });
  a('E1: evidência com número', ev.evidence_available && ev.confidence>0.5);
}

// E2: sem evidência
{
  const ev = extractEvidence({ abstract: null }, { text: 'Claim qualquer' });
  a('E2: sem abstract → não disponível', ev.evidence_available===false && ev.page===null);
}

// E3: page nunca inventado
{
  const ev = extractEvidence({ abstract: 'Abstract curto' }, { text: 'Claim' });
  a('E3: page null', ev.page===null && ev.section===null);
}

// E4: suporte direto
{
  const s = verifyClaimSupport({ text: 'A digitalização estimula inovação.' }, { evidence_text: 'A digitalização estimula inovação empresarial.', evidence_available: true });
  a('E4: direto', s.support_status==='DIRECTLY_SUPPORTS');
}

// E5: suporte parcial
{
  const s = verifyClaimSupport({ text: 'A digitalização estimula inovação global.' }, { evidence_text: 'A digitalização pode estimular inovação em alguns contextos.', evidence_available: true });
  a('E5: parcial', s.support_status==='PARTIALLY_SUPPORTS' || s.support_status==='DIRECTLY_SUPPORTS');
}

// E6: não sustenta
{
  const s = verifyClaimSupport({ text: 'Luanda produz 3.000 toneladas.' }, { evidence_text: 'Turismo em Portugal.', evidence_available: true });
  a('E6: não sustenta', s.support_status==='DOES_NOT_SUPPORT' || s.support_status==='NOT_VERIFIED');
}

// E7: número sem evidência
{
  const s = verifyClaimSupport({ text: 'A adoção aumentou 37% (n=100).', requires_numeric_evidence: true }, { evidence_text: 'Estudo qualitativo sem números.', evidence_available: true });
  a('E7: número sem evidência → NOT_VERIFIED', s.support_status==='NOT_VERIFIED');
}

console.log(`\n${f===0?'✅ EVIDENCE TESTS PASSARAM':`❌ ${f} falha(s)`}`);
process.exit(f===0?0:1);
