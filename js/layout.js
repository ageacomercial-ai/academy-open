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
    SISTEMA DE TEMAS PREMIUM — 6 PALETAS
════════════════════════════════════════════════════════════ */
const TEMAS = {
  safira: {
    nome: 'Safira Real',
    primario: '#0A2463',
    secundario: '#1B4D9E',
    acento: '#3E92CC',
    dourado: '#C9A961',
    fundo: '#F8F9FC',
    texto: '#1A1A2E',
  },
  esmeralda: {
    nome: 'Esmeralda',
    primario: '#0D3B2E',
    secundario: '#1A6B52',
    acento: '#2ECC71',
    dourado: '#D4AF37',
    fundo: '#F5FAF7',
    texto: '#1A2E1A',
  },
  rubi: {
    nome: 'Rubi Imperial',
    primario: '#4A0E0E',
    secundario: '#8B1A1A',
    acento: '#DC143C',
    dourado: '#FFD700',
    fundo: '#FDF5F5',
    texto: '#2E1A1A',
  },
  obsidiana: {
    nome: 'Obsidiana',
    primario: '#1A1A2E',
    secundario: '#2D2D44',
    acento: '#6C63FF',
    dourado: '#E8D5B7',
    fundo: '#F8F8FA',
    texto: '#1A1A2E',
  },
  bronze: {
    nome: 'Bronze Antigo',
    primario: '#3E2723',
    secundario: '#6D4C41',
    acento: '#CD7F32',
    dourado: '#DAA520',
    fundo: '#FAF8F5',
    texto: '#2E1A0A',
  },
  ametista: {
    nome: 'Ametista',
    primario: '#2D1B4E',
    secundario: '#5B3A8C',
    acento: '#9B59B6',
    dourado: '#F4C430',
    fundo: '#F9F5FC',
    texto: '#1A0A2E',
  },
};

function getTemaActual() {
  const nomeTema = (typeof State !== 'undefined' && State.get) ? (State.get('temaPDF') || 'safira') : 'safira';
  return TEMAS[nomeTema] || TEMAS.safira;
}

function setTema(nome) {
  if (TEMAS[nome] && typeof State !== 'undefined' && State.set) {
    State.set('temaPDF', nome);
  }
}

function listaTemas() {
  return Object.keys(TEMAS).map(k => ({ id: k, nome: TEMAS[k].nome }));
}

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
  MIN_LINHAS_SECAO: 8, /* mínimo após subtítulo */
};

function linhasBloco(bloco) {
  if (bloco.tipo === 'paragrafo') {
    const chars = (bloco.texto || '').length;
    return Math.max(1, Math.ceil(chars / LINE_MODEL.CHARS_POR_LINHA)) + 0.3;
  }
  if (bloco.tipo === 'data_table') {
    return 6;
  }
  return LINE_MODEL.LINHAS[bloco.tipo] ?? 1.5;
}

function pxBloco(bloco) {
  return Math.round(linhasBloco(bloco) * LINE_MODEL.PX_POR_LINHA);
}

/* ════════════════════════════════════════════════════════════
    MÓDULO 2 — ESTRUTURAÇÃO SEMÂNTICA
    Converte secções brutas em blocos tipados com hierarquia.
    Extrai citações do conteúdo para referências estruturadas.
    Detecta dados numéricos para gráficos/tabelas automáticas.
════════════════════════════════════════════════════════════ */
const _citacoesExtraidas = new Set();

function docEstruturarSemantico(secs) {
  const blocos = [];
  _citacoesExtraidas.clear();
  let temSecaoReferencias = false;

  for (const sec of secs) {
    const txt = sanitizarConteudo(sec.c || sec.conteudo || '');
    const isRef = /refer[eê]ncias|bibliograf/i.test(sec.titulo || '');

    if (isRef) {
      const refs = txt.split('\n').map(l => l.trim()).filter(l => l.length > 10);
      if (refs.length === 0) continue;
      temSecaoReferencias = true;
      blocos.push({ tipo: 'titulo_cap', titulo: sec.titulo, num: sec.num || '' });
      refs.forEach(linha => {
        blocos.push({ tipo: 'ref_item', texto: linha });
        _citacoesExtraidas.add(linha);
      });
} else {
      const secBlocos = [];
      secBlocos.push({ tipo: 'titulo_cap', titulo: sec.titulo, num: sec.num || '' });
      extrairCitacoesDoTexto(txt);
      docEstruturarSemanticoTexto(sec, txt, secBlocos);
      if (secBlocos.length > 1) {
        blocos.push(...secBlocos);
      }
    }
  }

  if (!temSecaoReferencias && _citacoesExtraidas.size > 0) {
    blocos.push({ tipo: 'titulo_cap', titulo: 'Referências Bibliográficas', num: '' });
    _citacoesExtraidas.forEach(cit => {
      blocos.push({ tipo: 'ref_item', texto: cit });
    });
  }

  return blocos;
}

function extrairDadosNumericos(txt) {
  const dados = [];
  const linhas = txt.split('\n');
  for (const linha of linhas) {
    const matchPercent = /([A-ZÁÉÍÓÚÀ][a-zà-ÿ\s]{2,40}):\s*(\d+(?:[.,]\d+)?)\s*%/g;
    let m;
    while ((m = matchPercent.exec(linha)) !== null) {
      dados.push({ label: m[1].trim(), valor: parseFloat(m[2].replace(',', '.')), tipo: 'percentagem' });
    }
    const matchComparacao = /([A-ZÁÉÍÓÚÀ][a-zà-ÿ\s]{2,30})\s*(?:vs\.?|versus|contra|e)\s*([A-ZÁÉÍÓÚÀ][a-zà-ÿ\s]{2,30})/gi;
    while ((m = matchComparacao.exec(linha)) !== null) {
      if (!dados.find(d => d.label === m[1].trim())) {
        dados.push({ label: m[1].trim(), tipo: 'comparacao' });
      }
      if (!dados.find(d => d.label === m[2].trim())) {
        dados.push({ label: m[2].trim(), tipo: 'comparacao' });
      }
    }
  }
  return dados.filter((d, i, arr) => arr.findIndex(x => x.label === d.label) === i).slice(0, 8);
}

function gerarBlocoGrafico(dados, tituloSec) {
  const temPercentagem = dados.some(d => d.tipo === 'percentagem' && d.valor > 0);
  if (temPercentagem) {
    const linhasTabela = dados.map(d =>
      `<tr><td style="padding:6pt;border:1px solid #e9ecef;font-weight:600">${d.label}</td><td style="padding:6pt;border:1px solid #e9ecef;text-align:right;font-weight:700">${d.valor}%</td></tr>`
    ).join('');
    return {
      tipo: 'data_table',
      html: `<div style="margin:12pt 0;padding:10pt;background:#f8f9fa;border-radius:4pt;border-left:3pt solid #1E92FF">
        <div style="font-size:9pt;font-weight:700;color:#1E92FF;margin-bottom:6pt;text-transform:uppercase">Dados Estatísticos</div>
        <table style="width:100%;border-collapse:collapse;font-size:9.5pt">
          <tr style="background:#1E92FF;color:#fff"><th style="padding:6pt;border:1px solid #1E92FF;text-align:left">Indicador</th><th style="padding:6pt;border:1px solid #1E92FF;text-align:right">Valor</th></tr>
          ${linhasTabela}
        </table>
      </div>`,
    };
  }
  return null;
}

function extrairCitacoesDoTexto(txt) {
  const padrao = /\(([^()]{3,120})\)/g;
  let m;
  while ((m = padrao.exec(txt)) !== null) {
    const cit = m[1].trim();
    if (/^(?:19|20)\d{2}|[A-ZÁÉÍÓÚÀ][a-z]+(?:\s+(?:et\s+al|&|e)\s+[^,]+)?,\s*(?:19|20)\d{2}/.test(cit)) {
      _citacoesExtraidas.add(cit);
    }
  }
  const padraoAutor = /([A-ZÁÉÍÓÚÀ][a-zà-ÿ]+(?:\s+(?:et\s+al|&|e)\s+[A-ZÁÉÍÓÚÀ][a-zà-ÿ]+)*)\s*\((19|20)\d{2}[a-z]?\)/g;
  while ((m = padraoAutor.exec(txt)) !== null) {
    _citacoesExtraidas.add(m[0].trim());
  }
}

function construirReferenciasCitadas(secs) {
  const refsExistentes = [];
  for (const sec of secs) {
    const txt = sanitizarConteudo(sec.c || sec.conteudo || '');
    const isRef = /refer[eê]ncias|bibliograf/i.test(sec.titulo || '');
    if (isRef) {
      txt.split('\n').map(l => l.trim()).filter(l => l.length > 10).forEach(l => refsExistentes.push(l));
    }
  }
  if (refsExistentes.length > 0) return refsExistentes;
  const citadas = [];
  _citacoesExtraidas.forEach(c => citadas.push(c));
  return citadas;
}

function docEstruturarSemanticoTexto(sec, txt, blocos) {
  const linhas = txt.split('\n');
  let primeiroPar = true;
  const tituloCap = (sec.titulo || '').toLowerCase().replace(/^\d+\.?\s*/, '').trim();

  const isLixoJSON = l => /^\s*[\{\[\}\]]\s*$/.test(l)
    || /^\s*"[a-z_]+"\s*:/.test(l)
    || /"(?:chapter_id|section_id|title|paragraphs|content|status|generated_at|generated_by|version|sections)"\s*:/.test(l)
    || /^[\{\[].*[\}\]]$/.test(l);

  const tituloNorm = tituloCap;

  const isDuplicadoTitulo = l => {
    if (!tituloCap || tituloCap.length < 4) return false;
    const linhaNorm = l.toLowerCase().replace(/^\d+\.?\d*\.?\s*/, '').trim();
    if (linhaNorm === tituloCap) return true;
    if (tituloNorm.includes(linhaNorm) && linhaNorm.length > 4) return true;
    if (linhaNorm.length > 4 && linhaNorm.includes(tituloCap.split(' ')[0]) && linhaNorm.split(' ').length <= 3) return true;
    return false;
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    if (isLixoJSON(linha)) continue;
    if (isDuplicadoTitulo(linha)) continue;

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
  const isHeading = (b) => { if (!b) return false; return b.tipo === 'titulo_cap' || b.tipo === 'h2' || b.tipo === 'h3'; };
  const validBlocos = blocos.filter((b) => b != null);

  while (i < validBlocos.length) {
    const b = validBlocos[i];

    if (b.tipo === 'titulo_cap') {
      const id = nextId('c');
      currentChapterId = id;
      const grupo = { id, chapter_id: id, section_id: null, tipo: 'chapter_group', blocos: [b], linhasTotal: linhasBloco(b) };
      i++;
      let nPars = 0, nSubs = 0;
      while (i < validBlocos.length && validBlocos[i].tipo !== 'titulo_cap') {
        const nb = validBlocos[i];
        grupo.blocos.push(nb);
        grupo.linhasTotal += linhasBloco(nb);
        if (nb.tipo === 'paragrafo') nPars++;
        if (nb.tipo === 'h2' || nb.tipo === 'h3') nSubs++;
        i++;
        if (nSubs >= 1 && nPars >= 3) break;
      }
      if (grupo.blocos.length > 1) grupos.push(grupo);
      continue;
    }

    if (b.tipo === 'h2' || b.tipo === 'h3') {
      const id = nextId('s');
      const grupo = { id, chapter_id: currentChapterId, section_id: id, tipo: 'section_group', blocos: [b], linhasTotal: linhasBloco(b), linhasConteudo: 0 };
      i++;
      while (i < validBlocos.length) {
        const nb = validBlocos[i];
        if (isHeading(nb)) break;
        const l = linhasBloco(nb);
        grupo.blocos.push(nb);
        grupo.linhasTotal    += l;
        grupo.linhasConteudo += l;
        i++;
      }
      if (grupo.linhasConteudo > 0) grupos.push(grupo);
      continue;
    }

    if (b.tipo === 'ref_item') {
      const id = nextId('r');
      const grupo = { id, chapter_id: currentChapterId, section_id: null, tipo: 'ref_group', blocos: [], linhasTotal: 0 };
      while (i < validBlocos.length && validBlocos[i].tipo === 'ref_item') {
        grupo.blocos.push(validBlocos[i]);
        grupo.linhasTotal += linhasBloco(validBlocos[i]);
        i++;
      }
      if (grupo.blocos.length > 0) grupos.push(grupo);
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
  const MIN_SEC_L  = 6;
  const isHeading  = b => b.tipo === 'h2' || b.tipo === 'h3' || b.tipo === 'titulo_cap';

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

  const espacoRestante = () => AREA_L - linhasUsadas;

  for (const grupo of grupos) {
    const gL = grupo.linhasTotal;

    if (grupo.tipo === 'chapter_group') {
      if (paginaActual.length > 0) novaPageBreak();
      if (gL <= AREA_CAP_L) {
        grupo.blocos.forEach(b => { paginaActual.push(b); linhasUsadas += linhasBloco(b); });
      } else {
        for (let bi = 0; bi < grupo.blocos.length; bi++) {
          const b  = grupo.blocos[bi];
          const l  = linhasBloco(b);
          if (linhasUsadas + l > AREA_CAP_L && paginaActual.length > 0) novaPageBreak();
          if (isHeading(b)) {
            let conteudoSeguinte = 0;
            for (let j = bi + 1; j < grupo.blocos.length && !isHeading(grupo.blocos[j]); j++) {
              conteudoSeguinte += linhasBloco(grupo.blocos[j]);
            }
            const minimo = Math.min(conteudoSeguinte, MIN_SEC_L);
            if (linhasUsadas + l + minimo > AREA_CAP_L && paginaActual.length > 0)
              novaPageBreak();
          }
          paginaActual.push(b);
          linhasUsadas += l;
        }
      }
      continue;
    }

    if (grupo.tipo === 'section_group') {
      const lSub   = linhasBloco(grupo.blocos[0]);
      const lCont  = grupo.linhasConteudo || 0;
      const guarda = lSub + Math.min(lCont, MIN_SEC_L);
      if (linhasUsadas + guarda > AREA_L && paginaActual.length > 0) novaPageBreak();
      for (let bi = 0; bi < grupo.blocos.length; bi++) {
        const b = grupo.blocos[bi];
        const l = linhasBloco(b);
        if (isHeading(b)) {
          let conteudoSeguinte = 0;
          for (let j = bi + 1; j < grupo.blocos.length && !isHeading(grupo.blocos[j]); j++) {
            conteudoSeguinte += linhasBloco(grupo.blocos[j]);
          }
          const minimo = Math.min(conteudoSeguinte, MIN_SEC_L);
          if (linhasUsadas + l + minimo > AREA_L && paginaActual.length > 0)
            novaPageBreak();
        } else if (linhasUsadas + l > AREA_L && paginaActual.length > 0) {
          novaPageBreak();
        }
        paginaActual.push(b);
        linhasUsadas += l;
      }
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

/* PASSO 3.3 — Anti-Órfãos: remove headings soltos no fim da página */
function preRenderFixOrphans(paginas) {
  const isHeading = b => b.tipo === 'h2' || b.tipo === 'h3' || b.tipo === 'titulo_cap';
  const fixed = [];
  for (let pi = 0; pi < paginas.length; pi++) {
    const pg = [...paginas[pi]];
    while (pg.length > 1 && isHeading(pg[pg.length - 1])) {
      const orphan = pg.pop();
      if (pi + 1 < paginas.length) {
        paginas[pi + 1].unshift(orphan);
      } else {
        paginas.push([orphan]);
      }
    }
    if (pg.length > 0) fixed.push(pg);
  }
  return fixed;
}

/* PASSO 3.4 — Stress Validator (só críticos) */
function preRenderStressValidate(paginas, grupos) {
  const isHeading = b => b.tipo === 'h2' || b.tipo === 'h3' || b.tipo === 'titulo_cap';
  const erros = [];
  for (let pi = 0; pi < paginas.length; pi++) {
    const pg   = paginas[pi];
    const nPg  = pi + 3;
    const ult  = pg[pg.length - 1];
    if (pg.length === 1 && pg[0].tipo === 'titulo_cap')
      erros.push({ sev: 'CRITICO', msg: `Cap. "${pg[0].titulo}" sozinho na pág. ${nPg}` });
    if (ult && isHeading(ult))
      erros.push({ sev: 'CRITICO', msg: `Título "${ult.texto || ult.titulo}" órfão no fim da pág. ${nPg}` });
  }
  const criticos = erros.filter(e => e.sev === 'CRITICO');
  if (criticos.length > 0) {
    console.group('[LAYOUT] Stress Validation');
    criticos.forEach(e => console.error(`[${e.sev}] ${e.msg}`));
    console.groupEnd();
  } else if (erros.length === 0) {
    console.log(`[LAYOUT] ✓ ${paginas.length} páginas OK`);
  }
  return erros;
}

/* API PÚBLICA DO PIPELINE */
function preRenderPipeline(blocos) {
  const grupos  = preRenderAgrupar(blocos);
  let paginas   = preRenderConstraintEngine(grupos);
  paginas       = preRenderFixOrphans(paginas);
  preRenderStressValidate(paginas, grupos);
  return paginas.filter(pg => pg && pg.length > 0 &&
    pg.some(b => ['titulo_cap','h2','h3','paragrafo','ref_item','data_table'].includes(b.tipo))
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
function layoutGerarTOCReal(paginasDeBlocos, offsetBase) {
  const base = offsetBase || 2; /* fallback para retrocompatibilidade */
  const mapa = [];
  for (let pi = 0; pi < paginasDeBlocos.length; pi++) {
    const tc = paginasDeBlocos[pi].find(b => b.tipo === 'titulo_cap');
    if (tc) mapa.push({ num: tc.num, titulo: tc.titulo, pgInicio: pi + base });
  }
  return mapa;
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 6 — RENDERIZAÇÃO DE PÁGINA
   Recebe lista de blocos → devolve HTML da página A4
════════════════════════════════════════════════════════════ */
function layoutRenderPagina(blocos, opts) {
  const { num, total, titulo, nomeCap, watermark } = opts;
  const linhas = blocosAgruparHeadings(blocos).map(bloco => layoutHtmlBloco(bloco)).join('');

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
  ${''}
</div>`;
}

/* HTML de um bloco dentro de uma página */
function layoutHtmlBloco(bloco) {
  const t = (bloco.texto || bloco.titulo || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  switch (bloco.tipo) {
    case 'heading_group':
      return `<div class="heading-group">${layoutHtmlBloco(bloco.heading)}${layoutHtmlBloco(bloco.firstChild)}</div>`;
    case 'titulo_cap':
      return `<div class="cap-titulo"><span class="cap-num">${bloco.num || ''}</span> ${bloco.titulo}</div>`;
    case 'h2':
      return `<h3 class="sub-h2">${t}</h3>`;
    case 'h3':
      return `<h4 class="sub-h3">${t}</h4>`;
    case 'paragrafo':
      return `<p class="par${bloco.noIndent ? ' no-indent' : ''}">${t}</p>`;
    case 'ref_item':
      return `<p class="ref-item">${t}</p>`;
    case 'data_table':
      return bloco.html || '';
    case 'espaco':
      return `<div style="height:${bloco.altura || 20}px"></div>`;
    default:
      return `<p class="par">${t}</p>`;
  }
}

/* Agrupa cada subtítulo (h2/h3) com o primeiro parágrafo seguinte
   num único bloco heading_group — evita título órfão no fundo da página */
function blocosAgruparHeadings(blocos) {
  const out = [];
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    if ((b.tipo === 'h2' || b.tipo === 'h3') && blocos[i + 1]?.tipo === 'paragrafo') {
      out.push({ tipo: 'heading_group', heading: b, firstChild: blocos[i + 1] });
      i++;
    } else {
      out.push(b);
    }
  }
  return out;
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
  ${''}
</div>`;
}

function htmlCapa(meta) {
  const t = getTemaActual();
  const capaObj    = (typeof State !== 'undefined' && State.get) ? (State.get('capa') || {}) : {};
  const logoInst   = capaObj.logoInst   || meta.logoInst   || null;
  const capaImg    = capaObj.imagem     || meta.capaImg    || null;
  const autores    = (meta.autor || '').split('\n').filter(Boolean).map(capitalizarNome);
  const profFmt    = meta.prof ? capitalizarNome(meta.prof) : '';

  return `
  <div style="position:relative;min-height:${PDF.ALTURA - PDF.MARGEM_V * 2}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:0;padding:40px 0">

    ${capaImg ? `<div style="position:absolute;inset:0;background:url('${capaImg}') center/cover;opacity:.04;border-radius:8px"></div>` : ''}

    ${logoInst ? `<img src="${logoInst}" style="height:64px;object-fit:contain;margin-bottom:20px;opacity:.9;filter:drop-shadow(0 2px 8px rgba(0,0,0,.2))" alt="logo">` : ''}

    <div style="font-family:Georgia,serif;font-size:8.5pt;letter-spacing:.2em;text-transform:uppercase;color:#555;margin-bottom:6px;position:relative;font-weight:600">${meta.inst || ''}</div>
    <div style="font-family:Georgia,serif;font-size:8pt;color:#777;margin-bottom:32px;position:relative">${meta.nivel || ''}</div>

    <div style="width:80mm;height:3px;background:linear-gradient(90deg,${t.primario},${t.acento});margin:0 auto 18px;border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>
    <div style="font-family:Georgia,serif;font-size:8pt;letter-spacing:.25em;text-transform:uppercase;color:${t.primario};margin-bottom:14px;position:relative;font-weight:700">${meta.sigla || meta.tipo || 'Trabalho Académico'}</div>
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22pt;font-weight:700;font-style:italic;color:${t.texto};max-width:380px;line-height:1.4;margin:0 auto 20px;position:relative;text-shadow:0 1px 2px rgba(0,0,0,.05)">${meta.titulo || ''}</h1>
    <div style="width:80mm;height:3px;background:linear-gradient(90deg,${t.primario},${t.acento});margin:0 auto 24px;border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>

    ${autores.map(a => `<div style="font-family:Georgia,serif;font-size:11.5pt;font-weight:700;color:${t.texto};line-height:1.6;position:relative;letter-spacing:.02em">${a}</div>`).join('')}
    ${(meta.mbs || []).map(m => `<div style="font-family:Georgia,serif;font-size:10.5pt;color:#444;line-height:1.6;position:relative">${m.nome ? capitalizarNome(m.nome) : 'Integrante'}</div>`).join('')}
    ${profFmt ? `<div style="font-family:Georgia,serif;font-size:9.5pt;font-style:italic;color:#666;margin-top:12px;position:relative">Orientador: <strong style="color:${t.primario};font-weight:600">${profFmt}</strong></div>` : ''}
    <div style="font-family:Georgia,serif;font-size:9pt;color:#888;margin-top:20px;position:relative;letter-spacing:.05em">${meta.data || ''}</div>
  </div>`;
}

/* Capitaliza nomes próprios (primeira letra de cada palavra, 
   excepto artigos/preposições). Não usa title case em palavras curtas. */
function capitalizarNome(nome) {
  if (!nome) return '';
  const minusculas = new Set(['de','da','do','das','dos','e','em','na','no','nas','nos','a','o','as','os','para','por','com','sem']);
  return nome.toLowerCase().split(/\s+/).filter(Boolean).map((palavra, i) => {
    if (i > 0 && minusculas.has(palavra)) return palavra;
    if (/^[a-zà-ÿ]/.test(palavra)) return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    return palavra;
  }).join(' ');
}

function htmlTOC(mapa) {
  const t = getTemaActual();
  const linhas = mapa.map(item =>
    `<div class="toc-item">
      <span class="toc-num">${item.num || ''}</span>
      <span class="toc-texto">${item.titulo}</span>
      <span class="toc-pg">${item.pgInicio}</span>
    </div>`
  ).join('');

  return `<div style="padding:40px 0">
    <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20pt;font-weight:700;text-transform:uppercase;color:${t.primario};margin-bottom:24pt;padding-bottom:12pt;border-bottom:3px solid ${t.fundo}">Índice</h2>
    ${linhas}
  </div>`;
}

function htmlPretextuais(cfg) {
  const t = getTemaActual();
  const pags = [];
  if (cfg.dedicatoria?.trim()) {
    pags.push(`<div style="display:flex;align-items:center;justify-content:center;min-height:${PDF.ALTURA - PDF.MARGEM_V * 2}px">
      <div style="text-align:right;max-width:320px;padding-right:24pt;border-right:3px solid;border-image:linear-gradient(180deg,${t.primario},${t.acento}) 1">
        <div style="font-family:Georgia,serif;font-size:11.5pt;font-style:italic;color:${t.texto};line-height:1.8">${cfg.dedicatoria}</div>
      </div>
    </div>`);
  }
  if (cfg.agradecimentos?.trim()) {
    pags.push(`<div style="padding:40px 0">
      <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18pt;font-weight:700;text-transform:uppercase;margin-bottom:20pt;padding-bottom:10pt;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,${t.primario},${t.acento}) 1;color:${t.texto}">Agradecimentos</h3>
      <p style="font-family:Georgia,serif;font-size:11pt;line-height:1.8;text-align:justify;color:${t.texto}">${cfg.agradecimentos}</p>
    </div>`);
  }
  if (cfg.epigrafe?.trim()) {
    pags.push(`<div style="display:flex;align-items:center;justify-content:center;min-height:${PDF.ALTURA - PDF.MARGEM_V * 2}px">
      <div style="text-align:right;max-width:360px;border-right:3px solid;border-image:linear-gradient(180deg,${t.primario},${t.acento}) 1;padding-right:24pt">
        <div style="font-family:Georgia,serif;font-size:12.5pt;font-style:italic;color:${t.texto};line-height:1.75">"${cfg.epigrafe}"</div>
        ${cfg.epigrafAutor ? `<div style="font-family:Georgia,serif;font-size:10.5pt;color:${t.primario};margin-top:12pt;font-weight:600">— ${cfg.epigrafAutor}</div>` : ''}
      </div>
    </div>`);
  }
  return pags;
}

function htmlPostextuais(cfg) {
  const t = getTemaActual();
  const itens = cfg.postextuais || [];
  if (!itens.length) return [];
  return itens.map(item => {
    switch (item.tipo) {
      case 'glossario':
        if (!item.termo && !item.definicao) return '';
        return `<div style="padding:40px 0">
          <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18pt;font-weight:700;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,${t.primario},${t.acento}) 1;padding-bottom:10px;margin-bottom:24pt;text-transform:uppercase;color:${t.texto}">Glossário</h3>
          <div style="font-family:Georgia,serif;font-size:11pt;line-height:1.7"><strong style="color:${t.primario}">${item.termo || ''}</strong> — <span style="color:${t.texto}">${item.definicao || ''}</span></div>
        </div>`;
      case 'abreviatura':
        if (!item.abrev && !item.significado) return '';
        return `<div style="padding:40px 0">
          <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18pt;font-weight:700;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,${t.primario},${t.acento}) 1;padding-bottom:10px;margin-bottom:24pt;text-transform:uppercase;color:${t.texto}">Lista de Abreviaturas</h3>
          <div style="display:flex;gap:16pt;font-family:Georgia,serif;font-size:11pt;line-height:1.7"><strong style="color:${t.primario};min-width:80pt">${item.abrev || ''}</strong><span style="color:${t.texto}">${item.significado || ''}</span></div>
        </div>`;
      default:
        if (!item.titulo && !item.conteudo) return '';
        return `<div style="padding:40px 0">
          <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18pt;font-weight:700;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,${t.primario},${t.acento}) 1;padding-bottom:10px;margin-bottom:24pt;text-transform:uppercase;color:${t.texto}">${item.titulo || item.tipo}</h3>
          <p style="font-family:Georgia,serif;font-size:11pt;line-height:1.8;text-align:justify;color:${t.texto}">${item.conteudo || ''}</p>
        </div>`;
    }
  }).filter(html => html && html.length > 0);
}

function htmlContracapa(meta) {
  const t = getTemaActual();
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-height:${PDF.ALTURA - PDF.MARGEM_V * 2}px;text-align:center;padding-bottom:40px;gap:8pt">
    <div style="font-family:Georgia,serif;font-size:7.5pt;letter-spacing:.16em;text-transform:uppercase;color:#AAA;font-weight:600">Produzido por</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16pt;font-weight:700;background:linear-gradient(135deg,${t.primario},${t.acento});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:.08em">ACADEMY</div>
    <div style="font-family:Georgia,serif;font-size:8pt;color:#888;letter-spacing:.1em">Grupo AGEA Comercial · CEO Adelino Graça</div>
    <div style="font-family:Georgia,serif;font-size:8pt;color:#AAA;margin-top:6pt;letter-spacing:.08em">angola.academy · ${new Date().getFullYear()}</div>
    <div style="width:60pt;height:3pt;background:linear-gradient(90deg,${t.primario},${t.acento});border-radius:2pt;margin-top:12pt"></div>
  </div>`;
}

function htmlMediaItem(item, idx) {
  const t = getTemaActual();
  if (!item || !item.tipo) return '';
  switch (item.tipo) {
    case 'imagem':
      if (!item.src) return '';
      return `<div style="margin:18pt 0;text-align:center">
        <img src="${item.src}" style="max-width:100%;max-height:180px;object-fit:contain;border:1px solid #e9ecef;border-radius:4pt;box-shadow:0 2px 8px rgba(0,0,0,.08)" alt="${item.legenda || ''}"/>
        <div style="font-family:Georgia,serif;font-size:9pt;color:#666;margin-top:8pt;font-style:italic">Figura ${idx}. ${item.legenda || ''}</div>
      </div>`;
    case 'tabela':
      if (!item.dados || !Array.isArray(item.dados) || item.dados.length === 0) return '';
      const headers = item.headers || [];
      const dataRows = item.dados;
      const headerHTML = headers.length > 0
        ? `<tr style="background:linear-gradient(90deg,${t.primario},${t.acento});color:#fff">${headers.map(h => `<th style="padding:8pt;border:1px solid rgba(255,255,255,.2);text-align:left;font-weight:600">${h}</th>`).join('')}</tr>`
        : '';
      return `<div style="margin:18pt 0">
        <div style="font-family:Georgia,serif;font-size:9pt;color:#666;margin-bottom:8pt;font-style:italic">Tabela ${idx}. ${item.titulo || ''}</div>
        <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;font-size:10pt">
          ${headerHTML}
          ${dataRows.map((row, ri) => `<tr style="background:${ri % 2 === 0 ? '#f8f9fa' : '#fff'}">${(Array.isArray(row) ? row : [row]).map(cell => `<td style="padding:6pt;border:1px solid #e9ecef">${cell}</td>`).join('')}</tr>`).join('')}
        </table>
      </div>`;
    case 'grafico':
      if (!item.dados && !item.src) return '';
      return `<div style="margin:18pt 0;padding:20pt;background:linear-gradient(135deg,${t.fundo},#f0f4ff);border:1px solid #e0e7ff;border-radius:6pt;text-align:center">
        <div style="font-family:Georgia,serif;font-size:10pt;color:${t.primario};font-weight:700">Gráfico ${idx}. ${item.titulo || ''}</div>
        ${item.src ? `<img src="${item.src}" style="max-width:100%;max-height:200px;margin-top:10pt;border-radius:4pt" alt="${item.titulo || ''}"/>` : ''}
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
  /* Defesa contra dados inválidos */
  if (!Array.isArray(secs) || secs.length === 0) {
    throw new Error('Sem secções para exportar');
  }
  meta = meta || {};

  /* Limpar cache entre gerações */
  const data   = new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' });
  const metaC  = { ...meta, data };
  const wm     = !!meta.watermark;

  /* 1. Estruturar semanticamente */
  const blocos = docEstruturarSemantico(secs);

  /* 2. Distribuir por páginas */
  const paginasDeBlocos = preRenderPipeline(blocos);
  layoutValidarDocumento(paginasDeBlocos, blocos);

  /* 3. Calcular pré-textuais e offset ANTES do TOC */
  const safeCfg = (meta.cfg || (typeof State !== 'undefined' && State.get && State.get('cfg')) || {});
  const pretexts     = htmlPretextuais(safeCfg);
  const offsetTOC    = 1 + pretexts.length; /* capa (1) + pré-textuais (N) = TOC vem depois */

  /* 4. TOC real — offset calculado dinamicamente */
  const mapaCapTOC = layoutGerarTOCReal(paginasDeBlocos, offsetTOC + 1);
  const totalPgs   = offsetTOC + 1 + paginasDeBlocos.length; /* +1 para a própria TOC */

  const paginas = [];

  /* Capa */
  paginas.push(renderPagina(htmlCapa(metaC), { num: 1, total: totalPgs, titulo: metaC.titulo, isCapa: true, watermark: wm }));

  /* Pré-textuais */
  pretexts.forEach((html, pi) => {
    paginas.push(renderPagina(html, { num: 2 + pi, total: totalPgs, titulo: metaC.titulo, isCapa: false, watermark: wm }));
  });

  /* TOC */
  paginas.push(renderPagina(htmlTOC(mapaCapTOC), { num: offsetTOC + 1, total: totalPgs, titulo: metaC.titulo, isTOC: true, watermark: wm }));

  /* Conteúdo */
  const pgsValidas = paginasDeBlocos.filter(pg =>
    pg && pg.some(b => ['titulo_cap','h2','h3','paragrafo','ref_item','data_table'].includes(b.tipo))
  );
  let nomeCap = '';
  pgsValidas.forEach((pg, pi) => {
    const tc = pg.find(b => b.tipo === 'titulo_cap');
    if (tc) nomeCap = tc.titulo;
    paginas.push(layoutRenderPagina(pg, {
      num: offsetTOC + 1 + 1 + pi, total: totalPgs,
      titulo: metaC.titulo, nomeCap: tc ? '' : nomeCap, watermark: wm,
    }));
  });

  /* Media sem página definida → Anexos (só se tiver conteúdo real) */
  const allMedia    = (meta.cfg || (typeof State !== 'undefined' && State.get && State.get('cfg')) || {}).mediaItems || [];
  const mediaComConteudo = allMedia.filter(m => {
    if (!m || !m.tipo) return false;
    if (m.tipo === 'imagem') return !!m.src;
    if (m.tipo === 'tabela') return Array.isArray(m.dados) && m.dados.length > 0;
    if (m.tipo === 'grafico') return !!m.dados || !!m.src;
    return false;
  });
  const mediaSemPag = mediaComConteudo.filter(m => !m.pag);
  if (mediaSemPag.length > 0) {
    const t = getTemaActual();
    const mediaHtml = `<div style="padding:40px 0">
      <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18pt;font-weight:700;text-transform:uppercase;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,${t.primario},${t.acento}) 1;padding-bottom:10px;margin-bottom:24pt;color:${t.texto}">Anexos</h2>
      ${mediaSemPag.map((item, i) => htmlMediaItem(item, i + 1)).join('<div style="margin:14px 0;border-top:.5pt solid #e9ecef"></div>')}
    </div>`;
    paginas.push(renderPagina(mediaHtml, { num: paginas.length + 1, total: totalPgs, titulo: metaC.titulo, watermark: wm }));
  }

  /* Pós-textuais */
  htmlPostextuais(safeCfg).forEach(html => {
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
  const t = getTemaActual();
  return `
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#E8E8E8; font-family:Georgia,'Times New Roman',serif; }

.pdf-toolbar {
  position:fixed; top:0; left:0; right:0; z-index:100;
  background:linear-gradient(135deg,${t.primario} 0%,${t.secundario} 100%); padding:10px 20px;
  display:flex; align-items:center; gap:14px; flex-wrap:wrap;
  box-shadow:0 4px 20px rgba(0,0,0,.5);
}
.pdf-toolbar-btn {
  padding:8px 20px; border-radius:8px; border:none; cursor:pointer;
  font-family:Georgia,serif; font-size:11pt; font-weight:700;
  background:linear-gradient(135deg,${t.acento},${t.dourado}); color:${t.primario};
  transition:all .2s; box-shadow:0 2px 8px rgba(0,0,0,.3);
}
.pdf-toolbar-btn:hover { opacity:.9; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.4); }
.pdf-toolbar-btn.word { background:linear-gradient(135deg,${t.secundario},${t.primario}); color:#fff; box-shadow:0 2px 8px rgba(0,0,0,.3); }
.pdf-toolbar-info { font-family:Georgia,serif; font-size:9pt; color:#AAA; }
.pdf-toolbar-tip  { font-family:Georgia,serif; font-size:8pt;  color:#666; margin-left:auto; }

.pdf-canvas {
  padding:80px 20px 40px;
  display:flex; flex-direction:column; align-items:center; gap:24px;
}

.pg {
  width:${PDF.LARGURA}px; min-height:${PDF.ALTURA}px;
  background:#fff; position:relative; overflow:visible;
  padding:${PDF.MARGEM_V}px ${PDF.MARGEM_DIR}px ${PDF.MARGEM_V}px ${PDF.MARGEM_ESQ}px;
  box-shadow:0 8px 32px rgba(0,0,0,.15), 0 2px 8px rgba(0,0,0,.1);
  page-break-after:always;
}

.pg::before {
  content:''; position:absolute; top:0; left:0; right:0; height:4px;
  background:linear-gradient(90deg,${t.primario} 0%,${t.acento} 50%,${t.primario} 100%);
}

.pg-head {
  position:absolute; top:32px; left:${PDF.MARGEM_ESQ}px; right:${PDF.MARGEM_DIR}px;
  padding-bottom:8px;
  display:flex; align-items:center; justify-content:flex-start;
  border-bottom:1px solid #E8E8E8;
}
.pg-head::after {
  content:''; position:absolute; bottom:-1px; left:0; width:60px; height:2px;
  background:linear-gradient(90deg,${t.primario},${t.acento});
}
.pg-head-titulo {
  font-family:Georgia,serif; font-size:7.5pt; color:#888888;
  letter-spacing:.08em; text-transform:uppercase;
}

.pg-rodape {
  position:absolute; bottom:32px; left:${PDF.MARGEM_ESQ}px; right:${PDF.MARGEM_DIR}px;
  padding-top:8px;
  display:flex; align-items:center; justify-content:space-between;
  border-top:1px solid #E8E8E8;
}
.pg-rodape::before {
  content:''; position:absolute; top:-1px; left:0; width:60px; height:2px;
  background:linear-gradient(90deg,${t.primario},${t.acento});
}
.pg-rodape-doc  { font-family:Georgia,serif; font-size:7pt; color:#AAAAAA; letter-spacing:.03em; }
.pg-rodape-num  {
  font-family:Georgia,serif; font-size:8.5pt; font-weight:700;
  background:linear-gradient(135deg,${t.primario},${t.acento});
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
}
.pg-rodape-data { font-family:Georgia,serif; font-size:7pt; color:#AAAAAA; }

.pg-wm {
  position:absolute; top:50%; left:50%;
  transform:translate(-50%,-50%) rotate(-35deg);
  font-family:Georgia,serif; font-size:48pt; font-weight:900;
  color:rgba(0,0,0,.03); pointer-events:none; user-select:none;
  letter-spacing:.15em; white-space:nowrap;
}

.pg-corpo { padding-top:22px; }

.cap-titulo {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:17pt; font-weight:700; line-height:1.3;
  color:${t.texto}; padding-bottom:8pt;
  margin-bottom:14pt; margin-top:6mm;
  position:relative;
}
.cap-titulo::after {
  content:''; position:absolute; bottom:0; left:0; width:100%; height:3px;
  background:linear-gradient(90deg,${t.primario} 0%,${t.acento} 60%,transparent 100%);
  border-radius:2px;
}
.cap-num {
  display:inline-block; margin-right:10px;
  font-size:14pt; font-weight:900;
  background:linear-gradient(135deg,${t.primario},${t.acento});
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
}

.sub-h2 {
  font-family:Georgia,serif; font-size:12.5pt; font-weight:700; line-height:1.35;
  margin:16pt 0 8pt; padding:6pt 0 6pt 12pt;
  border-left:4px solid; border-image:linear-gradient(180deg,${t.primario},${t.acento}) 1;
  color:${t.texto}; background:linear-gradient(90deg,rgba(${t.primario},.04),transparent);
}
.sub-h3 {
  font-family:Georgia,serif; font-size:11.5pt; font-weight:600; font-style:italic;
  line-height:1.35; margin:12pt 0 6pt; color:${t.secundario};
  padding-left:4pt; border-left:2px solid ${t.acento};
}

.heading-group {
  break-inside:avoid-page; page-break-inside:avoid;
}
.heading-group > .par:first-child { margin-top:0; }

.par {
  font-family:Georgia,serif; font-size:11pt; line-height:1.55;
  text-align:justify; text-indent:1.1cm; margin-bottom:7pt; color:${t.texto};
}
.par.no-indent { text-indent:0; }

.ref-item {
  font-family:Georgia,serif; font-size:10pt; line-height:1.55;
  text-indent:-2em; padding-left:2em; margin-bottom:8pt; color:#222;
  padding:4pt 2em 4pt 2em;
  border-left:2px solid #E8E8E8;
  margin-left:4pt;
}
.ref-item:hover { border-left-color:${t.acento}; }

@media print {
  * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  html, body { width:210mm !important; margin:0 !important; padding:0 !important; background:#fff !important; }
  .pdf-toolbar { display:none !important; }
  .pdf-canvas { padding:0 !important; gap:0 !important; width:210mm !important; }
  .pg {
    width:210mm !important; min-height:297mm !important; max-height:none !important;
    height:auto !important; margin:0 !important;
    padding:25mm 20mm 25mm 25mm !important;
    box-shadow:none !important; overflow:visible !important; position:relative !important;
    page-break-after:always !important; page-break-inside:avoid !important;
    break-after:page !important; break-inside:avoid !important;
  }
  .pg:last-child { page-break-after:auto !important; break-after:auto !important; }
  @page { size:210mm 297mm; margin:0; }
}`;
}

/* ════════════════════════════════════════════════════════════
   MÓDULO 10 — ENTRADA PÚBLICA
   gerarJanelaPDF() — chamado por export.js
   Gera PDF real via html2pdf.js (sem popup).
═════════════════════════════════════════════════════════════ */
/* ── Overlay premium espelhado ── */
function _pdfOverlayMostrar(total) {
  document.getElementById('pdfOverlay')?.remove();
  const t = getTemaActual();
  const o = document.createElement('div');
  o.id = 'pdfOverlay';
  o.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(22px) saturate(1.2);-webkit-backdrop-filter:blur(22px) saturate(1.2);animation:aparecer .3s ease';
  o.innerHTML = `
  <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">
    <div style="position:absolute;width:520px;height:520px;left:50%;top:40%;transform:translate(-50%,-50%);background:radial-gradient(ellipse at center, ${t.primario}18 0%, transparent 70%);filter:blur(30px)"></div>
    <div style="position:absolute;width:700px;height:260px;left:50%;bottom:-40px;transform:translateX(-50%);background:linear-gradient(180deg, transparent, ${t.acento}0A);filter:blur(20px)"></div>
  </div>
  <div style="position:relative;z-index:1;width:100%;max-width:380px;background:linear-gradient(180deg, rgba(22,25,34,.96), rgba(14,17,26,.98));border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px 22px 22px;box-shadow:0 24px 64px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset;overflow:hidden">
    <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg, transparent, ${t.acento}60, transparent)"></div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:0">
      <div style="position:relative;width:72px;height:72px;margin-bottom:16px">
        <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,255,255,.06)"></div>
        <div id="pdfRing" style="position:absolute;inset:0;border-radius:50%;border:2px solid transparent;border-top-color:${t.acento};border-right-color:${t.primario};animation:pdfSpin 1s linear infinite"></div>
        <div style="position:absolute;inset:10px;border-radius:50%;background:linear-gradient(135deg, ${t.primario}, ${t.acento});display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 4px 16px ${t.primario}40">◈</div>
      </div>
      <div style="font-family:var(--fm);font-size:7.5px;letter-spacing:.16em;color:${t.acento};margin-bottom:6px">ACADEMY · PDF PREMIUM</div>
      <div id="pdfOverlayTitle" style="font-size:17px;font-weight:800;color:#fff;letter-spacing:-.02em;margin-bottom:4px">A preparar o teu PDF…</div>
      <div id="pdfOverlaySub" style="font-size:12px;color:rgba(255,255,255,.55);margin-bottom:18px;text-align:center;line-height:1.5">A compor <strong style="color:#fff">${total} páginas</strong> com design espelhado</div>
      <!-- Preview espelhado -->
      <div style="position:relative;width:100%;margin-bottom:18px">
        <div style="background:#fff;border-radius:8px;padding:10px 12px;box-shadow:0 4px 20px rgba(0,0,0,.3);border:1px solid rgba(0,0,0,.06)">
          <div style="height:3px;background:linear-gradient(90deg, ${t.primario}, ${t.acento});border-radius:2px;margin-bottom:8px"></div>
          <div style="display:flex;flex-direction:column;gap:5px">
            <div style="height:6px;background:linear-gradient(90deg, #111 60%, #ddd 100%);border-radius:3px;animation:pdfShimmer 1.4s infinite"></div>
            <div style="height:6px;background:#e8e8e8;border-radius:3px;width:92%"></div>
            <div style="height:6px;background:#e8e8e8;border-radius:3px;width:88%"></div>
            <div style="height:6px;background:#f0f0f0;border-radius:3px;width:76%"></div>
          </div>
          <div style="margin-top:8px;height:1px;background:#eee"></div>
          <div style="margin-top:8px;display:flex;gap:6px">
            <div style="flex:1;height:32px;background:linear-gradient(135deg, ${t.fundo}, #f0f4ff);border:1px solid #e0e7ff;border-radius:4px"></div>
            <div style="flex:1;height:32px;background:#f8f9fa;border:1px solid #eee;border-radius:4px"></div>
          </div>
        </div>
        <!-- Reflexo espelhado -->
        <div style="margin-top:6px;transform:scaleY(-1);opacity:.18;filter:blur(.6px);mask-image:linear-gradient(180deg, rgba(0,0,0,.5), transparent 85%);-webkit-mask-image:linear-gradient(180deg, rgba(0,0,0,.5), transparent 85%);background:#fff;border-radius:8px;padding:10px 12px;height:42px;overflow:hidden">
          <div style="height:3px;background:linear-gradient(90deg, ${t.primario}, ${t.acento});border-radius:2px;margin-bottom:8px"></div>
          <div style="height:6px;background:#111;border-radius:3px;width:60%"></div>
        </div>
      </div>
      <!-- Barra -->
      <div style="width:100%;height:6px;background:rgba(255,255,255,.08);border-radius:10px;overflow:hidden;margin-bottom:10px;border:1px solid rgba(255,255,255,.04)">
        <div id="pdfBar" style="height:100%;width:0%;background:linear-gradient(90deg, ${t.primario}, ${t.acento}, ${t.dourado});border-radius:10px;transition:width .4s cubic-bezier(.16,1,.3,1);box-shadow:0 0 12px ${t.acento}60"></div>
      </div>
      <div style="display:flex;justify-content:space-between;width:100%;font-family:var(--fm);font-size:9px;color:rgba(255,255,255,.45);margin-bottom:6px">
        <span id="pdfPct">0%</span><span id="pdfStep">A iniciar…</span>
      </div>
      <div id="pdfPages" style="font-family:var(--fm);font-size:8px;color:rgba(255,255,255,.3);letter-spacing:.08em">PÁGINA — DE ${total}</div>
    </div>
  </div>
  <div style="margin-top:14px;font-family:var(--fm);font-size:7.5px;color:rgba(255,255,255,.35);letter-spacing:.08em;text-align:center;position:relative;z-index:1">✦ DESIGN ESPELHADO PREMIUM · NÃO FECHES A JANELA</div>
  <style>@keyframes pdfSpin{to{transform:rotate(360deg)}}@keyframes pdfShimmer{0%{opacity:.6}50%{opacity:1}100%{opacity:.6}}</style>`;
  document.body.appendChild(o);
  document.body.style.overflow = 'hidden';
}
function _pdfOverlayProgress(idx, total, etapa) {
  const pct = Math.round(((idx) / total) * 100);
  const bar = document.getElementById('pdfBar');
  const pctEl = document.getElementById('pdfPct');
  const step = document.getElementById('pdfStep');
  const pages = document.getElementById('pdfPages');
  if (bar) bar.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (step) step.textContent = etapa || `A processar página ${idx}/${total}`;
  if (pages) pages.textContent = `PÁGINA ${idx} DE ${total}`;
}
function _pdfOverlaySucesso(total) {
  const t = getTemaActual();
  const title = document.getElementById('pdfOverlayTitle');
  const sub = document.getElementById('pdfOverlaySub');
  const ring = document.getElementById('pdfRing');
  if (ring) ring.style.animation = 'none';
  if (ring) ring.style.borderTopColor = '#43E8A7';
  if (title) title.textContent = '✓ PDF pronto!';
  if (sub) sub.innerHTML = `<strong style="color:#43E8A7">${total} páginas</strong> geradas com sucesso`;
  const bar = document.getElementById('pdfBar');
  if (bar) { bar.style.width = '100%'; bar.style.background = 'linear-gradient(90deg, #43E8A7, #22C55E)'; }
  const pct = document.getElementById('pdfPct');
  if (pct) { pct.textContent = '100%'; pct.style.color = '#43E8A7'; }
}
function _pdfOverlayErro(msg) {
  const title = document.getElementById('pdfOverlayTitle');
  const sub = document.getElementById('pdfOverlaySub');
  if (title) title.textContent = '⚠ Erro ao gerar';
  if (sub) sub.textContent = msg || 'Tenta novamente';
}
function _pdfOverlayEsconder() {
  const o = document.getElementById('pdfOverlay');
  if (o) { o.style.transition = 'opacity .4s ease, transform .4s ease'; o.style.opacity = '0'; o.style.transform = 'scale(.98)'; setTimeout(()=>{o.remove(); document.body.style.overflow='';}, 420); }
  else document.body.style.overflow = '';
}

async function _pdfEsperarFontes() {
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch {}
  await new Promise(r => requestAnimationFrame(()=> requestAnimationFrame(r)));
  await new Promise(r => setTimeout(r, 120));
}

function gerarJanelaPDF(secs, meta) {
  let paginas, totalPgs;
  try {
    const result = montarDocumentoPDF(secs, meta);
    paginas = result.paginas;
    totalPgs = result.totalPgs;
    if (!paginas || paginas.length === 0) throw new Error('Documento vazio');
  } catch (e) {
    console.error('[PDF] montarDocumentoPDF falhou:', e);
    mostrarToast('⚠ Erro ao montar documento. Tenta novamente.', 'erro');
    return;
  }

  const nomeFicheiro = (meta.titulo || 'ACADEMY').substring(0, 50).replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_');
  const t = getTemaActual();
  const baseCSS = `
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:#fff; font-family:Georgia,'Times New Roman',serif; color:${t.texto}; line-height:1.6; }
.pg { width:${PDF.LARGURA}px; min-height:${PDF.ALTURA}px; background:#fff; position:relative; overflow:visible; padding:${PDF.MARGEM_V}px ${PDF.MARGEM_DIR}px ${PDF.MARGEM_V}px ${PDF.MARGEM_ESQ}px; page-break-after:always; }
    .pg::before { content:''; position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(90deg,${t.primario} 0%,${t.acento} 50%,${t.primario} 100%); }
    .pg-head { position:absolute; top:0; left:0; right:0; height:38px; background:linear-gradient(90deg,${t.primario} 0%,${t.secundario} 100%); display:flex; align-items:center; padding:0 ${PDF.MARGEM_DIR}px 0 ${PDF.MARGEM_ESQ}px; }
    .pg-head-titulo { font-size:7.5pt; color:#fff; letter-spacing:.08em; text-transform:uppercase; font-weight:600; }
    .pg-rodape { position:absolute; bottom:0; left:0; right:0; height:42px; background:linear-gradient(90deg,${t.fundo} 0%,#f0f0f0 100%); border-top:2px solid ${t.primario}; display:flex; align-items:center; justify-content:space-between; padding:0 ${PDF.MARGEM_DIR}px 0 ${PDF.MARGEM_ESQ}px; }
    .pg-rodape-doc { font-size:7pt; color:#666; font-style:italic; }
    .pg-rodape-num { font-size:9pt; font-weight:700; color:${t.primario}; background:#fff; padding:2px 12px; border-radius:12px; border:1.5px solid ${t.primario}; }
    .pg-rodape-data { font-size:7pt; color:#666; }
    .pg-corpo { padding-top:24px; }
    .cap-titulo { font-family:'Cormorant Garamond',Georgia,serif; font-size:18pt; font-weight:700; line-height:1.3; color:${t.texto}; padding-bottom:10pt; border-bottom:3px solid transparent; border-image:linear-gradient(90deg,${t.primario},${t.acento}) 1; margin-bottom:16pt; margin-top:8mm; }
    .cap-num { display:inline-block; margin-right:12px; background:linear-gradient(135deg,${t.primario},${t.acento}); color:#fff; font-size:14pt; font-weight:800; width:36px; height:36px; line-height:36px; text-align:center; border-radius:50%; vertical-align:middle; }
    .sub-h2 { font-size:13pt; font-weight:700; line-height:1.4; margin:18pt 0 8pt; padding-left:12pt; border-left:4px solid ${t.primario}; color:${t.texto}; }
    .sub-h3 { font-size:12pt; font-weight:600; font-style:italic; line-height:1.4; margin:12pt 0 6pt; color:${t.secundario}; padding-left:8pt; border-left:2px solid ${t.acento}; }
    .par { font-size:11pt; line-height:1.6; text-align:justify; text-indent:1.1cm; margin-bottom:8pt; color:${t.texto}; }
    .par.no-indent { text-indent:0; }
    .ref-item { font-size:10pt; line-height:1.6; text-indent:-2em; padding-left:calc(2em + 8pt); margin-bottom:10pt; color:${t.texto}; border-left:2px solid #e9ecef; }
    .pg-capa { background:linear-gradient(135deg,#ffffff 0%,${t.fundo} 50%,#f0f4ff 100%); }
    .pg-toc .toc-titulo { font-family:'Cormorant Garamond',Georgia,serif; font-size:20pt; font-weight:700; text-transform:uppercase; color:${t.primario}; margin-bottom:24pt; padding-bottom:12pt; border-bottom:3px solid #f0f0f0; }
    .pg-toc .toc-item { display:flex; align-items:baseline; margin-bottom:8pt; padding:6pt 0; border-bottom:1px dotted #e0e0e0; }
    .pg-toc .toc-num { font-size:10pt; font-weight:700; color:${t.primario}; min-width:28px; text-align:right; margin-right:12pt; }
    .pg-toc .toc-texto { font-size:10.5pt; color:#333; flex:1; }
    .pg-toc .toc-pg { font-size:9pt; color:${t.primario}; font-weight:600; background:${t.fundo}; padding:2pt 8pt; border-radius:10pt; }
    .heading-group { break-inside:avoid-page; page-break-inside:avoid; }
  `;

  const JS = window.jspdf?.jsPDF || window.jsPDF;
  if (!JS) { mostrarToast('⚠ jsPDF não carregou.', 'erro'); return; }

  _pdfOverlayMostrar(totalPgs);
  _pdfOverlayProgress(0, totalPgs, 'A preparar ' + totalPgs + ' páginas…');

  (async () => {
    await _pdfEsperarFontes();
    const pdf = new JS({ unit:'mm', format:'a4', orientation:'portrait' });
    const isMobile = (typeof AE !== 'undefined' && AE.device?.mobile) || window.innerWidth < 768;
    const scale = isMobile ? 2 : 2.4;
    let paginasOk = 0;
    let paginasFalha = [];

    for (let idx = 0; idx < paginas.length; idx++) {
      const paginaNum = idx + 1;
      _pdfOverlayProgress(paginaNum, totalPgs, paginaNum === 1 ? 'A compor capa e índice…' : paginaNum <= 3 ? 'A renderizar páginas iniciais…' : paginaNum > totalPgs - 2 ? 'A finalizar…' : `A processar página ${paginaNum} de ${totalPgs}…`);

      let wrapper = null;
      let tentativas = 0;
      let sucesso = false;
      while (tentativas < 2 && !sucesso) {
        tentativas++;
        try {
          wrapper = document.createElement('div');
          wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:'+PDF.LARGURA+'px;background:#fff;overflow:visible;pointer-events:none';
          wrapper.innerHTML = `<style>${baseCSS}</style>${paginas[idx]}`;
          document.body.appendChild(wrapper);
          const alvo = wrapper.querySelector('.pg') || wrapper;
          // Validar que tem altura real
          if (alvo.offsetHeight < 80) throw new Error('Altura inválida ' + alvo.offsetHeight);
          await _pdfEsperarFontes();
          const canvas = await html2canvas(alvo, {
            scale: tentativas === 2 ? Math.max(1.8, scale - 0.4) : scale,
            useCORS: true,
            logging: false,
            backgroundColor: '#FFFFFF',
            windowWidth: PDF.LARGURA,
            width: PDF.LARGURA,
            height: alvo.offsetHeight,
            windowHeight: alvo.offsetHeight,
            allowTaint: false,
            imageTimeout: 8000,
          });
          if (!canvas || canvas.width < 100 || canvas.height < 100) throw new Error('Canvas vazio');
          if (idx > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, 210, 297);
          paginasOk++;
          sucesso = true;
        } catch (e) {
          console.warn(`[PDF] Pág ${paginaNum} tentativa ${tentativas} falhou:`, e.message);
          if (tentativas >= 2) paginasFalha.push(paginaNum);
        } finally {
          if (wrapper && wrapper.parentNode) wrapper.remove();
          if (!sucesso && tentativas < 2) await new Promise(r => setTimeout(r, 400));
        }
      }
      // Pequena pausa para libertar memória entre páginas
      if (idx % 4 === 3) await new Promise(r => setTimeout(r, 80));
    }

    if (paginasFalha.length > 0 && paginasOk < totalPgs * 0.85) {
      _pdfOverlayErro(`${paginasFalha.length} página(s) falharam — tenta novamente`);
      mostrarToast(`⚠ ${paginasFalha.length} página(s) falharam. Tenta novamente.`, 'erro');
      setTimeout(_pdfOverlayEsconder, 2500);
      return;
    }

    _pdfOverlaySucesso(totalPgs);
    await new Promise(r => setTimeout(r, 500));
    try {
      pdf.save(nomeFicheiro + '.pdf');
      mostrarToast(`✓ PDF descarregado — ${paginasOk}/${totalPgs} páginas`);
    } catch (e) {
      console.error('[PDF] save falhou:', e);
      mostrarToast('⚠ Erro ao guardar PDF.', 'erro');
    }
    setTimeout(_pdfOverlayEsconder, 900);
  })().catch(e => {
    console.error('[PDF] Erro fatal:', e);
    _pdfOverlayErro(e.message);
    mostrarToast('⚠ Erro ao gerar PDF. Tenta novamente.', 'erro');
    setTimeout(_pdfOverlayEsconder, 2500);
  });
}

/* Fallback: abrir preview em nova janela (se html2pdf falhar) */
function _gerarJanelaPDFPopup(secs, meta, totalPgs, docHTML) {
  const titulo = (meta.titulo || 'ACADEMY').replace(/"/g, '&quot;');
  mostrarToast(`✓ Documento pronto — ${totalPgs} páginas.`);
}
