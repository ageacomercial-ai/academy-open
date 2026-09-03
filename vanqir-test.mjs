/* ═══════════════════════════════════════════════════════════
   vanqir-test.mjs — Testes da Parte 2 (Webhooks Vanqir)
   Uso:      node vanqir-test.mjs
   Pré-req:  servidor local a correr (node server.js, PORT=3100)
             → reiniciar após alterações em server.js/api/webhooks.js
   Objetivo: validar os 10+ testes obrigatórios da missão §32.
   1  Sem assinatura → 401             7  webhook.test → 200 + log
   2  HMAC inválido → 401              8  duplicado → 200 idempotente
   3  Replay >5min → 401               9  produto desconhecido → IGNORED
   4  JSON inválido → 400             10  order.paid → 200 + transação + aprovação
   5  Envelope incompleto → 400       11  order.refunded → 200 + refund
   6  Header event diverge → 400      12  product.approved → 200 log only
                                       13  withdrawal.approved → 200 IGNORED
                                       14  anon NÃO lê webhook_logs (RLS)
                                       15  anon NÃO auto-aprova (RLS)
   ═══════════════════════════════════════════════════════════ */
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';

const ENGINE  = process.env.TEST_ENGINE_URL || 'http://localhost:3100';
const WEBHOOK = ENGINE + '/api/webhooks/payment';
const HOTTOK  = process.env.VANQIR_HOTTOK || '';
const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY || '';

const P = (label, ok, extra = '') => console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);

function anonKeyDoFrontend() {
  try {
    const txt = fs.readFileSync('js/supabase.js', 'utf8');
    const m = txt.match(/const SB_KEY = \(\(\)=>\{\s*const p = \[([\s\S]*?)\];\s*return p\.join\('\.'\);\s*\}\)\(\);/);
    if (!m) return '';
    return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).join('.');
  } catch { return ''; }
}
const ANON_KEY = process.env.SUPABASE_ANON_KEY || anonKeyDoFrontend();

/* ---------------- Helpers ---------------- */
function assinar(raw, hottok, ts = tAgora()) {
  const v1 = crypto.createHmac('sha256', hottok).update(`${ts}.${raw}`).digest('hex');
  return `t=${ts},v1=${v1}`;
}

async function enviar(payload, opts = {}) {
  const raw = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  if (opts.signature) headers['X-Vanqir-Signature'] = opts.signature;
  if (opts.event)        headers['X-Vanqir-Event']   = opts.event;
  if (opts.delivery)     headers['X-Vanqir-Delivery'] = opts.delivery;
  if (opts.attempt)      headers['X-Vanqir-Attempt']  = String(opts.attempt);
  let ultimoErro;
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(WEBHOOK, {
        method: 'POST', headers,
        body: opts.rawBody !== undefined ? opts.rawBody : raw,
        signal: AbortSignal.timeout(30000),
      });
      const j = await r.json().catch(() => null);
      return { status: r.status, ...(j || {}) };
    } catch (e) { ultimoErro = e; await new Promise(r2 => setTimeout(r2, 1500 * i)); }
  }
  throw ultimoErro;
}

async function sbFetch(path, opts = {}) {
  /* ATENÇÃO: o spread ...opts deve vir ANTES das headers — caso contrário
     opts.headers (ex.: só Prefer) SUBSTITUI apikey/Authorization e a
     escrita falha com 401 sem qualquer erro visível (bug corrigido) */
  let ultimoErro;
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(SB_URL + path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, ...(opts.headers || {}) },
        signal: AbortSignal.timeout(30000),
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    } catch (e) { ultimoErro = e; await new Promise(r2 => setTimeout(r2, 1500 * i)); }
  }
  throw ultimoErro;
}

let falhas = 0;
const sid = 'V' + Date.now().toString(36).toUpperCase();
const emailUnico = `t${sid.toLowerCase()}@teste.academy`;

/* Relógio do PC pode estar dessincronizado vs engine remoto (Vercel):
   TEST_CLOCK_OFFSET_SECONDS = diferença (PC → cloud), reaplicada aos
   timestamps de assinatura (o engine compara com o relógio DELE). */
const CLOCK_OFFSET_MS = (Number(process.env.TEST_CLOCK_OFFSET_SECONDS) || 0) * 1000;
const tAgora = () => Math.floor((Date.now() + CLOCK_OFFSET_MS) / 1000);

/* Faixas de preço ÚNICAS por run (evita 409 com resíduos de runs anteriores) */
const _F = 99900 + (parseInt(sid.slice(-3), 36) % 90);
const F0 = _F, F1 = _F + 1, F2 = _F + 2, F3 = _F + 3, F4 = _F + 4, F5 = _F + 5, F6 = _F + 6, F7 = _F + 7;

/* ═══════════ TESTES 1-6: autenticação (não precisam da DB) ═══════════ */
console.log('\n── TESTE 1: sem assinatura ──');
{
  const r = await enviar({ id: 'x', event: 'webhook.test', created_at: new Date().toISOString(), data: {} });
  const ok = r.status === 401 && r.erro === 'SEM_ASSINATURA';
  P('Sem X-Vanqir-Signature → 401 SEM_ASSINATURA', ok, `HTTP ${r.status} ${r.erro || ''}`);
  if (!ok) falhas++;
}

console.log('\n── TESTE 2: HMAC inválido ──');
{
  const payload = { id: 'x', event: 'webhook.test', created_at: new Date().toISOString(), data: {} };
  const raw = JSON.stringify(payload);
  const r = await enviar(payload, { signature: assinar(raw, 'hottok_errado_que_nao_bate') });
  const ok = r.status === 401 && r.erro === 'HMAC_INVALIDO';
  P('Assinatura com chave errada → 401 HMAC_INVALIDO', ok, `HTTP ${r.status} ${r.erro || ''}`);
  if (!ok) falhas++;
}

console.log('\n── TESTE 3: replay (>5min) ──');
{
  const payload = { id: 'x', event: 'webhook.test', created_at: new Date().toISOString(), data: {} };
  const raw = JSON.stringify(payload);
  const tsAntigo = tAgora() - 360;
  const r = await enviar(payload, { signature: assinar(raw, HOTTOK, tsAntigo) });
  const ok = r.status === 401 && r.erro === 'REPLAY_TEMPO_EXPIRADO';
  P('Timestamp com 6 min de idade → 401 REPLAY_TEMPO_EXPIRADO', ok, `HTTP ${r.status} ${r.erro || ''}`);
  if (!ok) falhas++;
}

console.log('\n── TESTE 4: JSON inválido ──');
{
  const raw = 'isto-nao-e-json{';
  const r = await enviar(null, { rawBody: raw, signature: assinar(raw, HOTTOK) });
  const ok = r.status === 400;
  P('Corpo não-JSON → 400', ok, `HTTP ${r.status}${r.erro ? ' ' + r.erro : ''}`);
  if (!ok) falhas++;
}

console.log('\n── TESTE 5: envelope incompleto ──');
{
  const payload = { event: 'webhook.test', created_at: new Date().toISOString(), data: {} };
  const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
  const ok = r.status === 400 && /FALTA/.test(r.erro || '');
  P('Envelope sem id → 400 FALTA_*', ok, `HTTP ${r.status} ${r.erro || ''}`);
  if (!ok) falhas++;
}

console.log('\n── TESTE 6: X-Vanqir-Event diverge ──');
{
  const payload = { id: 'x', event: 'webhook.test', created_at: new Date().toISOString(), data: {} };
  const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK), event: 'order.paid' });
  const ok = r.status === 400 && r.erro === 'EVENT_HEADER_DIVERGENTE';
  P('Header declara event diferente do payload → 400', ok, `HTTP ${r.status} ${r.erro || ''}`);
  if (!ok) falhas++;
}

/* ═══════════ Pré-requisito: Supabase ═══════════ */
console.log('\n── SUPABASE ──');
let sbOk = false;
try {
  const r = await sbFetch('/rest/v1/');
  sbOk = r.status < 500;
  P('Supabase alcançável', sbOk, `HTTP ${r.status}`);
} catch (e) { P('Supabase alcançável', false, e.cause?.code || e.message); }

if (!sbOk) {
  console.log('\n⚠️  Supabase INDISPONÍVEL (host não resolve — projeto pausado?).');
  console.log('   Corrige no dashboard Supabase e re-executa: node vanqir-test.mjs');
  console.log('   Testes 7-15 ficam pendentes (precisam de webhook_logs/transacoes/pagamentos).');
}

if (sbOk) {
  /* ═══════════ TESTE 7: webhook.test → 200 PROCESSED + log ═══════════ */
  console.log('\n── TESTE 7: webhook.test ──');
  const deliveryId = 'dlv-' + sid + '-test';
  {
    const payload = { id: 'evt-' + sid + '-test', event: 'webhook.test', created_at: new Date().toISOString(), data: { hello: 'world' } };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK), delivery: deliveryId });
    const ok = r.status === 200 && r.estado === 'PROCESSED';
    P('200 + PROCESSED', ok, `HTTP ${r.status} ${r.estado || ''}`);
    if (!ok) falhas++;

    const q = await sbFetch(`/rest/v1/webhook_logs?delivery_id=eq.${deliveryId}&select=delivery_id,event,status`);
    const lido = q.body?.[0]?.status === 'PROCESSED';
    P('webhook_logs com estado PROCESSED', lido, JSON.stringify(q.body || q).slice(0, 80));
    if (!lido) falhas++;
  }

  /* ═══════════ TESTE 8: entregas duplicadas → idempotente ═══════════ */
  console.log('\n── TESTE 8: idempotência (mesmo delivery_id+event) ──');
  {
    const payload = { id: 'evt-' + sid + '-dup', event: 'webhook.test', created_at: new Date().toISOString(), data: {} };
    const sig = assinar(JSON.stringify(payload), HOTTOK);
    const r1 = await enviar(payload, { signature: sig, delivery: deliveryId + '-dup' });
    const r2 = await enviar(payload, { signature: sig, delivery: deliveryId + '-dup' });
    const ok = r1.status === 200 && r2.status === 200 && r2.idempotente === true && r1.estado === 'PROCESSED' && r2.estado === 'PROCESSED';
    P('2ª entrega → 200 idempotente, sem reprocessar', ok, `1ª:${r1.estado || r1.erro} 2ª:${r2.estado || r2.erro} dup:${r2.idempotente}`);
    if (!ok) falhas++;

    const q = await sbFetch(`/rest/v1/webhook_logs?delivery_id=eq.${deliveryId + '-dup'}&select=delivery_id,event,status`);
    const soUma = Array.isArray(q.body) && q.body.length === 1;
    P('Apenas 1 registo em webhook_logs', soUma, `linhas: ${q.body?.length}`);
    if (!soUma) falhas++;
  }

  /* ═══════════ TESTE 9: order.paid produto desconhecido → IGNORED ═══════════ */
  console.log('\n── TESTE 9: order.paid com produto desconhecido ──');
  {
    const orderId = 'ord-' + sid + '-ghost';
    const payload = {
      id: 'evt-' + sid + '-ghost', event: 'order.paid', created_at: new Date().toISOString(),
      data: { product_id: 'produto-inexistente-xyz', order: { id: orderId, order_number: orderId, total_amount: 1000, buyer: { name: 'X' } } },
    };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
    const ok = r.status === 200 && r.estado === 'IGNORED';
    P('200 + IGNORED (sem acesso libertado)', ok, `HTTP ${r.status} ${r.estado || ''}`);
    if (!ok) falhas++;

    const q = await sbFetch(`/rest/v1/transacoes?order_id=eq.${orderId}&select=order_id`);
    const semTrx = Array.isArray(q.body) && q.body.length === 0;
    P('Sem transação registada', semTrx, `linhas: ${q.body?.length}`);
    if (!semTrx) falhas++;

    await sbFetch(`/rest/v1/intervencoes_admin?ref=eq.${orderId}`, { method: 'DELETE' });
  }

  /* ═══════════ TESTE 10: order.paid válido → 200 + transação + pagamento aprovado ═══════════ */
  console.log('\n── TESTE 10: order.paid válido (fluxo completo) ──');
  {
    const orderId = 'ord-' + sid;
    const prodId  = 'prod-' + sid;
    const userId  = 'U' + sid;

    await sbFetch('/rest/v1/utilizadores?id=eq.' + userId, { method: 'DELETE' });
    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/precos?product_id=eq.' + prodId, { method: 'DELETE' });

    await sbFetch('/rest/v1/utilizadores', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id: userId, nome: 'Teste Vanqir ' + sid, email: emailUnico, whatsapp: '+244900000001', nivel: 'medio' }),
    });
    await sbFetch('/rest/v1/precos', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ faixa_inicio: F0, faixa_fim: F1, preco: 42500, label: 'Teste Vanqir', ativo: true, product_id: prodId }),
    });

    const payload = {
      id: 'evt-' + sid, event: 'order.paid', created_at: new Date().toISOString(),
      data: {
        product_id: prodId,
        order: {
          id: orderId, order_number: 'VP-' + sid,
          total_amount: 42500, seller_net_amount: 40000, commission_amount: 2500,
          payment_method: 'Multicaixa Express', paid_at: new Date().toISOString(),
          buyer: { name: 'Teste Vanqir', email: emailUnico, phone: '+244900000001' },
        },
      },
    };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
    const ok = r.status === 200 && r.estado === 'PROCESSED';
    P('200 + PROCESSED', ok, `HTTP ${r.status} ${r.estado || r.erro || ''}`);
    if (!ok) falhas++;

    const qTrx = await sbFetch(`/rest/v1/transacoes?order_id=eq.${orderId}&select=order_id,order_number,product_id,total_amount,seller_net_amount,commission_amount,payment_method,status,moeda`);
    const trx = qTrx.body?.[0];
    const trxOk = !!trx && trx.total_amount === 42500 && trx.product_id === prodId && trx.payment_method === 'Multicaixa Express' && trx.status === 'paid';
    P('Transação com valores históricos', trxOk, JSON.stringify(trx || qTrx.body).slice(0, 120));
    if (!trxOk) falhas++;

    const qPag = await sbFetch(`/rest/v1/pagamentos?vanqir_order_id=eq.${orderId}&select=id,estado,utilizador_id,vanqir_order_id,metodo,moeda`);
    const pag = qPag.body?.[0];
    const pagOk = !!pag && pag.estado === 'aprovado' && pag.utilizador_id === userId && pag.metodo === 'vanqir';
    P('Pagamento interno aprovado associado ao utilizador', pagOk, JSON.stringify(pag || qPag.body).slice(0, 120));
    if (!pagOk) falhas++;

    /* TESTE 15 (dentro do 10): anon não pode editar o estado para aprovado/rejeitado
       (a transição aprovado→processado é permitida por design — polling sbProcessar) */
    console.log('\n── TESTE 15: anon NÃO auto-aprova pagamento Vanqir ──');
    if (ANON_KEY) {
      const rr = await fetch(SB_URL + `/rest/v1/pagamentos?id=eq.${pag?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, Prefer: 'return=minimal' },
        body: JSON.stringify({ estado: 'rejeitado' }),
        signal: AbortSignal.timeout(30000),
      });
      const bloqueado = rr.status === 403 || rr.status === 401;
      P('PATCH anon para rejeitado bloqueado (403)', bloqueado, `HTTP ${rr.status}`);
      if (!bloqueado) falhas++;
    } else {
      P('PATCH anon bloqueado (403)', false, 'não foi possível extrair anon key');
      falhas++;
    }
    console.log('\n── fim TESTE 15 ──');

    /* limpeza do teste 10/15 */
    await sbFetch('/rest/v1/pagamentos?id=eq.' + pag?.id, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/precos?product_id=eq.' + prodId, { method: 'DELETE' });
    await sbFetch('/rest/v1/utilizadores?id=eq.' + userId, { method: 'DELETE' });
  }

  /* ═══════════ TESTE 11: order.refunded → 200 + refund ═══════════ */
  console.log('\n── TESTE 11: order.refunded ──');
  {
    const orderId = 'ord-' + sid + '-ref';
    const userId  = 'U' + sid + '-ref';

    await sbFetch('/rest/v1/utilizadores?id=eq.' + userId, { method: 'DELETE' });
    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/utilizadores', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id: userId, nome: 'Refund ' + sid, email: 'ref' + sid.toLowerCase() + '@teste.academy', whatsapp: '+244900000002' }),
    });
    await sbFetch('/rest/v1/pagamentos', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ utilizador_id: userId, uid: userId, nome: 'Refund ' + sid, tipo: 'avulso', num_pags: 15, valor: 42500, estado: 'aprovado', vanqir_order_id: orderId }),
    });

    const payload = {
      id: 'evt-' + sid + '-ref', event: 'order.refunded', created_at: new Date().toISOString(),
      data: { product_id: 'qualquer', order: { id: orderId, order_number: 'VP-' + sid + '-REF', total_amount: 42500, paid_at: new Date().toISOString(), buyer: { name: 'Refund', email: 'ref' + sid.toLowerCase() + '@teste.academy' } } },
    };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
    const ok = r.status === 200 && r.estado === 'PROCESSED';
    P('200 + PROCESSED (refund registado)', ok, `HTTP ${r.status} ${r.estado || r.erro || ''}`);
    if (!ok) falhas++;

    const q = await sbFetch(`/rest/v1/transacoes?order_id=eq.${orderId}&event=eq.order.refunded&select=order_id,status`);
    const trxRefund = q.body?.[0]?.status === 'refunded';
    P('Transação com status=refunded', trxRefund, JSON.stringify(q.body || q).slice(0, 80));
    if (!trxRefund) falhas++;

    const qPag = await sbFetch(`/rest/v1/pagamentos?vanqir_order_id=eq.${orderId}&select=id,estado`);
    const reembolsado = qPag.body?.[0]?.estado === 'reembolsado';
    P('Pagamento marcado reembolsado (sem apagar registos)', reembolsado, JSON.stringify(qPag.body || qPag).slice(0, 80));
    if (!reembolsado) falhas++;

    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/utilizadores?id=eq.' + userId, { method: 'DELETE' });
  }

  /* ═══════════ TESTE 12: product.approved → log only ═══════════ */
  console.log('\n── TESTE 12: product.approved ──');
  {
    const payload = { id: 'evt-' + sid + '-pa', event: 'product.approved', created_at: new Date().toISOString(), data: { product: { id: 'p-1', name: 'X' } } };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
    const ok = r.status === 200 && r.estado === 'PROCESSED';
    P('200 + PROCESSED (log only, sem pagamentos/transações)', ok, `HTTP ${r.status} ${r.estado || ''}`);
    if (!ok) falhas++;
  }

  /* ═══════════ TESTE 13: withdrawal.approved → IGNORED ═══════════ */
  console.log('\n── TESTE 13: withdrawal.approved ──');
  {
    const payload = { id: 'evt-' + sid + '-wd', event: 'withdrawal.approved', created_at: new Date().toISOString(), data: { withdrawal: { id: 'w-1' } } };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
    const ok = r.status === 200 && r.estado === 'IGNORED';
    P('200 + IGNORED (regista, não processa)', ok, `HTTP ${r.status} ${r.estado || ''}`);
    if (!ok) falhas++;
  }

  /* ═══════════ TESTE 16: ambiguidade de email → NUNCA liberar (§3) ═══════════ */
  console.log('\n── TESTE 16: email ambíguo (2 utilizadores) → sem libertação ──');
  {
    const orderId = 'ord-' + sid + '-amb';
    const emailAmb = 'amb' + sid.toLowerCase() + '@teste.academy';
    const prodAmb = 'prod-' + sid + '-amb';

    await sbFetch('/rest/v1/utilizadores?email=eq.' + emailAmb, { method: 'DELETE' });
    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/intervencoes_admin?ref=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/precos?product_id=eq.' + prodAmb, { method: 'DELETE' });

    await sbFetch('/rest/v1/precos', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ faixa_inicio: F2, faixa_fim: F3, preco: 5500, label: 'Amb', ativo: true, product_id: prodAmb }) });
    await sbFetch('/rest/v1/utilizadores', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id: 'U' + sid + '-A1', nome: 'Amb A1', email: emailAmb, whatsapp: '+244910000001' }) });
    await sbFetch('/rest/v1/utilizadores', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id: 'U' + sid + '-A2', nome: 'Amb A2', email: emailAmb, whatsapp: '+244910000002' }) });

    const payload = {
      id: 'evt-' + sid + '-amb', event: 'order.paid', created_at: new Date().toISOString(),
      data: { product_id: prodAmb, order: { id: orderId, order_number: orderId, total_amount: 5500, buyer: { name: 'Alguém', email: emailAmb, phone: '+244910000001' } } },
    };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
    const ok = r.status === 200 && (r.estado === 'IGNORED' || (r.estado === 'PROCESSED' && r.erro?.startsWith('SEM_LIBERTACAO')));
    P('Resposta sem libertação automática', ok, `HTTP ${r.status} ${r.estado} ${r.erro || ''}`);
    if (!ok) falhas++;

    const qPag = await sbFetch(`/rest/v1/pagamentos?vanqir_order_id=eq.${orderId}&select=id,estado`);
    const semPag = !qPag.body?.length;
    P('Nenhum pagamento aprovado criado', semPag, qPag.body?.length ? JSON.stringify(qPag.body).slice(0, 80) : '');
    if (!semPag) falhas++;

    const qInt = await sbFetch(`/rest/v1/intervencoes_admin?ref=eq.${orderId}&select=tipo,estado`);
    const inter = qInt.body?.find(x => x.tipo === 'UTILIZADOR_AMBIGUO');
    P('Caso registado para intervenção (UTILIZADOR_AMBIGUO)', !!inter, JSON.stringify(qInt.body || qInt).slice(0, 80));
    if (!inter) falhas++;

    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/intervencoes_admin?ref=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/precos?product_id=eq.' + prodAmb, { method: 'DELETE' });
    await sbFetch('/rest/v1/utilizadores?email=eq.' + emailAmb, { method: 'DELETE' });
  }

  /* ═══════════ TESTE 17: telefone normalizado (§3) ═══════════ */
  console.log('\n── TESTE 17: associação por telefone normalizado ──');
  {
    const orderId = 'ord-' + sid + '-tel';
    const userId  = 'U' + sid + '-tel';
    const prodTel = 'prod-' + sid + '-tel';

    await sbFetch('/rest/v1/utilizadores?id=eq.' + userId, { method: 'DELETE' });
    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/intervencoes_admin?ref=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/precos?product_id=eq.' + prodTel, { method: 'DELETE' });
    await sbFetch('/rest/v1/utilizadores?id=eq.' + userId, { method: 'DELETE' });
    await sbFetch('/rest/v1/utilizadores?whatsapp=eq.' + encodeURIComponent('+244 900 000 003'), { method: 'DELETE' });
    await sbFetch('/rest/v1/precos', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ faixa_inicio: F4, faixa_fim: F5, preco: 1850, label: 'Tel', ativo: true, product_id: prodTel }) });
    await sbFetch('/rest/v1/utilizadores', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id: userId, nome: 'Tel ' + sid, email: null, whatsapp: '+244 900 000 003' }) });

    const payload = {
      id: 'evt-' + sid + '-tel', event: 'order.paid', created_at: new Date().toISOString(),
      data: { product_id: prodTel, order: { id: orderId, order_number: orderId, total_amount: 1850, buyer: { name: 'Tel', email: 'sem-email@none', phone: '900000003' } } },
    };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
    const ok = r.status === 200 && r.estado === 'PROCESSED';
    P('200 + PROCESSED (telefone +244 900 000 003 == 900000003)', ok, `HTTP ${r.status} ${r.estado || r.erro || ''}`);
    if (!ok) falhas++;

    const qPag = await sbFetch(`/rest/v1/pagamentos?vanqir_order_id=eq.${orderId}&select=id,estado,utilizador_id`);
    const certo = qPag.body?.[0]?.estado === 'aprovado' && qPag.body?.[0]?.utilizador_id === userId;
    P('Pagamento aprovado para o utilizador certo', certo, JSON.stringify(qPag.body || qPag).slice(0, 80));
    if (!certo) falhas++;

    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/intervencoes_admin?ref=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/precos?product_id=eq.' + prodTel, { method: 'DELETE' });
    await sbFetch('/rest/v1/utilizadores?id=eq.' + userId, { method: 'DELETE' });
  }

  /* ═══════════ TESTE 18: offer_id oficial mapeia o pacote (§5) ═══════════ */
  console.log('\n── TESTE 18: identificação por offer_id (sem product_id) ──');
  {
    const orderId = 'ord-' + sid + '-of';
    const offerId = 'offer-OFICIAL-' + sid;
    const userId  = 'U' + sid + '-of';
    const emailOf = 'of' + sid.toLowerCase() + '@teste.academy';

    await sbFetch('/rest/v1/utilizadores?id=eq.' + userId, { method: 'DELETE' });
    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/intervencoes_admin?ref=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/precos?product_id=eq.' + offerId, { method: 'DELETE' });
    await sbFetch('/rest/v1/utilizadores', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id: userId, nome: 'Oferta ' + sid, email: emailOf, whatsapp: null }) });
    await sbFetch('/rest/v1/precos', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ faixa_inicio: F6, faixa_fim: F7, preco: 5500, label: 'Oferta 31-50', ativo: true, product_id: offerId }) });

    const payload = {
      id: 'evt-' + sid + '-of', event: 'order.paid', created_at: new Date().toISOString(),
      data: {
        offer_id: offerId, offer_name: 'Oferta 31-50 páginas',
        order: { id: orderId, order_number: orderId, total_amount: 5500, buyer: { name: 'Oferta', email: emailOf } },
      },
    };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
    const ok = r.status === 200 && r.estado === 'PROCESSED';
    P('200 + PROCESSED (offer_id reconhecido)', ok, `HTTP ${r.status} ${r.estado || r.erro || ''}`);
    if (!ok) falhas++;

    const qTrx = await sbFetch(`/rest/v1/transacoes?order_id=eq.${orderId}&select=product_id,offer_id,offer_name,total_amount`);
    const trxOf = qTrx.body?.[0]?.offer_id === offerId && qTrx.body?.[0]?.offer_name === 'Oferta 31-50 páginas';
    P('Transação com offer_id/offer_name oficiais', trxOf, JSON.stringify(qTrx.body || qTrx).slice(0, 120));
    if (!trxOf) falhas++;

    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/intervencoes_admin?ref=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/precos?product_id=eq.' + offerId, { method: 'DELETE' });
    await sbFetch('/rest/v1/utilizadores?id=eq.' + userId, { method: 'DELETE' });
  }

  /* ═══════════ TESTE 19: sem identificador oficial → IGNORED + intervenção (§5) ═══════════ */
  console.log('\n── TESTE 19: order.paid sem identificador oficial ──');
  {
    const orderId = 'ord-' + sid + '-semid';

    await sbFetch('/rest/v1/pagamentos?vanqir_order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/transacoes?order_id=eq.' + orderId, { method: 'DELETE' });
    await sbFetch('/rest/v1/intervencoes_admin?ref=eq.' + orderId, { method: 'DELETE' });

    const payload = {
      id: 'evt-' + sid + '-semid', event: 'order.paid', created_at: new Date().toISOString(),
      data: { order: { id: orderId, order_number: orderId, total_amount: 16000, buyer: { name: 'X', email: 'x@y.zz' } } },
    };
    const r = await enviar(payload, { signature: assinar(JSON.stringify(payload), HOTTOK) });
    const ok = r.status === 200 && r.estado === 'IGNORED';
    P('200 + IGNORED (sem identificar pacote — nunca inferir por valor)', ok, `HTTP ${r.status} ${r.estado || ''}`);
    if (!ok) falhas++;

    const qInt = await sbFetch(`/rest/v1/intervencoes_admin?ref=eq.${orderId}&select=tipo,estado`);
    const inter = qInt.body?.find(x => x.tipo === 'PACOTE_NAO_MAPEADO');
    P('Caso registado para intervenção (PACOTE_NAO_MAPEADO)', !!inter, JSON.stringify(qInt.body || qInt).slice(0, 80));
    if (!inter) falhas++;

    await sbFetch('/rest/v1/intervencoes_admin?ref=eq.' + orderId, { method: 'DELETE' });
  }

  /* ═══════════ TESTE 14: anon não lê webhook_logs/transacoes ═══════════ */
  console.log('\n── TESTE 14: RLS — anon não lê tabelas financeiras ──');
  {
    if (ANON_KEY) {
      for (const tabela of ['webhook_logs', 'transacoes', 'intervencoes_admin']) {
        const rr = await fetch(SB_URL + `/rest/v1/${tabela}?select=*&limit=1`, {
          headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY }, signal: AbortSignal.timeout(30000),
        });
        /* RLS sem políticas → 401/403 OU 200 com [] (filtrado a zero linhas) */
        let corpo = []; try { corpo = await rr.json(); } catch {}
        const negado = rr.status === 401 || rr.status === 403 || (rr.status === 200 && Array.isArray(corpo) && corpo.length === 0);
        P(`anon NÃO lê ${tabela}`, negado, `HTTP ${rr.status} ${Array.isArray(corpo) ? corpo.length + ' linha(s)' : ''}`);
        if (!negado) falhas++;
      }
    } else {
      P('anon NÃO lê tabelas financeiras', false, 'não foi possível extrair anon key');
      falhas++;
    }
  }
}

/* ═══════════ Resultado ═══════════ */
if (!sbOk) {
  console.log(`\n═══════════════ RESULTADO: ${falhas === 0 ? 'PARCIAL — testes 7-15 PENDENTES (Supabase offline)' : falhas + ' falha(s) + pendentes'} ═══════════════`);
  process.exit(2);
}
console.log(`\n═══════════════ RESULTADO: ${falhas === 0 ? 'TODOS OS TESTES PASSARAM 🎉' : falhas + ' falha(s) — ver acima'} ═══════════════`);
process.exit(falhas === 0 ? 0 : 1);