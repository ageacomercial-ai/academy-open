/* academic/policies/coverage.js
   Matching entre objectivos específicos, capítulos e conclusão
   Detecta objectivos órfãos, capítulos sem objectivo, conclusão incompleta
============================================================================= */

/* ── Analisar cobertura objectivo ↔ capítulo ── */
export function analisarCobertura(doc) {
  const objectives = doc.diagnostic?.specificObjectives || [];
  const chapters   = doc.chapters || [];
  const conclusion = chapters.find(c => /conclus[ãa]o/i.test(c.title || ''));
  const conclusionText = conclusion
    ? (conclusion.sections || []).map(s => (s.paragraphs || []).join(' ')).join(' ')
    : '';

  if (objectives.length === 0) {
    return {
      cobertura: [],
      totalObjectives: 0,
      totalChapters: chapters.length,
      orfaos: [],
      estado: 'no_objectives',
      relatorio: 'Nenhum objectivo específico definido.',
    };
  }

  const cobertura = objectives.map((obj, idx) => {
    const objLower = obj.toLowerCase();
    const palavrasObj = extrairPalavrasChave(objLower);

    /* Encontrar capítulos que mencionam este objectivo */
    const matchingChapters = chapters
      .map((cap, cIdx) => {
        const capLower = (cap.title || '').toLowerCase();
        const capText = (cap.sections || [])
          .map(s => (s.paragraphs || []).join(' ')).join(' ')
          .toLowerCase();
        const score = calcularMatch(palavrasObj, capLower + ' ' + capText);
        return { chapterIdx: cIdx, title: cap.title, score };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);

    /* Verificar se a conclusão responde ao objectivo */
    const respondidoNaConclusao = conclusionText
      ? calcularMatch(palavrasObj, conclusionText.toLowerCase()) > 1
      : false;

    return {
      objectiveIdx: idx,
      objective:    obj,
      matchingChapters: matchingChapters.slice(0, 3),
      respondidoNaConclusao,
      coberto: matchingChapters.length > 0,
      score:    matchingChapters.reduce((a, m) => a + m.score, 0),
    };
  });

  const orfaos = cobertura.filter(c => !c.coberto);
  const naoRespondidos = cobertura.filter(c => !c.respondidoNaConclusao);

  let estado = 'completo';
  if (orfaos.length > 0 && naoRespondidos.length > 0) estado = 'incompleto';
  else if (orfaos.length > 0) estado = 'objectivos_orfaos';
  else if (naoRespondidos.length > 0) estado = 'conclusao_incompleta';

  /* Detecta capítulos sem nenhum objectivo associado */
  const chaptersWithScores = chapters.map((cap, cIdx) => {
    const matchCount = cobertura.filter(c =>
      c.matchingChapters.some(m => m.chapterIdx === cIdx)
    ).length;
    return { chapterIdx: cIdx, title: cap.title, matched: matchCount > 0 };
  });
  const orfaosCapitulos = chaptersWithScores.filter(c => !c.matched && !/conclus[ãa]o|referencia/i.test(c.title || ''));

  return {
    cobertura,
    totalObjectives: objectives.length,
    totalChapters: chapters.length,
    orfaos,
    naoRespondidos,
    orfaosCapitulos,
    estado,
    relatorio: gerarRelatorioCobertura(cobertura, orfaos, naoRespondidos, orfaosCapitulos),
  };
}

/* ── Extrair palavras-chave de um objectivo ── */
function extrairPalavrasChave(texto) {
  const stopwords = ['o', 'a', 'os', 'as', 'de', 'da', 'do', 'dos', 'das',
    'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'sem',
    'um', 'uma', 'uns', 'umas', 'e', 'ou', 'mas', 'que', 'se',
    'como', 'mais', 'ao', 'aos', 'à', 'às', 'pelo', 'pela',
    'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
    'aquele', 'aquela', 'aqueles', 'aquelas', 'seu', 'sua', 'seus', 'suas',
    'analisar', 'identificar', 'avaliar', 'investigar', 'compreender',
    'descrever', 'caracterizar', 'verificar', 'demonstrar', 'discutir',
  ];
  return texto
    .replace(/[^\w\sà-üÀ-Üãç]/g, '')
    .split(/\s+/)
    .filter(p => p.length > 2 && !stopwords.includes(p));
}

/* ── Calcular match entre palavras-chave e texto ── */
function calcularMatch(palavras, texto) {
  let score = 0;
  for (const p of palavras) {
    const regex = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    const matches = texto.match(regex);
    if (matches) {
      score += matches.length;
    }
  }
  return score;
}

/* ── Gerar relatório legível de cobertura ── */
function gerarRelatorioCobertura(cobertura, orfaos, naoRespondidos, orfaosCapitulos) {
  const linhas = [];

  for (const c of cobertura) {
    const objLabel = c.objective.substring(0, 80);
    const caps = c.matchingChapters.map(m =>
      `Capítulo ${m.chapterIdx + 1} "${(m.title || '').substring(0, 30)}" (score: ${m.score})`
    ).join(', ');
    const concl = c.respondidoNaConclusao ? '✓' : '✗';
    linhas.push(`Objectivo ${c.objectiveIdx + 1} "${objLabel}":`);
    linhas.push(`  Capítulos: ${caps || '(nenhum)'}`);
    linhas.push(`  Conclusão: ${concl}`);
  }

  if (orfaos.length > 0) {
    linhas.push(`\n⚠ ${orfaos.length} objectivo(s) órfão(s):`);
    for (const o of orfaos) {
      linhas.push(`  ✗ "${o.objective.substring(0, 80)}"`);
    }
  }

  if (naoRespondidos.length > 0) {
    linhas.push(`\n⚠ ${naoRespondidos.length} objectivo(s) não respondido(s) na conclusão:`);
    for (const n of naoRespondidos) {
      linhas.push(`  ✗ "${n.objective.substring(0, 80)}"`);
    }
  }

  if (orfaosCapitulos.length > 0) {
    linhas.push(`\n⚠ ${orfaosCapitulos.length} capítulo(s) sem objectivo associado:`);
    for (const c of orfaosCapitulos) {
      linhas.push(`  ✗ "${c.title}"`);
    }
  }

  return linhas.join('\n');
}
