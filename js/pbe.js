/* ═══════════════════════════════════════════════════════════
   ACADEMY — PBE.JS (PAGE BUDGET ENGINE)
   Sistema interno de controlo de paginação.

   O número de páginas pedido pelo utilizador é uma RESTRIÇÃO
   OBRIGATÓRIA, nunca uma estimativa.

   Fluxo:
   1. pbePlanear()          — lê as páginas pedidas e deriva o layout real
   2. palavras/página       — calculado a partir de PDF + LINE_MODEL (layout.js)
   3. Word Budget           — orçamento total + distribuição por capítulo
   4. pbeMedirPaginas()     — mede a paginação real (mesmo motor do PDF)
   5. pbeValidarEAjustar()  — ciclo resumir/expandir até ±2% do pedido

   Camada interna: não altera interface, design nem fluxo do utilizador.
   Depende (em runtime) de: state.js, layout.js, export.js, generator.js
═══════════════════════════════════════════════════════════ */

const PBE = {
  AVG_CHARS_PALAVRA:   6.3,  /* comprimento médio de palavra (pt académico) */
  FRAGMENTO_FIM_PAR:   0.88, /* última linha parcial por parágrafo */
  OVERHEAD_TITULOS:    0.92, /* linhas dedicadas a títulos/subtítulos */
  MAX_TENTATIVAS:      5,    /* iterações máx. do ciclo de calibração */
  TOLERANCIA_PCT:      0.02, /* ±2% do número de páginas pedido */
  PALAVRAS_MIN_CAP:    200,  /* piso de qualidade por capítulo */
  FALLBACK:            { area: 827, pxPorLinha: 24, charsPorLinha: 68 },
};

/* ── 1. Modelo de layout real (PDF + LINE_MODEL de layout.js) ── */
function _pbeModeloLayout() {
  if (typeof PDF !== 'undefined' && typeof LINE_MODEL !== 'undefined') {
    return {
      area:         PDF.AREA,
      pxPorLinha:   LINE_MODEL.PX_POR_LINHA,
      charsPorLinha: LINE_MODEL.CHARS_POR_LINHA,
    };
  }
  return PBE.FALLBACK;
}

/* ── 2. Capacidade média de palavras por página do layout actual ── */
function pbePalavrasPorPagina() {
  const m = _pbeModeloLayout();
  const linhasPg = Math.max(20, Math.floor((m.area * 0.88) / m.pxPorLinha));
  const charsPg  = linhasPg * m.charsPorLinha;
  const capacidade = charsPg * PBE.FRAGMENTO_FIM_PAR * PBE.OVERHEAD_TITULOS / PBE.AVG_CHARS_PALAVRA;
  return Math.max(120, Math.round(capacidade));
}

/* ── 3. Páginas fixas fora do corpo (capa, TOC, anexos, pós-textuais, contracapa) ── */
function pbePaginasFrontais() {
  const cfg = State.get('cfg') || {};
  const pretexts = (typeof htmlPretextuais === 'function' ? htmlPretextuais(cfg) : []).length;
  const mediaComConteudo = (cfg.mediaItems || []).filter(m => {
    if (!m || !m.tipo) return false;
    if (m.tipo === 'imagem')  return !!m.src;
    if (m.tipo === 'tabela')  return Array.isArray(m.dados) && m.dados.length > 0;
    if (m.tipo === 'grafico') return !!m.dados || !!m.src;
    return false;
  });
  const anexos = mediaComConteudo.filter(m => !m.pag).length > 0 ? 1 : 0;
  const posText = (typeof htmlPostextuais === 'function' ? htmlPostextuais(cfg) : []).length;
  return 1 + pretexts + 1 + anexos + posText + 1; /* capa + TOC + contracapa */
}

/* ── 4. Plano de orçamento de palavras (Word Budget) ── */

/* Vocabulário realista pt (comprimento médio ≈ 6 caracteres/palavra) */
const _PBE_POOL = ('o de que e em para com uma os da no se por mais como das não mas sua tema estudo análise ' +
  'contexto angola resultado processo educação desenvolvimento social investigação metodologia contemporâneo ' +
  'bibliografia instituição económico política tecnologia informação estudantes universidade').split(' ');

/* Conteúdo de teste sintético com a estrutura real (subtítulo + parágrafos) */
function _pbeSintetarTexto(numPalavras) {
  const nPar  = Math.max(2, Math.round(Math.max(numPalavras, 60) / 110));
  const porPar = Math.max(24, Math.round(numPalavras / nPar));
  const frases = [];
  let k = 0;
  for (let p = 0; p < nPar; p++) {
    const n = p === nPar - 1 ? Math.max(12, numPalavras - (nPar - 1) * porPar) : porPar;
    const words = [];
    for (let w = 0; w < n; w++) {
      words.push(_PBE_POOL[k % _PBE_POOL.length]);
      k++;
    }
    frases.push(words.join(' ') + '.');
  }
  return ['1.1 Contexto e análise da literatura', ...frases].join('\n\n');
}

function _pbeSintetarSecs(lista, porCapitulo) {
  return lista.map((c, i) => ({
    num: i + 1,
    titulo: c && c.titulo ? c.titulo : 'Capítulo ' + (i + 1),
    c: _pbeSintetarTexto(porCapitulo[i] || 200),
    e: 'p',
  }));
}

function pbePlanear(est, alvoPags) {
  const alvo   = Math.max(1, Math.round(alvoPags || 15));
  const palavrasPorPagina = pbePalavrasPorPagina();
  const frontais  = pbePaginasFrontais();
  const corpoAlvo = Math.max(1, alvo - frontais);

  const lista = Array.isArray(est) && est.length ? est : [];
  const pesos = lista.map(c => {
    const t = (c && c.titulo ? c.titulo : '').toLowerCase();
    if (/refer[eê]ncias|bibliograf/.test(t)) return 0.55;
    if (/introdu[cç][aã]o/.test(t))          return 0.80;
    if (/conclus[aã]o|considera[cç][oõ]es finais/.test(t)) return 0.80;
    return 1;
  });
  const soma = pesos.reduce((s, p) => s + p, 0) || 1;

  /* Viés empírico de +1 página de corpo: acertar por cima permite ao
     ciclo de resumir (determinístico) calibrar o valor exacto. */
  const alvoPaginasCorpo = Math.max(1, corpoAlvo + 1);
  const modeloPalavras = Math.round(alvoPaginasCorpo * palavrasPorPagina);

  /* Piso de qualidade dinâmico: para documentos grandes usa 200;
     para documentos pequenos encolhe (permite cumprir o orçamento). */
  const piso = Math.min(
    PBE.PALAVRAS_MIN_CAP,
    Math.max(24, Math.round((modeloPalavras / Math.max(1, lista.length)) * 0.3))
  );

  /* Calibração numérica contra o motor real de paginação (layout.js):
     sintetiza o documento com o orçamento corrente e escala até a
     previsão de páginas coincidir com o número pedido. */
  let totalPalavras = modeloPalavras;
  let porCapitulo = lista.map((c, i) =>
    Math.max(piso, Math.round(totalPalavras * pesos[i] / soma))
  );

  const MAX_IT = 6;
  for (let it = 0; it < MAX_IT; it++) {
    if (lista.length === 0) break;
    const prev = pbeMedirPaginas(_pbeSintetarSecs(lista, porCapitulo)).corpo;
    if (!prev || prev <= 0) break;
    const ratio = alvoPaginasCorpo / prev;
    if (Math.abs(ratio - 1) < 0.004) break;
    const proximo = lista.map((c, i) =>
      Math.max(piso, Math.round(totalPalavras * ratio * pesos[i] / soma))
    );
    if (proximo.every((v, i) => v === porCapitulo[i])) break; /* piso activo — sem ganho possível */
    porCapitulo = proximo;
    totalPalavras = Math.round(totalPalavras * ratio);
  }

  return { alvoPags: alvo, palavrasPorPagina, frontais, corpoAlvo, totalPalavras, piso, porCapitulo };
}

/* ── 5. Medição real da paginação (mesmo motor do PDF) ── */
function pbeMedirPaginas(secs) {
  const alvo = Math.max(1, State.getCfg('pags') || 15);
  if (!Array.isArray(secs) || secs.length === 0) {
    return { total: 0, corpo: 0, frontais: 0, alvo, dif: -alvo, difPct: 1 };
  }
  let corpo = 0;
  if (typeof docEstruturarSemantico === 'function' && typeof preRenderPipeline === 'function') {
    try { corpo = preRenderPipeline(docEstruturarSemantico(secs)).length; } catch (e) { corpo = 0; }
  }
  const frontais = pbePaginasFrontais();
  const total = frontais + corpo;
  const dif   = total - alvo;
  return { total, corpo, frontais, alvo, dif, difPct: Math.abs(dif) / alvo };
}

/* ── Helpers de texto ── */
function _pbePalavras(t) { return (t || '').split(/\s+/).filter(Boolean).length; }

function _pbeFrases(par) {
  const out = [];
  const re = /[^.!?]+[.!?]+["'\u201D\u201C]*\s*|\s*[^.!?]+$/g;
  let m;
  while ((m = re.exec(par)) !== null) {
    const f = m[0].trim();
    if (f) out.push(f);
  }
  return out.length ? out : [par];
}

function _pbeCortarPara(par, maxPalavras) {
  const frases = _pbeFrases(par);
  let out = [], total = 0;
  for (const f of frases) {
    const fw = _pbePalavras(f);
    if (total + fw > maxPalavras) break;
    out.push(f);
    total += fw;
  }
  if (out.length === 0) { out = frases.slice(0, 1); }
  return out.join(' ');
}

/* ── 6. RESUMIR automaticamente (quando o documento excede o orçamento) ── */
function pbeResumir(secs, paginasExcesso) {
  if (!paginasExcesso || paginasExcesso <= 0 || !Array.isArray(secs) || secs.length === 0) return 0;
  /* Metade do défice por passagem: evita sobretomar (granularidade de
     frase/parágrafo); o ciclo de validação repete e converge sem
     precisar de expandir depois. */
  const alvoRemover = Math.max(1, Math.round(paginasExcesso * pbePalavrasPorPagina() * 0.5));
  const totalWords  = secs.reduce((s, x) => s + _pbePalavras(x.c), 0) || 1;
  let removidas = 0;

  for (const sec of secs) {
    if (removidas >= alvoRemover) break;
    const t = (sec.titulo || '').toLowerCase();
    if (/refer[eê]ncias|bibliograf/.test(t)) continue; /* preservar referências APA */

    const txt = sec.c || '';
    if (!txt.trim()) continue;

    let paras = txt.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (paras.length < 2) continue; /* nunca esvaziar uma secção */

    const secWords = _pbePalavras(txt);
    const alvoSec  = Math.min(secWords, Math.max(8, Math.round(alvoRemover * secWords / totalWords)));
    let cortadas = 0;

    /* 1.ª passagem: cortar frases do fim de parágrafos (mín. 2 frases por parágrafo) */
    for (let i = paras.length - 1; i >= 1 && cortadas < alvoSec; i--) {
      const p = paras[i];
      const w = _pbePalavras(p);
      if (w <= 8) continue;
      const frases = _pbeFrases(p);
      if (frases.length < 3) continue; /* parágrafos curtos não se mexem */
      const minManter = _pbePalavras(frases.slice(0, 2).join(' '));
      const manter    = Math.max(minManter, Math.min(w, w - (alvoSec - cortadas)));
      if (manter >= w) continue;
      const novo = _pbeCortarPara(p, manter);
      const nw   = _pbePalavras(novo);
      if (nw >= w) continue;
      paras[i] = novo;
      cortadas += w - nw;
      removidas += w - nw;
    }

    /* 2.ª passagem: remover parágrafos inteiros do fim (mín. 2 por secção) */
    while (paras.length > 2 && cortadas < alvoSec) {
      const w = _pbePalavras(paras[paras.length - 1]);
      if (w <= 8) break;
      paras.pop();
      cortadas += w;
      removidas += w;
    }

    if (cortadas > 0) {
      sec.c = paras.join('\n\n');
      sec.blocks = typeof blkExtrair === 'function' ? blkExtrair({ c: sec.c }) : sec.blocks;
    }
  }
  return removidas;
}

/* ── 7. EXPANDIR automaticamente (quando o documento fica abaixo do orçamento) ── */
async function pbeExpandir(secs, est, plan, paginasFaltam) {
  if (!paginasFaltam || paginasFaltam <= 0 || !Array.isArray(est) || !Array.isArray(secs)) return 0;
  const alvoPags = Math.max(1, State.getCfg('pags') || 15);
  const alvoPaginas = plan && plan.alvoPags ? plan.alvoPags : alvoPags;
  const wpp = plan && plan.palavrasPorPagina ? plan.palavrasPorPagina : pbePalavrasPorPagina();
  const palavrasNecessarias = Math.round(paginasFaltam * wpp);
  if (palavrasNecessarias <= 0) return 0;

  /* Melhor ajuste: capítulo cujo défice cobre o necessário sem exagerar */
  const pontos = est.map((c, i) => {
    const tem  = _pbePalavras(secs[i] && secs[i].c);
    const alvo = plan && plan.porCapitulo ? (plan.porCapitulo[i] || 0) : 0;
    return { i, tem, alvo, deficit: Math.max(0, alvo - tem) };
  });

  let escolha = pontos
    .filter(p => p.deficit >= Math.max(60, palavrasNecessarias * 0.5))
    .sort((a, b) => a.deficit - b.deficit)[0];
  if (!escolha) escolha = pontos.slice().sort((a, b) => b.deficit - a.deficit)[0];
  if (!escolha || escolha.tem < 40) escolha = pontos.slice().sort((a, b) => b.tem - a.tem)[0];
  if (!escolha) return 0;

  const alvoNovo = Math.max(escolha.alvo, escolha.tem + palavrasNecessarias);
  const cap = est[escolha.i];
  const tp = typeof tipoActual === 'function' ? tipoActual() : null;

  aSecDOM(escolha.i, 'g', 'A expandir…');
  try {
    const raw = await callAcademyAPI({
      acao:             'regenerar_capitulo',
      tema:             State.getCfg('tema'),
      tipoTrabalho:     tp ? tp.n : 'Trabalho Académico',
      nivel:            State.getCfg('nivel'),
      totalPags:        alvoPaginas,
      capNum:           cap.num,
      capTitulo:        cap.titulo,
      capSubs:          cap.subs || [],
      totalCaps:        est.length,
      palavrasPorCap:   alvoNovo,
      wordBudget:       plan ? plan.totalPalavras : 0,
      palavrasPorPagina: wpp,
      paginasAlvo:      alvoPaginas,
      modo:             'expandir',
    });

    const _rawVal = raw && typeof raw === 'object' && 'resposta' in raw ? raw.resposta : raw;
    let textoFinal = null, astFinal = null;

    if (_rawVal && typeof _rawVal === 'object' && _rawVal.sections) {
      astFinal   = _rawVal;
      textoFinal = typeof astParaTexto === 'function' ? astParaTexto(_rawVal) : '';
    } else if (typeof _rawVal === 'string' && _rawVal.length > 30) {
      textoFinal = _rawVal;
    }

    if (textoFinal && textoFinal.trim().length > 30) {
      const secs2 = State.get('secs');
      if (secs2[escolha.i]) {
        secs2[escolha.i].e          = 'p';
        secs2[escolha.i].c          = textoFinal;
        secs2[escolha.i].blocks     = typeof blkExtrair === 'function' ? blkExtrair({ c: textoFinal }) : secs2[escolha.i].blocks;
        secs2[escolha.i].ast        = astFinal;
        secs2[escolha.i].health     = raw && raw.health ? raw.health : secs2[escolha.i].health;
        secs2[escolha.i].completeness = raw && raw.completeness ? raw.completeness : secs2[escolha.i].completeness;
        State.set('secs', secs2);
        aSecDOM(escolha.i, 'p', '✓ EXPANDIDO', textoFinal);
        if (typeof genGuardarProgresso === 'function') genGuardarProgresso();
        if (typeof autoGuardar === 'function') autoGuardar();
        return 1;
      }
    }
  } catch (e) {
    /* manter conteúdo actual — não bloqueia a validação */
  }
  return 0;
}

/* ── 8. Ciclo de validação obrigatória: medir → resumir/expandir → repetir ── */
async function pbeValidarEAjustar(est, plan) {
  const alvo = Math.max(1, State.getCfg('pags') || 15);
  const historico = [];
  let resumiu = 0, expandiu = 0, motivo = PBE.MAX_TENTATIVAS + ' tentativas';

  for (let t = 0; t < PBE.MAX_TENTATIVAS; t++) {
    if (typeof _genCancelado !== 'undefined' && _genCancelado) { motivo = 'cancelado'; break; }
    const secs = State.get('secs');
    const m = pbeMedirPaginas(secs);
    historico.push(m.total);
    if (m.difPct <= PBE.TOLERANCIA_PCT) { motivo = 'tolerancia'; break; }

    if (m.dif > 0) {
      const rem = pbeResumir(secs, m.dif);
      resumiu += rem;
      if (rem === 0) { motivo = 'minimo-estrutural'; break; } /* já nada a cortar */
    } else {
      const n = await pbeExpandir(secs, est, plan, -m.dif);
      expandiu += n;
      if (n === 0) { motivo = 'expansao-impossivel'; break; } /* sem regenerações possíveis */
    }
  }

  const final = pbeMedirPaginas(State.get('secs'));
  const resultado = {
    ...final,
    alvo,
    historico,
    resumiu,
    expandiu,
    motivo,
    ok: final.difPct <= PBE.TOLERANCIA_PCT,
  };
  State.set('pbe', resultado);
  if (typeof autoGuardar === 'function') autoGuardar();
  if (typeof genGuardarProgresso === 'function') genGuardarProgresso();
  return resultado;
}
