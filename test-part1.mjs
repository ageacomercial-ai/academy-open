/* ═══════════════════════════════════════════════════════════
   test-part1.mjs — Testes da Parte 1 (Segurança + DB)
   Uso:      node test-part1.mjs          (usa variáveis do .env)
   Objetivo: validar os 6 testes obrigatórios da missão.
   1. Cliente consegue criar pagamento (anon key)
   2. Cliente NÃO consegue auto-aprovar via anon key (RLS)
   3. Admin aprova através do backend autorizado (PIN + service role)
   4. Polling sbCheckAprovados não quebra (aprovado → processado)
   5. Migrations aplicam-se limpas (verificação de tabelas via __health)
   6. Sem secrets expostos no frontend (varrimento local)
   ═══════════════════════════════════════════════════════════ */
import 'dotenv/config';
import fs from 'fs';

const ENGINE = process.env.TEST_ENGINE_URL || 'http://localhost:3100';
const SB_URL = process.env.SUPABASE_URL;

/* anon key pública do frontend (não é secret) — extrai se não vier do .env */
function anonKeyDoFrontend() {
  try {
    const txt = fs.readFileSync('js/supabase.js', 'utf8');
    const m = txt.match(/const SB_KEY = \(\(\)=>\{\s*const p = \[([\s\S]*?)\];\s*return p\.join\('\.'\);\s*\}\)\(\);/);
    if (!m) return '';
    const partes = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
    return partes.join('.');
  } catch { return ''; }
}
const SB_ANON = process.env.SUPABASE_ANON_KEY || anonKeyDoFrontend();
const ADMIN_PIN = process.env.ADMIN_PIN || '';

const P = (label, ok, extra = '') => console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);

async function apiRequest(body) {
  const r = await fetch(ENGINE + '/api/engine', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

async function sbFetch(path, opts = {}, key = SB_ANON) {
  const headers = { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key, ...(opts.headers || {}) };
  const r = await fetch(SB_URL + path, { ...opts, headers, signal: AbortSignal.timeout(30000) });
  return { status: r.status, body: await r.json().catch(() => null) };
}

let falhas = 0;

/* ═══════════ 6. Varrimento de secrets no frontend (sempre corre) ═══════════ */
console.log('\n── TESTE 6: secrets no frontend ──');
{
  const files = ['js/supabase.js', 'js/auth.js', 'js/admin.js', 'js/generator.js', 'js/screens-secondary.js', 'js/chat.js', 'index.html', 'sw.js', 'manifest.json'];
  const padroes = [
    /VANQIR_HOTTOK/i, /vanqir/i,
    /eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6W1AiLCJyb2xlIjoic2VydmljZV9yb2xl/i,
    /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2ZHprdWNkZWhnZ3VlYWZ5dWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZS/i,
    /SUPABASE_SERVICE_KEY\s*=\s*[A-Za-z0-9_-]{20,}/,
  ];
  let achados = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const txt = fs.readFileSync(f, 'utf8');
    padroes.forEach((re, i) => { if (re.test(txt)) achados.push(`${f}: padrão ${i + 1}`); });
  }
  if (achados.length) { P('Sem secrets no frontend', false, achados.join('; ')); falhas++; }
  else P('Sem secrets no frontend', true, 'VANQIR_HOTTOK / service_role / vanqir ausentes');
}

/* ═══════════ Pré-requisito: ligação ao backend local ═══════════ */
console.log('\n── BACKEND LOCAL ──');
let backendOk = false;
try {
  const r = await apiRequest({ action: 'ping' });
  backendOk = r.ok === true;
  P('Backend /api/engine responde', backendOk, backendOk ? '' : `(${r.status})`);
} catch (e) { P('Backend /api/engine responde', false, e.message); }

if (backendOk) {
  /* ═══════════ 3b. Routing + PIN (não necessita da DB) ═══════════ */
  console.log('\n── TESTE 3b: aprovação via backend — controlo de PIN ──');
  let r = await apiRequest({ action: 'aprovar_pagamento', payload: { id: '00000000-0000-0000-0000-000000000000', pin: 'pin_errado' } });
  const pinInvalidoRejeitado = r?.data?.resposta?.ok === false && r?.data?.resposta?.error === 'PIN_INVALIDO';
  P('PIN inválido é rejeitado (PIN_INVALIDO)', pinInvalidoRejeitado, JSON.stringify(r?.data?.resposta || r).slice(0, 80));
  if (!pinInvalidoRejeitado) falhas++;

  r = await apiRequest({ action: 'aprovar_pagamento', payload: { id: '00000000-0000-0000-0000-000000000000', pin: ADMIN_PIN } });
  const creds = r?.data?.resposta?.error;
  P('PIN correto é aceite e passa ao Supabase', creds !== 'PIN_INVALIDO', creds ? `(chega a: ${creds})` : '');
}

/* ═══════════ Pré-requisito: Supabase acessível ═══════════ */
console.log('\n── SUPABASE ──');
let sbOk = false;
let sid = 'TESTE' + Date.now().toString(36).toUpperCase();
try {
  const r = await sbFetch('/rest/v1/');
  sbOk = r.status < 500;
  P('Supabase alcançável', sbOk, `HTTP ${r.status}`);
} catch (e) { P('Supabase alcançável', false, e.cause?.code || e.message); }

if (!sbOk) {
  console.log('\n⚠️  Supabase INDISPONÍVEL (host não resolve — projeto pausado?).');
  console.log('   Corrige o projeto no dashboard Supabase e re-executa: node test-part1.mjs');
  console.log('   Resultados 1-5 ficam pendentes.');
}

if (sbOk) {
  /* ═══════════ TESTE 1: cliente cria pagamento (pendente) ═══════════ */
  console.log('\n── TESTE 1: cliente cria pagamento ──');
  let r = await sbFetch('/rest/v1/pagamentos', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      ref: 'TESTE-' + sid, uid: 'U' + sid, utilizador_id: 'U' + sid,
      nome: 'Teste Parte1', whatsapp: null, tipo: 'avulso',
      num_pags: 5, valor: 100, estado: 'pendente', criado_em: new Date().toISOString(),
    }),
  });
  const id = r.body?.[0]?.id;
  P('Criar pagamento pendente (201)', r.status === 201 && !!id, `HTTP ${r.status}`);
  if (r.status !== 201 || !id) { falhas++; } else {
    /* ═══════════ TESTE 2: cliente NÃO pode auto-aprovar ═══════════ */
    console.log('\n── TESTE 2: auto-aprovação bloqueada (RLS) ──');
    r = await sbFetch('/rest/v1/pagamentos?id=eq.' + id, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ estado: 'aprovado' }),
    });
    /* PostgREST novo: RLS bloqueado → 4xx ou 200 [] (0 linhas). Se tivesse
       passado, vinha 200 com a linha já 'aprovada'. */
    const bloqueado = r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0);
    P('PATCH estado=aprovado bloqueado (4xx ou 0 linhas)', bloqueado, `HTTP ${r.status}` + (Array.isArray(r.body) ? ` (${r.body.length} linha(s))` : ''));
    if (!bloqueado) falhas++;

    r = await sbFetch('/rest/v1/pagamentos', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ref: 'TESTE-' + sid + '-x', uid: 'U' + sid, utilizador_id: 'U' + sid, nome: 'X', tipo: 'avulso', num_pags: 5, valor: 100, estado: 'aprovado' }),
    });
    const insertBloqueado = r.status >= 400;
    P('INSERT directo com estado=aprovado bloqueado (4xx)', insertBloqueado, `HTTP ${r.status}`);
    if (!insertBloqueado) falhas++;

    r = await sbFetch('/rest/v1/pagamentos?utilizador_id=eq.U' + sid + '&select=estado', {});
    const aindaPendente = r.body?.[0]?.estado === 'pendente';
    P('O pagamento continua pendente', aindaPendente, JSON.stringify(r.body?.[0] || r.body));
    if (!aindaPendente) falhas++;

    /* ═══════════ TESTE 3: admin aprova via backend ═══════════ */
    console.log('\n── TESTE 3: admin aprova via backend autorizado ──');
    r = await apiRequest({ action: 'aprovar_pagamento', payload: { id, pin: ADMIN_PIN } });
    const aprovado = r?.data?.resposta?.ok === true;
    P('Backend marca aprovado (service role)', aprovado, JSON.stringify(r?.data?.resposta || r).slice(0, 80));
    if (!aprovado) falhas++;

    /* ═══════════ TESTE 4: polling não quebra (aprovado → processado) ═══════════ */
    console.log('\n── TESTE 4: polling sbCheckAprovados ──');
    r = await sbFetch('/rest/v1/pagamentos?utilizador_id=eq.U' + sid + '&estado=eq.aprovado', {});
    const viuAprovado = Array.isArray(r.body) && r.body.length === 1;
    P('Cliente vê estado=aprovado', viuAprovado, JSON.stringify(r.body || r).slice(0, 60));
    if (!viuAprovado) falhas++;

    r = await sbFetch('/rest/v1/pagamentos?id=eq.' + id, {
      method: 'PATCH', body: JSON.stringify({ estado: 'processado' }),
    });
    P('Cliente marca processado (2xx/3xx)', r.status < 400, `HTTP ${r.status}`);
    if (r.status >= 400) falhas++;

    /* limpeza (dados de teste) */
    await sbFetch('/rest/v1/pagamentos?id=eq.' + id, { method: 'DELETE' }, process.env.SUPABASE_SERVICE_KEY).catch(() => {});
  }

  /* ═══════════ TESTE 5: migrations/tabelas via __health ═══════════ */
  console.log('\n── TESTE 5: tabelas novas via __health (migrations aplicadas) ──');
  r = await apiRequest({ action: '__health', payload: {} });
  const tables = r?.data?.checks || {};
  const novas = ['webhook_logs', 'transacoes'];
  const okTodas = novas.every(t => tables['table_' + t] === true);
  novas.forEach(t => P(`Tabela ${t} existe`, tables['table_' + t] === true, tables['table_' + t] === undefined ? 'em falta' : ''));
  if (!okTodas) falhas++;
}

if (!sbOk) {
  console.log(`\n═══════════════ RESULTADO: ${falhas === 0 ? 'PARCIAL — testes 1-5 PENDENTES (Supabase offline)' : falhas + ' falha(s) + pendentes'} ═══════════════`);
  process.exit(2);
}

console.log(`\n═══════════════ RESULTADO: ${falhas === 0 ? 'TODOS OS TESTES PASSARAM 🎉' : falhas + ' falha(s) — ver acima'} ═══════════════`);
process.exit(falhas === 0 ? 0 : 1);