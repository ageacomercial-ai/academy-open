/* academic/engines/quality-gate.js
   QUALITY GATE MULTIDIMENSIONAL — Sections 32-34 do Master Prompt
   can_export_final = SCORE≥60 AND no_critical_errors
   Score: STRUCTURE 20% + CONTENT 20% + EVIDENCE 20% + ARGUMENTATION 15% + COVERAGE 10% + CITATIONS 5% + WRITING 5% + LAYOUT 5%
============================================================================= */

/* ═══════════════════════════════════════════════════════════
   SCORE DIMENSIONS (Section 33)
═══════════════════════════════════════════════════════════ */
const DIMENSOES = {
  STRUCTURE:          { peso: 0.20, label: 'Estrutura' },
  ACADEMIC_CONTENT:   { peso: 0.20, label: 'Conteúdo Académico' },
  EVIDENCE:           { peso: 0.20, label: 'Evidência' },
  ARGUMENTATION:      { peso: 0.15, label: 'Argumentação' },
  OBJECTIVE_COVERAGE: { peso: 0.10, label: 'Cobertura de Objetivos' },
  CITATIONS_REFS:     { peso: 0.05, label: 'Citações/Referências' },
  WRITING:            { peso: 0.05, label: 'Escrita' },
  DOCUMENT_LAYOUT:    { peso: 0.05, label: 'Layout' },
};

/* ═══════════════════════════════════════════════════════════
   QUALITY GATE — Decisão Central (Section 32)
═══════════════════════════════════════════════════════════ */
export function executarQualityGate({
  capitulos, referencias, grafoClaimEvidence, repeticao, orfas,
  documentPlan, objetivo, totalPags,
}) {
  const scores = {};
  const errosCriticos = [];
  const avisos = [];

  // ── 1. STRUCTURE (20%) ──
  const estrutura = avaliarEstrutura(capitulos, documentPlan);
  scores.STRUCTURE = estrutura.score;
  if (estrutura.erros.length) errosCriticos.push(...estrutura.erros);
  if (estrutura.avisos.length) avisos.push(...estrutura.avisos);

  // ── 2. ACADEMIC_CONTENT (20%) ──
  const conteudo = avaliarConteudoAcademico(capitulos);
  scores.ACADEMIC_CONTENT = conteudo.score;
  if (conteudo.erros.length) errosCriticos.push(...conteudo.erros);
  if (conteudo.avisos.length) avisos.push(...conteudo.avisos);

  // ── 3. EVIDENCE (20%) ──
  const evidencia = avaliarEvidencia(grafoClaimEvidence);
  scores.EVIDENCE = evidencia.score;
  if (evidencia.erros.length) errosCriticos.push(...evidencia.erros);
  if (evidencia.avisos.length) avisos.push(...evidencia.avisos);

  // ── 4. ARGUMENTATION (15%) ──
  const argumentacao = avaliarArgumentacao(capitulos);
  scores.ARGUMENTATION = argumentacao.score;
  if (argumentacao.erros.length) errosCriticos.push(...argumentacao.erros);
  if (argumentacao.avisos.length) avisos.push(...argumentacao.avisos);

  // ── 5. OBJECTIVE_COVERAGE (10%) ──
  const cobertura = avaliarCoberturaObjetivos(capitulos, objetivo);
  scores.OBJECTIVE_COVERAGE = cobertura.score;
  if (cobertura.erros.length) errosCriticos.push(...cobertura.erros);
  if (cobertura.avisos.length) avisos.push(...cobertura.avisos);

  // ── 6. CITATIONS_REFS (5%) ──
  const citacoes = avaliarCitacoes(orfas, referencias);
  scores.CITATIONS_REFS = citacoes.score;
  if (citacoes.erros.length) errosCriticos.push(...citacoes.erros);
  if (citacoes.avisos.length) avisos.push(...citacoes.avisos);

  // ── 7. WRITING (5%) ──
  const escrita = avaliarEscrita(capitulos, repeticao);
  scores.WRITING = escrita.score;
  if (escrita.erros.length) errosCriticos.push(...escrita.erros);
  if (escrita.avisos.length) avisos.push(...escrita.avisos);

  // ── 8. DOCUMENT_LAYOUT (5%) ──
  const layout = avaliarLayout(capitulos, totalPags);
  scores.DOCUMENT_LAYOUT = layout.score;
  if (layout.avisos.length) avisos.push(...layout.avisos);

  // ── SCORE FINAL ──
  let scoreFinal = 0;
  for (const [dim, cfg] of Object.entries(DIMENSOES)) {
    scoreFinal += (scores[dim] || 0) * cfg.peso;
  }
  scoreFinal = Math.round(scoreFinal);

  // ── CLASSIFICAÇÃO (Section 34) ──
  let classificacao;
  if (scoreFinal >= 90) classificacao = 'EXCELENTE';
  else if (scoreFinal >= 80) classificacao = 'MUITO BOM';
  else if (scoreFinal >= 70) classificacao = 'BOM';
  else if (scoreFinal >= 60) classificacao = 'ACEITÁVEL';
  else if (scoreFinal >= 50) classificacao = 'FRACO';
  else classificacao = 'NÃO PUBLICÁVEL';

  // ── DECISÃO FINAL ──
  const hasFabricatedSources = orfas?.orfasTexto?.some(o => !o.autor) || false;
  const hasOrphanRefs = (orfas?.orfasRef?.length || 0) > 2;
  const hasPlaceholder = capitulos.some(c => {
    const t = c.c || '';
    return /\(Ano\)|Segundo autor\s*\(Ano\)|Autor et al\.?\s*\(Ano\)/.test(t);
  });
  const hasCorruptedText = capitulos.some(c => (c.c || '').length < 30);
  const hasEmptyStructure = capitulos.some(c => {
    const t = c.c || '';
    return /não se dissocia das condições materiais/.test(t);
  });

  const errosCriticosFinais = [];
  if (hasFabricatedSources) errosCriticosFinais.push('FONTE_FABRICADA');
  if (hasOrphanRefs) errosCriticosFinais.push('ORPHAN_REFERENCES');
  if (hasPlaceholder) errosCriticosFinais.push('PLACEHOLDER_DETECTED');
  if (hasCorruptedText) errosCriticosFinais.push('CORRUPTED_TEXT');
  if (hasEmptyStructure) errosCriticosFinais.push('LOOP_FALLBACK');

  const canExport = scoreFinal >= 60 && errosCriticosFinais.length === 0;

  return {
    score: scoreFinal,
    classificacao,
    can_export: canExport,
    scores,
    dimensoes: Object.entries(DIMENSOES).map(([k, v]) => ({
      key: k,
      label: v.label,
      score: scores[k] || 0,
      peso: v.peso,
    })),
    erros_criticos: errosCriticosFinais,
    erros: errosCriticos,
    avisos,
    detalhes: { estrutura, conteudo, evidencia, argumentacao, cobertura, citacoes, escrita, layout },
  };
}

/* ═══════════════════════════════════════════════════════════
   SCORE COMPONENTS
═══════════════════════════════════════════════════════════ */

function avaliarEstrutura(capitulos, plan) {
  let score = 100;
  const erros = [];
  const avisos = [];

  // Verificar se tem introdução e conclusão
  const temIntro = capitulos.some(c => /introdução/i.test(c.titulo || ''));
  const temConclusao = capitulos.some(c => /conclusão/i.test(c.titulo || ''));
  if (!temIntro) { score -= 20; erros.push('Sem capítulo de Introdução'); }
  if (!temConclusao) { score -= 20; erros.push('Sem capítulo de Conclusão'); }

  // Verificar se tem subtítulos (H2/H3)
  const capsComSubtitulos = capitulos.filter(c => {
    const t = c.c || '';
    return /\d+\.\d+\s+[A-Z]/.test(t);
  }).length;
  if (capsComSubtitulos < capitulos.length * 0.5) {
    score -= 15;
    avisos.push(`Apenas ${capsComSubtitulos}/${capitulos.length} caps têm subtítulos`);
  }

  // Verificar se tem referências
  const temRefs = capitulos.some(c => /referência|bibliografia/i.test(c.titulo || ''));
  if (!temRefs) { score -= 15; erros.push('Sem secção de Referências'); }

  return { score: Math.max(0, score), erros, avisos };
}

function avaliarConteudoAcademico(capitulos) {
  let score = 100;
  const erros = [];
  const avisos = [];

  for (const cap of capitulos) {
    const texto = cap.c || '';
    const palavras = texto.split(/\s+/).filter(Boolean).length;

    // Capítulo muito curto
    if (/referência|bibliografia/i.test(cap.titulo || '')) continue;
    if (palavras < 150) {
      score -= 10;
      avisos.push(`Cap "${(cap.titulo || '').substring(0, 30)}" com apenas ${palavras}w`);
    }

    // Parágrafos muito curtos
    const paras = texto.split(/\n\n/).filter(p => p.trim().length > 10);
    const parasCurtos = paras.filter(p => p.split(/\s+/).length < 20).length;
    if (paras.length > 0 && parasCurtos / paras.length > 0.5) {
      score -= 8;
      avisos.push(`Cap "${(cap.titulo || '').substring(0, 30)}" tem ${parasCurtos}/${paras.length} parágrafos curtos`);
    }

    // Metodologia afirmando trabalho de campo sem dados
    if (/metodologia/i.test(cap.titulo || '')) {
      if (/foram realizadas entrevistas|foram aplicados questionários|foi realizada pesquisa de campo/i.test(texto)) {
        if (!/\d+\s*(pessoas|entrevistados|respondentes|participantes)/.test(texto)) {
          score -= 15;
          erros.push('Metodologia afirma trabalho de campo sem dados de amostra');
        }
      }
    }
  }

  return { score: Math.max(0, score), erros, avisos };
}

function avaliarEvidencia(grafo) {
  let score = 100;
  const erros = [];
  const avisos = [];

  if (!grafo || !grafo.stats) return { score: 50, erros: ['Grafo claim-evidence não construído'], avisos: [] };

  const { total, com_fonte, sem_fonte, taxa_cobertura } = grafo.stats;

  if (total === 0) {
    return { score: 30, erros: ['Nenhum claim extraído'], avisos: [] };
  }

  // Taxa de cobertura de fontes
  if (taxa_cobertura < 40) {
    score -= 25;
    erros.push(`Taxa de cobertura de fontes: ${taxa_cobertura}% (<40%)`);
  } else if (taxa_cobertura < 60) {
    score -= 10;
    avisos.push(`Taxa de cobertura de fontes: ${taxa_cobertura}% (<60%)`);
  }

  // Claims sem fonte que exigem
  if (sem_fonte > 3) {
    score -= 15;
    erros.push(`${sem_fonte} claims estatísticos/factuais sem fonte verificável`);
  }

  // Diversidade de tipos
  const tipos = Object.keys(grafo.stats.por_tipo || {});
  if (tipos.length < 3) {
    score -= 10;
    avisos.push(`Apenas ${tipos.length} tipos de claims (mínimo: 3)`);
  }

  return { score: Math.max(0, score), erros, avisos };
}

function avaliarArgumentacao(capitulos) {
  let score = 100;
  const erros = [];
  const avisos = [];

  for (const cap of capitulos) {
    const texto = cap.c || '';
    if (/referência|bibliografia/i.test(cap.titulo || '')) continue;

    // Verificar se tem análise (não só descrição)
    const temAnalise = /análise|análise|considera|avalia|examina|questiona|critica|compara/i.test(texto);
    const temDescricao = /descreve|apresenta|mostra|indica/i.test(texto);

    if (temDescricao && !temAnalise) {
      score -= 5;
      avisos.push(`Cap "${(cap.titulo || '').substring(0, 30)}" parece descritivo sem análise`);
    }

    // Verificar convergência/divergência
    const temSintese = /convergência|divergência|síntese|embora|no entanto|porém|contudo/i.test(texto);
    if (!temSintese && texto.length > 500) {
      score -= 3;
      avisos.push(`Cap "${(cap.titulo || '').substring(0, 30)}" sem síntese de perspectivas`);
    }
  }

  return { score: Math.max(0, score), erros, avisos };
}

function avaliarCoberturaObjetivos(capitulos, objetivo) {
  let score = 100;
  const erros = [];
  const avisos = [];

  if (!objetivo) return { score: 70, erros: [], avisos: ['Objetivo não definido'] };

  const todoTexto = capitulos.map(c => c.c || '').join(' ');
  const palavrasObjetivo = objetivo.split(/\s+/).filter(w => w.length > 4);
  const cobertas = palavrasObjetivo.filter(w => todoTexto.toLowerCase().includes(w.toLowerCase()));
  const taxaCobertura = palavrasObjetivo.length > 0 ? cobertas.length / palavrasObjetivo.length : 0;

  if (taxaCobertura < 0.3) {
    score -= 30;
    erros.push(`Objetivo mal coberto: apenas ${Math.round(taxaCobertura * 100)}% das palavras-chave encontradas`);
  } else if (taxaCobertura < 0.5) {
    score -= 15;
    avisos.push(`Objetivo parcialmente coberto: ${Math.round(taxaCobertura * 100)}%`);
  }

  // Verificar se conclusão responde ao problema
  const conclusao = capitulos.find(c => /conclusão/i.test(c.titulo || ''));
  if (conclusao) {
    const temResposta = /resposta|conclui|confirma|rejeita|verifica|confirmamos|responde/i.test(conclusao.c || '');
    if (!temResposta) {
      score -= 15;
      avisos.push('Conclusão não responde explicitamente à pergunta');
    }
  } else {
    score -= 20;
    erros.push('Sem capítulo de Conclusão');
  }

  return { score: Math.max(0, score), erros, avisos };
}

function avaliarCitacoes(orfas, referencias) {
  let score = 100;
  const erros = [];
  const avisos = [];

  if (!orfas) return { score: 60, erros: [], avisos: ['Análise de orfãs não realizada'] };

  if (orfas.orfasTexto?.length > 2) {
    score -= 20;
    erros.push(`${orfas.orfasTexto.length} citações no texto sem referência na bibliografia`);
  }

  if (orfas.orfasRef?.length > 2) {
    score -= 15;
    avisos.push(`${orfas.orfasRef.length} referências não citadas no texto`);
  }

  if (orfas.duplicadas?.length > 0) {
    score -= 10;
    avisos.push(`${orfas.duplicadas.length} referências duplicadas`);
  }

  // Mínimo de referências
  if ((referencias || []).length < 8) {
    score -= 10;
    avisos.push(`Apenas ${(referencias || []).length} referências (mínimo: 8)`);
  }

  return { score: Math.max(0, score), erros, avisos };
}

function avaliarEscrita(capitulos, repeticao) {
  let score = 100;
  const erros = [];
  const avisos = [];

  if (repeticao && repeticao.total > 0) {
    const criticos = repeticao.problemas.filter(p => p.severity === 'HIGH');
    const medios = repeticao.problemas.filter(p => p.severity === 'MEDIUM');
    score -= criticos.length * 8 + medios.length * 3;
    if (criticos.length > 0) {
      erros.push(`${criticos.length} problemas de repetição severos`);
    }
    if (medios.length > 2) {
      avisos.push(`${medios.length} problemas de repetição médios`);
    }
  }

  // Verificar vocabulário anti-IA
  const vocabularioIA = ['multifacetado', 'ecossistema', 'alavancagem', 'ucket', 'engajamento', 'impactante', 'sob a ótica', 'no âmbito', 'à luz de'];
  for (const cap of capitulos) {
    const texto = (cap.c || '').toLowerCase();
    const encontrados = vocabularioIA.filter(v => texto.includes(v));
    if (encontrados.length > 2) {
      score -= 5;
      avisos.push(`Cap "${(cap.titulo || '').substring(0, 30)}" contém ${encontrados.length} termos anti-IA`);
    }
  }

  return { score: Math.max(0, score), erros, avisos };
}

function avaliarLayout(capitulos, totalPags) {
  let score = 100;
  const avisos = [];

  const totalPalavras = capitulos.reduce((acc, c) => acc + (c.c || '').split(/\s+/).filter(Boolean).length, 0);
  const pagsEstimadas = Math.ceil(totalPalavras / 480);

  if (pagsEstimadas < totalPags * 0.6) {
    score -= 20;
    avisos.push(`Conteúdo insuficiente: ~${pagsEstimadas}p para ${totalPags}p solicitadas`);
  } else if (pagsEstimadas > totalPags * 1.4) {
    score -= 10;
    avisos.push(`Conteúdo excede pedido: ~${pagsEstimadas}p para ${totalPags}p solicitadas`);
  }

  return { score: Math.max(0, score), erros: [], avisos };
}
