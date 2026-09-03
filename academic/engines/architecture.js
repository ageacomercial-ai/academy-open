/* academic/engines/architecture.js
   Document Architecture & Planning Engine — TEMA→TIPO→OBJETIVOS→PERGUNTAS→ARQUITETURA
   Implementa secções 1-3, 9-11, 18, 27 da missão
============================================================================= */

export const TIPOS_DOCUMENTO = {
  ENSAIO: { id:'ensaio', capitulos:3, paginas_tipo: [1,6,1], label:'Ensaio' },
  ARTIGO: { id:'artigo', capitulos:6, paginas_tipo: [1,2,1,2,2,1], label:'Artigo Científico' },
  MONOGRAFIA: { id:'monografia', capitulos:6, paginas_tipo: [2,5,3,3,2,1], label:'Monografia' },
  TCC: { id:'tcc', capitulos:6, paginas_tipo: [2,5,3,3,2,1], label:'TCC' },
  RELATORIO: { id:'relatorio', capitulos:4, paginas_tipo: [1,3,3,1], label:'Relatório Académico' },
  REVISAO: { id:'revisao', capitulos:6, paginas_tipo: [2,1,5,3,2,1], label:'Revisão Bibliográfica' },
  PROJETO: { id:'projeto', capitulos:4, paginas_tipo: [2,3,2,1], label:'Projeto de Investigação' },
  DISSERTACAO: { id:'dissertacao', capitulos:6, paginas_tipo: [2,6,3,3,2,1], label:'Dissertação' },
};

const ARQUITETURA_REF = {
  capa:1, indice:1,
  1:{ titulo:'INTRODUÇÃO', subs:['Contextualização do tema','Problema de investigação','Pergunta de investigação','Objetivos','Justificativa','Delimitação do estudo','Estrutura do trabalho'], peso: 2 },
  2:{ titulo:'FUNDAMENTAÇÃO TEÓRICA / REVISÃO DA LITERATURA', subs:['Conceitos fundamentais','Teorias e modelos relevantes','Estado da arte','Estudos anteriores','Síntese crítica da literatura'], peso: 5 },
  3:{ titulo:'METODOLOGIA', subs:['Abordagem da investigação','Tipo de investigação','Local/contexto do estudo','População e amostra','Técnicas e instrumentos de recolha','Procedimentos','Técnicas de análise','Considerações éticas'], peso: 3 },
  4:{ titulo:'APRESENTAÇÃO E ANÁLISE DOS RESULTADOS', subs:['Apresentação dos resultados','Análise dos resultados','Resultados objetivo 1','Resultados objetivo 2','Resultados objetivo 3'], peso: 3 },
  5:{ titulo:'DISCUSSÃO DOS RESULTADOS', subs:['Interpretação dos principais resultados','Comparação com estudos anteriores','Convergências e divergências','Implicações dos resultados'], peso: 2 },
  6:{ titulo:'CONCLUSÃO E RECOMENDAÇÕES', subs:['Síntese das principais conclusões','Resposta à pergunta de investigação','Cumprimento dos objetivos','Limitações do estudo','Recomendações'], peso: 1 },
};

export function detectarTipoDocumento(tipoParam) {
  const t=(tipoParam||'').toLowerCase();
  if (/ensaio/.test(t)) return TIPOS_DOCUMENTO.ENSAIO;
  if (/artigo/.test(t)) return TIPOS_DOCUMENTO.ARTIGO;
  if (/monografia/.test(t)) return TIPOS_DOCUMENTO.MONOGRAFIA;
  if (/tcc/.test(t)) return TIPOS_DOCUMENTO.TCC;
  if (/relat[oó]rio/.test(t)) return TIPOS_DOCUMENTO.RELATORIO;
  if (/revis[aã]o/.test(t)) return TIPOS_DOCUMENTO.REVISAO;
  if (/projeto/.test(t)) return TIPOS_DOCUMENTO.PROJETO;
  if (/disserta/.test(t)) return TIPOS_DOCUMENTO.DISSERTACAO;
  return TIPOS_DOCUMENTO.MONOGRAFIA;
}

export function construirDocumentPlan({ tema, tipo, nivel, totalPags, objetivo, objetivos_especificos, problema, pergunta }) {
  const tipoCfg = detectarTipoDocumento(tipo);
  const frontMatter = 2; // capa+indice
  const refsPag = Math.max(1, Math.round(totalPags * 0.1));
  const conteudoPag = Math.max(4, totalPags - frontMatter - refsPag);
  // distribuir conteudo proporcional ao peso da arquitetura ref
  const pesos = Object.entries(ARQUITETURA_REF).filter(([k])=>!['capa','indice'].includes(k)).map(([k,v])=>v.peso);
  const totalPeso = pesos.reduce((a,b)=>a+b,0);
  const chapters = Object.entries(ARQUITETURA_REF).filter(([k])=>!['capa','indice'].includes(k)).map(([num, cfg], idx)=>{
    const pag = Math.max(1, Math.round(conteudoPag * cfg.peso / totalPeso));
    const palavras = pag * 500; // faixa ideal 450-550, usa 500 como alvo
    return {
      chapter_number: parseInt(num),
      title: cfg.titulo,
      purpose: `Desenvolver ${cfg.titulo.toLowerCase()} relacionado a "${tema}"`,
      objectives: (objetivos_especificos||[]).slice(0,2),
      questions: [`Como ${cfg.titulo.toLowerCase()} responde ao problema: ${problema||tema}?`],
      sections: cfg.subs.slice(0,4).map((s,i)=>({
        section_number: `${num}.${i+1}`,
        title: s,
        purpose: s,
        expected_arguments: [`Argumento sobre ${s.toLowerCase()}`],
        expected_evidence: [`Evidência para ${s.toLowerCase()}`],
        estimated_content: `${palavras/4} palavras`,
        estimated_pages: (pag/4).toFixed(1),
      })),
      estimated_pages: pag,
      estimated_words: palavras,
    };
  });
  // adaptar ao tipo: ensaio 3 caps, artigo 6 mas com pesos diferentes
  let capsAdaptados = chapters;
  if (tipoCfg.id==='ensaio') capsAdaptados = [chapters[0], { ...chapters[1], title:'DESENVOLVIMENTO', sections: chapters[1].sections.slice(0,3)}, chapters[5]];
  if (tipoCfg.id==='artigo') capsAdaptados = chapters; // já 6

  return {
    document_type: tipoCfg.id,
    title: tema,
    research_problem: problema || `Problema relacionado a ${tema}`,
    research_question: pergunta || `Como ${tema} se manifesta no contexto estudado?`,
    general_objective: objetivo || `Analisar ${tema}`,
    specific_objectives: objetivos_especificos || [],
    chapters: capsAdaptados,
    page_budget: { front_matter, content_pages: conteudoPag, references_pages: refsPag, total: totalPags },
    created_at: new Date().toISOString(),
  };
}

export function calcularPesosCapitulos(chapters) {
  return chapters.map(ch=>({
    chapter: ch.title,
    pages: ch.estimated_pages,
    words: ch.estimated_words,
    weight: ch.estimated_pages,
  }));
}

export function detectarDesequilibrio(chapters) {
  const pags = chapters.map(c=>c.estimated_pages);
  const media = pags.reduce((a,b)=>a+b,0)/pags.length;
  const desequilibrados = chapters.filter(c=> Math.abs(c.estimated_pages-media) > media*0.8);
  return { media, desequilibrados: desequilibrados.map(c=>c.title), isBalanced: desequilibrados.length===0 };
}
