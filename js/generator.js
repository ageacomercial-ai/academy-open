/* ═══════════════════════════════════════════════════════════
   ACADEMY — GENERATOR.JS
   Loop de geração de capítulos com IA.
   Chamadas ao /api/engine, anti-detecção, memória do documento.
   Depende de: state.js, navigation.js
═══════════════════════════════════════════════════════════ */

const ACADEMY_ENGINE_URL = '/api/engine';

/* ── Delays entre capítulos (para não sobrecarregar a API) ── */
const _DELAY       = (i) => i < 10 ? 1600 : i < 20 ? 2800 : i < 35 ? 4000 : 5500;
const _RETRY_QUOTA = 45000; /* 45s de espera ao detectar rate limit */
const _GEN_SAVE_KEY = 'acy_gen_prog';

let _genCancelado = false;
let _treRetroRefCount = 0;

/* ═══════════════════════════════════════════════════════════
   CHAMADA CENTRAL AO /api/engine
   Arquitectura: Frontend → /api/engine → switch(action)
   Único provider de IA: OpenRouter (no backend)
═══════════════════════════════════════════════════════════ */

async function callAcademyAPI(rawPayload) {
  const action = rawPayload.acao || rawPayload.tipo || '';
  const { acao: _a, tipo: _t, ...payload } = rawPayload;

  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 60000);
  try {
    const resp = await fetch(ACADEMY_ENGINE_URL, {
      method:  'POST',
      mode:    'cors',
      signal:  ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, payload }),
    });

    if (!resp.ok) {
      const ed = await resp.json().catch(() => ({}));
      throw new Error(ed?.error || 'Engine HTTP ' + resp.status);
    }

    const envelope = await resp.json();
    if (!envelope?.ok) throw new Error(envelope?.error || 'Engine: resposta inválida');

    const resposta = envelope?.data?.resposta;
    if (resposta === undefined || resposta === null || resposta === '') {
      throw new Error('Engine: resposta vazia');
    }

    if (action === 'gerar_capitulo' || action === 'gerar_capitulo_referencias' || action === 'regenerar_capitulo') {
      return {
        resposta,
        health:       envelope.data.health       || null,
        readiness:    envelope.data.readiness    || null,
        confidence:   envelope.data.confidence   || null,
        completeness: envelope.data.completeness || null,
        _guaranteed:  envelope.data._guaranteed  || false,
      };
    }
    return resposta;
  } finally {
    clearTimeout(tid);
  }
}

/* ── Converter AST de capítulo em texto plano ── */
function astParaTexto(ast) {
  if (!ast || !ast.sections) return '';
  return ast.sections.map(sec => {
    let txt = '';
    if (sec.titulo || sec.title) txt += (sec.titulo || sec.title) + '\n\n';
    const paras = sec.paragrafos || sec.paragraphs || [];
    if (paras.length) txt += paras.join('\n\n');
    return txt;
  }).join('\n\n');
}

/* ── Render de erro de API no ecrã ── */
function renderErroAPI(ec, erMsg, retryCb, voltarCb) {
  const linhas  = erMsg.replace('ACADEMY FALHOU:\n', '').split('\n').filter(Boolean);
  const isCORS  = erMsg.includes('EDGE_DOWN') || linhas.some(l => l.includes('CORS') || l.includes('Failed to fetch') || l.includes('NetworkError'));
  const isQuota = erMsg.includes('QUOTA')     || (!isCORS && linhas.some(l => l.includes('429') || l.includes('quota')));
  const is404   = !isCORS && !isQuota && linhas.some(l => l.includes('404'));

  let icone  = '📡';
  let titulo = 'Falha no servidor ACADEMY';
  let desc   = 'O servidor não respondeu. Detalhes:';
  if (isCORS)  { icone = '🔌'; titulo = 'Servidor indisponível'; desc = 'Não foi possível contactar o servidor ACADEMY. Verifica a tua ligação à internet.'; }
  if (isQuota) { icone = '⏳'; titulo = 'Quota diária esgotada'; desc = 'Atingiste o limite da API. Aguarda uns segundos e tenta novamente.'; }
  if (is404)   { icone = '🔌'; titulo = 'Serviço não encontrado'; desc = 'O serviço não está disponível nesta região. Tenta novamente.'; }

  const detalhes = linhas.map(l => `<div style="text-align:left;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)">${l}</div>`).join('');

  if (ec) ec.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;text-align:center;padding:24px">
      <div style="font-size:40px">${icone}</div>
      <div class="T1" style="font-size:20px">${titulo}</div>
      <div class="desc" style="max-width:300px">${desc}</div>
      <div style="font-family:var(--fm);font-size:9px;color:var(--t3);width:100%;max-width:320px;padding:10px;background:var(--z3);border-radius:8px;overflow-x:hidden">${detalhes || erMsg.substring(0, 300)}</div>
      <button class="btn B" onclick="${retryCb}">↺ Tentar novamente</button>
      ${isQuota ? `<button class="btn O" onclick="nav('exemplares')" style="margin-top:2px">◉ Ver Exemplares Oficiais</button>` : ''}
      <button class="btn G" onclick="${voltarCb}" style="margin-top:2px">← Voltar</button>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   GERAR PLANO E ESTRUTURA
═══════════════════════════════════════════════════════════ */

async function gerarPlano() {
  State.set('load', true);
  irPara('plano');
  try {
    const tp  = tipoActual() || { n: 'Trabalho Académico' };
    const raw = await callAcademyAPI({
      acao:         'plano_academico',
      tema:         State.getCfg('tema'),
      tipoTrabalho: tp.n,
      nivel:        State.getCfg('nivel'),
    });
    State.set('plano', typeof raw === 'object' ? raw : JSON.parse(raw));
  } catch (e) {
    State.set('plano', null);
    State.set('load', false);
    const ec = document.querySelector('.ecra');
    renderErroAPI(ec, e.message || 'erro desconhecido', 'gerarPlano()', "irPara('nivel')");
    return;
  }
  State.set('load', false);
  irPara('plano');
}

async function gerarEst() {
  State.set('load', true);
  irPara('est');
  try {
    const tp             = tipoActual() || { n: 'Trabalho Académico' };
    const estruturaPadrao = getEstruturaTipo(State.getCfg('tipo'));
    const raw            = await callAcademyAPI({
      acao:             'estrutura_academica',
      tema:             State.getCfg('tema'),
      tipoTrabalho:     tp.n,
      nivel:            State.getCfg('nivel'),
      pags:             State.getCfg('pags'),
      numCaps:          State.getCfg('numCaps') || 5,
      estruturaProf:    State.getCfg('estruturaProf') || '',
      estruturaPadrao:  estruturaPadrao?.caps || [],
    });
    const parsed = typeof raw === 'object' ? raw : JSON.parse(raw);
    State.set('est', parsed.capitulos || parsed);
  } catch (e) {
    /* Fallback: estrutura padrão sem IA */
    const estruturaPadrao = getEstruturaTipo(State.getCfg('tipo'));
    if (estruturaPadrao?.caps?.length > 0) {
      State.set('est', estruturaPadrao.caps);
      State.set('load', false);
      irPara('est');
      return;
    }
    State.set('est', null);
    State.set('load', false);
    const ec = document.querySelector('.ecra');
    renderErroAPI(ec, e.message || 'erro desconhecido', 'gerarEst()', "irPara('plano')");
    return;
  }
  State.set('load', false);
  irPara('est');
}

/* ═══════════════════════════════════════════════════════════
   SISTEMA ANTI-DETECÇÃO IA
   Pools de variação linguística — cada capítulo
   recebe um conjunto diferente de instruções.
═══════════════════════════════════════════════════════════ */

const EXEMPLO_PREFIXOS = [
  'A título de exemplo,', 'Por exemplo,', 'Como caso concreto,',
  'Ilustrando este ponto,', 'Num cenário prático,', 'Observa-se, por exemplo,',
  'Em contexto angolano,', 'Tomando como referência,', 'De forma ilustrativa,',
  'Como se verifica na prática,',
];

const HIPOTESE_VARIACOES = [
  'A hipótese central deste estudo sustenta que', 'Parte-se do pressuposto de que',
  'Este trabalho assume como ponto de partida que', 'A investigação sugere que',
  'Admite-se, neste contexto, que', 'O presente trabalho defende que',
  'A análise desenvolvida indica que', 'Considera-se relevante sublinhar que',
];

const CONCLUSAO_CONECTORES  = ['Em síntese,', 'Em suma,', 'Em conclusão,', 'Concluindo,', 'Desta forma,', 'Face ao exposto,', 'Perante o analisado,', 'Assim sendo,'];
const INTRODUCAO_CONECTORES = ['Neste sentido,', 'Com efeito,', 'Importa referir que', 'Cumpre salientar que', 'De facto,', 'Convém destacar que', 'Saliente-se que', 'Há que considerar que'];

function _INSTRUCAO_ANTI_IA(capNum, numSubs) {
  const idx  = (capNum || 0) % EXEMPLO_PREFIXOS.length;
  const idxH = (capNum || 0) % HIPOTESE_VARIACOES.length;
  const idxC = ((capNum || 0) + 2) % CONCLUSAO_CONECTORES.length;
  const idxI = ((capNum || 0) + 1) % INTRODUCAO_CONECTORES.length;

  return `REGRAS OBRIGATÓRIAS DE ESTILO ACADÉMICO — APLICAR RIGOROSAMENTE:
1. PROIBIDO usar "A título de exemplo:" — usa EXCLUSIVAMENTE: "${EXEMPLO_PREFIXOS[idx]}"
2. PROIBIDO usar "A hipótese deste trabalho sugere que" — usa: "${HIPOTESE_VARIACOES[idxH]}"
3. PROIBIDO repetir a mesma expressão de exemplo em subtópicos diferentes do mesmo capítulo
4. Para concluir parágrafos usa: "${CONCLUSAO_CONECTORES[idxC]}" ou variantes naturais
5. Para introduzir parágrafos usa: "${INTRODUCAO_CONECTORES[idxI]}" ou variantes naturais
6. PROIBIDO usar bullet points ou listas — apenas prosa académica fluida
7. PROIBIDO repetir a mesma estrutura sintáctica em parágrafos consecutivos
8. Cada parágrafo deve começar com palavra diferente do anterior
9. Varia os conectores: não uses "Além disso" mais de uma vez por subtópico
10. O texto deve soar como escrito por um académico angolano experiente, não por IA`;
}

/* ═══════════════════════════════════════════════════════════
   DOCUMENT MEMORY ENGINE
   Regista o que já foi usado — injecta proibições no próximo prompt.
═══════════════════════════════════════════════════════════ */

const DOC_MEMORY = {
  conectoresUsados: new Set(),
  frasesUsadas:     new Set(),
  autoresCitados:   new Set(),
  exemplosUsados:   new Set(),
  conceitosChave:   new Set(),
  _capitulosTexto:  [],

  reset() {
    this.conectoresUsados.clear();
    this.frasesUsadas.clear();
    this.autoresCitados.clear();
    this.exemplosUsados.clear();
    this.conceitosChave.clear();
    this._capitulosTexto = [];
  },

  registar(texto) {
    if (!texto || texto.length < 50) return;
    /* Resumo do capítulo */
    this._capitulosTexto.push(texto.substring(0, 200).replace(/\n/g, ' '));

    /* Extrair conectores usados */
    const conn = ['Além disso', 'Por outro lado', 'No entanto', 'Todavia', 'Portanto', 'Desta forma', 'Em suma', 'Com efeito'];
    conn.forEach(c => { if (texto.includes(c)) this.conectoresUsados.add(c); });

    /* Extrair frases de 4+ palavras para evitar repetição */
    const frases = texto.match(/[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÜ][^.!?]{15,80}[.!?]/g) || [];
    frases.slice(0, 8).forEach(f => this.frasesUsadas.add(f.substring(0, 60)));
  },

  gerarInstrucao() {
    const proibidos = [...this.conectoresUsados].slice(0, 5).join(', ');
    const frases    = [...this.frasesUsadas].slice(0, 3).map(f => `"${f}"`).join(', ');
    if (!proibidos && !frases) return '';
    return `MEMÓRIA DO DOCUMENTO (PROIBIÇÕES ABSOLUTAS PARA ESTE CAPÍTULO):
${proibidos ? `- PROIBIDO usar estes conectores já usados: ${proibidos}` : ''}
${frases    ? `- PROIBIDO começar frases com: ${frases}` : ''}
- OBRIGATÓRIO: este capítulo deve ter estilo e vocabulário claramente diferente dos anteriores.`;
  },
};

/* ── Registar capítulo no DOC_MEMORY após geração ── */
function ailRegistarCapitulo(texto) {
  DOC_MEMORY.registar(texto);
}

/* ── Argumento Graph (rastreio de coerência argumentativa) ── */
const ARGUMENT_GRAPH = {
  argumentosPrincipais: [],
  conclusoesParciais:   [],
  autoresUtilizados:    [],
  conceitosCentrais:    [],

  reset() {
    this.argumentosPrincipais = [];
    this.conclusoesParciais   = [];
    this.autoresUtilizados    = [];
    this.conceitosCentrais    = [];
  },
};

function treRegistarCapitulo(texto, capNum) {
  if (!texto || texto.length < 100) return;
  ARGUMENT_GRAPH.argumentosPrincipais.push({
    cap:       capNum,
    resumo200: texto.substring(0, 200).replace(/\n/g, ' '),
  });
}

/* ═══════════════════════════════════════════════════════════
   GUARDAR / RESTAURAR PROGRESSO DE GERAÇÃO
═══════════════════════════════════════════════════════════ */

function genGuardarProgresso() {
  try {
    localStorage.setItem(_GEN_SAVE_KEY, JSON.stringify({
      secs: State.get('secs').map(s => ({ id: s.id, titulo: s.titulo, num: s.num, e: s.e, c: s.c || '' })),
      cfg:  { tema: State.getCfg('tema'), tipo: State.getCfg('tipo'), nivel: State.getCfg('nivel'), pags: State.getCfg('pags') },
      est:  State.get('est'),
      ts:   Date.now(),
    }));
  } catch (e) {}
}

function genTemProgresso() {
  try {
    const d = JSON.parse(localStorage.getItem(_GEN_SAVE_KEY) || 'null');
    if (!d) return false;
    if (Date.now() - d.ts > 4 * 3600 * 1000) return false; /* expira em 4h */
    if (d.cfg?.tema !== State.getCfg('tema') || d.cfg?.tipo !== State.getCfg('tipo')) return false;
    return d;
  } catch { return false; }
}

function genLimparProgresso() {
  try { localStorage.removeItem(_GEN_SAVE_KEY); } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════
   LOOP DE GERAÇÃO PRINCIPAL
═══════════════════════════════════════════════════════════ */

async function iniciarGer(retomar) {
  if (_btnGerarBloqueado) { mostrarToast('⏳ Geração já em curso — aguarda.'); return; }
  _btnGerarBloqueado = true;
  try {
  const est = State.get('est');
  if (!est) return;

  _genCancelado = false;
  State.set('genFim', false);
  DOC_MEMORY.reset();
  ARGUMENT_GRAPH.reset();
  _treRetroRefCount = 0;

  /* Definir ponto de início */
  let iniciarEm = 0;
  if (retomar) {
    const prog = genTemProgresso();
    if (prog) {
      State.set('secs', prog.secs);
      iniciarEm = State.get('secs').findIndex(s => s.e !== 'p' && s.e !== 'x');
      if (iniciarEm === -1) iniciarEm = State.get('secs').length;
    }
  }

  if (!retomar || iniciarEm === 0) {
    State.set('secs', est.map((c, i) => ({
      id: i, nome: `CAP. ${c.num || i + 1} — ${c.titulo}`,
      titulo: c.titulo, num: c.num, subs: c.subs || [],
      e: 'a', c: '', ast: null,
    })));
  }

  irPara('geracao');

  const totalPags  = State.getCfg('pags') || 15;
  const pagsRef    = Math.max(1, Math.round(totalPags / (est.length || 1)));
  const tp         = tipoActual() || { n: 'Trabalho Académico' };
  const plano      = State.get('plano') || {};

  for (let i = iniciarEm; i < est.length; i++) {
    if (_genCancelado) break;

    const cap  = est[i];
    const secs = State.get('secs');
    secs[i].e  = 'g';
    State.set('secs', secs);
    aSecDOM(i, 'g', 'EM CURSO');

    /* Actualizar estimativa de tempo restante */
    const restEl = document.getElementById('estimG');
    if (restEl) {
      const seg_med = _DELAY(i) / 1000 + 8;
      const min     = Math.round((est.length - i) * seg_med / 60);
      restEl.textContent = min > 1 ? `~${min} min` : `~${(est.length - i) * Math.round(seg_med)}s`;
    }

    if (i > iniciarEm) await new Promise(r => setTimeout(r, _DELAY(i)));
    if (_genCancelado) break;

    /* ── GERAÇÃO DO CAPÍTULO ────────────────────────────────────────
       Tenta até 4 vezes. Para quando tiver resultado válido.
    ─────────────────────────────────────────────────────────────── */
    const isRef    = cap.titulo && (cap.titulo.toLowerCase().includes('refer') || cap.titulo.toLowerCase().includes('bibliog'));
    const acaoGer  = isRef ? 'gerar_capitulo_referencias' : 'gerar_capitulo';

    let resultado   = null;
    let tentativas  = 0;
    let _capTimedOut = false;
    const _capTimeout = setTimeout(() => { _capTimedOut = true; }, 120000);

    try {
      while (!resultado && tentativas < 4 && !_genCancelado && !_capTimedOut) {
        try {
          const raw = await callAcademyAPI({
            acao:                acaoGer,
            tema:                State.getCfg('tema'),
            tipoTrabalho:        tp.n,
            nivel:               State.getCfg('nivel'),
            totalPags,
            capNum:              cap.num,
            capTitulo:           cap.titulo,
            capSubs:             cap.subs || [],
            totalCaps:           est.length,
            palavrasPorCap:      Math.max(200, pagsRef * 220),
            objetivo:            (plano.objetivo || '').substring(0, 120),
            hipotese:            (plano.hipotese || '').substring(0, 100),
            metodologia:         (plano.metodologia || '').substring(0, 100),
            instrucaoSubtitulos: `Cada subtópico em capSubs DEVE aparecer como subtítulo numerado em linha própria.`,
            instrucaoVariacao:   _INSTRUCAO_ANTI_IA(cap.num, cap.subs?.length || 0),
            memoriaDocumento:    DOC_MEMORY.gerarInstrucao(),
          });

          /* raw pode ser { resposta, health, readiness } ou valor directo */
          let _rawVal = raw;
          if (raw && typeof raw === 'object' && 'resposta' in raw) {
            _rawVal = raw.resposta;
            const secsArr = State.get('secs');
            secsArr[i].health       = raw.health       || null;
            secsArr[i].readiness    = raw.readiness    || null;
            secsArr[i].confidence   = raw.confidence   || null;
            secsArr[i].completeness = raw.completeness || null;
            State.set('secs', secsArr);
          }

          if (_rawVal && (typeof _rawVal === 'object' || (typeof _rawVal === 'string' && _rawVal.length > 30))) {
            resultado = _rawVal;
          } else {
            tentativas++;
          }
        } catch (er) {
          tentativas++;
          const espera = Math.min(tentativas * 8000, 45000);
          aSecDOM(i, 'g', `Tentativa ${tentativas}/4 — aguarda ${Math.round(espera / 1000)}s…`);
          if (restEl) restEl.textContent = 'Erro API — a re‐tentar…';
          await new Promise(r => setTimeout(r, espera));
        }
      }
    } finally {
      clearTimeout(_capTimeout);
      if (!resultado) resultado = `[Cap. ${cap.num} não concluído. Toca em ↺.]`;
    }

    if (_genCancelado) { genGuardarProgresso(); break; }

    /* ── PROCESSAR RESULTADO ──────────────────────────────────────
       Normalizar para texto + AST independentemente do formato
    ─────────────────────────────────────────────────────────────── */
    let textoFinal = '[Secção não gerada. Toca em ↺ para regenerar.]';
    let astFinal   = null;

    if (resultado) {
      if (typeof resultado === 'object' && resultado.sections) {
        astFinal   = resultado;
        textoFinal = astParaTexto(resultado);
      } else if (typeof resultado === 'string' && resultado.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(resultado);
          if (parsed?.sections) { astFinal = parsed; textoFinal = astParaTexto(parsed); }
          else textoFinal = resultado;
        } catch { textoFinal = resultado; }
      } else if (typeof resultado === 'string') {
        textoFinal = resultado;
      }
    }

    /* ── GUARDAR NA SECÇÃO ── */
    const secsArr   = State.get('secs');
    secsArr[i].e   = 'p';
    secsArr[i].c   = textoFinal;
    secsArr[i].blocks = blkExtrair({ c: textoFinal });
    secsArr[i].ast = astFinal;
    State.set('secs', secsArr);

    const healthLabel = secsArr[i].health  ? ` · ${secsArr[i].health.health}% ${secsArr[i].health.label}` : '';
    const readyLabel  = secsArr[i].readiness ? (secsArr[i].readiness.ready ? ' ✓' : ' ⚠') : '';
    aSecDOM(i, 'p', `✓ PRONTO${healthLabel}${readyLabel}`, textoFinal);
    aBarra(i + 1, est.length);

    /* Alimentar memória do documento */
    if (textoFinal && textoFinal.length > 30 && !textoFinal.startsWith('[')) {
      ailRegistarCapitulo(textoFinal);
      treRegistarCapitulo(textoFinal, cap.num);
    }

    genGuardarProgresso();
    autoGuardar();
  }

  /* ── FIM DA GERAÇÃO ── */
  if (_genCancelado) {
    autoGuardar();
    mostrarToast('⏹ Geração pausada — trabalho guardado. Podes retomar.');
    return;
  }

  const restEl2 = document.getElementById('estimG');
  if (restEl2) restEl2.textContent = 'Concluído ✓';

  genLimparProgresso();
  limparRascunhoPendente();

  /* Calcular qualidade estimada */
  const secs       = State.get('secs');
  const totalWords = secs.reduce((s, x) => s + (x.c?.split(/\s+/).length || 0), 0);
  const targetWords = totalPags * 240;
  const fill        = Math.min(100, Math.round(totalWords / targetWords * 100));
  const base        = Math.min(95, 72 + Math.floor(fill * 0.22));
  State.set('qual', {
    total: base,
    itens: [['Coerência', Math.min(97, base + 2)], ['Profundidade', Math.min(97, base - 2)], ['Rigor', Math.min(97, base - 3)], ['Argumentação', Math.min(97, base + 1)]],
  });

  State.set('genFim', true);
  _desbloquearBtnGerar();
  addDoc({ tipo: tp.s || tp.n, tema: State.getCfg('tema'), pags: nPags(), qual: State.get('qual')?.total });
  autoGuardar();

  /* Notificação PWA */
  pwaNotificarConclusaoCapitulo(secs.length);
  renderizar(); /* actualizar ecrã de geração para mostrar "Pronto" */
} finally { _desbloquearBtnGerar(); }
}

/* ── Concluir: ir para o editor ── */
function docConcluido() {
  irPara('editor');
}

/* ── Calcular estatísticas do documento ── */
function calcStats(secs) {
  const txt      = secs.map(s => s.c || s.conteudo || '').join(' ');
  const palavras = txt.split(/\s+/).filter(Boolean).length;
  const chars    = txt.replace(/\s/g, '').length;
  const pags     = Math.max(1, Math.ceil(palavras / 280));
  const refs     = secs.filter(s => (s.titulo || '').toLowerCase().includes('referência')).length;
  const tempoLeit = Math.max(1, Math.ceil(palavras / 200));
  return { palavras, chars, pags, refs, tempoLeit };
}

/* ── Sanitização de texto académico ── */
function sanitizeAcademic(txt) {
  if (!txt || typeof txt !== 'string') return txt || '';
  return txt
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/* ── Validação antes de gerar ── */
let _btnGerarBloqueado = false;

function btnGerarFinalClick() {
  if (_btnGerarBloqueado) { mostrarToast('⏳ Geração já em curso — aguarda.'); return; }
  const erros = _validarFormularioCompleto();
  if (erros.length) { _mostrarErroValidacao(erros[0]); return; }
  const btn = document.getElementById('btnGerarFinal');
  if (btn) { btn.textContent = '⏳ A iniciar geração…'; btn.disabled = true; btn.style.opacity = '.7'; btn.style.cursor = 'not-allowed'; }
  verificarAntesDeGerar(true);
}

function _desbloquearBtnGerar() {
  _btnGerarBloqueado = false;
  const btn = document.getElementById('btnGerarFinal');
  if (btn) { btn.textContent = '⚡ Gerar Trabalho'; btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; }
}

function _validarFormularioCompleto() {
  const erros = [];
  if (!State.getCfg('tipo'))                                    erros.push('Selecciona o tipo de trabalho antes de continuar.');
  if (!State.getCfg('tema') || State.getCfg('tema').length < 10) erros.push('O tema deve ter pelo menos 10 caracteres.');
  if (!State.getCfg('nivel'))                                   erros.push('Selecciona o nível académico.');
  if (!State.getCfg('pags') || State.getCfg('pags') < 1)       erros.push('Define o número de páginas.');
  if (!State.getCfg('numCaps') || State.getCfg('numCaps') < 1) erros.push('Define o número de capítulos.');
  if (!State.get('est') || !State.get('est').length)            erros.push('A estrutura académica ainda não foi gerada. Aguarda…');
  return erros;
}

function _mostrarErroValidacao(msg) {
  document.getElementById('validacao-erro')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'validacao-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:699;background:rgba(0,0,0,.6);backdrop-filter:blur(8px)';
  const div = document.createElement('div');
  div.id = 'validacao-erro';
  div.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:700;background:var(--z2);border:1.5px solid rgba(248,113,113,.5);border-radius:14px;padding:24px 22px;width:calc(100% - 48px);max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,.7);text-align:center;animation:aparecer .2s;`;
  div.innerHTML = `
    <div style="font-size:32px;margin-bottom:12px">⚠️</div>
    <div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:8px">Campo obrigatório</div>
    <div style="font-size:13px;color:var(--t2);line-height:1.65;margin-bottom:20px">${msg}</div>
    <button onclick="document.getElementById('validacao-erro')?.remove();document.getElementById('validacao-overlay')?.remove()"
      style="padding:12px 28px;border-radius:10px;background:linear-gradient(135deg,var(--b),var(--bd));border:none;color:var(--t-inv);font-family:var(--fu);font-size:14px;font-weight:700;cursor:pointer">
      OK, percebido
    </button>`;
  overlay.onclick = () => { div.remove(); overlay.remove(); };
  document.body.appendChild(overlay);
  document.body.appendChild(div);
}

/* ── Gate de geração (verifica plano antes de avançar) ── */
function verificarAntesDeGerar(gerarDirecto) {
  if (gerarDirecto) iniciarGer();
  else irPara('preview_gen');
}
