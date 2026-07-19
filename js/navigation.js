/* ═══════════════════════════════════════════════════════════
   ACADEMY — NAVIGATION.JS
   Toda a navegação entre ecrãs, topbar e nav inferior.
   Depende de: state.js
═══════════════════════════════════════════════════════════ */

/* ── Mapa de ecrãs: título, passo, ecrã de volta ── */
const CFG_ECRAS = {
  inicio:      { t: 'ACADEMY',          p: null,    v: null },
  tipo:        { t: 'MISSÃO',           p: '01/04', v: 'inicio' },
  tema_:       { t: 'TEMA',             p: '02/04', v: 'tipo' },
  nivel:       { t: 'CONTEXTO',         p: '03/04', v: 'tema_' },
  identidade:  { t: 'IDENTIDADE',       p: '04/04', v: 'nivel' },
  preview_gen: { t: 'CONFIRMAR',        p: null,    v: 'identidade' },
  plano:       { t: 'ACADEMY',          p: null,    v: 'preview_gen' },
  est:         { t: 'ACADEMY',          p: null,    v: 'plano' },
  geracao:     { t: 'ACADEMY',          p: null,    v: null },
  editor:      { t: 'DOCUMENTO',        p: null,    v: 'inicio', g: true },
  exemplares:  { t: 'EXEMPLARES',       p: null,    v: null },
  exViewer:    { t: 'EXEMPLAR',         p: null,    v: 'exemplares' },
  documentos:  { t: 'DOCUMENTOS',       p: null,    v: null },
  config:      { t: 'CONFIGURAÇÃO',     p: null,    v: 'inicio' },
  cv:          { t: 'CURRICULUM VITAE', p: null,    v: 'inicio' },
  sobre:       { t: 'ACADEMY',          p: null,    v: 'inicio' },
  doclivre:    { t: 'DOCUMENTO LIVRE',  p: null,    v: 'inicio' },
  planos:      { t: 'PLANOS & PREÇOS',  p: null,    v: 'inicio' },
  admin:       { t: 'ADMINISTRAÇÃO',    p: null,    v: 'sobre' },
};

/* ── Navegar para um ecrã ── */
function irPara(ecra, opts) {
  State.set('ecra', ecra);
  State.set('_ecraOpts', opts || null);
  State.set('load', false);
  renderizar();

  /* Scroll reset + animação de entrada */
  const el = document.querySelector('.ecra');
  if (el) {
    requestAnimationFrame(() => {
      el.scrollTop = 0;
      el.classList.add('com-animacao');
      setTimeout(() => el.classList.remove('com-animacao'), 300);
    });
  }
  updateChatContext(ecra);
}

/* ── Navegar pela barra de navegação inferior ── */
function nav(n) {
  State.set('nav', n);
  const u = State.get('u');
  const dest = u
    ? ({ inicio: 'inicio', exemplares: 'exemplares', documentos: 'documentos', config: 'config', sobre: 'sobre', cv: 'cv', planos: 'planos' }[n] || 'inicio')
    : 'entrada';
  irPara(dest);
  actualizarNav();
}

/* ── Actualizar estado visual da nav ── */
function actualizarNav() {
  const navActual = State.get('nav');

  /* Bottom nav (mobile) */
  document.querySelectorAll('.nv').forEach(el => {
    const n = el.dataset.n;
    const cores = { inicio: 'ab', exemplares: 'ao', documentos: 'ab', chat: 'ab' };
    el.className = 'nv' + (navActual === n ? ' ' + (cores[n] || 'ab') : '');
  });

  /* Sidebar nav (tablet/desktop) */
  document.querySelectorAll('.ns-item').forEach(el => {
    const n = el.dataset.n;
    el.className = `ns-item${navActual === n ? (n === 'exemplares' ? ' ao' : ' ab') : ''}`;
  });

  /* Avatar na sidebar */
  const u = State.get('u');
  const nu = document.getElementById('nsUser');
  if (nu && u) {
    nu.textContent = (u.nome || '?')[0].toUpperCase();
    nu.setAttribute('data-nome', u.nome?.split(' ')[0] || '');
  }
}

/* ── Actualizar topbar ── */
function aTopbar() {
  const tb = document.getElementById('topbar');
  const ecra = State.get('ecra');
  const c = CFG_ECRAS[ecra];
  if (!c) { tb.style.display = 'none'; return; }

  tb.style.display = 'flex';

  const backFn = c.v ? `irPara('${c.v}')` : null;
  const vol = backFn
    ? `<div class="tb-voltar" onclick="${backFn}">←</div>`
    : `<div style="width:34px"></div>`;

  /* Centro: logo nos ecrãs principais, título nos ecrãs de fluxo */
  const mainScreens = ['inicio', 'exemplares', 'documentos', 'sobre', 'config'];
  const logoEl = `<span onclick="nav('inicio');adminTap()" style="cursor:pointer;display:inline-flex;align-items:center;height:28px">${LOGO_SVG_SMALL.replace(/(<svg[^>]*)/, '$1 style="height:28px;width:auto"')}</span>`;
  const centroCentro = mainScreens.includes(ecra)
    ? logoEl
    : `<div class="tb-titulo">${c.t}</div>`;

  /* Direita: guardar no editor, passo no fluxo, ou botão de tema */
  const tema = State.get('tema');
  const guardarEst = State.get('guardarEst');
  let dir;
  if (c.g) {
    dir = `<div style="display:flex;align-items:center;gap:8px">
      <div class="tb-guardar ${guardarEst}" id="estG">
        <div class="ds"></div>
        <span>${{ guardado: 'Guardado', guardando: 'A guardar…', editado: 'Editado' }[guardarEst]}</span>
      </div>
      <div class="btn-tema" onclick="togTema()">${tema === 'escuro' ? '☀' : '🌙'}</div>
    </div>`;
  } else if (c.p) {
    dir = `<div class="tb-passo">${c.p}</div>`;
  } else {
    dir = `<div class="btn-tema" onclick="togTema()">${tema === 'escuro' ? '☀' : '🌙'}</div>`;
  }

  tb.innerHTML = `${vol}${centroCentro}${dir}`;
}

/* ── Toggle tema claro/escuro ── */
function togTema() {
  const novoTema = State.get('tema') === 'escuro' ? 'claro' : 'escuro';
  State.set('tema', novoTema);
  document.documentElement.setAttribute('data-tema', novoTema);
  LS.set('tema', novoTema);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = novoTema === 'escuro' ? '#000000' : '#F7F6F4';
  aTopbar();
  const nt = document.getElementById('nsTema');
  if (nt) nt.textContent = novoTema === 'escuro' ? '☀' : '🌙';
  if (State.get('ecra') === 'config') renderizar();
}

/* ── Renderizar ecrã activo ── */
function renderizar() {
  const ecra = State.get('ecra');
  const u = State.get('u');
  if (!u && ecra !== 'entrada') { irPara('entrada'); return; }

  const nb = document.getElementById('nb') || document.getElementById('navbaixo');
  const semNav = ['entrada', 'geracao'].includes(ecra);

  if (nb) nb.style.display = semNav ? 'none' : 'flex';
  if (!semNav) actualizarNav();
  aTopbar();

  /* Sidebar só visível para logados */
  const sb = document.getElementById('sidebar');
  if (sb) sb.style.display = (u && window.innerWidth >= 768) ? 'flex' : 'none';

  /* Pill do chat */
  const pill = document.getElementById('chatPill');
  if (pill) {
    pill.style.display = semNav ? 'none' : 'flex';
    pill.style.opacity = '1';
    pill.style.visibility = 'visible';
    pill.className = 'chat-pill' + (chatAberto ? ' oculta' : '');
  }

  /* Mapa ecrã → função de renderização */
  const ECRAS = {
    entrada:     sEntrada,
    inicio:      sInicio,
    tipo:        sTipo,
    tema_:       sTema,
    nivel:       sNivel,
    identidade:  sIdentidade,
    preview_gen: sPreviewGen,
    plano:       sPlano,
    est:         sEst,
    geracao:     sGeracao,
    editor:      sEditor,
    exemplares:  sExemplares,
    exViewer:    sExViewer,
    documentos:  sDocs,
    config:      sConfig,
    sobre:       sSobre,
    doclivre:    sDocLivre,
    planos:      sPlanosPrecos,
    admin:       sAdmin,
    cv:          sCv,
  };

  const fn = ECRAS[ecra] || sEntrada;
  const opts = State.get('_ecraOpts') || null;

  /* Anti-flicker: reutilizar wrapper .ecra sempre que possível */
  const ecrasEl = document.getElementById('ecras');
  let ecraEl = ecrasEl.querySelector('.ecra');
  const novaClasse = 'ecra' + (semNav ? ' semrodape' : '');
  const novoConteudo = fn(opts) || '';

  if (!ecraEl || ecraEl.className !== novaClasse) {
    ecrasEl.innerHTML = `<div class="${novaClasse}">${novoConteudo}</div>`;
  } else {
    ecraEl.innerHTML = novoConteudo;
  }

/* Post-render */
if (ecra === 'admin') { loadAdminPendentes(); carregarMonitorIA(); carregarDashboard(); carregarInstituicoesAdmin(); carregarParceirosAdmin(); carregarComissoesAdmin(); }
if (ecra === 'editor' && typeof injectAcademicUI === 'function') { setTimeout(() => injectAcademicUI(), 100); }
}

/* ── Helpers de início rápido ── */
function iniciarTipo(id) {
  State.set('cfg', { ...State.get('cfg'), tipo: id });
  irPara('identidade');
}

function iniciarDocLivre(id) {
  _docLivre.tipo = id;
  _docLivre.descricao = '';
  _docLivre.resultado = null;
  irPara('doclivre');
}

/* ── Lógica de entrada ── */
function fazerEntrada() {
  const n      = document.getElementById('en')?.value?.trim();
  const email  = document.getElementById('eEmail')?.value?.trim() || '';
  const wa     = document.getElementById('eWA')?.value?.trim() || '';
  const niv    = document.getElementById('eniv')?.value;
  const inpNome  = document.getElementById('en');
  const inpEmail = document.getElementById('eEmail');
  const er = document.getElementById('nomeErr');

  function mostrarErroEntrada(campo, msg) {
    if (campo) { campo.style.borderColor = 'rgba(248,113,113,.5)'; campo.focus(); }
    if (er) { er.textContent = msg; er.style.display = 'block'; }
  }

  /* Nome: mínimo 2 palavras com ≥ 2 letras cada */
  const palavrasNome = (n || '').split(/\s+/).filter(p => p.length >= 2);
  if (!n || palavrasNome.length < 2) {
    mostrarErroEntrada(inpNome, '✕ Escreve o teu nome completo — nome e apelido (ex: João Silva).');
    return;
  }

  /* E-mail (se preenchido) */
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    mostrarErroEntrada(inpEmail, '✕ E-mail inválido. Usa o formato: nome@dominio.com');
    return;
  }

  /* WhatsApp (se preenchido): mínimo 9 dígitos */
  if (wa && wa.replace(/\D/g, '').length < 9) {
    mostrarErroEntrada(document.getElementById('eWA'), '✕ Número de WhatsApp inválido. Inclui o código do país (+244…).');
    return;
  }

  const u = { nome: n, email: email || null, whatsapp: wa || null, nivel: niv || 'Licenciatura' };
  State.set('u', u);
  LS.set('u', u);
  sbUpsertUser(u);
  irPara('inicio');
  pwaHandleStartupAction();
}

/* ── Administração: detector de 7 toques no logo ── */
let _adminTaps = 0;
let _adminTimer = null;
let _adminLastTap = 0;

function adminTap() {
  const agora = Date.now();
  const intervalo = agora - _adminLastTap;

  if (_adminLastTap > 0 && intervalo < 80) return; /* toque acidental */

  if (_adminTaps === 0) {
    _adminTimer = setTimeout(() => { _adminTaps = 0; }, 4000);
  }

  _adminTaps++;
  _adminLastTap = agora;

  if (_adminTaps >= 7) {
    clearTimeout(_adminTimer);
    _adminTaps = 0;
    _adminLastTap = 0;
    _abrirAdminAuth();
  }
}

/* ── Helper: actualizar barra de progresso da geração ── */
function aBarra(feitos, total) {
  const pct = total ? Math.round(feitos / total * 100) : 0;
  const barra = document.getElementById('barraG');
  const pctN = document.getElementById('pctN');
  const anp = document.getElementById('anp');
  if (barra) barra.style.width = pct + '%';
  if (pctN) pctN.textContent = pct + '%';
  if (anp) anp.textContent = nPags();
}

/* ── Helper: actualizar estado de uma secção no DOM durante geração ── */
function aSecDOM(i, estado, etiqueta, preview) {
  const el = document.getElementById(`sg-${i}`);
  if (!el) return;
  el.className = 'sec' + (estado === 'p' ? ' pronto' : estado === 'g' ? ' ativo' : '');
  const etq = document.getElementById(`setq-${i}`);
  if (etq) {
    etq.className = `etq ${estado === 'p' ? 'etq-v' : estado === 'g' ? 'etq-o' : 'etq-b'}`;
    etq.textContent = etiqueta || (estado === 'p' ? '✓ PRONTO' : estado === 'g' ? 'EM CURSO' : '—');
  }
}

/* ── Guardar ecrã de entrada (restaurar sessão) ── */
function mostrarToast(msg, tipo) {
  const t = document.createElement('div');
  t.className = 'toast' + (tipo === 'erro' ? ' toast-erro' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visivel'));
  setTimeout(() => { t.classList.remove('visivel'); setTimeout(() => t.remove(), 400); }, 2800);
}

/* ── Gestão de documentos locais ── */
const getDocs  = () => LS.list('docs');
const getU     = ()  => LS.get('u');
const setU     = u   => LS.set('u', u);

function addDoc(d) {
  const l = getDocs();
  l.unshift({
    ...d,
    id:    Date.now(),
    em:    new Date().toLocaleDateString('pt-PT'),
    secs:  State.get('secs'),
    plano: State.get('plano'),
    est:   State.get('est'),
    cfg:   { ...State.getCfg() },
  });
  LS.set('docs', l.slice(0, 30));
}

function autoGuardar() {
  try {
    const lista = getDocs();
    const tema = State.getCfg('tema');
    const idx = lista.findIndex(d => d.cfg?.tema === tema && d.cfg?.tipo === State.getCfg('tipo'));
    const doc = {
      id:    idx >= 0 ? lista[idx].id : Date.now(),
      em:    new Date().toLocaleDateString('pt-PT'),
      secs:  State.get('secs'),
      plano: State.get('plano'),
      est:   State.get('est'),
      cfg:   { ...State.get('cfg') },
      qual:  State.get('qual'),
    };
    if (idx >= 0) lista[idx] = doc;
    else lista.unshift(doc);
    LS.set('docs', lista.slice(0, 30));
    State.set('guardarEst', 'guardado');
    const estG = document.getElementById('estG');
    if (estG) {
      estG.className = 'tb-guardar guardado';
      estG.querySelector('span').textContent = 'Guardado';
    }
    /* Sincronizar com Supabase em background */
    sbSalvarDoc(doc).catch(() => {});
  } catch (e) {
    State.set('guardarEst', 'erro');
    console.warn('[NAV] autoGuardar:', e);
  }
}

function apagarDoc(id) {
  _confirmarApagarDoc(id);
}

function _confirmarApagarDoc(id) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px';
  div.innerHTML = `
    <div style="background:var(--z1);border:.5px solid var(--e1);border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center">
      <div style="font-size:28px;margin-bottom:12px">🗑</div>
      <div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:8px">Apagar documento?</div>
      <div style="font-size:13px;color:var(--t2);margin-bottom:22px">Esta acção não pode ser desfeita.</div>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('div[style]').remove()" style="flex:1;padding:12px;border-radius:10px;border:.5px solid var(--e1);background:transparent;color:var(--t2);font-family:var(--fu);font-size:13px;cursor:pointer">Cancelar</button>
        <button onclick="_executarApagarDoc(${id});this.closest('div[style]').remove()" style="flex:1;padding:12px;border-radius:10px;border:none;background:#ef4444;color:#fff;font-family:var(--fu);font-size:13px;font-weight:700;cursor:pointer">Apagar</button>
      </div>
    </div>`;
  document.body.appendChild(div);
}

function _executarApagarDoc(id) {
  const lista = getDocs().filter(d => d.id !== id);
  LS.set('docs', lista);
  sbApagarDoc(id).catch(() => {});
  mostrarToast('Documento apagado.');
  if (State.get('ecra') === 'documentos') irPara('documentos');
}

/* ── Guardar / restaurar rascunho pendente (para após pagamento) ── */
const _RASCUNHO_KEY = 'acy_rascunho_pendente';

function guardarRascunhoPendente() {
  try {
    const d = {
      ts:    Date.now(),
      cfg:   { ...State.get('cfg') },
      est:   State.get('est'),
      plano: State.get('plano'),
    };
    localStorage.setItem(_RASCUNHO_KEY, JSON.stringify(d));
  } catch (e) { console.warn('[NAV] guardarRascunho:', e); }
}

function temRascunhoPendente() {
  try {
    const d = JSON.parse(localStorage.getItem(_RASCUNHO_KEY) || 'null');
    if (!d) return false;
    if (Date.now() - d.ts > 24 * 3600 * 1000) return false; /* expira em 24h */
    return d;
  } catch { return false; }
}

function restaurarRascunho(d) {
  State.set('cfg',   d.cfg   || State.get('cfg'));
  State.set('est',   d.est   || null);
  State.set('plano', d.plano || null);
}

function limparRascunhoPendente() {
  try { localStorage.removeItem(_RASCUNHO_KEY); } catch (e) {}
}
