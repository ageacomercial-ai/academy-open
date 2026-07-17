/* ═══════════════════════════════════════════════════════════
   ACADEMY — AUTH.JS
   Tudo relacionado com senhas, planos e créditos.
   Depende de: state.js (LS, PLANOS_DEF, SENHA_TIPOS)
═══════════════════════════════════════════════════════════ */

/* ── Chave de validação offline (nunca partilhar o código-fonte) ── */
const _SK = (()=>{ const p = ['AGEA','26','SCOS','_ADL']; return p.join(''); })();

/* Tipos de senha e o que desbloqueiam */
const SENHA_TIPOS = {
  /* Planos Pro mensais */
  'EST':  { plano: 'estudante', meses: 1, desc: 'Estudante 1 mês — 70 págs',       preco: 5400  },
  'GRF':  { plano: 'grafica',   meses: 1, desc: 'Gráfica 1 mês — 200 págs',        preco: 15000 },
  'PREM': { plano: 'premium',   meses: 1, desc: 'Premium 1 mês — 1.000 págs',      preco: 30000 },
  /* Pacotes de crédito (páginas) */
  'C15':  { tipo: 'credito', pags: 15,   valor: 950,   desc: 'Créditos 15 páginas — 950 Kz'        },
  'C30':  { tipo: 'credito', pags: 30,   valor: 1650,  desc: 'Créditos 30 páginas — 1.650 Kz'      },
  'C200': { tipo: 'credito', pags: 200,  valor: 12000, desc: 'Créditos 200 páginas — 12.000 Kz'    },
  'C500': { tipo: 'credito', pags: 500,  valor: 29500, desc: 'Créditos 500 páginas — 29.500 Kz'    },
  'C1K':  { tipo: 'credito', pags: 1000, valor: 60000, desc: 'Créditos 1.000 páginas — 60.000 Kz'  },
};

/* ── Tabela oficial de preços ── */
function calcPreco(pags) {
  if (pags <= 15)  return 950;
  if (pags <= 30)  return 1650;
  if (pags <= 200) return 12000;
  if (pags <= 500) return 29500;
  return 60000;
}

function calcPacote(pags) {
  if (pags <= 15)  return { pags: 15,   preco: 950,   label: 'Pacote Base' };
  if (pags <= 30)  return { pags: 30,   preco: 1650,  label: 'Pacote Essencial' };
  if (pags <= 200) return { pags: 200,  preco: 12000, label: 'Pacote Avançado' };
  if (pags <= 500) return { pags: 500,  preco: 29500, label: 'Pacote Profissional' };
  return               { pags: 1000, preco: 60000, label: 'Pacote Premium' };
}

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

/* Valida uma senha digitada pelo utilizador */
function validarSenha(senha) {
  try {
    const partes = senha.trim().toUpperCase().split('-');
    if (partes.length < 4 || partes[0] !== 'ACAD') return null;
    const nonce = partes[1];
    const tipo  = partes.slice(2, -1).join('-');
    const check = partes[partes.length - 1];
    if (_hash(_SK + nonce + tipo).slice(0, 4) !== check) return null;
    const def = SENHA_TIPOS[tipo];
    if (!def) return null;
    return { tipo, ...def };
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
  /* Normalizar planos antigos */
  const validos = ['gratuito', 'estudante', 'grafica', 'premium'];
  if (!validos.includes(c.plano)) c.plano = 'gratuito';
  return c.plano || 'gratuito';
}

/* ── Verificar se pode exportar ── */
function verificarExportacao(numPags) {
  const plano = planoActivo();
  const def   = PLANOS_DEF[plano] || PLANOS_DEF.gratuito;
  const c     = getCreditos();

  /* 1. Crédito avulso activo */
  if (temCreditoActivo()) {
    if (getCreditosPags() < numPags) return { ok: false, motivo: 'credito_insuficiente', plano, c, numPags };
    return { ok: true, wm: false };
  }

  /* 2. Plano Pro mensal */
  if (plano !== 'gratuito') {
    if (c.pags + numPags > def.pags_mes) return { ok: false, motivo: 'limite_mes', plano, c, numPags };
    return { ok: true, wm: false };
  }

  /* 3. Gratuito — 1 geração real por utilizador (vitalício) */
  if (c.gen_usada >= 1) return { ok: false, motivo: 'gratuito_esgotado', plano, c, numPags };
  return { ok: true, wm: true };
}

/* ── Registar exportação (descontar créditos) ── */
function registarExportacao(numPags, pago) {
  const c     = getCreditos();
  const plano = planoActivo();
  if (temCreditoActivo()) {
    c.credito_pags = Math.max(0, (c.credito_pags || 0) - numPags);
  } else if (plano === 'gratuito') {
    c.gen_usada = 1;
  } else {
    c.pags = (c.pags || 0) + numPags;
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
  mostrarToast(`✓ Plano ${PLANOS_DEF[planoId]?.n} activado!`);
  if (redirect) irPara('inicio');
}

/* ── Activar pacote de crédito de páginas ── */
function activarCredito(numPags, redirect = true) {
  const c = getCreditos();
  c.credito_pags   = (c.credito_pags || 0) + numPags;
  c.credito_expiry = Date.now() + 30 * 24 * 3600 * 1000; /* 30 dias */
  setCreditos(c);
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
    if (expiry && Date.now() > expiry) return; /* expirou */
    const c = getCreditos();
    if (c.plano !== 'gratuito') return; /* já tem plano local */
    c.plano        = row.plano;
    c.plano_expiry = expiry;
    c.pags         = 0;
    setCreditos(c);
    mostrarToast(`✓ Plano ${PLANOS_DEF[row.plano]?.n || row.plano} restaurado!`);
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
  } else if (def.tipo === 'credito') {
    /* É um pacote de créditos */
    activarCredito(def.pags, redirect);
  }
  return true;
}
