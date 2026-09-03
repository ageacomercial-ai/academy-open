/* academic/engines/claim-evidence-graph.js
   Claim-Evidence Architecture — Section 10 do Master Prompt
   CLAIM → EVIDENCE → SOURCE → CITATION → REFERENCE
   Implementa secções 10, 11, 22, 27
============================================================================= */

/* ═══════════════════════════════════════════════════════════
   CLAIM TYPES (Section 10)
═══════════════════════════════════════════════════════════ */
export const CLAIM_TYPES = {
  FACTUAL: { severity: 'HIGH', requires_source: true, requires_numeric: false },
  STATISTICAL: { severity: 'CRITICAL', requires_source: true, requires_numeric: true },
  HISTORICAL: { severity: 'HIGH', requires_source: true, requires_numeric: false },
  THEORETICAL: { severity: 'MEDIUM', requires_source: true, requires_numeric: false },
  EMPIRICAL: { severity: 'CRITICAL', requires_source: true, requires_numeric: true },
  INTERPRETATIVE: { severity: 'LOW', requires_source: false, requires_numeric: false },
  NORMATIVE: { severity: 'MEDIUM', requires_source: false, requires_numeric: false },
  COMMON_KNOWLEDGE: { severity: 'NONE', requires_source: false, requires_numeric: false },
};

/* ═══════════════════════════════════════════════════════════
   CLASSIFY CLAIM
═══════════════════════════════════════════════════════════ */
export function classificarClaim(texto) {
  const t = texto.toLowerCase();
  if (/\d+(?:[.,]\d+)?\s*%|\b\d{3,}\b|\b\d+(?:[.,]\d+)?\s*(toneladas|habitantes|pessoas|kz|usd|aoa)\b/.test(t))
    return 'STATISTICAL';
  if (/\b(causa|causado|leva a|resulta em|impacto|efeito|correlação)\b/.test(t))
    return 'CAUSAL';
  if (/\b(entrevistados|amostra|questionário|entrevista|observados|medidos|pesquisa de campo)\b/.test(t))
    return 'EMPIRICAL';
  if (/\b(em \d{4}|desde \d{4}|história|evolução|fundada em)\b/.test(t))
    return 'HISTORICAL';
  if (/\b(define-se|é definido|conceito de|entende-se por)\b/.test(t))
    return 'DEFINITIONAL';
  if (/\b(comparado|versus|maior que|menor que|diferença|superior|inferior)\b/.test(t))
    return 'COMPARATIVE';
  if (/\b(teoria|modelo|framework|abordagem|paradigma)\b/.test(t))
    return 'THEORETICAL';
  if (/\b(previsão|tendência|futuro|projeção|perspectiva)\b/.test(t))
    return 'PREDICTIVE';
  if (/\b(deve|deveria|é necessário|é fundamental|é essencial)\b/.test(t))
    return 'NORMATIVE';
  return 'INTERPRETATIVE';
}

/* ═══════════════════════════════════════════════════════════
   EXTRACT CLAIMS FROM TEXT
═══════════════════════════════════════════════════════════ */
export function extrairClaimsDeTexto(texto, capNum) {
  if (!texto || typeof texto !== 'string') return [];
  const frases = texto
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÜ])/)
    .filter(f => f.trim().length > 40);

  return frases.map((frase, i) => ({
    id: `cap${capNum}_claim_${i}`,
    text: frase.trim(),
    type: classificarClaim(frase),
    citation: extrairCitacaoClaim(frase),
    has_source: /\([A-ZÀ-Ü][^)]*\d{4}[^)]*\)/.test(frase),
    chapter: capNum,
    position: i,
  }));
}

function extrairCitacaoClaim(texto) {
  const match = texto.match(/\(([A-ZÀ-Ü][^)]*\d{4}[^)]*)\)/);
  return match ? match[1].trim() : null;
}

/* ═══════════════════════════════════════════════════════════
   BUILD CLAIM-EVIDENCE GRAPH
═══════════════════════════════════════════════════════════ */
export function construirGrafoClaimEvidence(capitulos) {
  const grafo = { nodes: [], edges: [], stats: {} };

  for (const cap of capitulos) {
    const texto = cap.c || cap.texto || '';
    const claims = extrairClaimsDeTexto(texto, cap.num || 1);
    grafo.nodes.push(...claims);

    // Ligação claim → citation
    for (const claim of claims) {
      if (claim.citation) {
        grafo.edges.push({
          from: claim.id,
          to: `ref_${claim.citation.substring(0, 20)}`,
          type: 'cites',
          citation_raw: claim.citation,
        });
      }
    }
  }

  // Estatísticas
  const totalClaims = grafo.nodes.length;
  const claimsComFonte = grafo.nodes.filter(n => n.has_source).length;
  const claimsSemFonte = grafo.nodes.filter(n => !n.has_source && ['STATISTICAL', 'EMPIRICAL', 'FACTUAL', 'HISTORICAL'].includes(n.type)).length;
  const claimsPorTipo = {};
  grafo.nodes.forEach(n => { claimsPorTipo[n.type] = (claimsPorTipo[n.type] || 0) + 1; });

  grafo.stats = {
    total: totalClaims,
    com_fonte: claimsComFonte,
    sem_fonte: claimsSemFonte,
    taxa_cobertura: totalClaims > 0 ? Math.round((claimsComFonte / totalClaims) * 100) : 0,
    por_tipo: claimsPorTipo,
    claims_que_exigem_fonte: grafo.nodes.filter(n => {
      const cfg = CLAIM_TYPES[n.type];
      return cfg && cfg.requires_source;
    }).length,
  };

  return grafo;
}

/* ═══════════════════════════════════════════════════════════
   REPETITION DETECTOR (Section 22)
═══════════════════════════════════════════════════════════ */
export function detetarRepeticao(capitulos) {
  const problemas = [];
  const aberturas = [];
  const frasesTodas = [];

  for (const cap of capitulos) {
    const texto = cap.c || cap.texto || '';
    const frases = texto.split(/(?<=[.!?])\s+/).filter(f => f.length > 20);
    frasesTodas.push(...frases);

    // 1. Aberturas repetidas
    frases.forEach(f => {
      const abertura = f.substring(0, 40).toLowerCase().trim();
      aberturas.push({ frase: f.substring(0, 80), cap: cap.num });
      const count = aberturas.filter(a => a.frase.substring(0, 40).toLowerCase().trim() === abertura).length;
      if (count >= 3) {
        problemas.push({
          type: 'REPEATED_OPENING',
          severity: 'HIGH',
          text: f.substring(0, 80),
          count,
          chapter: cap.num,
        });
      }
    });

    // 2. Transições repetidas
    const transicoes = ['além disso', 'por outro lado', 'em síntese', 'não obstante', 'desta forma', 'é importante destacar'];
    transicoes.forEach(t => {
      const regex = new RegExp(t, 'gi');
      const matches = texto.match(regex) || [];
      if (matches.length >= 3) {
        problemas.push({
          type: 'REPEATED_TRANSITION',
          severity: 'MEDIUM',
          text: t,
          count: matches.length,
          chapter: cap.num,
        });
      }
    });

    // 3. Claims repetidos
    const claims = texto.match(/\([A-ZÀ-Ü][^)]*\d{4}[^)]*\)/g) || [];
    const claimCounts = {};
    claims.forEach(c => {
      const key = c.replace(/\s+/g, ' ').trim();
      claimCounts[key] = (claimCounts[key] || 0) + 1;
    });
    Object.entries(claimCounts).forEach(([c, count]) => {
      if (count >= 3) {
        problemas.push({
          type: 'REPEATED_CLAIM',
          severity: 'HIGH',
          text: c,
          count,
          chapter: cap.num,
        });
      }
    });
  }

  // 4. Frases genéricas repetidas entre capítulos
  const genericas = ['a literatura indica', 'segundo dados', 'estudos mostram', 'pesquisas revelam', 'investigações apontam'];
  genericas.forEach(g => {
    const count = frasesTodas.filter(f => f.toLowerCase().includes(g)).length;
    if (count >= 4) {
      problemas.push({
        type: 'GENERIC_PHRASE',
        severity: 'MEDIUM',
        text: g,
        count,
        chapter: 'multiple',
      });
    }
  });

  return { problemas, total: problemas.length };
}

/* ═══════════════════════════════════════════════════════════
   ORPHAN DETECTOR — Citações ↔ Referências (Section 27)
═══════════════════════════════════════════════════════════ */
export function detetarOrfas(referencias, citacoesTexto) {
  const orfasTexto = [];   // citações no texto sem referência
  const orfasRef = [];      // referências sem citação no texto
  const duplicadas = [];

  // Normalizar referências
  const refsNormalizadas = referencias.map(r => ({
    raw: r,
    autor: (r.match(/^([A-ZÀ-Ü][^,]+)/) || [])[1]?.trim() || '',
    ano: (r.match(/\((\d{4})\)/) || [])[1] || '',
  }));

  // Normalizar citações
  const citacaoRegex = /([A-ZÀ-Ü][A-Za-zà-ÿ]+(?:\s+(?:et\s+al\.|&\s*[A-ZÀ-Ü][A-Za-zà-ÿ]*))?)\s*\((\d{4})[a-z]?\)/g;
  const citacoesEncontradas = [];
  let m;
  while ((m = citacaoRegex.exec(citacoesTexto)) !== null) {
    citacoesEncontradas.push({ autor: m[1].trim(), ano: m[2], raw: m[0] });
  }

  // Verificar citações → referências
  citacoesEncontradas.forEach(cit => {
    const encontrada = refsNormalizadas.some(ref =>
      ref.autor.toLowerCase().includes(cit.autor.toLowerCase().split(' ').pop()) &&
      ref.ano === cit.ano
    );
    if (!encontrada) orfasTexto.push(cit);
  });

  // Verificar referências → citações
  refsNormalizadas.forEach(ref => {
    const citada = citacoesEncontradas.some(cit =>
      ref.autor.toLowerCase().includes(cit.autor.toLowerCase().split(' ').pop()) &&
      ref.ano === cit.ano
    );
    if (!citada && ref.autor) orfasRef.push(ref);
  });

  // Verificar duplicadas
  const refsVistas = new Set();
  refsNormalizadas.forEach(ref => {
    const key = `${ref.autor.toLowerCase()}_${ref.ano}`;
    if (refsVistas.has(key)) duplicadas.push(ref);
    refsVistas.add(key);
  });

  return {
    orfasTexto,
    orfasRef,
    duplicadas,
    total: orfasTexto.length + orfasRef.length + duplicadas.length,
    taxaValidade: refsNormalizadas.length > 0
      ? Math.round(((refsNormalizadas.length - orfasRef.length) / refsNormalizadas.length) * 100)
      : 0,
  };
}
