/* academic/engines/content-density.js
   Content Density Engine — paginas 350-650, VERY_EMPTY..VERY_DENSE + paragraph/section balance
   Secções 4-7, 10, 19 da missão
============================================================================= */

export const DENSIDADE_FAIXAS = {
  VERY_EMPTY: { max: 249, label:'VERY_EMPTY' },
  EMPTY: { min:250, max:349, label:'EMPTY' },
  BALANCED: { min:350, max:649, label:'BALANCED' },
  DENSE: { min:650, max:799, label:'DENSE' },
  VERY_DENSE: { min:800, label:'VERY_DENSE' },
};

export function classificarPagina(palavras, { headings=0, tables=0, figures=0, citations=0 }={}) {
  // Ajuste heurístico: tabela/figura importante compensa menos palavras
  let ajustada = palavras;
  if (tables>0 || figures>0) ajustada += 120;
  if (headings>1) ajustada -= 30;
  if (ajustada < 250) return 'VERY_EMPTY';
  if (ajustada < 350) return 'EMPTY';
  if (ajustada <= 649) return 'BALANCED';
  if (ajustada <= 799) return 'DENSE';
  return 'VERY_DENSE';
}

export function classificarParagrafo(texto) {
  const palavras = texto.split(/\s+/).filter(Boolean).length;
  if (palavras < 50) return { tipo:'CURTO', palavras, status: palavras<20?'VERY_SHORT':'SHORT' };
  if (palavras <= 150) return { tipo:'NORMAL', palavras, status:'OK' };
  if (palavras <= 200) return { tipo:'DESENVOLVIDO', palavras, status:'OK' };
  return { tipo:'LONGO', palavras, status: palavras>250?'VERY_LONG':'OK' };
}

export function analisarDensidadePaginas(paginas) {
  // paginas: [{numero, palavras, headings, tables, figures, paragraphs}]
  return paginas.map(p=>({
    ...p,
    densidade: classificarPagina(p.palavras, p),
    problemas: detectarProblemasPagina(p),
  }));
}

function detectarProblemasPagina(p) {
  const probs=[];
  const dens = classificarPagina(p.palavras, p);
  if (dens==='VERY_EMPTY') probs.push('VERY_EMPTY_PAGE');
  if (dens==='VERY_DENSE') probs.push('VERY_DENSE_PAGE');
  if (p.headings>0 && p.paragraphs===0) probs.push('ORPHAN_HEADING');
  if (p.paragraphs===1 && p.palavras<30) probs.push('ORPHAN_PARAGRAPH');
  if (p.palavras>800) probs.push('EXCESSIVE_DENSE');
  return probs;
}

export function detectarDesequilibrioSecoes(secoes) {
  // secoes: [{titulo, paragrafos: [texto]}]
  const counts = secoes.map(s=>s.paragrafos.length);
  if (!counts.length) return { isBalanced:true };
  const media = counts.reduce((a,b)=>a+b,0)/counts.length;
  const desvio = counts.map(c=>Math.abs(c-media));
  const maxDesvio = Math.max(...desvio);
  return {
    media: Math.round(media*10)/10,
    maxDesvio: Math.round(maxDesvio*10)/10,
    isBalanced: maxDesvio < 3,
    detalhes: secoes.map((s,i)=>({ titulo:s.titulo, paras:counts[i]})),
  };
}

export function detectarRepeticao(paragrafos) {
  // paragrafos: [texto]
  const openings = paragrafos.map(p=>p.trim().split(/\s+/).slice(0,3).join(' ').toLowerCase());
  const counts={}; openings.forEach(o=>counts[o]=(counts[o]||0)+1);
  const repetidos = Object.entries(counts).filter(([,c])=>c>2).map(([o,c])=>({ abertura:o, vezes:c}));
  // similaridade Jaccard entre paragrafos
  let maxSim=0;
  for(let i=0;i<paragrafos.length;i++) for(let j=i+1;j<paragrafos.length;j++){
    const a=new Set(paragrafos[i].toLowerCase().split(/\W+/).filter(w=>w.length>4));
    const b=new Set(paragrafos[j].toLowerCase().split(/\W+/).filter(w=>w.length>4));
    const inter=[...a].filter(x=>b.has(x)).length; const uni=new Set([...a,...b]).size;
    const sim=uni?inter/uni:0; if(sim>maxSim) maxSim=sim;
  }
  return { repetidos, maxJaccard: Math.round(maxSim*100)/100, hasRepetition: repetidos.length>0 || maxSim>0.82 };
}

export function validarEstruturaInternaParagrafo(texto) {
  // CLAIM → EXPLICAÇÃO → EVIDÊNCIA → INTERPRETAÇÃO → CONEXÃO (heurística)
  const temClaim = /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÜ]/.test(texto);
  const temEvidencia = /\(.*\d{4}.*\)|Fonte:|Segundo/.test(texto);
  const temInterpretacao = /portanto|assim|conclui|interpreta|significa/.test(texto.toLowerCase());
  const score = (temClaim?1:0)+(temEvidencia?1:0)+(temInterpretacao?1:0);
  return { temClaim, temEvidencia, temInterpretacao, score, isValid: score>=2 };
}
