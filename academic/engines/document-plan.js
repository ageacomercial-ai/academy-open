/* academic/engines/document-plan.js
   DOCUMENT_PLAN — Step 1-8 do Master Prompt
   Antes de escrever: tipo → modelo → plano → fontes → evidências → claim-evidence graph
   Implementa secções 1-5, 24-26, 29 da missão
============================================================================= */

/* ═══════════════════════════════════════════════════════════
   STEP 1-3: ANALYSE REQUEST → CLASSIFY → BUILD RESEARCH MODEL
═══════════════════════════════════════════════════════════ */

export function analiseRequest({ tema, tipo, nivel, totalPags, area, pais, objetivo }) {
  const classificacao = classificarDocumento(tipo);
  const modeloPesquisa = construirModeloPesquisa({ tema, nivel, area, classificacao });
  const escopo = delimitarEscopo({ tema, pais, area, nivel });
  return { classificacao, modeloPesquisa, escopo };
}

function classificarDocumento(tipo) {
  const t = (tipo || '').toLowerCase();
  const tipos = {
    monografia: { estrutura: 6, capitulos: 6, profundidade: 'média', methodology: 'revisão literária' },
    tcc:        { estrutura: 6, capitulos: 6, profundidade: 'média', methodology: 'revisão literária' },
    dissertacao: { estrutura: 6, capitulos: 6, profundidade: 'alta', methodology: 'investigação' },
    artigo:     { estrutura: 4, capitulos: 4, profundidade: 'alta', methodology: 'investigação' },
    ensaio:     { estrutura: 3, capitulos: 3, profundidade: 'média', methodology: 'analítica' },
    relatorio:  { estrutura: 4, capitulos: 4, profundidade: 'média', methodology: 'descritiva' },
    revisao:    { estrutura: 6, capitulos: 6, profundidade: 'alta', methodology: 'sistemática' },
    projeto:    { estrutura: 4, capitulos: 4, profundidade: 'média', methodology: 'propositiva' },
  };
  const found = Object.entries(tipos).find(([k]) => t.includes(k));
  return found ? found[1] : tipos.monografia;
}

function construirModeloPesquisa({ tema, nivel, area, classificacao }) {
  return {
    tipo_investigacao: classificacao.methodology,
    abordagem: /monografia|tcc|disserta/i.test(nivel) ? 'qualitativa' : 'mista',
    profundidade_esperada: classificacao.profundidade,
    area,
    tema,
  };
}

function delimitarEscopo({ tema, pais, area, nivel }) {
  return {
    geographic_scope: pais ? [pais, 'Angola', 'África'] : ['Angola'],
    temporal_scope: '2015-2025',
    population_scope: 'população geral / profissionais do setor',
    thematic_scope: tema,
  };
}

/* ═══════════════════════════════════════════════════════════
   STEP 4: BUILD DOCUMENT PLAN — Seções 3, 4, 5
═══════════════════════════════════════════════════════════ */

export function construirDocumentPlanCompleto({
  tema, tipo, nivel, totalPags, area, pais,
  objetivo, objetivos_especificos, problema, pergunta,
}) {
  const { classificacao, modeloPesquisa, escopo } = analiseRequest({ tema, tipo, nivel, totalPags, area, pais, objetivo });

  const frontMatter = 2;
  const refsPag = Math.max(1, Math.round(totalPags * 0.1));
  const conteudoPag = Math.max(4, totalPags - frontMatter - refsPag);

  const arquitetura = definirArquiteturaCapitulos({
    tipo: classificacao,
    tema,
    problema: problema || `Como ${tema} se manifesta no contexto estudado?`,
    pergunta: pergunta || `Como ${tema} influencia o desenvolvimento do setor?`,
    objetivo: objetivo || `Analisar ${tema}`,
    objetivos_especificos: objetivos_especificos || [],
    conteudoPag,
    escopo,
    modeloPesquisa,
  });

  // 5. VALIDAR SUBCAPÍTULOS — cada um deve ter função clara (Seção 5)
  const capitulosValidados = arquitetura.capitulos.map(ch => ({
    ...ch,
    sections: ch.sections.filter(sec => sec.purpose && sec.purpose.length > 10),
  }));

  // 6. EQUILÍBRIO DOS CAPÍTULOS (Seção 21)
  const pesos = capitulosValidados.map(ch => ch.estimated_pages);
  const media = pesos.reduce((a, b) => a + b, 0) / pesos.length;
  const desequilibrados = capitulosValidados.filter(ch => Math.abs(ch.estimated_pages - media) > media * 0.8);

  return {
    document_type: classificacao,
    title: tema,
    scope: escopo,
    research_problem: problema || `Problema relacionado a ${tema}`,
    research_question: pergunta || `Como ${tema} se manifesta no contexto estudado?`,
    general_objective: objetivo || `Analisar ${tema}`,
    specific_objectives: objetivos_especificos || [],
    chapters: capitulosValidados,
    page_budget: {
      front_matter: frontMatter,
      content_pages: conteudoPag,
      references_pages: refsPag,
      total: totalPags,
      palavras_por_pagina: 480,
    },
    balance_check: {
      media,
      desequilibrados: desequilibrados.map(c => c.title),
      is_balanced: desequilibrados.length === 0,
    },
    created_at: new Date().toISOString(),
  };
}

function definirArquiteturaCapitulos({ tipo, tema, problema, pergunta, objetivo, objetivos_especificos, conteudoPag, escopo, modeloPesquisa }) {
  const estruturas = {
    monografia: [
      {
        num: 1, titulo: 'INTRODUÇÃO', peso: 2,
        purpose: 'Apresentar o tema, problema, objetivos e justificativa da investigação',
        questions: [pergunta],
        objectives: objetivos_especificos.slice(0, 2),
        evidence_requirements: ['Dados contextualizadores', 'Estatísticas do setor'],
        sections: [
          { num: '1.1', title: 'Contextualização do tema', purpose: 'Apresentar o tema no contexto geral e local', arguments: ['Evolução histórica do tema', 'Relevância social/económica'], evidence: ['Dados INE', 'Relatórios setoriais'], words: 350 },
          { num: '1.2', title: 'Problema de investigação', purpose: 'Definir o problema que justifica a pesquisa', arguments: ['Lacuna na literatura', 'Necessidade prática'], evidence: ['Revisão da literatura'], words: 250 },
          { num: '1.3', title: 'Objetivos', purpose: 'Apresentar objetivo geral e específicos', arguments: [], evidence: [], words: 150 },
          { num: '1.4', title: 'Justificativa', purpose: 'Explicar por que o tema é relevante', arguments: ['Impacto social', 'Contributo científico'], evidence: ['Dados de impacto'], words: 200 },
        ],
      },
      {
        num: 2, titulo: 'FUNDAMENTAÇÃO TEÓRICA', peso: 5,
        purpose: 'Revisar literatura existente e construir base teórica',
        questions: ['O que a literatura diz sobre o tema?', 'Quais teorias sustentam a análise?'],
        objectives: objetivos_especificos.slice(0, 3),
        evidence_requirements: ['Artigos científicos', 'Livros académicos', 'Relatórios de organismos internacionais'],
        sections: [
          { num: '2.1', title: 'Conceitos fundamentais', purpose: 'Definir conceitos-chave do tema', arguments: ['Definições de autores', 'Evolução conceitual'], evidence: ['Livros de referência', 'Artigos de revisão'], words: 400 },
          { num: '2.2', title: 'Enquadramento teórico', purpose: 'Apresentar teorias que sustentam a análise', arguments: ['Teoria A vs Teoria B', 'Aplicação ao contexto'], evidence: ['Artigos teóricos'], words: 450 },
          { num: '2.3', title: 'Estado da arte', purpose: 'Apresentar estudos recentes sobre o tema', arguments: ['Tendências atuais', 'Lacunas identificadas'], evidence: ['Artigos 2020-2025'], words: 400 },
          { num: '2.4', title: 'Síntese crítica da literatura', purpose: 'Comparar e sintetizar contributos', arguments: ['Convergências', 'Divergências', 'Lacunas'], evidence: ['Análise comparativa'], words: 350 },
        ],
      },
      {
        num: 3, titulo: 'METODOLOGIA', peso: 3,
        purpose: 'Descrever como a investigação foi realizada',
        questions: ['Como foi conduzida a pesquisa?'],
        objectives: [],
        evidence_requirements: ['Fonte primária do método'],
        sections: [
          { num: '3.1', title: 'Abordagem da investigação', purpose: 'Definir abordagem qualitativa/quantitativa/mista', arguments: ['Justificação da abordagem'], evidence: ['Referências metodológicas'], words: 200 },
          { num: '3.2', title: 'Tipo de investigação', purpose: 'Classificar tipo (exploratória, descritiva, explicativa)', arguments: [], evidence: [], words: 150 },
          { num: '3.3', title: 'Local e contexto', purpose: 'Delimitar espaço e tempo da pesquisa', arguments: [], evidence: ['Dados geográficos'], words: 150 },
          { num: '3.4', title: 'Técnicas e instrumentos', purpose: 'Descrever ferramentas de recolha', arguments: [], evidence: [], words: 200 },
          { num: '3.5', title: 'Procedimentos e análise', purpose: 'Explicar procedimentos e análise de dados', arguments: [], evidence: [], words: 200 },
        ],
      },
      {
        num: 4, titulo: 'RESULTADOS E ANÁLISE', peso: 3,
        purpose: 'Apresentar e analisar resultados da pesquisa',
        questions: ['O que os dados revelam?'],
        objectives: objetivos_especificos,
        evidence_requirements: ['Dados primários', 'Tabelas', 'Gráficos'],
        sections: [
          { num: '4.1', title: 'Apresentação dos resultados', purpose: 'Organizar dados de forma clara', arguments: [], evidence: ['Tabelas', 'Gráficos'], words: 400 },
          { num: '4.2', title: 'Análise dos resultados', purpose: 'Interpretar dados à luz da teoria', arguments: ['Relação com fundamentação'], evidence: ['Dados + teoria'], words: 400 },
          { num: '4.3', title: 'Discussão parcial', purpose: 'Comparar com estudos anteriores', arguments: ['Convergências', 'Divergências'], evidence: ['Literatura'], words: 350 },
        ],
      },
      {
        num: 5, titulo: 'DISCUSSÃO', peso: 2,
        purpose: 'Interpretar resultados no contexto da literatura',
        questions: ['O que os resultados significam?', 'Como se relacionam com a literatura?'],
        objectives: objetivos_especificos,
        evidence_requirements: ['Literatura revisada', 'Resultados'],
        sections: [
          { num: '5.1', title: 'Interpretação dos resultados', purpose: 'Significado dos achados', arguments: [], evidence: [], words: 400 },
          { num: '5.2', title: 'Comparação com estudos anteriores', purpose: 'Convergências e divergências', arguments: [], evidence: [], words: 350 },
          { num: '5.3', title: 'Implicações', purpose: 'Contributo teórico e prático', arguments: [], evidence: [], words: 300 },
        ],
      },
      {
        num: 6, titulo: 'CONCLUSÃO E RECOMENDAÇÕES', peso: 1,
        purpose: 'Sintetizar achados e responder à pergunta',
        questions: ['A pergunta foi respondida?', 'Objetivos foram cumpridos?'],
        objectives: objetivos_especificos,
        evidence_requirements: [],
        sections: [
          { num: '6.1', title: 'Síntese das conclusões', purpose: 'Resumo dos principais achados', arguments: [], evidence: [], words: 300 },
          { num: '6.2', title: 'Resposta à pergunta', purpose: 'Responder diretamente à questão de investigação', arguments: [], evidence: [], words: 200 },
          { num: '6.3', title: 'Limitações e recomendações', purpose: 'Limitações do estudo e sugestões futuras', arguments: [], evidence: [], words: 250 },
        ],
      },
    ],
  };

  const tipoKey = tipo.estrutura === 3 ? 'monografia' : tipo.estrutura === 4 ? 'monografia' : 'monografia';
  const caps = (estruturas[tipoKey] || estruturas.monografia).map(ch => {
    const pag = Math.max(1, Math.round(conteudoPag * ch.peso / 11));
    return { ...ch, estimated_pages: pag, estimated_words: pag * 480 };
  });

  return { capitulos: caps };
}
