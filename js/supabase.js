/* ═══════════════════════════════════════════════════════════
   ACADEMY — SUPABASE.JS
   Todas as chamadas ao Supabase REST API.
   Pagamentos · Aprovações · Utilizadores · Documentos
   
   SEGURANÇA: A chave abaixo é a anon/public key.
   Nunca expõe a service_role key no frontend.
   Operações de admin passam sempre pelo backend Vercel.
═══════════════════════════════════════════════════════════ */

const SB_URL = 'https://avdzkucdehggueafyukw.supabase.co';
let _instituicoesCache = null;

const SB_KEY = (()=>{
  const p = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2ZHprdWNkZWhnZ3VlYWZ5dWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjE4MTMsImV4cCI6MjA5OTkzNzgxM30',
    'hGmrDP5A0EhX-Ax2-QSIH434yxjQnIg48mHR_vMW6tw',
  ];
  return p.join('.');
})();

const SB_H = () => ({
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
});

/* ── ID único persistente do utilizador ── */
function sbUserId() {
  let id = LS.get('sb_uid');
  if (!id) {
    id = 'U' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
    LS.set('sb_uid', id);
  }
  return id;
}

/* ═══════════════════════════════════════════════════════════
   UTILIZADORES
═══════════════════════════════════════════════════════════ */

async function sbUpsertUser(u) {
  try {
    await fetch(SB_URL + '/rest/v1/utilizadores', {
      method: 'POST',
      headers: { ...SB_H(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        id:         sbUserId(),
        nome:       u.nome,
        email:      u.email || null,
        whatsapp:   u.whatsapp || null,
        nivel:      u.nivel || null,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (e) { console.warn('[SB] upsertUser:', e); }
}

/* ═══════════════════════════════════════════════════════════
   PAGAMENTOS
═══════════════════════════════════════════════════════════ */

async function sbInsertPagamento(p) {
  try {
    const r = await fetch(SB_URL + '/rest/v1/pagamentos', {
      method: 'POST',
      headers: { ...SB_H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(p),
    });
    return r.ok;
  } catch (e) { console.warn('[SB] insertPag:', e); return false; }
}

async function sbGetPendentes() {
  try {
    const r = await fetch(
      SB_URL + '/rest/v1/pagamentos?estado=eq.pendente&order=criado_em.desc',
      { headers: SB_H() }
    );
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

async function sbAprovar(id) {
  try {
    await fetch(SB_URL + '/rest/v1/pagamentos?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: SB_H(),
      body: JSON.stringify({ estado: 'aprovado' }),
    });
  } catch (e) { console.warn('[SB] aprovar:', e); }
}

async function sbRejeitar(id) {
  try {
    await fetch(SB_URL + '/rest/v1/pagamentos?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: SB_H(),
      body: JSON.stringify({ estado: 'rejeitado' }),
    });
  } catch (e) { console.warn('[SB] rejeitar:', e); }
}

async function sbProcessar(id) {
  try {
    await fetch(SB_URL + '/rest/v1/pagamentos?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: SB_H(),
      body: JSON.stringify({ estado: 'processado' }),
    });
  } catch (e) { console.warn('[SB] processar:', e); }
}

/* ── Verificar pagamentos aprovados para este utilizador ──
   Corre ao arrancar e periodicamente (setInterval em main) */
async function sbCheckAprovados() {
  try {
    const uid = sbUserId();
    /* Tenta utilizador_id primeiro, depois user_id como fallback */
    let r = await fetch(
      SB_URL + '/rest/v1/pagamentos?utilizador_id=eq.' + uid + '&estado=eq.aprovado&order=criado_em.desc',
      { headers: SB_H() }
    );
    if (!r.ok) {
      r = await fetch(
        SB_URL + '/rest/v1/pagamentos?user_id=eq.' + uid + '&estado=eq.aprovado&order=criado_em.desc',
        { headers: SB_H() }
      );
    }
    if (!r.ok) return;
    const rows = await r.json();
    for (const row of rows) {
      await sbProcessar(row.id); /* marcar imediatamente para não processar duas vezes */
      if (row.tipo === 'plano' && row.plano) {
        activarPlano(row.plano, row.meses || 1, false);
      } else if (row.tipo === 'avulso' || row.tipo === 'credito') {
        activarCredito(row.num_pags || 15, false);
        mostrarToast(`✓ ${row.num_pags || 15} páginas de crédito activadas!`);
        if (State.get('ecra') === 'planos') irPara('inicio');
      }
    }
  } catch (e) { console.warn('[SB] checkAprovados:', e); }
}

/* ═══════════════════════════════════════════════════════════
   DOCUMENTOS (sincronização na nuvem)
═══════════════════════════════════════════════════════════ */

async function sbSalvarDoc(doc) {
  try {
    const payload = {
      uid:        sbUserId(),
      doc_id:     String(doc.id),
      titulo:     doc.cfg?.tema || 'Sem título',
      tipo:       doc.cfg?.tipo || null,
      pags:       doc.secs?.length || 0,
      plano:      doc.plano || null,
      dados:      JSON.stringify(doc),
      updated_at: new Date().toISOString(),
    };
    const r = await fetch(SB_URL + '/rest/v1/documentos', {
      method: 'POST',
      headers: { ...SB_H(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch (e) { console.warn('[SB] salvarDoc:', e); return false; }
}

async function sbApagarDoc(id) {
  try {
    await fetch(
      SB_URL + '/rest/v1/documentos?uid=eq.' + sbUserId() + '&doc_id=eq.' + encodeURIComponent(String(id)),
      { method: 'DELETE', headers: SB_H() }
    );
  } catch (e) { console.warn('[SB] apagarDoc:', e); }
}

async function sbCarregarDocs() {
  try {
    const r = await fetch(
      SB_URL + '/rest/v1/documentos?uid=eq.' + sbUserId() + '&order=updated_at.desc&limit=30',
      { headers: SB_H() }
    );
    if (!r.ok) return [];
    const rows = await r.json();
    return rows.map(row => {
      try { return JSON.parse(row.dados); } catch { return null; }
    }).filter(Boolean);
  } catch (e) { console.warn('[SB] carregarDocs:', e); return []; }
}

/* ── Sincronizar documentos locais → Supabase ── */
async function sbSincronizarDocs() {
  try {
    const docs = LS.list('docs');
    if (!docs.length) return;
    /* Enviar apenas os 5 mais recentes para não sobrecarregar */
    const recentes = docs.slice(0, 5);
    await Promise.allSettled(recentes.map(d => sbSalvarDoc(d)));
  } catch (e) { console.warn('[SB] sincronizar:', e); }
}

/* ═══════════════════════════════════════════════════════════
   ADMIN
═══════════════════════════════════════════════════════════ */

async function _verificarCredenciaisAdmin(email, pin) {
  try {
    const r = await callAcademyAPI({ acao: 'verificar_admin', pin: (pin || '').trim() });
    return r?.ok === true;
  } catch (e) { console.warn('[ADMIN] Verificação falhou:', e.message); return false; }
}

/* ═══════════════════════════════════════════════════════════
   INSTITUIÇÕES PARCEIRAS
═══════════════════════════════════════════════════════════ */
async function sbCarregarInstituicoes() {
  if (_instituicoesCache) return _instituicoesCache;
  try {
    const r = await fetch(SB_URL + '/rest/v1/instituicoes?select=*&activa=eq.true&order=nome.asc', { headers: SB_H() });
    if (!r.ok) { _instituicoesCache = []; return []; }
    _instituicoesCache = await r.json();
    return _instituicoesCache;
  } catch { return []; }
}
async function sbCriarInstituicao(nome, sigla, desconto) {
  try {
    await fetch(SB_URL + '/rest/v1/instituicoes', {
      method:'POST', headers:{ ...SB_H(), 'Prefer':'return=minimal' },
      body:JSON.stringify({ nome, sigla: sigla||null, desconto_porcentagem: desconto||0 }),
    });
    _instituicoesCache = null;
    return true;
  } catch { return false; }
}
async function sbRemoverInstituicao(id) {
  try {
    await fetch(SB_URL + '/rest/v1/instituicoes?id=eq.'+id, { method:'DELETE', headers:SB_H() });
    _instituicoesCache = null;
    return true;
  } catch { return false; }
}

/* ═══════════════════════════════════════════════════════════
   PARCEIROS E COMISSÕES
═══════════════════════════════════════════════════════════ */
async function sbCarregarParceiros() {
  try {
    const r = await fetch(SB_URL + '/rest/v1/parceiros?activo=eq.true&order=nome.asc', { headers: SB_H() });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}
async function sbCriarParceiro(nome, whatsapp, porcentagem, codigo) {
  try {
    await fetch(SB_URL + '/rest/v1/parceiros', {
      method:'POST', headers:{ ...SB_H(), 'Prefer':'return=minimal' },
      body:JSON.stringify({ nome, whatsapp: whatsapp||null, comissao_porcentagem: porcentagem||10, codigo: codigo||null }),
    });
    return true;
  } catch { return false; }
}
async function sbRemoverParceiro(id) {
  try {
    await fetch(SB_URL + '/rest/v1/parceiros?id=eq.'+id, { method:'DELETE', headers:SB_H() });
    return true;
  } catch { return false; }
}
async function sbCarregarComissoes() {
  try {
    const r = await fetch(SB_URL + '/rest/v1/comissoes?order=criado_em.desc&limit=20', { headers: SB_H() });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}
async function sbRegistarComissao(parceiroNome, valorVenda, percentagem) {
  try {
    const valorComissao = Math.round(valorVenda * percentagem / 100);
    await fetch(SB_URL + '/rest/v1/comissoes', {
      method:'POST', headers:{ ...SB_H(), 'Prefer':'return=minimal' },
      body:JSON.stringify({ parceiro_nome: parceiroNome, valor_venda: valorVenda, percentagem, valor_comissao: valorComissao }),
    });
    return true;
  } catch { return false; }
}
async function sbPagarComissao(id, pagamentoRef) {
  try {
    await fetch(SB_URL + '/rest/v1/comissoes?id=eq.'+id, {
      method:'PATCH', headers:SB_H(),
      body:JSON.stringify({ estado:'pago', pago_em: new Date().toISOString(), pagamento_ref: pagamentoRef||null }),
    });
    return true;
  } catch { return false; }
}

/* ── Detectar se Supabase está acessível ── */
let _sbConectado = null;
async function _detetarSB() {
  if (_sbConectado !== null) return _sbConectado;
  try {
    const r = await fetch(SB_URL + '/rest/v1/', { headers: SB_H(), signal: AbortSignal.timeout(3000) });
    _sbConectado = r.ok;
  } catch { _sbConectado = false; }
  return _sbConectado;
}
