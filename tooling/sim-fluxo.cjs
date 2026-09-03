const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const root = path.join(__dirname, '..');

/* ═══ STUBS ═══ */
function makeEl(id) {
  const el = {
    id, tagName: 'div', innerHTML: '', textContent: '', value: '',
    checked: false, disabled: false, style: {}, dataset: {},
    files: [], options: [], selectedIndex: -1, classList: { add(){}, remove(){} },
    remove() { el._removed = true; },
    appendChild() {}, removeChild() {}, insertBefore() {},
    setAttribute() {}, getAttribute(){ return null; },
    addEventListener() {}, click() {}, focus() {},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    closest(){ return null; }, getBoundingClientRect(){ return { top:0 }; },
    scrollIntoView() {}, setSelectionRange() {}, matches(){ return false; },
  };
  return el;
}
const els = new Map();
const bodyChildren = [];
const documentStub = {
  documentElement: makeEl('documentElement'),
  getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  querySelector()        { return null; },
  querySelectorAll()     { return []; },
  createElement()        { return makeEl('el-' + Math.random().toString(36).slice(2)); },
  body: Object.assign(makeEl('body'), { appendChild(c){ bodyChildren.push(c); }, removeChild(){}, }),
  addEventListener() {},
  title: '',
  location: { href: 'about:blank' },
  currentScript: null,
};
const store = new Map();
const localStorageStub = {
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  setItem(k, v) { store.set(k, String(v)); },
  removeItem(k) { store.delete(k); },
  clear() { store.clear(); },
};
const fetchLog = [];
const fetchStub = async (url, opts) => {
  fetchLog.push({ url, body: opts?.body ? String(opts.body).slice(0, 140) : '' });
  return {
    ok: false, status: 503,
    json: async () => ({ ok: false, error: 'CAPITULO_INVALIDO', retry: false }),
    text: async () => '{}',
  };
};
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  AbortController, Promise, Date, Math, JSON, RegExp, Map, Set, Array, Object,
  localStorage: localStorageStub,
  document: documentStub,
  fetch: fetchStub,
  navigator: { onLine: true, clipboard: { writeText: async () => {} }, vibrate(){}, language: 'pt-AO' },
  location: { href: '' },
  history: { pushState(){} },
  innerWidth: 390, innerHeight: 800,
  screen: { width: 390, height: 800, orientation: { type: 'portrait-primary' } },
  URL, URLSearchParams, Blob, atob, btoa, crypto: require('crypto').webcrypto,
  Chart: function(){}, JSZip: {}, uaParser: {},
  addEventListener(ev, fn) { (this._handlers = this._handlers || {})[ev] = fn; },
  matchMedia(){ return { matches:false, addListener(){}, addEventListener(){} }; },
  requestAnimationFrame(){}, cancelAnimationFrame(){}, performance: { now: () => Date.now() },
  visualViewport: {},
  confirm(){ return true; }, alert(){}, prompt(){ return null; },
  parent: undefined,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

/* ═══ SCRIPTS (ordem real do index.html) ═══ */
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inlines = [...indexHtml.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function run(label, src, fatal = false) {
  try { vm.runInContext(src, sandbox, { filename: label }); console.log('carregado:', label.padEnd(26), 'OK'); }
  catch (e) { console.log('ERRO ao carregar:', label, '->', e.message); if (fatal) process.exit(1); }
}

run('inline #1 (globals)', inlines[0], true);
const files = [
  'js/state.js', 'js/supabase.js', 'js/navigation.js', 'js/auth.js',
  'js/doc-blocks.js', 'js/doc-history.js', 'js/generator.js', 'js/layout.js',
  'js/pbe.js', 'js/export.js', 'js/editor.js', 'js/academic-ui.js',
  'js/screens-flow.js', 'js/screens-secondary.js', 'js/modelos-doc.js',
  'js/pwa.js', 'js/chat.js', 'js/admin.js',
];
for (const f of files) run(f, fs.readFileSync(path.join(root, f), 'utf8'), true);
run('inline #2 (arranque)', inlines[1], true);

/* ═══ AVALIAÇÃO DENTRO DO CONTEXTO ═══ */
function V(expr) {
  try { return vm.runInContext(expr, sandbox); }
  catch (e) { console.log('ERRO CLAUSE', expr.slice(0, 80), '->', e.constructor.name + ': ' + e.message); return undefined; }
}
function LOG(prefixo, expr) {
  try {
    const r = vm.runInContext(expr, sandbox);
    if (r && typeof r === 'object' && r.then) r.then(v => console.log('OK  ', prefixo, v === undefined ? '' : JSON.stringify(v)));
    else console.log('OK  ', prefixo, r === undefined ? '' : (typeof r === 'string' && r.length > 90 ? r.slice(0, 90) + '…' : JSON.stringify(r)));
  } catch (e) {
    console.log('ERRO', prefixo, '->', e.constructor.name + ': ' + e.message);
  }
}

setTimeout(() => { main(); }, 60);

async function main() {
  console.log('\n═══════ CENÁRIO A — Login simulado + arranque ═══════');
  LOG('login guardado', `LS.set('u', { nome:'José Maria', email:'jose@teste.ao', whatsapp:'+244900000000', nivel:'Licenciatura' }); LS.set('lingua','pt-AO'); LS.set('tema','escuro'); 'u guardado'`);
  vm.runInContext(`(function(){ try { LS.set('u', { nome:'José Maria', email:'jose@teste.ao', whatsapp:'+244900000000', nivel:'Licenciatura' }); LS.set('lingua','pt-AO'); } catch(e){} })()`, sandbox);
  if (sandbox._handlers && sandbox._handlers.load) { console.log('handler load disparado'); sandbox._handlers.load(); }
  await new Promise(r => setTimeout(r, 300));

  console.log('\n═══════ CENÁRIO 1 — FLUXO ACADÉMICO COMPLETO (saldo 0) ═══════');
  LOG('irPara(tipo)', `(irPara('tipo'), State.get('ecra'))`);
  LOG('escolher tipo', `(State.setCfg('tipo','out'), irPara('tema_'), State.get('ecra'))`);
  LOG('definir tema', `(State.setCfg('tema','O impacto das tecnologias de informação no sector bancário angolano'), irPara('nivel'), State.get('ecra'))`);
  LOG('definir nivel/pags', `(State.setCfg('nivel','Licenciatura'), State.setCfg('pags',30), State.setCfg('numCaps',5), irPara('identidade'), State.get('ecra'))`);
  LOG('identidade+gerarEst', `(State.setCfg('autor','José Maria'), State.setCfg('prof','Prof. Dr. João Silva'), State.setCfg('inst','Universidade Agostinho Neto'), gerarEst(), 'gerarEst lançado')`);
  await new Promise(r => setTimeout(r, 500));
  LOG('ecra após gerarEst', `State.get('ecra')`);
  LOG('est existe?', `Array.isArray(State.get('est')) ? State.get('est').length + ' caps' : String(State.get('est'))`);
  LOG('saldo', `getSaldoDisponivel()`);
  LOG('sEst markup tem botao?', `sEst().includes('Confirmar e Gerar') ? 'SIM' : 'NAO (loading?)'`);
  LOG('CLIQUE btnGerarFinalClick', `btnGerarFinalClick(); 'executado sem crash'`);
  LOG('popups no body', String(bodyChildren.length));
  LOG('botao desbloqueado?', `_btnGerarBloqueado`);
  LOG('toast/overlay saldo', `document.getElementById('saldo-card') ? 'saldo-card existe' : 'sem saldo-card'`);

  console.log('\n═══════ CENÁRIO 2 — Com créditos (saldo suficiente) ═══════');
  LOG('set creditos', `LS.set('creditos', { credito_pags: 100, credito_expiry: Date.now() + 86400000, plano: 'creditos' }); getSaldoDisponivel()`);
  bodyChildren.length = 0;
  LOG('CLIQUE btnGerarFinalClick', `btnGerarFinalClick(); 'ok'`);
  LOG('ecra agora', `State.get('ecra')`);
  await new Promise(r => setTimeout(r, 3000));
  LOG('secs criadas', `(State.get('secs')||[]).map(s=>s.e).join(',')`);
  LOG('genFim', `State.get('genFim')`);
  LOG('fetch chamadas', String(fetchLog.length) + (fetchLog.length ? ' :: ' + fetchLog[0].body : ''));
  V('genCancelar()');
  await new Promise(r => setTimeout(r, 100));

  console.log('\n═══════ CENÁRIO 3 — Validação (formulário vazio) ═══════');
  bodyChildren.length = 0;
  LOG('reset e clique', `(State.resetDocumento(), btnGerarFinalClick(), 'ok')`);
  LOG('popup erro criado', String(bodyChildren.length) + ' nós anexados');

  console.log('\n═══════ CENÁRIO 4 — GLOSSÁRIO: renderizar todos os ecrãs ═══════');
  const ecras = ['tipo', 'tema_', 'nivel', 'identidade', 'preview_gen', 'plano', 'est', 'geracao',
                 'docs', 'docslivre', 'modelosdoc', 'exemplares', 'planos', 'perfil', 'ajuda',
                 'monitoria', 'admin', 'parceiros', 'instituicoes', 'entrada', 'inicio', 'chat'];
  for (const ecra of ecras) {
    LOG('renderizar::' + ecra, `(irPara('${ecra}'), renderizar(), State.get('ecra') + ' ok')`);
  }

  console.log('\n═══════ CENÁRIO 5 — Handlers auxiliares críticos ═══════');
  const handlers = [
    'toggleModo(true)',
    'toggleModo(false)',
    'actualizarMembros(3)',
    `State.setCfg('tipo','tfc'); irPara('tema_'); State.setCfg('tema','Tema longo de teste com mais de dez caracteres'); _maisSugestoesTema(); 'sugestoes ok'`,
    'verificarAntesDeGerar(false)',
    `State.set('est', getEstruturaTipo('tfc').caps); State.setCfg('tipo','tfc'); gerarPlano(); 'plano lançado'`,
  ];
  for (const h of handlers) LOG('handler :: ' + h.slice(0, 50), h);
  await new Promise(r => setTimeout(r, 1200));

  console.log('\n═══════ CENÁRIO 6 — API e controles de docs ═══════');
  for (const h of [
    `(State.setCfg('tema',''), 'vazio')`,
    `typeof autoGuardar === 'function' ? 'autoGuardar ok' : 'SEM autoGuardar'`,
    `typeof addDoc === 'function' ? 'addDoc ok' : 'SEM addDoc'`,
    `typeof expPDF === 'function' ? 'expPDF ok' : 'SEM expPDF'`,
    `typeof criarVersao === 'function' ? 'criarVersao ok' : 'SEM criarVersao'`,
    `typeof verificarReferencias === 'function' ? 'verificarReferencias ok' : 'SEM verificarReferencias'`,
    `typeof _docLivreExportarPDF === 'function' ? 'SIM' : 'NAO — botao exportar doc livre QUEBRADO'`,
  ]) LOG('API :: ' + h, h);

  console.log('\n═══════ CENÁRIO 7 — Flag presa (geração morta) — auto-recuperação ═══════');
  LOG('estrutura real (5 caps, 12 subs)', `State.set('est', [{num:1,titulo:'Introdução',subs:['Contextualização do Tema','Justificativa da Pesquisa','Objetivos da Investigação']},{num:2,titulo:'Revisão de Literatura',subs:['TIC e Educação Global','Impacto das TIC no Desempenho Acadêmico','Contexto Angolano: Cenário Atual']},{num:3,titulo:'Metodologia',subs:['Tipo de Pesquisa','Instrumentos de Coleta de Dados','Procedimentos de Análise']},{num:4,titulo:'Análise de Dados e Discussão',subs:['Resultados Quantitativos','Resultados Qualitativos','Interpretação dos Resultados']},{num:5,titulo:'Referências Bibliográficas',subs:[]}]); 'est ok'`);
  LOG('simular geração morta', `_btnGerarBloqueado = true; _btnGerarBloqueadoEm = Date.now() - 200000; 'travado há 200s'`);
  LOG('clique com flag presa (deve auto-recuperar)', `btnGerarFinalClick(); 'sem crash — flag: ' + _btnGerarBloqueado`);

  process.exit(0);
}