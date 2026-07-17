/* ═══════════════════════════════════════════════════════════
   ACADEMY — EDITOR.JS
   Editor de documento: visualização, edição inline,
   regeneração de capítulos, qualidade, capa, pós-textuais.
   Depende de: state.js, navigation.js, generator.js
═══════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   RENDER PRINCIPAL DO EDITOR
════════════════════════════════════════════════════════════ */
function sEditor(secsArg, cfgArg, qualArg, isEx) {
  const ss    = secsArg || State.get('secs');
  const cfg   = cfgArg  || State.get('cfg');
  const tp    = isEx
    ? { n: isEx.tipo, s: isEx.sigla }
    : (tipoActual() || { n: 'Trabalho Académico', s: 'TFC' });
  const pg    = isEx ? isEx.pags : nPags();
  const q     = qualArg || State.get('qual') || null;
  const tema  = isEx ? isEx.titulo  : cfg.tema;
  const inst  = isEx ? isEx.inst    : cfg.inst;
  const prof  = isEx ? isEx.prof    : cfg.prof;
  const nivel = isEx ? isEx.nivel   : cfg.nivel;
  const mbs   = isEx ? []           : (cfg.mbs || []);
  const stats = calcStats(ss);
  const u     = State.get('u');

  return `
  <!-- CAPA DO DOCUMENTO -->
  <div class="ed-capa">
    ${inst ? `<div style="font-family:var(--fm);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);text-align:center;margin-bottom:10px">${inst}</div>` : ''}
    <div class="ed-tipo">● ${tp.n}${isEx ? ' · EXEMPLAR' : ''}</div>
    <div class="ed-titulo">${tema}</div>
    <div class="ed-linha"></div>
    <div class="ed-meta">
      ${mbs.length ? mbs.join('<br/>') : u?.nome || isEx?.autor || 'Autor'}
      ${prof  ? `<br/>Orientador: ${prof}` : ''}
      ${inst  ? `<br/>${inst}`             : ''}
      ${nivel ? `<br/>${nivel}`            : ''}
      <br/>${new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' })}
    </div>
  </div>

  <!-- BADGE REFERÊNCIAS -->
  <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(67,232,167,.06);border:1px solid rgba(67,232,167,.3);border-radius:10px;margin-bottom:14px">
    <div style="width:8px;height:8px;border-radius:50%;background:var(--b);flex-shrink:0;box-shadow:0 0 6px var(--b)"></div>
    <div style="flex:1">
      <div style="font-family:var(--fm);font-size:9px;font-weight:700;color:var(--b);letter-spacing:.1em;text-transform:uppercase">Referências Académicas Incluídas</div>
      <div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-top:1px">Secção obrigatória · Estilo ${cfg.refStyle || 'APA'} · Gerada automaticamente</div>
    </div>
    <div style="font-size:16px">📚</div>
  </div>

  <!-- MÉTRICAS DE QUALIDADE -->
  <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px">
    <div class="anel">
      <svg width="80" height="80" viewBox="0 0 80 80" style="transform:rotate(-90deg)">
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(30,146,255,.08)" stroke-width="5"/>
        <circle cx="40" cy="40" r="34" fill="none" stroke="#1E92FF" stroke-width="5" stroke-linecap="round"
          stroke-dasharray="${Math.min(pg / 40, 1) * 2 * Math.PI * 34} ${2 * Math.PI * 34}"
          style="filter:drop-shadow(0 0 5px #1E92FF)"/>
      </svg>
      <div class="anel-c"><div class="anel-n">${pg}</div><div class="anel-l">PÁG</div></div>
    </div>
    ${q ? `
    <div style="flex:1">
      <div style="font-family:var(--fm);font-size:8.5px;color:var(--t3);letter-spacing:.12em;margin-bottom:10px">QUALIDADE ACADÉMICA</div>
      ${q.itens.map(([n, v]) => `
      <div class="qi">
        <div class="qi-l">${n}</div>
        <div class="qi-b"><div class="qi-f" style="width:${Math.min(100, v)}%;background:linear-gradient(90deg,var(--bd),var(--b));box-shadow:0 0 8px rgba(30,146,255,.4)"></div></div>
        <div class="qi-v">${Math.min(100, v)}%</div>
      </div>`).join('')}
    </div>` : `
    <div style="flex:1;display:flex;align-items:center">
      <div style="font-family:var(--fm);font-size:10px;color:var(--t3);line-height:1.7">As métricas de qualidade são calculadas após a geração do documento.</div>
    </div>`}
  </div>

  <!-- ESTATÍSTICAS -->
  <div class="stats-row" style="border-radius:var(--r2);border:1px solid var(--e0);margin-bottom:14px">
    <div class="stat-pill"><strong>${stats.palavras.toLocaleString('pt-PT')}</strong>palavras</div>
    <div class="stat-pill" style="color:var(--e1)">·</div>
    <div class="stat-pill"><strong>${stats.chars.toLocaleString('pt-PT')}</strong>caracteres</div>
    <div class="stat-pill" style="color:var(--e1)">·</div>
    <div class="stat-pill"><strong>${stats.pags}</strong>págs</div>
    <div class="stat-pill" style="color:var(--e1)">·</div>
    <div class="stat-pill"><strong>~${stats.tempoLeit} min</strong>leitura</div>
    <div class="stat-pill" style="margin-left:auto"><span class="etq etq-b" style="font-size:8px">${cfg.refStyle || 'APA'}</span></div>
  </div>

  <!-- BOTÕES EXPORTAR -->
  <div style="display:flex;gap:8px;margin-bottom:10px">
    <button class="btn B s" style="flex:1" onclick="${isEx ? `expPDF('${isEx.id}')` : 'expPDF(null)'}">📄 PDF</button>
    <button class="btn G s" style="flex:1" onclick="${isEx ? `expDocx('${isEx.id}')` : 'expDocx(null)'}">📝 DOCX</button>
    <button class="btn G s" onclick="${isEx ? 'abrirMLEx()' : 'abrirML()'}">📖</button>
  </div>

  ${!isEx ? `
  <!-- EDITOR CONVERSACIONAL -->
  <button class="btn B w" onclick="abrirEditorConversacional()" style="margin-bottom:14px;background:linear-gradient(135deg,rgba(63,255,160,.12),rgba(34,211,238,.08));border:1.5px solid rgba(63,255,160,.35);color:var(--t1);display:flex;align-items:center;justify-content:center;gap:10px">
    <span style="font-size:15px">⚡</span>
    <span style="flex:1;text-align:left">
      <span style="display:block;font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--b);text-transform:uppercase;margin-bottom:2px">Novo</span>
      <span style="font-size:14px;font-weight:600;color:var(--t1)">Editar com IA Conversacional</span>
    </span>
    <span style="font-size:12px;color:var(--b)">→</span>
  </button>` : ''}

  ${!isEx ? renderCapaPanel() : ''}

  ${!isEx ? `
  <!-- DICA: TEXTO EDITÁVEL -->
  <div style="background:rgba(63,255,160,.06);border:1.5px solid var(--eb);border-radius:10px;padding:13px 16px;margin-bottom:14px;display:flex;align-items:flex-start;gap:11px">
    <div style="font-size:20px;flex-shrink:0;margin-top:1px">✏️</div>
    <div>
      <div style="font-family:var(--fm);font-size:9px;font-weight:700;color:var(--b);letter-spacing:.1em;margin-bottom:4px;text-transform:uppercase">Conteúdo editável</div>
      <div style="font-size:12px;color:var(--t2);line-height:1.65">
        Podes editar qualquer capítulo — basta <strong style="color:var(--t1)">tocar/clicar no texto</strong> para começar a editar. As alterações são guardadas automaticamente. Usa os botões <strong style="color:var(--t1)">↺ ✦ ⊕</strong> para regenerar, melhorar ou expandir cada secção com IA.
      </div>
    </div>
  </div>` : ''}

  <!-- SECÇÕES EDITÁVEIS -->
  ${ss.map((sec, i) => `
  <div class="ed-sec" id="esec-${i}${isEx ? '-x' : ''}">
    <div class="ed-sec-cab" onclick="togSec(${i},'${isEx ? 'x' : ''}')">
      <div class="ed-sec-num">CAP. ${sec.num || sec.numero || i + 1}</div>
      <div class="ed-sec-tit">${sec.titulo}</div>
      <div style="display:flex;gap:5px">
        ${!isEx ? `
        <div class="ed-sec-btn" onclick="event.stopPropagation();regenSec(${i})" title="Regenerar">↺</div>
        <div class="ed-sec-btn" onclick="event.stopPropagation();melhorarSec(${i})" title="Melhorar linguagem" style="font-size:10px">✦</div>
        <div class="ed-sec-btn" onclick="event.stopPropagation();expandirSec(${i})" title="Expandir" style="font-size:11px">⊕</div>
        <div class="ed-sec-btn" onclick="event.stopPropagation();chatSec(${i})" title="Pedir ao ACADEMY" style="color:var(--o);font-size:10px">⊙</div>
        <div class="tts-btn" id="tts-${i}" onclick="event.stopPropagation();lerTexto((State.get('secs')[${i}]?.c||'').substring(0,3000),'tts-${i}')" title="Ouvir este capítulo">🔊 Ouvir</div>` : ''}
        <div class="ed-sec-btn" onclick="event.stopPropagation();togSec(${i},'${isEx ? 'x' : ''}')">▾</div>
      </div>
    </div>

    ${!isEx ? `
    <div class="ed-toolbar" id="tb-${i}" style="display:none">
      <button class="ed-tb-btn" onclick="fmt('bold',${i})" title="Negrito"><b>N</b></button>
      <button class="ed-tb-btn" onclick="fmt('italic',${i})" title="Itálico"><i>I</i></button>
      <button class="ed-tb-btn" onclick="fmt('underline',${i})" title="Sublinhado"><u>S</u></button>
      <div class="ed-tb-sep"></div>
      <button class="ed-tb-btn" onclick="fmt('insertUnorderedList',${i})" title="Lista">≡</button>
      <div class="ed-tb-sep"></div>
      <span class="ed-tb-label">Edição activa</span>
    </div>` : ''}

    <div class="ed-sec-body" id="sc-${i}${isEx ? '-x' : ''}"
      ${!isEx ? `contenteditable="true" oninput="onEdit(${i})" onfocus="mostrarTb(${i})" onblur="ocultarTb(${i})"` : ''}
      style="display:${i === 0 ? 'block' : 'none'}">
      ${_renderSecConteudo(sec)}
    </div>
  </div>`).join('')}

  <div id="graficosContainer"></div>
  <div id="docHealthPanel"></div>
  ${!isEx ? _renderPanelPostextuais(cfg) : ''}
  ${RODAPE_HTML}`;
}

/* ── Renderizar conteúdo de uma secção (sanitizado + HTML) ── */
function _renderSecConteudo(sec) {
  const raw       = sec.c || sec.conteudo || '';
  const sanitized = sanitizeAcademic(raw);
  const paragrafos = sanitized.split('\n\n').filter(p => p.trim().length > 0);
  return paragrafos.map(p => `<p>${mdParaHtml(p.trim())}</p>`).join('');
}

/* ── Converter Markdown básico em HTML ── */
function mdParaHtml(txt) {
  if (!txt) return '';
  return txt
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/^[-*]\s+(.+)$/gm,    '$1')
    .trim();
}

/* ════════════════════════════════════════════════════════════
   INTERACÇÕES DO EDITOR
════════════════════════════════════════════════════════════ */

/* ── Abrir/fechar secção ── */
function togSec(i, suf) {
  const c = document.getElementById(`sc-${i}${suf ? '-' + suf : ''}`);
  if (c) c.style.display = c.style.display === 'none' ? 'block' : 'none';
}

/* ── Auto-guardar ao editar ── */
let _tGuardar = null;
function onEdit(i) {
  const c    = document.getElementById(`sc-${i}`);
  const secs = State.get('secs');
  if (c && secs[i]) secs[i].c = c.innerText;
  State.set('secs', secs);
  State.set('guardarEst', 'editado');
  _actualizarGuardarUI('editado');
  clearTimeout(_tGuardar);
  _tGuardar = setTimeout(autoGuardar, 2000);
}

function _actualizarGuardarUI(estado) {
  const el = document.getElementById('estG');
  if (!el) return;
  const t = { guardado: 'Guardado', guardando: 'A guardar…', editado: 'Editado' };
  el.className  = `tb-guardar ${estado || 'guardado'}`;
  el.innerHTML  = `<div class="ds"></div><span>${t[estado || 'guardado']}</span>`;
}

/* ── Formatação rich-text ── */
function fmt(cmd, i) {
  const c = document.getElementById(`sc-${i}`);
  if (!c) return;
  c.focus();
  document.execCommand(cmd, false, null);
  onEdit(i);
}

function mostrarTb(i) {
  const tb = document.getElementById(`tb-${i}`);
  if (tb) tb.style.display = 'flex';
}

function ocultarTb(i) {
  setTimeout(() => {
    const tb = document.getElementById(`tb-${i}`);
    if (tb) tb.style.display = 'none';
  }, 200);
}

/* ════════════════════════════════════════════════════════════
   ACÇÕES DE IA NO EDITOR
════════════════════════════════════════════════════════════ */

/* ── Regenerar secção completa ── */
async function regenSec(i) {
  const secs = State.get('secs');
  const est  = State.get('est') || [];
  const cap  = est[i];
  if (!cap) return;
  await _regenerarCapitulo(i);
  /* Actualizar DOM do editor inline */
  const el = document.getElementById(`sc-${i}`);
  if (el) {
    el.innerHTML = _renderSecConteudo(State.get('secs')[i]);
  }
}

/* ── Melhorar linguagem ── */
async function melhorarSec(i) {
  const secs = State.get('secs');
  const sec  = secs[i];
  if (!sec?.c) return;
  mostrarToast('✦ A melhorar linguagem…');
  try {
    const res = await callAcademyAPI({
      acao:    'editar_texto',
      texto:   sec.c.substring(0, 4000),
      subacao: 'melhorar',
    });
    const novoTexto = typeof res === 'string' ? res : sec.c;
    secs[i].c = novoTexto;
    State.set('secs', secs);
    const el = document.getElementById(`sc-${i}`);
    if (el) el.innerHTML = _renderSecConteudo(secs[i]);
    autoGuardar();
    mostrarToast('✓ Linguagem melhorada.');
  } catch (e) {
    mostrarToast('✗ Erro ao melhorar: ' + (e.message || ''), 'erro');
  }
}

/* ── Expandir secção ── */
async function expandirSec(i) {
  const secs = State.get('secs');
  const sec  = secs[i];
  if (!sec?.c) return;
  mostrarToast('⊕ A expandir capítulo…');
  try {
    const res = await callAcademyAPI({
      acao:    'editar_texto',
      texto:   sec.c.substring(0, 4000),
      subacao: 'expandir',
    });
    const novoTexto = typeof res === 'string' ? res : sec.c;
    secs[i].c = novoTexto;
    State.set('secs', secs);
    const el = document.getElementById(`sc-${i}`);
    if (el) el.innerHTML = _renderSecConteudo(secs[i]);
    autoGuardar();
    mostrarToast('✓ Capítulo expandido.');
  } catch (e) {
    mostrarToast('✗ Erro ao expandir: ' + (e.message || ''), 'erro');
  }
}

/* ── Abrir chat para este capítulo ── */
function chatSec(i) {
  const secs = State.get('secs');
  const sec  = secs[i];
  if (!sec) return;
  window._chatContextoCap = { idx: i, titulo: sec.titulo, preview: (sec.c || '').substring(0, 300) };
  togChat();
  setTimeout(() => {
    const inp = document.getElementById('chatInp');
    if (inp) {
      inp.value = `Sobre o capítulo "${sec.titulo}": `;
      inp.focus();
    }
  }, 300);
}

/* ── Regenerar capítulo via engine ── */
async function _regenerarCapitulo(idx) {
  const secs = State.get('secs');
  const est  = State.get('est') || [];
  const cap  = est[idx];
  if (!cap || idx < 0 || idx >= secs.length) return;

  secs[idx].e = 'g';
  State.set('secs', secs);
  aSecDOM(idx, 'g', 'A regenerar…');

  try {
    const tp  = tipoActual() || { n: 'Trabalho Académico' };
    const raw = await callAcademyAPI({
      acao:         'regenerar_capitulo',
      tema:         State.getCfg('tema'),
      tipoTrabalho: tp.n,
      nivel:        State.getCfg('nivel'),
      totalPags:    State.getCfg('pags') || 15,
      capNum:       cap.num,
      capTitulo:    cap.titulo,
      capSubs:      cap.subs || [],
      totalCaps:    est.length,
    });

    let textoFinal = '[Secção não regenerada]';
    let astFinal   = null;
    const _rawVal  = raw?.resposta ?? raw;

    if (_rawVal && typeof _rawVal === 'object' && _rawVal.sections) {
      astFinal   = _rawVal;
      textoFinal = astParaTexto(_rawVal);
    } else if (typeof _rawVal === 'string') {
      textoFinal = _rawVal;
    }

    secs[idx].e           = 'p';
    secs[idx].c           = textoFinal;
    secs[idx].ast         = astFinal;
    secs[idx].health      = raw?.health      || null;
    secs[idx].readiness   = raw?.readiness   || null;
    secs[idx].confidence  = raw?.confidence  || null;
    secs[idx].completeness = raw?.completeness || null;
    State.set('secs', secs);

    aSecDOM(idx, 'p', '✓ Regenerado', textoFinal);
    _calcularHealthGlobal();
    autoGuardar();
    mostrarToast('✓ Capítulo regenerado.');
  } catch (e) {
    secs[idx].e = 'e';
    State.set('secs', secs);
    aSecDOM(idx, 'e', 'Erro: ' + e.message);
    mostrarToast('✗ Erro ao regenerar: ' + e.message, 'erro');
  }
}

/* ════════════════════════════════════════════════════════════
   DOCUMENT HEALTH — QUALIDADE GLOBAL
════════════════════════════════════════════════════════════ */

function _calcularHealthGlobal() {
  const secs = State.get('secs');
  if (!secs || !secs.length) return;

  const geradas    = secs.filter(s => s.e === 'p');
  if (!geradas.length) return;

  /* Health médio */
  const comHealth  = geradas.filter(s => s.health);
  const healthMedio = comHealth.length
    ? Math.round(comHealth.reduce((a, s) => a + (s.health.health || 0), 0) / comHealth.length)
    : 70;

  /* Confidence médio */
  const comConf    = geradas.filter(s => s.confidence);
  const confMedio  = comConf.length
    ? Math.round(comConf.reduce((a, s) => a + (s.confidence.confidence || 0), 0) / comConf.length)
    : null;

  /* Issues */
  const todosIssues = [];
  const isRef       = cap => /refer[eê]ncias|bibliograf/i.test(cap.titulo || '');
  const temRef      = geradas.some(s => isRef(s));
  const temIntro    = geradas.some(s => /introd/i.test(s.titulo || ''));
  const temConcl    = geradas.some(s => /conclu|conside/i.test(s.titulo || ''));

  if (!temRef)   todosIssues.push({ severity: 'blocker', code: 'NO_REFERENCES',   message: 'Referências bibliográficas ausentes',  cap: null });
  if (!temIntro) todosIssues.push({ severity: 'warning', code: 'NO_INTRODUCTION', message: 'Introdução não detectada',             cap: null });
  if (!temConcl) todosIssues.push({ severity: 'warning', code: 'NO_CONCLUSION',   message: 'Conclusão não detectada',             cap: null });

  geradas.forEach(s => {
    (s.health?.issues || []).forEach(iss => todosIssues.push({ ...iss, cap: `Cap. ${s.num}` }));
    if (s.readiness && !s.readiness.ready)
      (s.readiness.blockers || []).forEach(b => todosIssues.push({ severity: 'blocker', message: b, cap: `Cap. ${s.num}` }));
  });

  const positivos = [];
  if (geradas.length === secs.length) positivos.push('Todos os capítulos gerados');
  if (temRef)   positivos.push('Referências bibliográficas presentes');
  if (temIntro) positivos.push('Introdução presente');
  if (temConcl) positivos.push('Conclusão presente');
  if (!todosIssues.some(i => i.severity === 'blocker')) positivos.push('Sem erros bloqueadores');

  const blockers = todosIssues.filter(i => i.severity === 'blocker');
  const warnings = todosIssues.filter(i => i.severity === 'warning');

  const health = {
    health:    healthMedio,
    confidence: confMedio,
    issues:    todosIssues,
    positivos,
    label:     healthMedio >= 85 ? 'Saudável' : healthMedio >= 60 ? 'Aceitável' : 'Necessita revisão',
    readiness: {
      ready:   blockers.length === 0,
      verdict: blockers.length === 0 ? 'Pronto para entrega' : 'Requer atenção antes de entregar',
      blockers: blockers.map(b => b.cap ? `${b.cap}: ${b.message}` : b.message),
      warnings: warnings.map(w => w.cap ? `${w.cap}: ${w.message}` : w.message),
    },
    chapter_scores: geradas.map(s => ({
      num:          s.num,
      titulo:       s.titulo,
      health:       s.health?.health || null,
      confidence:   s.confidence?.confidence || null,
      completeness: s.completeness?.completeness || null,
      ready:        s.readiness?.ready !== false,
    })),
  };

  /* Actualizar painel no DOM sem re-renderizar tudo */
  const el = document.getElementById('docHealthPanel');
  if (el) el.innerHTML = _renderDocHealthPanel(health);
}

function _renderDocHealthPanel(h) {
  if (!h) return '';
  const corH = h.health >= 85 ? '#16a34a' : h.health >= 60 ? '#d97706' : '#dc2626';
  const corR = h.readiness.ready ? '#16a34a' : '#dc2626';
  const corC = h.confidence == null ? null : h.confidence >= 80 ? '#16a34a' : h.confidence >= 60 ? '#d97706' : '#dc2626';

  return `
  <div style="padding:12px 14px;background:var(--z2);border:1px solid var(--e0);border-radius:var(--r);margin-bottom:12px">

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.1em">QUALIDADE DO DOCUMENTO</div>
      <div style="font-family:var(--fm);font-size:8px;padding:3px 10px;border-radius:20px;background:${corR}18;color:${corR};font-weight:600">
        ${h.readiness.ready ? '✓ Pronto para entrega' : '⚠ Requer atenção'}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">
      <div style="background:var(--z3);border-radius:var(--r2);padding:8px;text-align:center">
        <div style="font-size:18px;font-weight:700;color:${corH};font-family:var(--fm);line-height:1">${h.health}</div>
        <div style="font-family:var(--fm);font-size:7px;color:var(--t4);margin-top:2px;letter-spacing:.06em">SAÚDE</div>
      </div>
      ${h.confidence != null ? `
      <div style="background:var(--z3);border-radius:var(--r2);padding:8px;text-align:center">
        <div style="font-size:18px;font-weight:700;color:${corC};font-family:var(--fm);line-height:1">${h.confidence}</div>
        <div style="font-family:var(--fm);font-size:7px;color:var(--t4);margin-top:2px;letter-spacing:.06em">CONFIANÇA</div>
      </div>` : '<div></div>'}
      <div style="background:var(--z3);border-radius:var(--r2);padding:8px;text-align:center">
        <div style="font-size:18px;font-weight:700;color:${corR};font-family:var(--fm);line-height:1">${h.readiness.ready ? '✓' : '✗'}</div>
        <div style="font-family:var(--fm);font-size:7px;color:var(--t4);margin-top:2px;letter-spacing:.06em">ENTREGA</div>
      </div>
    </div>

    ${(h.positivos || []).length > 0 ? `
    <div style="margin-bottom:8px">
      ${h.positivos.map(p => `
      <div style="display:flex;align-items:center;gap:6px;padding:2px 0">
        <div style="font-size:9px;color:#16a34a">✓</div>
        <div style="font-family:var(--fm);font-size:9px;color:var(--t2)">${p}</div>
      </div>`).join('')}
    </div>` : ''}

    ${(h.issues || []).length > 0 ? `
    <div style="border-top:.5px solid var(--e0);padding-top:8px">
      ${(h.issues || []).slice(0, 5).map(iss => {
        const corI = iss.severity === 'blocker' ? '#dc2626' : iss.severity === 'warning' ? '#d97706' : '#6b7280';
        const icon = iss.severity === 'blocker' ? '✗' : iss.severity === 'warning' ? '⚠' : 'ℹ';
        return `<div style="padding:5px 0;border-bottom:.5px solid var(--e0)">
          <div style="display:flex;gap:6px;align-items:flex-start">
            <div style="font-size:9px;color:${corI};flex-shrink:0;margin-top:1px">${icon}</div>
            <div style="font-family:var(--fm);font-size:8px;color:var(--t2);line-height:1.4">
              ${iss.cap ? `<span style="color:var(--t3)">${iss.cap}</span> — ` : ''}${iss.message}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    ${(h.chapter_scores || []).length > 1 ? `
    <div style="border-top:.5px solid var(--e0);padding-top:8px;margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">
      ${h.chapter_scores.map(c => {
        const hv  = c.health;
        const cor2 = hv == null ? 'var(--t4)' : hv >= 85 ? '#16a34a' : hv >= 60 ? '#d97706' : '#dc2626';
        return `<div style="font-family:var(--fm);font-size:8px;background:var(--z3);padding:2px 7px;border-radius:20px;color:${cor2}" title="Saúde:${hv || '—'}">
          Cap.${c.num}${hv != null ? ' ' + hv : ''}${!c.ready ? ' ⚠' : ''}
        </div>`;
      }).join('')}
    </div>` : ''}
  </div>`;
}

/* ── Executar acção correctiva do painel de qualidade ── */
function _executarAccaoIssue(code, capLabel, acao) {
  const capNum = parseInt((capLabel || '').replace(/[^0-9]/g, '')) || null;
  const capIdx = capNum ? State.get('secs').findIndex(s => s.num === capNum) : -1;

  if (acao === 'gerar_capitulo_referencias') {
    const refIdx = State.get('secs').findIndex(s => /refer[eê]|bibliog/i.test(s.titulo || ''));
    if (refIdx >= 0) { mostrarToast('⏳ A regenerar referências…'); _regenerarCapitulo(refIdx); }
    else mostrarToast('⚠ Capítulo de referências não encontrado.');
    return;
  }
  if (acao === 'regenerar_capitulo' && capIdx >= 0) {
    mostrarToast(`⏳ A regenerar Cap. ${capNum}…`);
    _regenerarCapitulo(capIdx);
    return;
  }
  if (acao === 'editar_texto' && capIdx >= 0) {
    mostrarToast(`⏳ A enriquecer Cap. ${capNum}…`);
    expandirSec(capIdx);
    return;
  }
  mostrarToast('⚠ Acção não disponível para este issue.');
}

/* ════════════════════════════════════════════════════════════
   PAINEL DE CAPA
════════════════════════════════════════════════════════════ */
function renderCapaPanel() {
  const cfg  = State.get('cfg');
  const capa = State.get('capa') || {};

  return `
  <div style="padding:14px;background:var(--z2);border:1px solid var(--e0);border-radius:var(--r);margin-bottom:14px">
    <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.1em;margin-bottom:12px">PERSONALIZAR CAPA</div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:13px;color:var(--t2)">Incluir capa</div>
      <div onclick="_togCapa()" style="width:44px;height:24px;border-radius:12px;background:${capa.usarCapa !== false ? 'var(--b)' : 'var(--z4)'};border:1px solid ${capa.usarCapa !== false ? 'var(--bd)' : 'var(--e1)'};position:relative;cursor:pointer;transition:all .3s">
        <div style="position:absolute;top:2px;${capa.usarCapa !== false ? 'right:2px' : 'left:2px'};width:18px;height:18px;border-radius:50%;background:#fff;transition:all .3s"></div>
      </div>
    </div>

    ${capa.usarCapa !== false ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn G s" style="font-size:10px" onclick="document.getElementById('logoInstInp').click()">🏛 Logo instituição</button>
      <button class="btn G s" style="font-size:10px" onclick="document.getElementById('capaImgInp').click()">🖼 Imagem de fundo</button>
      <button class="btn B s" style="font-size:10px" onclick="gerarCapaIA()">⚡ Gerar capa com IA</button>
    </div>
    <input type="file" id="logoInstInp"  accept="image/*" style="display:none" onchange="_carregarLogoInst(this)"/>
    <input type="file" id="capaImgInp"   accept="image/*" style="display:none" onchange="_carregarCapaImg(this)"/>
    ${capa.logoInst ? `<div style="margin-top:8px;font-family:var(--fm);font-size:9px;color:var(--b)">✓ Logo da instituição carregado</div>` : ''}
    ${capa.imagem   ? `<div style="margin-top:4px;font-family:var(--fm);font-size:9px;color:var(--b)">✓ Imagem de fundo carregada</div>`   : ''}
    ` : ''}
  </div>`;
}

function _togCapa() {
  const capa = State.get('capa') || {};
  capa.usarCapa = capa.usarCapa === false ? true : false;
  State.set('capa', capa);
  irPara('editor');
}

function _carregarLogoInst(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const capa = State.get('capa') || {};
    capa.logoInst = e.target.result;
    State.set('capa', capa);
    mostrarToast('✓ Logo carregado.');
    irPara('editor');
  };
  reader.readAsDataURL(file);
}

function _carregarCapaImg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const capa = State.get('capa') || {};
    capa.imagem = e.target.result;
    State.set('capa', capa);
    mostrarToast('✓ Imagem de capa carregada.');
    irPara('editor');
  };
  reader.readAsDataURL(file);
}

async function gerarCapaIA() {
  mostrarToast('⚡ A gerar capa com IA…');
  try {
    const res = await callAcademyAPI({
      acao:   'gerar_capa',
      tema:   State.getCfg('tema'),
      tipo:   tipoActual()?.n || 'Trabalho Académico',
      nivel:  State.getCfg('nivel'),
      inst:   State.getCfg('inst'),
    });
    if (res && typeof res === 'string' && res.startsWith('data:')) {
      const capa = State.get('capa') || {};
      capa.imagem = res;
      State.set('capa', capa);
      mostrarToast('✓ Capa gerada!');
      irPara('editor');
    } else {
      mostrarToast('Capa gerada — sem imagem disponível.');
    }
  } catch (e) {
    mostrarToast('✗ Erro ao gerar capa: ' + (e.message || ''), 'erro');
  }
}

/* ════════════════════════════════════════════════════════════
   PAINEL PÓS-TEXTUAIS E MEDIA
════════════════════════════════════════════════════════════ */
function _renderPanelPostextuais(cfg) {
  if (!cfg) return '';
  const pt = cfg.postextuais  || [];
  const mi = cfg.mediaItems   || [];

  return `
  <div style="margin-top:20px;padding:14px;background:var(--z2);border:1px solid var(--e0);border-radius:var(--r)">
    <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.1em;margin-bottom:12px">ELEMENTOS EXTRA DO DOCUMENTO</div>

    <!-- Media -->
    <div style="margin-bottom:10px">
      <div style="font-family:var(--fm);font-size:9px;color:var(--t2);font-weight:600;margin-bottom:6px">🖼 Imagens / 📊 Tabelas / 📈 Gráficos</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn G s" style="font-size:9px" onclick="document.getElementById('mediaImgEd').click()">+ Imagem</button>
        <button class="btn G s" style="font-size:9px" onclick="_mediaAddTabela()">+ Tabela</button>
        <button class="btn G s" style="font-size:9px" onclick="_mediaAddGrafico()">+ Gráfico</button>
        <input type="file" id="mediaImgEd" accept="image/*" multiple style="display:none" onchange="_mediaAddImagem(this)"/>
      </div>
      ${mi.length > 0 ? `<div style="margin-top:6px">${mi.map((m, i) =>
        `<span style="font-family:var(--fm);font-size:9px;background:var(--z3);padding:3px 8px;border-radius:20px;margin:2px;display:inline-block">
          ${m.tipo === 'imagem' ? '🖼' : m.tipo === 'tabela' ? '📊' : '📈'} ${m.legenda || m.titulo || 'item'}
          <span onclick="_mediaRemover(${i})" style="cursor:pointer;color:var(--t4);margin-left:4px">✕</span>
        </span>`).join('')}</div>` : ''}
    </div>

    <!-- Pós-textuais -->
    <div>
      <div style="font-family:var(--fm);font-size:9px;color:var(--t2);font-weight:600;margin-bottom:6px">📚 Pós-textuais</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <button class="btn G s" style="font-size:9px" onclick="_posTextualAdd('glossario')">+ Glossário</button>
        <button class="btn G s" style="font-size:9px" onclick="_posTextualAdd('abreviatura')">+ Abreviaturas</button>
        <button class="btn G s" style="font-size:9px" onclick="_posTextualAdd('apendice')">+ Apêndice</button>
        <button class="btn G s" style="font-size:9px" onclick="_posTextualAdd('anexo')">+ Anexo</button>
      </div>
      ${pt.length > 0 ? `<div>${pt.map((p, i) =>
        `<span style="font-family:var(--fm);font-size:9px;background:var(--z3);padding:3px 8px;border-radius:20px;margin:2px;display:inline-block">
          ${p.tipo === 'glossario' ? '📖' : p.tipo === 'abreviatura' ? '🔤' : p.tipo === 'apendice' ? '📎' : '📂'}
          ${p.termo || p.abrev || p.titulo || p.tipo}
          <span onclick="_posTextualRemover(${i})" style="cursor:pointer;color:var(--t4);margin-left:4px">✕</span>
        </span>`).join('')}</div>` : `<div style="font-family:var(--fm);font-size:9px;color:var(--t4)">Nenhum elemento adicionado</div>`}
    </div>
  </div>`;
}

/* ── Media ── */
function _mediaAddImagem(input) {
  const files = [...input.files];
  if (!files.length) return;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const cfg = State.get('cfg');
      cfg.mediaItems = cfg.mediaItems || [];
      cfg.mediaItems.push({ tipo: 'imagem', src: e.target.result, legenda: file.name });
      State.set('cfg', cfg);
      mostrarToast('✓ Imagem adicionada.');
      irPara('editor');
    };
    reader.readAsDataURL(file);
  });
}

function _mediaAddTabela() {
  const cfg = State.get('cfg');
  cfg.mediaItems = cfg.mediaItems || [];
  cfg.mediaItems.push({ tipo: 'tabela', titulo: `Tabela ${cfg.mediaItems.length + 1}`, dados: [] });
  State.set('cfg', cfg);
  mostrarToast('✓ Tabela adicionada ao documento.');
  irPara('editor');
}

function _mediaAddGrafico() {
  const cfg = State.get('cfg');
  cfg.mediaItems = cfg.mediaItems || [];
  cfg.mediaItems.push({ tipo: 'grafico', titulo: `Gráfico ${cfg.mediaItems.length + 1}` });
  State.set('cfg', cfg);
  mostrarToast('✓ Gráfico adicionado ao documento.');
  irPara('editor');
}

function _mediaRemover(i) {
  const cfg = State.get('cfg');
  cfg.mediaItems = cfg.mediaItems || [];
  cfg.mediaItems.splice(i, 1);
  State.set('cfg', cfg);
  irPara('editor');
}

/* ── Pós-textuais ── */
function _posTextualAdd(tipo) {
  const cfg = State.get('cfg');
  cfg.postextuais = cfg.postextuais || [];
  const novos = {
    glossario:   { tipo, termo: 'Novo termo', definicao: '' },
    abreviatura: { tipo, abrev: 'ABREV', significado: '' },
    apendice:    { tipo, titulo: 'Apêndice ' + (cfg.postextuais.length + 1), conteudo: '' },
    anexo:       { tipo, titulo: 'Anexo '    + (cfg.postextuais.length + 1), conteudo: '' },
  };
  cfg.postextuais.push(novos[tipo] || { tipo, titulo: tipo });
  State.set('cfg', cfg);
  mostrarToast(`✓ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} adicionado.`);
  irPara('editor');
}

function _posTextualRemover(i) {
  const cfg = State.get('cfg');
  cfg.postextuais = cfg.postextuais || [];
  cfg.postextuais.splice(i, 1);
  State.set('cfg', cfg);
  irPara('editor');
}

/* ════════════════════════════════════════════════════════════
   MODO LEITURA (visualização fullscreen)
════════════════════════════════════════════════════════════ */
function abrirML() {
  const secs = State.get('secs');
  if (!secs.length) { mostrarToast('Nenhum documento para visualizar.'); return; }
  const cfg = State.get('cfg');
  const tp  = tipoActual() || { n: 'Trabalho Académico' };
  abrirModoLeitura(secs, {
    titulo: cfg.tema, tipo: tp.n, inst: cfg.inst, prof: cfg.prof,
    nivel: cfg.nivel, autor: cfg.mbs.length ? cfg.mbs.join(', ') : State.get('u')?.nome || '',
  });
}

function abrirMLEx() {
  const EXEM = typeof EXEMPLARES !== 'undefined' ? EXEMPLARES : [];
  const ex   = EXEM.find(e => e.id === State.get('exAberto'));
  if (!ex) return;
  abrirModoLeitura(ex.secs, { titulo: ex.titulo, tipo: ex.tipo, inst: ex.inst, prof: ex.prof, nivel: ex.nivel, autor: ex.autor });
}

function abrirModoLeitura(secs, meta) {
  const { titulo, tipo, inst, prof, nivel, autor } = meta;
  const stats = calcStats(secs);
  const ml    = document.createElement('div');
  ml.className = 'ml-overlay';
  ml.id        = 'mlR';
  ml.innerHTML = `
    <div class="ml-header">
      <button class="ml-close" onclick="document.getElementById('mlR').remove()">✕ Fechar</button>
      <div style="font-family:var(--fm);font-size:9px;color:var(--t3)">${stats.palavras} palavras · ${stats.pags} págs · ~${stats.tempoLeit} min</div>
    </div>
    <div class="ml-content">
      <div class="ml-titulo">${titulo}</div>
      <div class="ml-meta">${tipo}${inst ? ' · ' + inst : ''}${autor ? ' · ' + autor : ''}</div>
      ${secs.map(sec => `
        <div class="ml-cap-titulo">CAP. ${sec.num || ''} — ${sec.titulo}</div>
        <div class="ml-cap-corpo">${_renderSecConteudo(sec)}</div>
      `).join('')}
    </div>`;
  document.body.appendChild(ml);
}

/* ── Retornar rascunho pendente ── */
function _retornarRascunho() {
  const rd = temRascunhoPendente();
  if (!rd) return;
  restaurarRascunho(rd);
  limparRascunhoPendente();
  mostrarToast('✓ Rascunho restaurado!');
  irPara('editor');
}

/* ── Novo documento ── */
function novoDoc() {
  State.resetDocumento();
  irPara('tipo');
}

/* ── WhatsApp para activar ── */
function abrirWAActivar() {
  const msg = encodeURIComponent(`Olá! Quero activar a minha conta ACADEMY.\nNome: ${State.get('u')?.nome || '—'}`);
  window.open(`https://wa.me/244937876711?text=${msg}`, '_blank');
}

/* ── Texto para voz ── */
let _ttsActive = null;
function lerTexto(texto, btnId) {
  if (_ttsActive) {
    speechSynthesis.cancel();
    _ttsActive = null;
    const btn = document.getElementById(btnId);
    if (btn) btn.textContent = '🔊 Ouvir';
    return;
  }
  const utt = new SpeechSynthesisUtterance(texto);
  utt.lang  = 'pt-PT';
  utt.rate  = 0.9;
  utt.onend = () => {
    _ttsActive = null;
    const btn = document.getElementById(btnId);
    if (btn) btn.textContent = '🔊 Ouvir';
  };
  _ttsActive = utt;
  const btn = document.getElementById(btnId);
  if (btn) btn.textContent = '⏹ Parar';
  speechSynthesis.speak(utt);
}
