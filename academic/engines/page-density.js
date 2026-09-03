/* academic/engines/page-density.js
   PAGE DENSITY ANALYSIS — Section 16-19 do Master Prompt
   Analisa densidade real de cada página (não só word count)
   Considera: títulos, parágrafos, tabelas, figuras, listas, citações, espaços
============================================================================= */

/* ═══════════════════════════════════════════════════════════
   DENSITY CLASSIFICATION (Section 16)
═══════════════════════════════════════════════════════════ */
export function classificarDensidade(palavras, temTituloCap, temTabela, temFigura) {
  // Ajustar thresholds baseado em elementos visuais
  let ajuste = 0;
  if (temTituloCap) ajuste += 80;   // Título de capítulo ocupa espaço
  if (temTabela) ajuste += 150;     // Tabela ocupa ~1/3 da página
  if (temFigura) ajuste += 120;     // Figura ocupa ~1/4 da página

  const palavrasEfectivas = palavras + ajuste;

  if (palavrasEfectivas < 250) return 'VERY_EMPTY';
  if (palavrasEfectivas < 350) return 'EMPTY';
  if (palavrasEfectivas < 650) return 'BALANCED';
  if (palavrasEfectivas < 800) return 'DENSE';
  return 'VERY_DENSE';
}

/* ═══════════════════════════════════════════════════════════
   ANALYZE PAGE DENSITY — Step 15
═══════════════════════════════════════════════════════════ */
export function analisarDensidadePaginas(paginasDeBlocos) {
  return paginasDeBlocos.map((pg, i) => {
    const temTituloCap = pg.some(b => b.tipo === 'titulo_cap');
    const temTabela = pg.some(b => b.tipo === 'data_table');
    const temFigura = pg.some(b => b.tipo === 'imagem' || b.tipo === 'grafico');
    const temH2 = pg.some(b => b.tipo === 'h2');
    const temH3 = pg.some(b => b.tipo === 'h3');

    // Calcular palavras reais
    const palavras = pg.reduce((acc, b) => {
      if (b.tipo === 'paragrafo' || b.tipo === 'ref_item') {
        return acc + (b.texto || '').split(/\s+/).filter(Boolean).length;
      }
      if (b.tipo === 'titulo_cap') return acc + 5; // título = ~5 palavras
      if (b.tipo === 'h2' || b.tipo === 'h3') return acc + 4;
      return acc;
    }, 0);

    const classificacao = classificarDensidade(palavras, temTituloCap, temTabela, temFigura);

    // Contar elementos estruturais
    const elementos = {
      paragrafos: pg.filter(b => b.tipo === 'paragrafo').length,
      subtitulos: pg.filter(b => b.tipo === 'h2' || b.tipo === 'h3').length,
      tabelas: pg.filter(b => b.tipo === 'data_table').length,
      figuras: pg.filter(b => b.tipo === 'imagem' || b.tipo === 'grafico').length,
      refs: pg.filter(b => b.tipo === 'ref_item').length,
    };

    return {
      pagina: i + 1,
      palavras,
      classificacao,
      elementos,
      temTituloCap,
      temEstrutura: temH2 || temH3 || temTituloCap,
      isVeryEmpty: classificacao === 'VERY_EMPTY' && !temTituloCap,
      isVeryDense: classificacao === 'VERY_DENSE',
    };
  });
}

/* ═══════════════════════════════════════════════════════════
   REPAIR LAYOUT — Step 16
═══════════════════════════════════════════════════════════ */
export function repararLayout(paginasComDensidade, blocos) {
  const problemas = [];
  const reparacoes = [];

  for (const pg of paginasComDensidade) {
    if (pg.isVeryEmpty) {
      problemas.push({
        pagina: pg.pagina,
        tipo: 'VERY_EMPTY_PAGE',
        palavras: pg.palavras,
      });
      // Não adicionar texto artificial — apenas assinalar
      reparacoes.push({
        pagina: pg.pagina,
        acao: 'ASSINALAR_VAZIA',
        motivo: 'Página com conteúdo insuficiente — considerar reflow',
      });
    }

    if (pg.isVeryDense) {
      problemas.push({
        pagina: pg.pagina,
        tipo: 'VERY_DENSE_PAGE',
        palavras: pg.palavras,
      });
      reparacoes.push({
        pagina: pg.pagina,
        acao: 'QUEBRAR_PARAGRAFO',
        motivo: 'Página excessivamente densa — considerar quebra lógica',
      });
    }
  }

  // Títulos órfãos (Section 20)
  for (let i = 0; i < paginasComDensidade.length - 1; i++) {
    const pg = paginasComDensidade[i];
    const proxPg = paginasComDensidade[i + 1];

    if (pg.elementos.paragrafos === 0 && pg.elementos.subtitulos > 0) {
      problemas.push({
        pagina: pg.pagina,
        tipo: 'ORPHAN_HEADING',
        titulo: 'Subtítulo sem conteúdo',
      });
      reparacoes.push({
        pagina: pg.pagina,
        acao: 'MOVER_CONTEUDO',
        motivo: 'Subtítulo órfão — mover conteúdo da página seguinte',
      });
    }
  }

  return { problemas, reparacoes, totalProblemas: problemas.length };
}

/* ═══════════════════════════════════════════════════════════
   CHECK EQUILÍBRIO (Section 21)
═══════════════════════════════════════════════════════════ */
export function verificarEquilibrioCapitulos(capitulos) {
  const dados = capitulos.map(c => {
    const texto = c.c || '';
    const palavras = texto.split(/\s+/).filter(Boolean).length;
    const paras = texto.split(/\n\n/).filter(p => p.trim().length > 20).length;
    return {
      titulo: c.titulo || '',
      palavras,
      paragrafos: paras,
      estimativaPags: Math.ceil(palavras / 480),
    };
  });

  const mediaPags = dados.reduce((a, d) => a + d.estimativaPags, 0) / dados.length;
  const desequilibrados = dados.filter(d => Math.abs(d.estimativaPags - mediaPags) > mediaPags * 0.8);

  return {
    capitulos: dados,
    mediaPags,
    desequilibrados: desequilibrados.map(d => d.titulo),
    isBalanced: desequilibrados.length === 0,
  };
}
