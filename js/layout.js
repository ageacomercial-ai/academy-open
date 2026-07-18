/* ═══════════════════════════════════════════════════════════
   ACADEMY — LAYOUT.JS
   Motor de paginação e renderização PDF académico.
   Separado do resto para isolamento de bugs de layout.
   Depende de: state.js, navigation.js, export.js

   ARQUITECTURA INTERNA:
   1. docEstruturarSemantico()  — secs → blocos tipados
   2. preRenderPipeline()       — blocos → grupos → páginas
   3. layoutRenderPagina()      — página → HTML A4
   4. gerarJanelaPDF()          — orquestra tudo → janela
═══════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   CONSTANTES DO DOCUMENTO A4
════════════════════════════════════════════════════════════ */
const PDF = {
  LARGURA:    794,  /* px @ 96dpi = 210mm */
  ALTURA:     1123, /* px @ 96dpi = 297mm */
  MARGEM_H:   96,   /* 3cm esq, 2.5cm dir */
  MARGEM_V:   108,  /* 3cm cima, 2.5cm baixo */
  MARGEM_ESQ: 113,  /* 3cm */
  MARGEM_DIR: 85,   /* 2.5cm */
  /* Área útil de conteúdo */
  get AREA() { return this.ALTURA - this.MARGEM_V * 2 - 80; /* 80 = rodapé */ },
  get LARGURA_UTIL() { return this.LARGURA - this.MARGEM_ESQ - this.MARGEM_DIR; },
};

/* ════════════════════════════════════════════════════════════
   MÓDULO 0 — DEVICE PROFILE
   Detecta capacidades do dispositivo para escolher
   estratégia de medição de alturas (DOM real vs heurística)
════════════════════════════════════════════════════════════ */
const AE = {
  device: { mobile: false, lowMemory: false, slowCPU: false },
  perf:   {},
};

let _aeForcarHeuristica = false;

function aeDetectarDispositivo() {
  const ua = navigator.userAgent || '';
  AE.device.mobile    = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768;
  AE.device.lowMemory = (navigator.deviceMemory || 4) < 2;

  /* Benchmark CPU: >15ms = lento → forçar heurística */
  const t0 = performance.now();
  let x = 0;
  for (let i = 0; i < 100000; i++) x += Math.sqrt(i);
  AE.device.slowCPU = (performance.now() - t0) > 15;

  /* Dispositivos lentos/mobile usam heurística (sem medição DOM) */
  _aeForcarHeuristica = AE.device.mobile || AE.device.lowMemory || AE.device.slowCPU;
  console.log('[LAYOUT] Device:', AE.device, '| heurística:', _aeForcarHeuristica);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') aeDetectarDispositivo();
  else window.addEventListener('load', aeDetectarDispositivo, { once: true });
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 1 — MODELO DE LINHAS
   Base estável: Georgia 12pt, line-height 1.5, 155mm útil.
   Em linhas (não px) — independente de DPI e render engine.
════════════════════════════════════════════════════════════ */
const LINE_MODEL = {
  PX_POR_LINHA:   24,  /* Georgia 12pt × 1.5 */
  CHARS_POR_LINHA: 68, /* largura útil 155mm */
  LINHAS: {
    titulo_cap: 4.5,  /* heading + espacador + borda */
    h2:         2.2,
    h3:         1.8,
    ref_item:   2.0,
    paragrafo:  null, /* calculado dinamicamente */
    espaco:     0.8,
  },
  MIN_LINHAS_SECAO: 6, /* mínimo após subtítulo */
};

function linhasBloco(bloco) {
  if (bloco.tipo === 'paragrafo') {
    const chars = (bloco.texto || '').length;
    return Math.max(1, Math.ceil(chars / LINE_MODEL.CHARS_POR_LINHA)) + 0.3;
  }
  return LINE_MODEL.LINHAS[bloco.tipo] ?? 1.5;
}

function pxBloco(bloco) {
  return Math.round(linhasBloco(bloco) * LINE_MODEL.PX_POR_LINHA);
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 2 — ESTRUTURAÇÃO SEMÂNTICA
   Converte secções brutas em blocos tipados com hierarquia.
════════════════════════════════════════════════════════════ */
function docEstruturarSemantico(secs) {
  const blocos = [];
  for (const sec of secs) {
    const txt = sanitizarConteudo(sec.c || sec.conteudo || '');
    const isRef = /refer[eê]ncias|bibliograf/i.test(sec.titulo || '');

    /* Título do capítulo */
    blocos.push({ tipo: 'titulo_cap', titulo: sec.titulo, num: sec.num || '' });

    if (isRef) {
      /* Referências: cada linha é um item APA */
      txt.split('\n').map(l => l.trim()).filter(l => l.length > 10).forEach(linha => {
        blocos.push({ tipo: 'ref_item', texto: linha });
      });
    } else {
      docEstruturarSemanticoTexto(sec, txt, blocos);
    }
  }
  return blocos;
}

function docEstruturarSemanticoTexto(sec, txt, blocos) {
  const linhas = txt.split('\n');
  let primeiroPar = true;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;

    /* Detectar subtítulos numerados (ex: "1.1 Contextualização") */
    const isSubSecH2 = /^\d+\.\d+\s+[A-ZÁÉÍÓÚÀ]/.test(linha) && linha.length < 90;
    const isSubSecH3 = /^\d+\.\d+\.\d+\s+[A-ZÁÉÍÓÚÀ]/.test(linha) && linha.length < 90;
    /* Subtítulos não numerados: linha curta em maiúsculas ou caps */
    const isTituloLinha = !isSubSecH2 && !isSubSecH3 && linha.length < 70
      && (linha === linha.toUpperCase() || /^[A-ZÁÉÍÓÚÀ][^.!?]{4,60}$/.test(linha))
      && !/[.!?,;]$/.test(linha);

    if (isSubSecH3) {
      blocos.push({ tipo: 'h3', texto: linha });
      primeiroPar = true;
    } else if (isSubSecH2) {
      blocos.push({ tipo: 'h2', texto: linha });
      primeiroPar = true;
    } else if (isTituloLinha && i > 0) {
      blocos.push({ tipo: 'h2', texto: linha });
      primeiroPar = true;
    } else if (linha.length > 30) {
      blocos.push({ tipo: 'paragrafo', texto: linha, noIndent: primeiroPar });
      primeiroPar = false;
    }
  }
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 3 — PRE-RENDER PIPELINE
   blocos → grupos hierárquicos → paginação por linhas → páginas
════════════════════════════════════════════════════════════ */

/* PASSO 3.1 — Agrupar com IDs hierárquicos */
function preRenderAgrupar(blocos) {
  const grupos = [];
  let i = 0, seq = 0;
  let currentChapterId = null;
  const nextId = p => `${p}-${++seq}`;

  while (i < blocos.length) {
    const b = blocos[i];

    if (b.tipo === 'titulo_cap') {
      const id = nextId('c');
      currentChapterId = id;
      const grupo = { id, chapter_id: id, section_id: null, tipo: 'chapter_group', blocos: [b], linhasTotal: linhasBloco(b) };
      i++;
      let nPars = 0, nSubs = 0;
      while (i < blocos.length && blocos[i].tipo !== 'titulo_cap') {
        const nb = blocos[i];
        grupo.blocos.push(nb);
        grupo.linhasTotal += linhasBloco(nb);
        if (nb.tipo === 'paragrafo') nPars++;
        if (nb.tipo === 'h2' || nb.tipo === 'h3') nSubs++;
        i++;
        if (nSubs >= 1 && nPars >= 3) break;
      }
      grupos.push(grupo);
      continue;
    }

    if (b.tipo === 'h2' || b.tipo === 'h3') {
      const id = nextId('s');
      const grupo = { id, chapter_id: currentChapterId, section_id: id, tipo: 'section_group', blocos: [b], linhasTotal: linhasBloco(b), linhasConteudo: 0 };
      i++;
      while (i < blocos.length) {
        const nb = blocos[i];
        if (nb.tipo === 'titulo_cap' || nb.tipo === 'h2' || nb.tipo === 'h3') break;
        const l = linhasBloco(nb);
        grupo.blocos.push(nb);
        grupo.linhasTotal    += l;
        grupo.linhasConteudo += l;
        i++;
      }
      grupos.push(grupo);
      continue;
    }

    if (b.tipo === 'ref_item') {
      const id = nextId('r');
      const grupo = { id, chapter_id: currentChapterId, section_id: null, tipo: 'ref_group', blocos: [], linhasTotal: 0 };
      while (i < blocos.length && blocos[i].tipo === 'ref_item') {
        grupo.blocos.push(blocos[i]);
        grupo.linhasTotal += linhasBloco(blocos[i]);
        i++;
      }
      grupos.push(grupo);
      continue;
    }

    grupos.push({ id: nextId('b'), chapter_id: currentChapterId, section_id: null, tipo: 'single', blocos: [b], linhasTotal: linhasBloco(b) });
    i++;
  }
  return grupos;
}

/* PASSO 3.2 — Constraint Engine (line-based) */
function preRenderConstraintEngine(grupos) {
  const AREA_L     = Math.round(PDF.AREA * 0.88) / LINE_MODEL.PX_POR_LINHA;
  const AREA_CAP_L = Math.round(PDF.AREA * 0.95) / LINE_MODEL.PX_POR_LINHA;
  const MIN_SEC_L  = LINE_MODEL.MIN_LINHAS_SECAO;

  const paginas = [];
  let paginaActual = [], linhasUsadas = 0;

  const novaPageBreak = () => {
    if (paginaActual.length > 0) { paginas.push(paginaActual); paginaActual = []; linhasUsadas = 0; }
  };

  const adicionarBloco = bloco => {
    const l = linhasBloco(bloco);
    if (linhasUsadas + l > AREA_L && paginaActual.length > 0) novaPageBreak();
    paginaActual.push(bloco);
    linhasUsadas += l;
  };

  for (const grupo of grupos) {
    const gL = grupo.linhasTotal;

    if (grupo.tipo === 'chapter_group') {
      if (paginaActual.length > 0) novaPageBreak();
      if (gL <= AREA_CAP_L) {
        grupo.blocos.forEach(b => { paginaActual.push(b); linhasUsadas += linhasBloco(b); });
      } else {
        grupo.blocos.forEach(b => {
          const l = linhasBloco(b);
          if (linhasUsadas + l > AREA_CAP_L && paginaActual.length > 0) novaPageBreak();
          paginaActual.push(b);
          linhasUsadas += l;
        });
      }
      continue;
    }

    if (grupo.tipo === 'section_group') {
      const lSub   = linhasBloco(grupo.blocos[0]);
      const lCont  = grupo.linhasConteudo || 0;
      const guarda = lSub + Math.min(lCont, MIN_SEC_L);
      if (linhasUsadas + guarda > AREA_L && paginaActual.length > 0) novaPageBreak();
      grupo.blocos.forEach(b => {
        const l = linhasBloco(b);
        if (linhasUsadas + l > AREA_L && paginaActual.length > 0) novaPageBreak();
        paginaActual.push(b);
        linhasUsadas += l;
      });
      continue;
    }

    if (grupo.tipo === 'ref_group') {
      if (linhasUsadas + gL > AREA_L && paginaActual.length > 0) novaPageBreak();
      grupo.blocos.forEach(adicionarBloco);
      continue;
    }

    adicionarBloco(grupo.blocos[0]);
  }

  if (paginaActual.length > 0) paginas.push(paginaActual);
  return paginas;
}

/* PASSO 3.3 — Stress Validator (loga, não bloqueia) */
function preRenderStressValidate(paginas, grupos) {
  const erros = [];
  for (let pi = 0; pi < paginas.length; pi++) {
    const pg   = paginas[pi];
    const nPg  = pi + 3;
    const ult  = pg[pg.length - 1];
    if (pg.length === 1 && pg[0].tipo === 'titulo_cap')
      erros.push({ sev: 'CRITICO', msg: `Cap. "${pg[0].titulo}" sozinho na pág. ${nPg}` });
    if (ult && (ult.tipo === 'h2' || ult.tipo === 'h3'))
      erros.push({ sev: 'CRITICO', msg: `Subtítulo "${ult.texto}" órfão no fim da pág. ${nPg}` });
    const nPars = pg.filter(b => b.tipo === 'paragrafo').length;
    if (!pg.some(b => b.tipo === 'titulo_cap') && nPars < 2 && pi > 0)
      erros.push({ sev: 'AVISO', msg: `Pág. ${nPg} só tem ${nPars} parágrafo(s)` });
  }
  if (erros.length > 0) {
    console.group('[LAYOUT] Stress Validation');
    erros.forEach(e => (e.sev === 'CRITICO' ? console.error : console.warn)(`[${e.sev}] ${e.msg}`));
    console.groupEnd();
  } else {
    console.log(`[LAYOUT] ✓ ${paginas.length} páginas OK`);
  }
  return erros;
}

/* API PÚBLICA DO PIPELINE */
function preRenderPipeline(blocos) {
  const grupos  = preRenderAgrupar(blocos);
  const paginas = preRenderConstraintEngine(grupos);
  preRenderStressValidate(paginas, grupos);
  return paginas.filter(pg => pg && pg.length > 0 &&
    pg.some(b => ['titulo_cap','h2','h3','paragrafo','ref_item'].includes(b.tipo))
  );
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 4 — VALIDAÇÃO DE ANOMALIAS
════════════════════════════════════════════════════════════ */
function layoutValidarDocumento(paginasDeBlocos, blocos) {
  const avisos = [];
  const nPags  = paginasDeBlocos.length;
  if (nPags < 2)   avisos.push('Documento com menos de 2 páginas de conteúdo.');
  if (nPags > 200) avisos.push(`Documento muito longo (${nPags} páginas) — pode demorar.`);
  const semRef = !blocos.some(b => b.tipo === 'ref_item');
  if (semRef) avisos.push('Referências bibliográficas não detectadas.');
  if (avisos.length > 0) console.warn('[LAYOUT] Avisos:', avisos);
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 5 — TOC REAL
   Percorre as páginas distribuídas e extrai a página real
   de cada título de capítulo.
════════════════════════════════════════════════════════════ */
function layoutGerarTOCReal(paginasDeBlocos) {
  const mapa = [];
  for (let pi = 0; pi < paginasDeBlocos.length; pi++) {
    const tc = paginasDeBlocos[pi].find(b => b.tipo === 'titulo_cap');
    if (tc) mapa.push({ num: tc.num, titulo: tc.titulo, pgInicio: pi + 3 }); /* +3: capa + pré-textuais + TOC */
  }
  return mapa;
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 6 — RENDERIZAÇÃO DE PÁGINA
   Recebe lista de blocos → devolve HTML da página A4
════════════════════════════════════════════════════════════ */
function layoutRenderPagina(blocos, opts) {
  const { num, total, titulo, nomeCap, watermark } = opts;
  const linhas = blocos.map(bloco => layoutHtmlBloco(bloco)).join('');

  return `<div class="pg" data-pg="${num}">
  <div class="pg-head">
    <span class="pg-head-titulo">${(nomeCap || titulo || '').substring(0, 60)}</span>
  </div>
  <div class="pg-corpo">${linhas}</div>
  <div class="pg-rodape">
    <span class="pg-rodape-doc">${(titulo || '').substring(0, 45)}</span>
    <span class="pg-rodape-num">— ${num} —</span>
    <span class="pg-rodape-data">${new Date().getFullYear()}</span>
  </div>
  ${watermark ? '<div class="pg-wm">ACADEMY · RASCUNHO</div>' : ''}
</div>`;
}

/* HTML de um bloco dentro de uma página */
function layoutHtmlBloco(bloco) {
  const t = (bloco.texto || bloco.titulo || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  switch (bloco.tipo) {
    case 'titulo_cap':
      return `<div class="cap-titulo"><span class="cap-num">${bloco.num || ''}</span>${bloco.titulo}</div>`;
    case 'h2':
      return `<h3 class="sub-h2">${t}</h3>`;
    case 'h3':
      return `<h4 class="sub-h3">${t}</h4>`;
    case 'paragrafo':
      return `<p class="par${bloco.noIndent ? ' no-indent' : ''}">${t}</p>`;
    case 'ref_item':
      return `<p class="ref-item">${t}</p>`;
    case 'espaco':
      return `<div style="height:${bloco.altura || 20}px"></div>`;
    default:
      return `<p class="par">${t}</p>`;
  }
}

/* Versão para medição DOM (heurística idêntica ao HTML real) */
function layoutHtmlBlocoMed(bloco) {
  const t = (bloco.texto || bloco.titulo || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  switch (bloco.tipo) {
    case 'titulo_cap': return `<div style="height:8mm"></div><h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:17pt;font-weight:700;line-height:1.25;padding-bottom:7pt;border-bottom:2pt solid #111;margin-bottom:14pt">${t}</h2>`;
    case 'h2':         return `<h3 style="font-size:13pt;font-weight:700;line-height:1.4;margin:18pt 0 8pt;padding-left:8pt;border-left:3pt solid #333">${t}</h3>`;
    case 'h3':         return `<h4 style="font-size:12pt;font-weight:600;font-style:italic;line-height:1.4;margin:14pt 0 6pt">${t}</h4>`;
    case 'ref_item':   return `<p style="font-size:11pt;line-height:1.75;text-indent:-2em;padding-left:2em;margin-bottom:10pt">${t}</p>`;
    case 'paragrafo':  return `<p style="font-size:12pt;line-height:1.5;text-indent:${bloco.noIndent ? '0' : '1.25cm'};margin-bottom:10pt;text-align:justify">${t}</p>`;
    default:           return `<p style="font-size:12pt;line-height:1.5">${t}</p>`;
  }
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 7 — HTML DAS PÁGINAS ESPECIAIS
════════════════════════════════════════════════════════════ */
function renderPagina(html, opts) {
  const { num, total, titulo, isCapa, isTOC, watermark } = opts;
  return `<div class="pg${isCapa ? ' pg-capa' : isTOC ? ' pg-toc' : ''}" data-pg="${num}">
  ${!isCapa && !isTOC ? `<div class="pg-head"><span class="pg-head-titulo">${(titulo || '').substring(0, 55)}</span></div>` : ''}
  <div class="pg-corpo">${html}</div>
  ${!isCapa ? `<div class="pg-rodape">
    <span class="pg-rodape-doc">${(titulo || '').substring(0, 40)}</span>
    <span class="pg-rodape-num">— ${num} —</span>
    <span class="pg-rodape-data">${new Date().getFullYear()}</span>
  </div>` : ''}
  ${watermark ? '<div class="pg-wm">ACADEMY · RASCUNHO</div>' : ''}
</div>`;
}

function htmlCapa(meta) {
  const capaObj    = State.get('capa') || {};
  const usarCapa   = capaObj.usarCapa !== false;
  const logoInst   = capaObj.logoInst   || meta.logoInst   || null;
  const capaImg    = capaObj.imagem     || meta.capaImg    || null;
  const autores    = (meta.autor || '').split('\n').filter(Boolean);

  return `
  <div style="position:relative;min-height:${PDF.ALTURA - PDF.MARGEM_V * 2}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:0">

    ${capaImg ? `<div style="position:absolute;inset:0;background:url('${capaImg}') center/cover;opacity:.06;border-radius:4px"></div>` : ''}

    ${logoInst ? `<img src="${logoInst}" style="height:56px;object-fit:contain;margin-bottom:18px;opacity:.85" alt="logo">` : ''}

    <div style="font-family:Georgia,serif;font-size:8.5pt;letter-spacing:.18em;text-transform:uppercase;color:#555;margin-bottom:6px;position:relative">${meta.inst || ''}</div>
    <div style="font-family:Georgia,serif;font-size:8pt;color:#777;margin-bottom:28px;position:relative">${meta.nivel || ''}</div>

    <div style="width:70mm;height:1px;background:#111;margin:0 auto 14px"></div>
    <div style="font-family:Georgia,serif;font-size:8pt;letter-spacing:.2em;text-transform:uppercase;color:#555;margin-bottom:12px;position:relative">${meta.sigla || meta.tipo || 'Trabalho Académico'}</div>
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20pt;font-weight:600;font-style:italic;color:#111;max-width:370px;line-height:1.4;margin:0 auto 18px;position:relative">${meta.titulo || ''}</h1>
    <div style="width:70mm;height:1px;background:#111;margin:0 auto 20px"></div>

    ${autores.map(a => `<div style="font-family:Georgia,serif;font-size:11pt;font-weight:700;color:#111;line-height:1.5;position:relative">${a}</div>`).join('')}
    ${(meta.mbs || []).map(m => `<div style="font-family:Georgia,serif;font-size:10pt;color:#444;line-height:1.5;position:relative">${m.nome || 'Integrante'}</div>`).join('')}
    ${meta.prof ? `<div style="font-family:Georgia,serif;font-size:9pt;font-style:italic;color:#555;margin-top:10px;position:relative">Orientador: ${meta.prof}</div>` : ''}
    <div style="font-family:Georgia,serif;font-size:9pt;color:#777;margin-top:18px;position:relative">${meta.data || ''}</div>
  </div>`;
}

function htmlTOC(mapa) {
  const linhas = mapa.map(item =>
    `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:.5pt dotted #DDD">
      <span style="font-family:Georgia,serif;font-size:11pt;color:#111">${item.num ? item.num + '. ' : ''}${item.titulo}</span>
      <span style="font-family:Georgia,serif;font-size:10pt;color:#555;flex-shrink:0;margin-left:12px">${item.pgInicio}</span>
    </div>`
  ).join('');

  return `<div style="padding:40px 0">
    <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18pt;font-weight:700;text-transform:uppercase;border-bottom:1.5pt solid #111;padding-bottom:10px;margin-bottom:24px;letter-spacing:.04em">Índice</h2>
    ${linhas}
  </div>`;
}

function htmlPretextuais(cfg) {
  const pags = [];
  if (cfg.dedicatoria?.trim()) {
    pags.push(`<div style="display:flex;align-items:center;justify-content:center;min-height:${PDF.ALTURA - PDF.MARGEM_V * 2}px">
      <div style="text-align:right;max-width:300px">
        <div style="font-family:Georgia,serif;font-size:11pt;font-style:italic;color:#333;line-height:1.8">${cfg.dedicatoria}</div>
      </div>
    </div>`);
  }
  if (cfg.agradecimentos?.trim()) {
    pags.push(`<div style="padding:40px 0">
      <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16pt;font-weight:700;text-transform:uppercase;border-bottom:1.5pt solid #111;padding-bottom:8px;margin-bottom:20px">Agradecimentos</h3>
      <p style="font-family:Georgia,serif;font-size:11pt;line-height:1.8;text-align:justify;color:#222">${cfg.agradecimentos}</p>
    </div>`);
  }
  if (cfg.epigrafe?.trim()) {
    pags.push(`<div style="display:flex;align-items:center;justify-content:center;min-height:${PDF.ALTURA - PDF.MARGEM_V * 2}px">
      <div style="text-align:right;max-width:340px;border-right:2pt solid #333;padding-right:20px">
        <div style="font-family:Georgia,serif;font-size:12pt;font-style:italic;color:#222;line-height:1.75">"${cfg.epigrafe}"</div>
        ${cfg.epigrafAutor ? `<div style="font-family:Georgia,serif;font-size:10pt;color:#555;margin-top:10px">— ${cfg.epigrafAutor}</div>` : ''}
      </div>
    </div>`);
  }
  return pags;
}

function htmlPostextuais(cfg) {
  const itens = cfg.postextuais || [];
  if (!itens.length) return [];
  return itens.map(item => {
    switch (item.tipo) {
      case 'glossario':
        return `<div style="padding:40px 0">
          <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16pt;font-weight:700;border-bottom:1.5pt solid #111;padding-bottom:8px;margin-bottom:20px;text-transform:uppercase">Glossário</h3>
          <div><strong style="font-family:Georgia,serif;font-size:11pt">${item.termo}</strong> — <span style="font-family:Georgia,serif;font-size:11pt;color:#333">${item.definicao || ''}</span></div>
        </div>`;
      case 'abreviatura':
        return `<div style="padding:40px 0">
          <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16pt;font-weight:700;border-bottom:1.5pt solid #111;padding-bottom:8px;margin-bottom:20px;text-transform:uppercase">Lista de Abreviaturas</h3>
          <div style="display:flex;gap:16px;font-family:Georgia,serif;font-size:11pt"><strong>${item.abrev}</strong><span>—</span><span>${item.significado || ''}</span></div>
        </div>`;
      default:
        return `<div style="padding:40px 0">
          <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16pt;font-weight:700;border-bottom:1.5pt solid #111;padding-bottom:8px;margin-bottom:20px;text-transform:uppercase">${item.titulo || item.tipo}</h3>
          <p style="font-family:Georgia,serif;font-size:11pt;line-height:1.8;text-align:justify">${item.conteudo || ''}</p>
        </div>`;
    }
  });
}

function htmlContracapa(meta) {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-height:${PDF.ALTURA - PDF.MARGEM_V * 2}px;text-align:center;padding-bottom:40px;gap:6px">
    <div style="font-family:Georgia,serif;font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;color:#AAAAAA">Produzido por</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14pt;font-weight:700;color:#333;letter-spacing:.06em">ACADEMY</div>
    <div style="font-family:Georgia,serif;font-size:8pt;color:#AAAAAA;letter-spacing:.08em">Grupo AGEA Comercial · CEO Adelino Graça</div>
    <div style="font-family:Georgia,serif;font-size:8pt;color:#BBBBBB;margin-top:4px">angola.academy · ${new Date().getFullYear()}</div>
  </div>`;
}

function htmlMediaItem(item, idx) {
  switch (item.tipo) {
    case 'imagem':
      return `<div style="margin:16px 0;text-align:center">
        <img src="${item.src}" style="max-width:100%;max-height:180px;object-fit:contain;border:1px solid #EEE" alt="${item.legenda || ''}"/>
        <div style="font-family:Georgia,serif;font-size:9pt;color:#555;margin-top:6px;font-style:italic">Figura ${idx}. ${item.legenda || ''}</div>
      </div>`;
    case 'tabela':
      return `<div style="margin:16px 0">
        <div style="font-family:Georgia,serif;font-size:9pt;color:#555;margin-bottom:6px;font-style:italic">Tabela ${idx}. ${item.titulo || ''}</div>
        <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;font-size:10pt">
          <tr style="background:#F5F5F5"><th style="padding:6px;border:1px solid #DDD">Dados</th></tr>
          <tr><td style="padding:6px;border:1px solid #DDD">—</td></tr>
        </table>
      </div>`;
    case 'grafico':
      return `<div style="margin:16px 0;padding:20px;background:#F9F9F9;border:1px solid #EEE;text-align:center">
        <div style="font-family:Georgia,serif;font-size:10pt;color:#999">Gráfico ${idx}. ${item.titulo || ''}</div>
      </div>`;
    default:
      return '';
  }
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 8 — ORQUESTRADOR PRINCIPAL
   Monta o documento completo: capa + TOC + conteúdo
════════════════════════════════════════════════════════════ */
function montarDocumentoPDF(secs, meta) {
  /* Limpar cache entre gerações */
  const data   = new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' });
  const metaC  = { ...meta, data };
  const wm     = !!meta.watermark;

  /* 1. Estruturar semanticamente */
  const blocos = docEstruturarSemantico(secs);

  /* 2. Distribuir por páginas */
  const paginasDeBlocos = preRenderPipeline(blocos);
  layoutValidarDocumento(paginasDeBlocos, blocos);

  /* 3. TOC real */
  const mapaCapTOC = layoutGerarTOCReal(paginasDeBlocos);
  const totalPgs   = 2 + paginasDeBlocos.length;

  const paginas = [];

  /* Capa */
  paginas.push(renderPagina(htmlCapa(metaC), { num: 1, total: totalPgs, titulo: metaC.titulo, isCapa: true, watermark: wm }));

  /* Pré-textuais */
  const pretexts = htmlPretextuais(meta.cfg || State.get('cfg') || {});
  pretexts.forEach((html, pi) => {
    paginas.push(renderPagina(html, { num: 2 + pi, total: totalPgs, titulo: metaC.titulo, isCapa: false, watermark: wm }));
  });
  const offsetTOC = 1 + pretexts.length;

  /* TOC */
  paginas.push(renderPagina(htmlTOC(mapaCapTOC), { num: 1 + offsetTOC, total: totalPgs, titulo: metaC.titulo, isTOC: true, watermark: wm }));

  /* Conteúdo */
  const pgsValidas = paginasDeBlocos.filter(pg =>
    pg && pg.some(b => ['titulo_cap','h2','h3','paragrafo','ref_item'].includes(b.tipo))
  );
  let nomeCap = '';
  pgsValidas.forEach((pg, pi) => {
    const tc = pg.find(b => b.tipo === 'titulo_cap');
    if (tc) nomeCap = tc.titulo;
    paginas.push(layoutRenderPagina(pg, {
      num: 2 + offsetTOC + pi, total: totalPgs,
      titulo: metaC.titulo, nomeCap: tc ? '' : nomeCap, watermark: wm,
    }));
  });

  /* Media sem página definida → Anexos */
  const allMedia    = (meta.cfg || State.get('cfg') || {}).mediaItems || [];
  const mediaSemPag = allMedia.filter(m => !m.pag);
  if (mediaSemPag.length > 0) {
    const mediaHtml = `<div style="padding:40px 0">
      <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16pt;font-weight:700;text-transform:uppercase;border-bottom:1.5pt solid #111;padding-bottom:8px;margin-bottom:20px">Anexos</h2>
      ${mediaSemPag.map((item, i) => htmlMediaItem(item, i + 1)).join('<div style="margin:14px 0;border-top:.5pt solid #EEE"></div>')}
    </div>`;
    paginas.push(renderPagina(mediaHtml, { num: paginas.length + 1, total: totalPgs, titulo: metaC.titulo, watermark: wm }));
  }

  /* Pós-textuais */
  htmlPostextuais(meta.cfg || State.get('cfg') || {}).forEach(html => {
    paginas.push(renderPagina(html, { num: paginas.length + 1, total: totalPgs, titulo: metaC.titulo, watermark: wm }));
  });

  /* Contracapa */
  paginas.push(renderPagina(htmlContracapa(meta), { num: paginas.length + 1, total: totalPgs + 1, titulo: metaC.titulo, isCapa: true, watermark: false }));

  return { paginas, totalPgs: paginas.length };
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 9 — CSS DO PDF
   Todo o CSS da visualização A4 num único lugar.
   Quando o layout tem um bug visual → editar aqui.
════════════════════════════════════════════════════════════ */
function cssPDF() {
  return `
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#E8E8E8; font-family:Georgia,'Times New Roman',serif; }

.pdf-toolbar {
  position:fixed; top:0; left:0; right:0; z-index:100;
  background:#1A1A2E; padding:10px 20px;
  display:flex; align-items:center; gap:14px; flex-wrap:wrap;
  box-shadow:0 2px 12px rgba(0,0,0,.4);
}
.pdf-toolbar-btn {
  padding:8px 20px; border-radius:8px; border:none; cursor:pointer;
  font-family:Georgia,serif; font-size:11pt; font-weight:700;
  background:linear-gradient(135deg,#3FE8A7,#1E92FF); color:#050D1A;
  transition:opacity .2s;
}
.pdf-toolbar-btn:hover { opacity:.85; }
.pdf-toolbar-btn.word { background:linear-gradient(135deg,#2B5CE6,#1A3ECC); color:#fff; }
.pdf-toolbar-info { font-family:Georgia,serif; font-size:9pt; color:#AAA; }
.pdf-toolbar-tip  { font-family:Georgia,serif; font-size:8pt;  color:#666; margin-left:auto; }

.pdf-canvas {
  padding:80px 20px 40px;
  display:flex; flex-direction:column; align-items:center; gap:24px;
}

/* Página A4 */
.pg {
  width:${PDF.LARGURA}px; min-height:${PDF.ALTURA}px;
  background:#fff; position:relative; overflow:hidden;
  padding:${PDF.MARGEM_V}px ${PDF.MARGEM_DIR}px ${PDF.MARGEM_V}px ${PDF.MARGEM_ESQ}px;
  box-shadow:0 4px 24px rgba(0,0,0,.18);
  page-break-after:always;
}

/* Cabeçalho */
.pg-head {
  position:absolute; top:28px; left:${PDF.MARGEM_ESQ}px; right:${PDF.MARGEM_DIR}px;
  border-bottom:.75pt solid #CCCCCC; padding-bottom:6px;
  display:flex; align-items:center; justify-content:flex-start;
}
.pg-head-titulo {
  font-family:Georgia,serif; font-size:7.5pt; color:#888888;
  letter-spacing:.06em; text-transform:uppercase;
}

/* Rodapé */
.pg-rodape {
  position:absolute; bottom:28px; left:${PDF.MARGEM_ESQ}px; right:${PDF.MARGEM_DIR}px;
  border-top:.75pt solid #CCCCCC; padding-top:6px;
  display:flex; align-items:center; justify-content:space-between;
}
.pg-rodape-doc  { font-family:Georgia,serif; font-size:7pt; color:#AAAAAA; }
.pg-rodape-num  { font-family:Georgia,serif; font-size:8pt;  color:#666666; }
.pg-rodape-data { font-family:Georgia,serif; font-size:7pt; color:#AAAAAA; }

/* Watermark */
.pg-wm {
  position:absolute; top:50%; left:50%;
  transform:translate(-50%,-50%) rotate(-35deg);
  font-family:Georgia,serif; font-size:48pt; font-weight:900;
  color:rgba(0,0,0,.04); pointer-events:none; user-select:none;
  letter-spacing:.1em; white-space:nowrap;
}

/* Corpo */
.pg-corpo { padding-top:24px; }

/* Capítulos */
.cap-titulo {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:17pt; font-weight:700; line-height:1.25;
  color:#0A0A0A; padding-bottom:7pt;
  border-bottom:2pt solid #111111; margin-bottom:16pt;
  margin-top:8mm;
}
.cap-num { display:inline-block; margin-right:10px; color:#555; font-size:14pt; }

/* Subtítulos */
.sub-h2 {
  font-family:Georgia,serif; font-size:13pt; font-weight:700; line-height:1.4;
  margin:18pt 0 8pt; padding-left:8pt; border-left:3pt solid #333333; color:#1A1A1A;
}
.sub-h3 {
  font-family:Georgia,serif; font-size:12pt; font-weight:600; font-style:italic;
  line-height:1.4; margin:14pt 0 6pt; color:#2A2A2A;
}

/* Parágrafos */
.par {
  font-family:Georgia,serif; font-size:12pt; line-height:1.65;
  text-align:justify; text-indent:1.25cm; margin-bottom:8pt; color:#111111;
}
.par.no-indent { text-indent:0; }

/* Referências APA */
.ref-item {
  font-family:Georgia,serif; font-size:11pt; line-height:1.75;
  text-indent:-2em; padding-left:2em; margin-bottom:10pt; color:#111111;
}

@media print {
  body { background:#fff; }
  .pdf-toolbar { display:none; }
  .pdf-canvas  { padding:0; gap:0; }
  .pg { box-shadow:none; page-break-after:always; }
  @page { size:A4; margin:0; }
}`;
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 10 — ENTRADA PÚBLICA
   gerarJanelaPDF() — chamado por export.js
════════════════════════════════════════════════════════════ */
function gerarJanelaPDF(secs, meta) {
  const { paginas, totalPgs } = montarDocumentoPDF(secs, meta);
  const titulo = (meta.titulo || 'ACADEMY').replace(/"/g, '&quot;');

  const metaJSON = JSON.stringify(meta);
  const secsJSON = JSON.stringify(
    secs.map(s => ({ num: s.num || s.numero, titulo: s.titulo, c: s.c || s.conteudo || '' }))
  );

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${titulo} — PDF</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<style>${cssPDF()}</style>
</head>
<body>

<div class="pdf-toolbar">
  <button class="pdf-toolbar-btn" onclick="window.print()">⬇ Guardar PDF</button>
  <button class="pdf-toolbar-btn word" onclick="guardarWord()">📝 Exportar Word</button>
  <div class="pdf-toolbar-info">${totalPgs} páginas · A4 · Académico</div>
  <div class="pdf-toolbar-tip">Ctrl + P → "Guardar como PDF" → Sem margens → OK</div>
</div>

<div class="pdf-canvas">
${paginas.join('\n')}
</div>

<div style="text-align:center;font-family:Georgia,serif;font-size:8pt;color:#BBBBBB;letter-spacing:.06em;padding:14px 0 24px">
  Para trabalhos académicos: 937 876 711 · 958 614 517
</div>

<script>
const _meta = ${metaJSON};
const _secs = ${secsJSON};

function guardarWord() {
  const data = new Date().toLocaleDateString('pt-PT', { year:'numeric', month:'long' });
  const autores = (_meta.autor || '').split('\\n').filter(Boolean);
  const caps = _secs.map((s, i) => \`
    <div style="page-break-before:\${i===0?'auto':'always'}">
      <h1 style="font-family:Georgia,serif;font-size:16pt;font-weight:700;border-bottom:1.5pt solid #111;padding-bottom:6pt;margin:24pt 0 16pt">\${s.num||i+1}. \${s.titulo}</h1>
      \${(s.c||'').split('\\n\\n').filter(Boolean).map((p,pi)=>\`<p style="font-family:Georgia,serif;font-size:12pt;line-height:1.65;text-align:justify;text-indent:\${pi===0?'0':'1.25cm'};margin-bottom:10pt">\${p}</p>\`).join('')}
    </div>\`).join('');
  const wordHTML = \`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>@page{size:A4;margin:3cm 2.5cm 2.5cm 3cm}body{font-family:Georgia,serif;font-size:12pt;color:#111;line-height:1.65}</style>
    </head><body>
    <div style="min-height:29.7cm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always">
      \${_meta.inst?\`<p style="font-size:10pt;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:6pt">\${_meta.inst}</p>\`:''}
      <h1 style="font-family:Georgia,serif;font-size:20pt;font-style:italic;max-width:380px;line-height:1.4;margin:0 auto 20pt">\${_meta.titulo}</h1>
      \${autores.map(a=>\`<p style="font-size:11.5pt;font-weight:700">\${a}</p>\`).join('')}
      \${_meta.prof?\`<p style="font-size:10pt;font-style:italic;color:#555;margin-top:6pt">Orientador: \${_meta.prof}</p>\`:''}
      <p style="font-size:10pt;color:#666;margin-top:10pt">\${data}</p>
    </div>
    \${caps}
    </body></html>\`;
  const nome = (_meta.titulo||'ACADEMY').substring(0,50).replace(/[^\\w\\s]/g,'').trim().replace(/\\s+/g,'_');
  const blob = new Blob(['\\ufeff', wordHTML], { type:'application/msword;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = nome + '.doc';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
<\/script>
</body>
</html>`;

  /* Abrir numa nova janela/tab */
  const janela = window.open('', '_blank');
  if (janela) {
    janela.document.write(html);
    janela.document.close();
  } else {
    /* Fallback: download directo como ficheiro HTML */
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = (meta.titulo || 'ACADEMY').substring(0, 40).replace(/[^\w\s]/g, '').trim() + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    mostrarToast('📄 PDF descarregado como ficheiro — abre no browser para imprimir.');
  }
}
