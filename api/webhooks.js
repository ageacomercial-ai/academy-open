/* ═══════════════════════════════════════════════════════════
   ACADEMY — WEBHOOKS VANQIR (Parte 2)
   POST /api/webhooks/payment

   Fluxo:
     recebe → rawBody → verifica HMAC (t+rawBody, timingSafeEqual)
     → replay ±5min → envelope → header event → idempotência
     → webhook_logs (RECEIVED→PROCESSING→PROCESSED/FAILED/IGNORED)
     → transacoes → pagamentos (aprovação service role)

   REGRAS DE NEGÓCIO (oficiais):
     §3  Associação comprador→utilizador: identificador explícito → email
         exacto → telefone normalizado. AMBIGUIDADE → nunca liberar;
         registar em intervencoes_admin. Nunca associar por nome.
     §4  Sem geração/créditos gratuitos — só compra válida consome/credita.
     §5  Pacote identificado por product_id/offer_id/offer_name oficiais;
         nunca inferir o pacote apenas pelo valor pago.

   SEGURANÇA:
     - VANQIR_HOTTOK só via process.env (NUNCA no frontend/Git/logs)
     - SUPABASE_SERVICE_KEY só no backend
     - Nunca faz JSON.stringify(req.body) para a assinatura — usa rawBody
   ═══════════════════════════════════════════════════════════ */

import crypto from 'crypto';

const JANELA_REPLAY_MS = 5 * 60 * 1000; /* ±5 minutos */
const SB_TIMEOUT_MS    = 15000;          /* rede instável → 5s era insuficiente */

const STATUS = { RECEIVED:'RECEIVED', PROCESSING:'PROCESSING', PROCESSED:'PROCESSED', FAILED:'FAILED', IGNORED:'IGNORED' };

/* ---------------- Utilidades Supabase (service role) ---------------- */
function sbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY || '',
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || ''}`,
  };
}

async function sbFetch(path, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), SB_TIMEOUT_MS);
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}${path}`, {
      ...opts, signal: ctrl.signal,
      headers: { ...sbHeaders(), ...(opts.headers || {}) },
    });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch { /* não-JSON */ }
    return { ok: r.ok, status: r.status, body: j, txt };
  } finally { clearTimeout(t); }
}

/* ---------------- RAW BODY ---------------- */
/* No Express local o server.js entrega req.rawBody (buffer exato).
   No serverless Vercel o corpo está no STREAM não consumido — a leitura
   é feita aqui. NUNCA re-serializar JSON já parseado: o HMAC depende do
   rawBody exato (espaços/ordem de chaves). */
async function obterRawBody(req) {
  if (req.rawBody) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  if (typeof req.on === 'function' && typeof req.read === 'function') {
    try {
      return await new Promise((resolve) => {
        let dados = '';
        req.on('data', (c) => { dados += c; });
        req.on('end', () => resolve(dados || null));
        req.on('error', () => resolve(null));
      });
    } catch { return null; }
  }
  return null;
}

/* ---------------- Verificação de assinatura ---------------- */
function verificarAssinatura(rawBody, header) {
  if (!header || !rawBody) return { ok:false, motivo:'SEM_ASSINATURA' };
  const hottok = process.env.VANQIR_HOTTOK || '';
  if (!hottok) return { ok:false, motivo:'HOTTOK_NAO_CONFIGURADO' };

  const partes = String(header).split(',');
  let t = null, v1 = null;
  for (const p of partes) {
    if (p.startsWith('t='))  t  = p.slice(2);
    if (p.startsWith('v1=')) v1 = p.slice(3);
  }
  if (t === null || v1 === null) return { ok:false, motivo:'FORMATO_INVALIDO' };
  if (!/^\d+$/.test(t)) return { ok:false, motivo:'TIMESTAMP_INVALIDO' };

  /* Replay attack: janela ±5 min */
  const tMs = Number(t) * 1000;
  if (Math.abs(Date.now() - tMs) > JANELA_REPLAY_MS) return { ok:false, motivo:'REPLAY_TEMPO_EXPIRADO' };

  const esperado = crypto.createHmac('sha256', hottok).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(esperado, 'hex');
  const b = Buffer.from(String(v1), 'hex');
  if (a.length !== b.length) return { ok:false, motivo:'HMAC_INVALIDO' };
  return { ok: crypto.timingSafeEqual(a, b), motivo: crypto.timingSafeEqual(a, b) ? null : 'HMAC_INVALIDO' };
}

/* ---------------- Validação do envelope ---------------- */
function validarEnvelope(payload) {
  if (!payload || typeof payload !== 'object') return 'PAYLOAD_NAO_OBJECTO';
  if (!payload.id) return 'FALTA_ID';
  if (!payload.event) return 'FALTA_EVENT';
  if (!payload.created_at) return 'FALTA_CREATED_AT';
  if (payload.data === undefined || payload.data === null) return 'FALTA_DATA';
  return null;
}

/* ---------------- Identificadores oficiais da oferta (§5) ----------------
   O pacote é identificado pelos dados OFICIAIS da Vanqir:
     product_id · offer_id · offer_name
   Preferência: identificador oficial (offer_id → product_id) sobre o valor.
   NUNCA inferir o pacote apenas pelo valor pago. */
function extractOferta(data) {
  const d = data && typeof data === 'object' ? data : {};
  const item = d.items?.[0] || d.order?.items?.[0] || null;
  return {
    productId: d.product_id || item?.product_id || d.order?.product_id || null,
    offerId:   d.offer_id   || item?.offer_id   || d.order?.offer_id   || null,
    offerName: d.offer_name || item?.offer_name || d.order?.offer_name || null,
  };
}

/* ---------------- Produtos permitidos (env + DB) ---------------- */
let _cacheProdutos = { ts: 0, ids: null, map: null };

async function produtosConfig(force = false) {
  const agora = Date.now();
  /* Cache curto (60s); com force=true há refresh imediato — usado quando um
     identificador não bate (o admin pode ter mapeado o produto agora mesmo) */
  if (!force && _cacheProdutos.ids && agora - _cacheProdutos.ts < 60000) return _cacheProdutos;

  const ids = new Set();
  const map = new Map(); /* identificador oficial → { tipo, numPags, preco, nome } */

  for (const v of String(process.env.VANQIR_PRODUCT_ID || '').split(',')) {
    const x = v.trim();
    if (x) ids.add(x);
  }

  /* Mapeamento na DB (precos / planos_grafica — coluna product_id pode
     conter o product_id OU o offer_id oficial da Vanqir) */
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const r = await sbFetch('/rest/v1/precos?select=faixa_inicio,faixa_fim,preco,label,product_id&ativo=eq.true&product_id=not.is.null');
      if (r.ok && Array.isArray(r.body)) {
        for (const p of r.body) {
          if (!p.product_id) continue;
          ids.add(p.product_id);
          map.set(p.product_id, { tipo:'avulso', numPags: p.faixa_fim || 15, preco: Number(p.preco) || 0, nome: p.label || 'Academy' });
        }
      }
      const r2 = await sbFetch('/rest/v1/planos_grafica?select=nome,paginas,preco,product_id&ativo=eq.true&product_id=not.is.null');
      if (r2.ok && Array.isArray(r2.body)) {
        for (const p of r2.body) {
          if (!p.product_id) continue;
          ids.add(p.product_id);
          map.set(p.product_id, { tipo:'avulso', numPags: p.paginas || 15, preco: Number(p.preco) || 0, nome: p.nome || 'Academy' });
        }
      }
    } catch { /* DB indisponível — usa só env */ }
  }

  _cacheProdutos = { ts: agora, ids, map };
  return _cacheProdutos;
}

/* ---------------- Registos em webhook_logs ---------------- */
async function logInsert(deliveryId, event, attempt) {
  return sbFetch('/rest/v1/webhook_logs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ delivery_id: deliveryId, event, status: STATUS.RECEIVED, attempt: attempt || 1, received_at: new Date().toISOString() }),
  });
}

async function logUpdate(deliveryId, event, status, extra = {}) {
  const patch = { status, processed_at: new Date().toISOString(), ...extra };
  return sbFetch(`/rest/v1/webhook_logs?delivery_id=eq.${encodeURIComponent(deliveryId)}&event=eq.${encodeURIComponent(event)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function logExiste(deliveryId, event) {
  const r = await sbFetch(`/rest/v1/webhook_logs?delivery_id=eq.${encodeURIComponent(deliveryId)}&event=eq.${encodeURIComponent(event)}&select=id,status,attempt`);
  return r.ok && Array.isArray(r.body) && r.body.length ? r.body[0] : null;
}

/* ---------------- Transações ---------------- */
async function registarTransacao(deliveryId, event, data, order, oferta) {
  const trx = {
    delivery_id: deliveryId,
    order_id: order?.id || null,
    order_number: order?.order_number || null,
    product_id: oferta?.productId || data?.product_id || null,
    offer_id: oferta?.offerId || null,
    offer_name: oferta?.offerName || null,
    event,
    total_amount: order?.total_amount != null ? Number(order.total_amount) : null,
    seller_net_amount: order?.seller_net_amount != null ? Number(order.seller_net_amount) : null,
    commission_amount: order?.commission_amount != null ? Number(order.commission_amount) : null,
    payment_method: order?.payment_method || null,
    buyer_name: order?.buyer?.name || null,
    buyer_email: order?.buyer?.email || null,
    buyer_phone: order?.buyer?.phone || null,
    paid_at: order?.paid_at || null,
    status: event === 'order.refunded' ? 'refunded' : 'paid',
    moeda: 'AOA',
  };
  /* Idempotência por order_id+event — on_conflict EXPLÍCITO (UNIQUE da DB):
     uma ordem+evento só entra uma vez; reentregas são ignoradas (200) */
  return sbFetch('/rest/v1/transacoes?on_conflict=order_id,event', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(trx),
  });
}

/* ---------------- Intervenções administrativas (§3) ----------------
   Casos que NUNCA são resolvidos automaticamente são registados aqui
   para resolução manual. Só o backend (service role) escreve. */
async function registrarIntervencao({ tipo, ref, contexto }) {
  try {
    const r = await sbFetch('/rest/v1/intervencoes_admin', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ tipo, ref: ref || null, contexto: contexto || {}, estado: 'pendente' }),
    });
    if (!r.ok) console.error(`[WEBHOOK] intervenção ${tipo} NÃO registada: HTTP ${r.status}`);
    return r.ok;
  } catch (e) {
    console.error('[WEBHOOK] intervenção falhou:', e.message || e);
    return false;
  }
}

/* ---------------- Associação comprador → utilizador (§3) ----------------
   Prioridade (nunca por nome):
     1. identificador explícito da conta Academy (se veio no payload)
     2. email exacto
     3. telefone/whatsapp normalizado (últimos 9 dígitos)
   Se 2+ utilizadores casam → AMBIGUIDADE → NUNCA liberar; registar caso. */
async function encontrarUtilizador(buyer, metadata) {
  const naoEncontrado = { ok: false, motivo: 'NAO_ENCONTRADO' };

  /* 1. Identificador explícito da conta Academy */
  const acctId = String(buyer?.academy_uid || buyer?.uid || buyer?.account_id || metadata?.academy_uid || '').trim();
  if (acctId) {
    const r = await sbFetch(`/rest/v1/utilizadores?id=eq.${encodeURIComponent(acctId)}&select=id,nome,email&limit=1`);
    if (r.ok && Array.isArray(r.body) && r.body.length === 1) return { ok: true, user: r.body[0] };
    /* Identificador fornecido mas que não corresponde a nenhuma conta real:
       nunca inventar utilizador — caso administrativo. */
    return { ok: false, motivo: 'IDENTIFICADOR_INVALIDO' };
  }

  /* 2. Email exacto (ignore-case) */
  const email = String(buyer?.email || '').trim().toLowerCase();
  if (email) {
    const r = await sbFetch(`/rest/v1/utilizadores?select=id,nome,email&email=eq.${encodeURIComponent(email)}`);
    if (r.ok && Array.isArray(r.body)) {
      if (r.body.length === 1) return { ok: true, user: r.body[0] };
      if (r.body.length > 1) return { ok: false, motivo: 'AMBIGUIDADE', candidatos: r.body.map(u => u.id) };
    }
  }

  /* 3. Telefone/WhatsApp NORMALIZADO (últimos 9 dígitos — sem país/separadores)
     A normalização é feita na DB (RPC utilisadores_por_telefone) — o valor
     cru pode ter espaços/parentesis ('+244 900 000 003') e ilike não casa. */
  const tel = String(buyer?.phone || '').replace(/\D/g, '');
  if (tel.length >= 9) {
    const sufixo = tel.slice(-9);
    try {
      const r = await sbFetch('/rest/v1/rpc/utilizadores_por_telefone', {
        method: 'POST',
        body: JSON.stringify({ p_sufixo: sufixo }),
      });
      if (r.ok && Array.isArray(r.body)) {
        if (r.body.length === 1) return { ok: true, user: r.body[0] };
        if (r.body.length > 1) return { ok: false, motivo: 'AMBIGUIDADE', candidatos: r.body.map(u => u.id) };
      }
    } catch (e) { console.error('[WEBHOOK] RPC telefone falhou:', e.message || e); }
  }

  return naoEncontrado;
}

/* ---------------- Localizar pagamento interno ---------------- */
async function localizarPagamento(order) {
  if (!order?.id) return null;
  const r = await sbFetch(`/rest/v1/pagamentos?vanqir_order_id=eq.${encodeURIComponent(order.id)}&select=id,estado,utilizador_id&limit=1`);
  if (r.ok && Array.isArray(r.body) && r.body.length) return r.body[0];
  if (order.order_number) {
    const r2 = await sbFetch(`/rest/v1/pagamentos?vanqir_order_number=eq.${encodeURIComponent(order.order_number)}&select=id,estado,utilizador_id&limit=1`);
    if (r2.ok && Array.isArray(r2.body) && r2.body.length) return r2.body[0];
  }
  return null;
}

/* ---------------- order.paid ---------------- */
async function processarOrderPaid(deliveryId, data) {
  const order = data?.order;
  if (!order || !order.id) return { status: STATUS.FAILED, erro: 'SEM_ORDEM' };

  /* 1. Identificadores oficiais da oferta (§5) — preferir offer_id/product_id,
        NUNCA inferir o pacote apenas pelo valor pago */
  const oferta = extractOferta(data);
  const identificador = oferta.offerId || oferta.productId;
  if (!identificador) {
    await registrarIntervencao({
      tipo: 'PACOTE_NAO_MAPEADO',
      ref: order.id,
      contexto: { order_id: order.id, order_number: order.order_number, total_amount: order.total_amount, buyer_email: order.buyer?.email, motivo: 'SEM_IDENTIFICADOR_OFICIAL' },
    });
    return { status: STATUS.IGNORED, erro: 'SEM_IDENTIFICADOR_OFICIAL' };
  }

  /* 2. Validação do produto Vanqir (env + precos/planos_grafica)
     Refresh forçado da cache se não bater — a DB pode ter sido atualizada
     há instantes (mapeamento novo do admin) */
  let cfg = await produtosConfig();
  if (!cfg.ids.has(identificador)) {
    cfg = await produtosConfig(true);
  }
  if (!cfg.ids.has(identificador)) {
    await registrarIntervencao({
      tipo: 'PACOTE_NAO_MAPEADO',
      ref: order.id,
      contexto: { order_id: order.id, order_number: order.order_number, product_id: oferta.productId, offer_id: oferta.offerId, offer_name: oferta.offerName, total_amount: order.total_amount, buyer_email: order.buyer?.email },
    });
    return { status: STATUS.IGNORED, erro: 'PACOTE_NAO_MAPEADO' };
  }
  const mapProduto = cfg.map.get(identificador);

  /* 3. Transação (idempotente por order_id+event) — valores históricos */
  await registarTransacao(deliveryId, 'order.paid', data, order, oferta);

  /* 4. Pagamento interno: procura por vanqir_order_id/order_number */
  let pagamento = await localizarPagamento(order);

  if (!pagamento) {
    /* 5. Associação comprador → utilizador (§3): nunca por nome, nunca ambígua */
    const assoc = await encontrarUtilizador(order.buyer, data.metadata);
    if (!assoc.ok) {
      await registrarIntervencao({
        tipo: assoc.motivo === 'AMBIGUIDADE' ? 'UTILIZADOR_AMBIGUO' : 'UTILIZADOR_NAO_ENCONTRADO',
        ref: order.id,
        contexto: {
          order_id: order.id, order_number: order.order_number, total_amount: order.total_amount,
          buyer_email: order.buyer?.email, buyer_phone: order.buyer?.phone,
          motivo: assoc.motivo, candidatos: assoc.candidatos || null,
        },
      });
      /* Pagamento válido, mas sem libertação automática — intervenção administrativa */
      return { status: STATUS.PROCESSED, erro: `SEM_LIBERTACAO_${assoc.motivo}`, semAcesso: true };
    }
    const user = assoc.user;
    const valor = order.total_amount != null ? Number(order.total_amount) : (mapProduto?.preco || 0);
    const r = await sbFetch('/rest/v1/pagamentos', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        ref: 'VANQIR-' + (order.order_number || order.id),
        uid: user.id,
        utilizador_id: user.id,
        nome: order.buyer?.name || user.nome || 'Cliente Vanqir',
        whatsapp: order.buyer?.phone || null,
        tipo: mapProduto?.tipo || 'avulso',
        num_pags: mapProduto?.numPags || 15,
        valor,
        moeda: 'AOA',
        metodo: 'vanqir',
        estado: 'pendente',
        criado_em: order.paid_at || new Date().toISOString(),
        vanqir_order_id: order.id,
        vanqir_order_number: order.order_number || null,
        vanqir_delivery_id: deliveryId,
      }),
    });
    pagamento = r.ok && Array.isArray(r.body) && r.body.length ? r.body[0] : null;
  }

  /* 6. Aprovação exclusivamente pelo backend (service role) */
  if (pagamento?.id) {
    const up = await sbFetch(`/rest/v1/pagamentos?id=eq.${encodeURIComponent(pagamento.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: 'aprovado', processado_em: new Date().toISOString() }),
    });
    if (!up.ok) return { status: STATUS.FAILED, erro: 'APROVACAO_FALHOU' };
  }

  return { status: STATUS.PROCESSED };
}

/* ---------------- order.refunded ---------------- */
async function processarOrderRefunded(deliveryId, data) {
  const order = data?.order;
  if (!order || !order.id) return { status: STATUS.FAILED, erro: 'SEM_ORDEM' };

  const oferta = extractOferta(data);

  /* Regista o refund (não apaga nada — histórico auditável) */
  await registarTransacao(deliveryId, 'order.refunded', data, order, oferta);

  /* Localiza o pagamento e assinala reembolso (sem apagar registos) */
  const pagamento = await localizarPagamento(order);
  if (pagamento?.id) {
    await sbFetch(`/rest/v1/pagamentos?id=eq.${encodeURIComponent(pagamento.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ estado: 'reembolsado' }),
    });
    await registrarIntervencao({
      tipo: 'REVOGACAO_ACESSO_PENDENTE',
      ref: order.id,
      contexto: { order_id: order.id, pagamento_id: pagamento.id, utilizador_id: pagamento.utilizador_id, total_amount: order.total_amount },
    });
  } else {
    await registrarIntervencao({
      tipo: 'REVOGACAO_ACESSO_PENDENTE',
      ref: order.id,
      contexto: { order_id: order.id, order_number: order.order_number, motivo: 'SEM_PAGAMENTO_LOCALIZADO' },
    });
  }

  /* NOTA: revogação efectiva do acesso (créditos já activados no cliente)
     fica identificada como etapa PENDENTE — não inventar comportamento. */
  return { status: STATUS.PROCESSED, pendente: 'REVOGACAO_ACESSO' };
}

/* ---------------- Log-only (product.* / webhook.test / account events) ---------------- */
function processarLogOnly() {
  return { status: STATUS.PROCESSED };
}

/* ---------------- Handler principal ---------------- */
async function handler(req, res) {
  const inicio = Date.now();
  const respond = (status, body) => {
    try { if (!res.headersSent) res.status(status).json(body); } catch { /* ignore */ }
    console.log(`[WEBHOOK] ${status} ${body?.estado || ''} ${Date.now() - inicio}ms`);
  };

  /* 1. Corpo em bruto (obrigatório para a assinatura) */
  const rawBody = await obterRawBody(req);
  if (rawBody === null) return respond(400, { ok:false, erro:'SEM_RAW_BODY' });

  /* 2. Assinatura (HMAC + replay) — 401 e NÃO processa */
  const sig = verificarAssinatura(rawBody, req.headers['x-vanqir-signature']);
  if (!sig.ok) return respond(401, { ok:false, erro:sig.motivo });

  /* 3. Envelope */
  let payload = null;
  try { payload = JSON.parse(rawBody); } catch { return respond(400, { ok:false, erro:'JSON_INVALIDO' }); }
  const envErro = validarEnvelope(payload);
  if (envErro) return respond(400, { ok:false, erro:envErro });

  /* 4. Header event vs payload.event */
  const hdrEvent = req.headers['x-vanqir-event'];
  if (hdrEvent && hdrEvent !== payload.event) return respond(400, { ok:false, erro:'EVENT_HEADER_DIVERGENTE' });

  /* 5. Idempotência: delivery_id = X-Vanqir-Delivery || payload.id */
  const deliveryId = req.headers['x-vanqir-delivery'] || payload.id;
  const attempt = Number(req.headers['x-vanqir-attempt']) || 1;

  /* Sem Supabase configurado → não consegue persistir */
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return respond(500, { ok:false, erro:'SEM_SUPABASE' });
  }

  try {
    /* RECEIVED (ou já existente → idempotente) */
    const existente = await logExiste(deliveryId, payload.event);
    if (existente) {
      if (['PROCESSED','IGNORED','PROCESSING'].includes(existente.status)) {
        return respond(200, { ok:true, idempotente:true, estado: existente.status });
      }
      /* FAILED → nova tentativa da Vanqir: reset para RECEIVED e reprocessa */
      await logUpdate(deliveryId, payload.event, STATUS.RECEIVED);
    } else {
      const ins = await logInsert(deliveryId, payload.event, attempt);
      if (!ins.ok && ins.status !== 409) return respond(500, { ok:false, erro:'LOG_INSERT_FALHOU' });
    }

    await logUpdate(deliveryId, payload.event, STATUS.PROCESSING);

    /* 6. Roteamento por evento */
    let resultado = null;
    switch (payload.event) {
      case 'order.paid':        resultado = await processarOrderPaid(deliveryId, payload.data); break;
      case 'order.refunded':    resultado = await processarOrderRefunded(deliveryId, payload.data); break;
      case 'product.approved':
      case 'product.rejected':  resultado = processarLogOnly(); break;
      case 'webhook.test':      resultado = processarLogOnly(); break;
      /* Eventos de conta — não chegam a webhook de produto; registar apenas */
      case 'withdrawal.approved':
      case 'withdrawal.paid':
      case 'kyc.approved':
      case 'kyc.rejected':      resultado = { status: STATUS.IGNORED }; break;
      default:                  resultado = { status: STATUS.IGNORED, erro:'EVENTO_DESCONHECIDO' };
    }

    /* 7. Estado final */
    const finalStatus = resultado?.status || STATUS.FAILED;
    if (finalStatus === STATUS.PROCESSED || finalStatus === STATUS.IGNORED) {
      await logUpdate(deliveryId, payload.event, finalStatus, resultado?.erro ? { error: resultado.erro } : {});
      return respond(200, {
        ok: true, estado: finalStatus, event: payload.event,
        ...(resultado?.erro     ? { erro: resultado.erro }     : {}),
        ...(resultado?.semAcesso ? { semAcesso: true }          : {}),
      });
    }
    /* FAILED → erro interno, deixar a Vanqir re-tentar */
    await logUpdate(deliveryId, payload.event, STATUS.FAILED, { error: resultado?.erro || 'PROCESSAMENTO_FALHOU' });
    return respond(500, { ok:false, erro: resultado?.erro || 'PROCESSAMENTO_FALHOU' });
  } catch (e) {
    console.error('[WEBHOOK] erro:', e.message || e);
    try { await logUpdate(deliveryId, payload.event, STATUS.FAILED, { error: String(e.message || e).slice(0, 300) }); } catch { /* sem log */ }
    return respond(500, { ok:false, erro:'INTERNO' });
  }
}

export default handler;
export { handler };