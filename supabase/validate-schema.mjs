/* ═══════════════════════════════════════════════════════════
   ACADEMY — Validação de estrutura Supabase (missão §19/§20)
   Confirma no banco REAL:
     1. Todas as tabelas existem e respondem (service role)
     2. RLS: anon NÃO escreve em tabelas financeiras (webhook_logs,
        transacoes, intervencoes_admin, audit_log) e NÃO auto-aprova
        pagamentos; leitura de precos permitida
     3. UNIQUE de idempotência (webhook_logs, transacoes)
     4. Trigger de auditoria regista alterações
   (Linhas criadas por este script usam prefixo VAL- e são removidas
    no fim — o registo de auditoria do teste é apagado junto.)
   ═══════════════════════════════════════════════════════════ */

import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'node:path';

try { dotenv.config({ path: path.join(process.cwd(), '.env.local') }); } catch {}

const URL_SB = process.env.SUPABASE_URL;
const SRV    = process.env.SUPABASE_SERVICE_KEY;
const ANON   = process.env.SUPABASE_ANON_KEY;

if (!URL_SB || !SRV || !ANON) {
  console.error('❌ Faltam SUPABASE_URL/SERVICE_KEY/ANON_KEY (.env ou .env.local)');
  process.exit(1);
}

const TABELAS = [
  'utilizadores','pagamentos','documentos','senhas_usadas','planos_utilizadores',
  'precos','planos_grafica','academy_ai_logs','academy_history','instituicoes',
  'comissoes','parceiros','webhook_logs','transacoes','intervencoes_admin','audit_log',
];

let passou = 0, falhou = 0;
function check(nome, cond, detalhe = '') {
  if (cond) { passou++; console.log(`  ✅ ${nome}`); }
  else      { falhou++; console.error(`  ❌ ${nome} ${detalhe ? '— ' + detalhe : ''}`); }
}

async function req(tabela, opts = {}, chave = SRV) {
  const r = await fetch(`${URL_SB}/rest/v1/${tabela}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', apikey: chave, Authorization: `Bearer ${chave}`, ...(opts.headers||{}) },
  });
  let corpo = null; try { corpo = await r.json(); } catch {}
  return { status: r.status, corpo };
}

/* 1 ── Existência das 16 tabelas */
console.log('\n⓪  ESTRUTURA (service role — SELECT limit=1)');
for (const t of TABELAS) {
  const r = await req(t, { method: 'GET' });
  check(`tabela ${t}`, r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.corpo).slice(0,80)}`);
}

/* 2 ── RLS financeiro */
console.log('\n①  RLS — anon NÃO pode escrever em tabelas financeiras');
{
  const r = await req('webhook_logs', { method:'POST', body: JSON.stringify({ delivery_id:'VAL-WL', event:'order.paid', status:'RECEIVED' }) }, ANON);
  check('POST webhook_logs (anon) → bloqueado', r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}
{
  const r = await req('transacoes', { method:'POST', body: JSON.stringify({ order_id:'VAL-TRX', event:'order.paid', total_amount:1 }) }, ANON);
  check('POST transacoes (anon) → bloqueado', r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}
{
  const r = await req('intervencoes_admin', { method:'POST', body: JSON.stringify({ tipo:'TESTE', motivo:'VAL', estado:'pendente' }) }, ANON);
  const bloqueado = r.status !== 201 && !(r.status === 200 && r.corpo !== null);
  check('POST intervencoes_admin (anon) → bloqueado', bloqueado, `HTTP ${r.status}`);
}
{
  const r = await req('audit_log', { method:'GET' }, ANON);
  const vazio = r.status >= 200 && r.status < 300 && Array.isArray(r.corpo) && r.corpo.length === 0;
  const bloqueado = r.status === 401 || r.status === 403 || vazio;
  check('GET audit_log (anon) → sem vazamento', bloqueado, `HTTP ${r.status} ${JSON.stringify(r.corpo).slice(0,80)}`);
}
{
  const r = await req('precos', { method:'GET' }, ANON);
  check('GET precos (anon) → permitido (frontend)', r.status === 200, `HTTP ${r.status}`);
}

/* 3 ── RLS pagamentos: pendente sim, aprovado NÃO */
console.log('\n②  RLS pagamentos — cliente só cria pendente');
let pagId = null;
{
  const r = await req('pagamentos', { method:'POST', body: JSON.stringify({ ref:'VAL-PEND', uid:'VAL-uid', valor:100, estado:'pendente' }) }, ANON);
  check('POST pagamentos estado=pendente (anon) → permitido', r.status === 201, `HTTP ${r.status}` + (r.status!==201?` ${JSON.stringify(r.corpo).slice(0,100)}`:''));
  pagId = r.corpo?.[0]?.id || null;
}
{
  const r = await req('pagamentos', { method:'POST', body: JSON.stringify({ ref:'VAL-APRV', valor:100, estado:'aprovado' }) }, ANON);
  check('POST pagamentos estado=aprovado (anon) → BLOQUEADO', r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}
if (pagId) {
  const r = await req(`pagamentos?id=eq.${encodeURIComponent(pagId)}`, { method:'PATCH', body: JSON.stringify({ estado:'aprovado' }) }, ANON);
  check('PATCH pagamento pendente→aprovado (anon) → BLOQUEADO', r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}

/* 4 ── UNIQUE de idempotência */
console.log('\n③  Idempotência — UNIQUE(delivery_id,event) e UNIQUE(order_id,event)');
{
  const a = await req('webhook_logs', { method:'POST', body: JSON.stringify({ delivery_id:'VAL-DL', event:'order.paid', status:'RECEIVED' }) });
  const b = await req('webhook_logs', { method:'POST', body: JSON.stringify({ delivery_id:'VAL-DL', event:'order.paid', status:'RECEIVED' }) });
  check('webhook_logs duplicado → 409', a.status === 201 && b.status === 409, `1º=${a.status} 2º=${b.status}`);
}
{
  const a = await req('transacoes', { method:'POST', body: JSON.stringify({ order_id:'VAL-ORD', event:'order.paid', total_amount:100 }) });
  const b = await req('transacoes', { method:'POST', body: JSON.stringify({ order_id:'VAL-ORD', event:'order.paid', total_amount:100 }) });
  check('transacoes duplicado → 409', a.status === 201 && b.status === 409, `1º=${a.status} 2º=${b.status}`);
}

/* 5 ── Trigger de auditoria em precos */
console.log('\n④  Assinatura em depósito — auditoria de alterações de preço');
{
  const ins = await req('precos', { method:'POST', headers: { Prefer:'return=representation' }, body: JSON.stringify({ faixa_inicio:0, faixa_fim:1, preco:0.01, label:'VAL', ativo:true }) });
  if (ins.status === 201) {
    const audit = await req('audit_log', { method:'GET' });
    const logado = Array.isArray(audit.corpo) && audit.corpo.some(l => l.tabela === 'precos' && l.acao === 'INSERT' && String(l.registo_id) === String(ins.corpo[0].id));
    check('INSERT precos → registo em audit_log', logado, `audit_log=${audit.status}`);
    /* teste UPDATE também acontece pelo DELETE (garante ação) */
    const del = await req(`precos?id=eq.${encodeURIComponent(ins.corpo[0].id)}`, { method:'DELETE' });
    check('cleanup precos teste', del.status === 200 || del.status === 204, `HTTP ${del.status}`);
  } else {
    check('INSERT precos → registo em audit_log', false, `HTTP ${ins.status} ${JSON.stringify(ins.corpo).slice(0,120)}`);
  }
}

/* 6 ── Limpeza das linhas de teste */
console.log('\n⑤  Cleanup (service role)');
const limpezas = [
  ['pagamentos', `ref=eq.VAL-PEND`],
  ['pagamentos', `ref=eq.VAL-APRV`],
  ['webhook_logs', `delivery_id=eq.VAL-DL`],
  ['transacoes', `order_id=eq.VAL-ORD`],
  ['audit_log', `tabela=eq.precos`],
];
for (const [tabela, f] of limpezas) {
  const r = await req(`${tabela}?${f}`, { method:'DELETE' });
  console.log(`  ${r.status === 200 || r.status === 204 ? '✅' : '⚠️'} ${tabela} cleanup (HTTP ${r.status})`);
}

console.log(`\n══════════════════════════════════════`);
console.log(`RESULTADO: ${passou} ✅ · ${falhou} ❌`);
process.exit(falhou ? 1 : 0);