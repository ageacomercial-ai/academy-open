/* ═══════════════════════════════════════════════════════════
   ACADEMY — AUTH.JS
   Tudo relacionado com senhas, planos e créditos.
   Depende de: state.js (LS, PLANOS_DEF, SENHA_TIPOS)
═══════════════════════════════════════════════════════════ */

/* ── Chave de validação offline (nunca partilhar o código-fonte) ── */
const _SK = (()=>{ const p = ['AGEA','26','SCOS','_ADL']; return p.join(''); })();

/* Tipos de senha — apenas promoções personalizadas (P####) */
const SENHA_TIPOS = {};

/* ── Cache dinâmico de preços (carregado do Supabase) ── */
let _precosCache = null;
let _planosGraficaCache = null;

/* Preços padrão (fallback se Supabase offline) */
const _PRECOS_DEFAULT = [
  { faixa_inicio: 0,  faixa_fim: 15, preco: 1850, label: '0-15 páginas' },
  { faixa_inicio: 16, faixa_fim: 20, preco: 2250, label: '16-20 páginas' },
  { faixa_inicio: 21, faixa_fim: 30, preco: 5500, label: '21-30 páginas' },
  { faixa_inicio: 31, faixa_fim: 50, preco: 8500, label: '31-50 páginas' },
];
const _PLANOS_GRAFICA_DEFAULT = [
  { nome: 'Gráfica 150',     paginas: 150, preco: 15000 },
  { nome: 'Gráfica 300',     paginas: 300, preco: 25000 },
  { nome: 'Gráfica 500',     paginas: 500, preco: 40000 },
];

async function carregarPrecos() {
  try {
    const r = await fetch(SB_URL + '/rest/v1/precos?ativo=eq.true&order=faixa_inicio.asc',
      { headers: SB_H(), signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      _precosCache = await r.json();
    }
  } catch {}
  if (!_precosCache || !_precosCache.length) _precosCache = _PRECOS_DEFAULT;

  try {
    const r = await fetch(SB_URL + '/rest/v1/planos_grafica?ativo=eq.true&order=preco.asc',
      { headers: SB_H(), signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      _planosGraficaCache = await r.json();
    }
  } catch {}
  if (!_planosGraficaCache || !_planosGraficaCache.length) _planosGraficaCache = _PLANOS_GRAFICA_DEFAULT;

  /* Instituições parceiras (para desconto) */
  try {
    const r = await fetch(SB_URL + '/rest/v1/instituicoes?activa=eq.true&order=nome.asc',
      { headers: SB_H(), signal: AbortSignal.timeout(5000) });
    if (r.ok) _instituicoesCache = await r.json();
  } catch {}
  if (!_instituicoesCache) _instituicoesCache = [];
}

/* Desconto institucional */
function getDescontoInst() {
  const inst = State.getCfg('inst');
  if (!inst) return 0;
  const found = (_instituicoesCache||[]).find(i => i.nome === inst);
  return found?.desconto_porcentagem || 0;
}

function _aplDesc(preco) {
  const desc = getDescontoInst();
  return desc > 0 ? Math.round(preco * (100 - desc) / 100) : preco;
}

/* Tabela oficial de preços (dinâmica do Supabase ou fallback) */
function calcPreco(pags) {
  const tabela = _precosCache || _PRECOS_DEFAULT;
  for (const faixa of tabela) {
    if (pags >= faixa.faixa_inicio && pags <= faixa.faixa_fim) return _aplDesc(faixa.preco);
  }
  const ultimo = tabela[tabela.length - 1];
  return ultimo ? _aplDesc(ultimo.preco) : 1850;
}

function calcPacote(pags) {
  const tabela = _precosCache || _PRECOS_DEFAULT;
  for (const faixa of tabela) {
    if (pags >= faixa.faixa_inicio && pags <= faixa.faixa_fim) {
      return { pags: faixa.faixa_fim, preco: _aplDesc(faixa.preco), label: faixa.label || `${faixa.faixa_inicio}-${faixa.faixa_fim} págs` };
    }
  }
  const ultimo = tabela[tabela.length - 1];
  return { pags: ultimo.faixa_fim, preco: _aplDesc(ultimo.preco), label: ultimo.label };
}

function getPrecosCache() { return _precosCache || _PRECOS_DEFAULT; }
function getPlanosGraficaCache() { return _planosGraficaCache || _PLANOS_GRAFICA_DEFAULT; }

/* ═══════════════════════════════════════════════════════════
   VALIDAÇÃO DE SENHAS (offline — sem internet)
═══════════════════════════════════════════════════════════ */

function _hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).toUpperCase().padStart(8, '0');
}

function _nonce() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

/* Gera uma senha válida (usar só no admin) */
function gerarSenha(tipo) {
  const nonce = _nonce();
  const check = _hash(_SK + nonce + tipo).slice(0, 4);
  return `ACAD-${nonce}-${tipo}-${check}`;
}

/* Gera uma senha promocional personalizada */
function gerarSenhaPromo(pags, desc) {
  if (!pags || pags < 1) return null;
  const tipo = 'P' + String(pags).padStart(4, '0');
  const nonce = _nonce();
  const check = _hash(_SK + nonce + tipo).slice(0, 4);
  const senha = `ACAD-${nonce}-${tipo}-${check}`;
  /* Guardar metadados da promo */
  const promos = JSON.parse(localStorage.getItem('acy_promos') || '{}');
  promos[senha] = { pags, desc: desc || `${pags} páginas bónus`, criado: Date.now() };
  localStorage.setItem('acy_promos', JSON.stringify(promos));
  return senha;
}

/* Valida uma senha digitada pelo utilizador */
function validarSenha(senha) {
  try {
    const partes = senha.trim().toUpperCase().split('-');
    if (partes.length < 4 || partes[0] !== 'ACAD') return null;
    const nonce = partes[1];
    const tipo  = partes.slice(2, -1).join('-');
    const check = partes[partes.length - 1];
    if (_hash(_SK + nonce + tipo).slice(0, 4) !== check) return null;
    /* Tipos padrão */
    const def = SENHA_TIPOS[tipo];
    if (def) return { tipo, _senha: senha, ...def };
    /* Tipos promocionais P + 4 dígitos (páginas) */
    const pm = tipo.match(/^P(\d{4})$/);
    if (pm) {
      const pags = parseInt(pm[1]);
      const promos = JSON.parse(localStorage.getItem('acy_promos') || '{}');
      const meta = promos[senha];
      return { tipo, _senha: senha, _promo: true, pags, desc: meta?.desc || `${pags} páginas bónus`, valor: 0 };
    }
    return null;
  } catch { return null; }
}

/* ── Verificar se senha já foi usada (Supabase) ── */
async function sbVerificarSenhaUsada(senha) {
  try {
    const r = await fetch(
      SB_URL + '/rest/v1/senhas_usadas?senha=eq.' + encodeURIComponent(senha.trim().toUpperCase()),
      { headers: SB_H() }
    );
    if (!r.ok) return false;
    const rows = await r.json();
    return rows.length > 0;
  } catch { return false; }
}

/* ── Marcar senha como usada (Supabase) ── */
async function sbMarcarSenhaUsada(senha) {
  try {
    await fetch(SB_URL + '/rest/v1/senhas_usadas', {
      method: 'POST',
      headers: { ...SB_H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ senha: senha.trim().toUpperCase(), uid: sbUserId(), usado_em: new Date().toISOString() }),
    });
  } catch (e) { console.warn('[AUTH] marcarSenha:', e); }
}

/* ═══════════════════════════════════════════════════════════
   PLANOS E CRÉDITOS
═══════════════════════════════════════════════════════════ */

function _semanaKey() {
  const d = new Date();
  const j = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  j.setUTCDate(j.getUTCDate() + 4 - (j.getUTCDay() || 7));
  const ano = j.getUTCFullYear();
  const sem = Math.ceil(((j - new Date(Date.UTC(ano, 0, 1))) / 86400000 + 1) / 7);
  return `${ano}-W${sem}`;
}

function getCreditos() {
  const mes = new Date().toISOString().slice(0, 7);
  const sem = _semanaKey();
  let c = LS.get('creditos') || {
    plano: 'gratuito', plano_expiry: null,
    mes, sem,
    pags: 0,           /* págs geradas este mês (planos pro) */
    gen_usada: 0,      /* geração gratuita usada (0 ou 1, vitalício) */
    credito_pags: 0,   /* págs de crédito disponíveis */
    credito_expiry: null,
    pagos: [],
  };
  /* Reset mensal (só contadores pro) */
  if (c.mes !== mes) { c.mes = mes; c.pags = 0; }
  /* Migração: limpar campos antigos */
  delete c.gens_dia; delete c.gens_sem; delete c.pags_mes_gr;
  delete c.gens_mes_livro; delete c.pags_mes_livro;
  /* Expirar créditos avulsos */
  if (c.credito_expiry && Date.now() > c.credito_expiry) { c.credito_pags = 0; c.credito_expiry = null; }
  LS.set('creditos', c);
  return c;
}

function setCreditos(c) { LS.set('creditos', c); }

/* ── Saldo disponível para geração ── */
function getSaldoDisponivel() {
  const c = getCreditos();
  const plano = planoActivo();
  if (plano === 'gratuito') return c.gen_usada >= 1 ? 0 : 9999;
  if (temCreditoActivo()) return getCreditosPags();
  return 0;
}

function getSaldoExpiracao() {
  const c = getCreditos();
  if (temCreditoActivo() && c.credito_expiry) return new Date(c.credito_expiry).toLocaleDateString();
  return null;
}

function getDiasRestantes() {
  const c = getCreditos();
  if (temCreditoActivo() && c.credito_expiry) {
    const diff = c.credito_expiry - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
  return null;
}

function temCreditoActivo() {
  const c = getCreditos();
  return c.credito_pags > 0 && c.credito_expiry && Date.now() < c.credito_expiry;
}

function getCreditosPags() {
  if (!temCreditoActivo()) return 0;
  return getCreditos().credito_pags || 0;
}

function planoActivo() {
  const c = getCreditos();
  /* Verificar expiração do plano pago */
  if (c.plano && c.plano !== 'gratuito' && c.plano_expiry && Date.now() > c.plano_expiry) {
    c.plano = 'gratuito'; c.plano_expiry = null; setCreditos(c);
  }
  /* Normalizar — só gratuito ou crédito */
  if (c.plano !== 'gratuito' && !temCreditoActivo()) c.plano = 'gratuito';
  return c.plano || 'gratuito';
}

/* ── Verificar se pode exportar ── */
function verificarExportacao(numPags) {
  const plano = planoActivo();
  const c     = getCreditos();

  /* 1. Crédito avulso activo */
  if (temCreditoActivo()) {
    if (getCreditosPags() < numPags) return { ok: false, motivo: 'credito_insuficiente', plano, c, numPags };
    return { ok: true, wm: false };
  }

  /* 2. Gratuito — 1 geração real por utilizador (vitalício) */
  if (plano === 'gratuito') {
    if (c.gen_usada >= 1) return { ok: false, motivo: 'gratuito_esgotado', plano, c, numPags };
    return { ok: true, wm: true };
  }

  return { ok: false, motivo: 'sem_credito', plano, c, numPags };
}

/* ── Registar exportação (descontar créditos) ── */
function registarExportacao(numPags, pago) {
  const c     = getCreditos();
  if (temCreditoActivo()) {
    c.credito_pags = Math.max(0, (c.credito_pags || 0) - numPags);
  } else {
    c.gen_usada = 1;
  }
  if (pago) c.pagos.push({ data: new Date().toISOString(), pags: numPags, valor: pago });
  setCreditos(c);
}

/* ── Activar plano Pro ── */
function activarPlano(planoId, meses, redirect = true) {
  const c = getCreditos();
  c.plano        = planoId;
  c.plano_expiry = Date.now() + (meses || 1) * 30 * 24 * 3600 * 1000;
  c.pags         = 0;
  setCreditos(c);
  sessionStorage.removeItem('expWarn');
  mostrarToast(`✓ Plano ${PLANOS_DEF[planoId]?.n} activado!`);
  if (redirect) irPara('inicio');
}

/* ── Activar pacote de crédito de páginas ── */
function activarCredito(numPags, redirect = true) {
  const c = getCreditos();
  c.credito_pags   = (c.credito_pags || 0) + numPags;
  c.credito_expiry = Date.now() + 30 * 24 * 3600 * 1000; /* 30 dias */
  setCreditos(c);
  sessionStorage.removeItem('expWarn');
  mostrarToast(`✓ ${numPags} páginas de crédito activadas (válidas 30 dias)!`);
  if (redirect) irPara('inicio');
}

/* ── Guardar plano no Supabase (backup remoto) ── */
async function sbGuardarPlano(plano, expiryMs) {
  try {
    await fetch(SB_URL + '/rest/v1/planos_utilizadores', {
      method: 'POST',
      headers: { ...SB_H(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        uid:     sbUserId(),
        plano,
        expiry:  expiryMs ? new Date(expiryMs).toISOString() : null,
        updated: new Date().toISOString(),
      }),
    });
  } catch (e) { console.warn('[AUTH] guardarPlano:', e); }
}

/* ── Restaurar plano do Supabase (ao arrancar sem créditos locais) ── */
async function sbRestaurarPlano() {
  try {
    const r = await fetch(
      SB_URL + '/rest/v1/planos_utilizadores?uid=eq.' + sbUserId() + '&order=updated.desc&limit=1',
      { headers: SB_H() }
    );
    if (!r.ok) return;
    const rows = await r.json();
    if (!rows.length) return;
    const row = rows[0];
    if (!row.plano || row.plano === 'gratuito') return;
    const expiry = row.expiry ? new Date(row.expiry).getTime() : null;
    if (expiry && Date.now() > expiry) return;
    const c = getCreditos();
    if (c.plano !== 'gratuito') return;
    c.plano        = row.plano;
    c.plano_expiry = expiry;
    c.pags         = 0;
    setCreditos(c);
  } catch (e) { console.warn('[AUTH] restaurarPlano:', e); }
}

/* ── Aplicar senha digitada pelo utilizador ── */
async function aplicarSenha(resultado, { redirect = true } = {}) {
  const def = resultado;
  /* Verificar se já foi usada */
  const usada = await sbVerificarSenhaUsada(resultado._senha);
  if (usada) {
    mostrarToast('❌ Esta senha já foi utilizada.', 'erro');
    return false;
  }
  await sbMarcarSenhaUsada(resultado._senha);

  if (def.plano) {
    /* É um plano mensal */
    activarPlano(def.plano, def.meses, redirect);
    await sbGuardarPlano(def.plano, Date.now() + (def.meses || 1) * 30 * 24 * 3600 * 1000);
  } else if (def.tipo === 'credito' || def._promo) {
    /* É um pacote de créditos ou código promocional */
    activarCredito(def.pags, redirect);
  }
  return true;
}
