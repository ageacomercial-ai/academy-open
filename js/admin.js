/* ═══════════════════════════════════════════════════════════
   ACADEMY — ADMIN.JS
   Painel de administrador: senhas, pagamentos, estatísticas.
   Acesso por 7 toques no logo → autenticação por PIN.
   Depende de: state.js, supabase.js, auth.js, navigation.js
═══════════════════════════════════════════════════════════ */

let _adminSenhaActual = '';
let _adminTipoActual  = '';

/* ════════════════════════════════════════════════════════════
   ECRÃ ADMIN — RENDER PRINCIPAL
════════════════════════════════════════════════════════════ */
function sAdmin() {
  const historico = LS.get('senhas_geradas') || [];
  const sbStatus  = _sbConectado === true
    ? '🟢 Supabase ligado'
    : _sbConectado === false
      ? '🔴 Supabase offline'
      : '⚪ A verificar…';

  return `
  <!-- Badge Admin -->
  <div style="background:rgba(251,191,36,.06);border:.5px solid rgba(251,191,36,.2);border-radius:var(--r2);padding:12px;margin-bottom:16px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.14em;color:#FBBF24;margin-bottom:4px">⚡ PAINEL DE ADMINISTRADOR</div>
    <div style="font-size:12px;color:var(--t3);margin-bottom:6px">Grupo AGEA Comercial · CEO Adelino Graça</div>
    <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.06em">${sbStatus}</div>
  </div>

  <!-- Pagamentos Pendentes -->
  <div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.14em;color:var(--t3);text-transform:uppercase">⏳ Pedidos de Pagamento</div>
      <button onclick="loadAdminPendentes()" style="font-family:var(--fm);font-size:8px;color:var(--b);background:none;border:none;cursor:pointer;letter-spacing:.06em">↺ Actualizar</button>
    </div>
    <div id="sb-pendentes" style="min-height:48px">
      <div style="font-size:12px;color:var(--t3);padding:12px;background:var(--z3);border-radius:var(--r2);text-align:center">A carregar...</div>
    </div>
  </div>

  <!-- Gerar Senha -->
  <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);margin-bottom:10px;text-transform:uppercase">🔑 Gerar Senha de Acesso</div>
  <label class="lbl">Tipo de Acesso</label>
  <select class="inp" id="adminTipo" style="margin-bottom:12px">
    ${Object.entries(SENHA_TIPOS).map(([id, t]) =>
      `<option value="${id}">${t.desc} — ${(t.preco || t.valor || PLANOS_DEF[t.plano]?.preco || 0).toLocaleString()} Kz</option>`
    ).join('')}
  </select>

  <button class="btn B w" onclick="adminGerarSenha()" style="font-size:15px;padding:14px;margin-bottom:16px">
    ⚡ Gerar Nova Senha
  </button>

  <!-- Senha Gerada -->
  <div id="adminSenhaGerada" style="display:none;background:rgba(63,255,160,.06);border:.5px solid var(--eb);border-radius:var(--r);padding:16px;margin-bottom:20px;text-align:center">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.1em;color:var(--t3);margin-bottom:8px">SENHA GERADA</div>
    <div id="adminSenhaTexto" style="font-size:22px;font-weight:800;color:var(--b);letter-spacing:.12em;margin-bottom:12px;font-family:var(--fm)"></div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="btn B s" onclick="adminCopiar()">📋 Copiar</button>
      <button class="btn G s" onclick="adminWhatsApp()">💬 WhatsApp</button>
    </div>
  </div>

  <!-- Histórico de Senhas -->
  <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);margin-bottom:10px;text-transform:uppercase">Últimas senhas geradas</div>
  <div style="display:flex;flex-direction:column;gap:6px">
    ${historico.slice(0, 10).map(h => `
    <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r2);padding:10px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-family:var(--fm);font-size:10px;color:var(--b);letter-spacing:.08em">${h.senha}</div>
        <div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-top:2px">${h.desc} · ${h.data}</div>
      </div>
      <div style="font-size:9px;color:${h.usada ? '#f87171' : 'var(--b)'}">${h.usada ? 'USADA' : '✓ OK'}</div>
    </div>`).join('') || `<div style="font-size:13px;color:var(--t3)">Nenhuma senha gerada ainda.</div>`}
  </div>

  <!-- Estatísticas -->
  <div style="margin-top:20px;padding:16px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r)">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);margin-bottom:12px;text-transform:uppercase">📊 Estatísticas da Sessão</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${[
        ['Documentos criados', getDocs().length],
        ['Plano activo',       PLANOS_DEF[planoActivo()]?.n || 'Gratuito'],
        ['Utilizador',        State.get('u')?.nome || '—'],
        ['ID Supabase',       sbUserId().substring(0, 12) + '…'],
      ].map(([l, v]) => `
      <div style="background:var(--z3);border-radius:var(--r2);padding:10px">
        <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em;margin-bottom:4px">${l.toUpperCase()}</div>
        <div style="font-size:12px;font-weight:600;color:var(--t1)">${v}</div>
      </div>`).join('')}
    </div>
  </div>

  ${RODAPE_HTML}`;
}

/* ════════════════════════════════════════════════════════════
   ACÇÕES DE ADMIN
════════════════════════════════════════════════════════════ */
function adminGerarSenha() {
  const tipo  = document.getElementById('adminTipo')?.value;
  if (!tipo) return;
  const senha = gerarSenha(tipo);
  if (!senha) return;
  _adminSenhaActual = senha;
  _adminTipoActual  = tipo;

  document.getElementById('adminSenhaGerada').style.display = 'block';
  document.getElementById('adminSenhaTexto').textContent    = senha;

  /* Guardar no histórico local */
  const hist = LS.get('senhas_geradas') || [];
  hist.unshift({
    senha, desc: SENHA_TIPOS[tipo]?.desc || tipo,
    data: new Date().toLocaleDateString('pt-PT'), usada: false,
  });
  LS.set('senhas_geradas', hist.slice(0, 50));
}

function adminCopiar() {
  navigator.clipboard?.writeText(_adminSenhaActual)
    .then(() => mostrarToast('✓ Senha copiada!'));
}

function adminWhatsApp() {
  const tipo = SENHA_TIPOS[_adminTipoActual];
  const msg  = encodeURIComponent(
    `Olá! Aqui está a tua senha de acesso ao ACADEMY:\n\n*${_adminSenhaActual}*\n\n` +
    `✓ Válida para: ${tipo?.desc || 'Acesso'}\n\n` +
    `Como activar:\n1. Abre o ACADEMY\n2. Vai a Planos → "Activar com Senha"\n3. Insere o código acima\n\n` +
    `Grupo AGEA Comercial`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

/* ════════════════════════════════════════════════════════════
   CARREGAR PAGAMENTOS PENDENTES
════════════════════════════════════════════════════════════ */
async function loadAdminPendentes() {
  const el = document.getElementById('sb-pendentes');
  if (!el) return;

  el.innerHTML = `<div style="font-size:12px;color:var(--t3);padding:12px;background:var(--z3);border-radius:var(--r2);text-align:center">🔄 A carregar pagamentos…</div>`;

  const rows = await sbGetPendentes();

  if (!rows || !rows.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--t3);padding:14px;background:var(--z3);border-radius:var(--r2);text-align:center">✓ Nenhum pagamento pendente de aprovação</div>`;
    return;
  }

  el.innerHTML = rows.map(r => {
    const data  = r.criado_em ? new Date(r.criado_em).toLocaleString('pt-PT') : '—';
    const tipo  = r.tipo === 'plano'
      ? `Plano ${(r.plano || '').toUpperCase()}`
      : `${r.num_pags || '?'} páginas (avulso)`;
    const nome  = r.utilizador_nome || r.nome || 'Desconhecido';
    const wa    = r.utilizador_whatsapp || r.whatsapp || null;
    const email = r.utilizador_email   || r.email    || null;
    const nivel = r.utilizador_nivel   || r.nivel    || null;
    const valor = r.valor || 0;

    return `
    <div id="pag-${r.id}" style="background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r);padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:2px">${nome}</div>
          ${email ? `<div style="font-family:var(--fm);font-size:8px;color:var(--o)">✉ ${email}</div>` : ''}
          ${wa    ? `<div style="font-family:var(--fm);font-size:8px;color:var(--t3)">${wa}</div>` : ''}
          ${nivel ? `<div style="font-family:var(--fm);font-size:8px;color:var(--t3)">${nivel}</div>` : ''}
          <div style="font-family:var(--fm);font-size:8px;color:var(--t4);margin-top:2px">${data}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:10px">
          <div style="font-size:20px;font-weight:800;color:var(--b);line-height:1">${valor.toLocaleString()} Kz</div>
          <div style="font-family:var(--fm);font-size:8px;color:var(--o);margin-top:4px">${tipo}</div>
          <div style="font-family:var(--fm);font-size:7px;color:var(--t3);margin-top:2px">${(r.ref || r.id || '').substring(0, 14)}</div>
        </div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:2px">
        ${wa ? `<a href="https://wa.me/${wa.replace(/\D/g,'')}" target="_blank" class="btn B s" style="font-size:10px;text-decoration:none">💬 WhatsApp</a>` : ''}
        <button class="btn B s" style="font-size:10px" onclick="adminAprovar('${r.id}','${r.tipo || 'avulso'}','${r.plano || ''}',${r.num_pags || 15},${r.meses || 1},'${nome}','${wa || ''}')">✓ Aprovar</button>
        <button class="btn G s" style="font-size:10px;border-color:rgba(248,113,113,.3);color:#f87171" onclick="adminRejeitar('${r.id}')">✕ Rejeitar</button>
      </div>
    </div>`;
  }).join('');
}

/* ── Aprovar pagamento ── */
async function adminAprovar(id, tipo, plano, numPags, meses, nome, wa) {
  const card = document.getElementById(`pag-${id}`);
  if (card) card.style.opacity = '.5';
  await sbAprovar(id);

  /* Gerar senha automática para enviar ao cliente */
  let senhaGerada = '';
  try {
    if (tipo === 'plano' && plano) {
      const mapPlano = { estudante: 'EST', grafica: 'GRF', premium: 'PREM' };
      const tipoSenha = mapPlano[plano] || 'EST';
      senhaGerada = gerarSenha(tipoSenha);
    } else {
      const mapPags = { 15: 'C15', 30: 'C30', 200: 'C200', 500: 'C500', 1000: 'C1K' };
      const chave   = Object.keys(mapPags).find(k => parseInt(k) >= numPags) || '1000';
      senhaGerada   = gerarSenha(mapPags[chave] || 'C15');
    }
  } catch (e) {
    console.warn('[ADMIN] gerarSenha err:', e);
  }

  /* Guardar senha no histórico */
  if (senhaGerada) {
    const hist = LS.get('senhas_geradas') || [];
    hist.unshift({ senha: senhaGerada, desc: `Aprovação: ${nome}`, data: new Date().toLocaleDateString('pt-PT'), usada: false });
    LS.set('senhas_geradas', hist.slice(0, 50));
  }

  mostrarToast(`✓ Pagamento de ${nome} aprovado.`);

  /* Actualizar UI do card */
  if (card) {
    card.style.opacity  = '1';
    card.style.border   = '.5px solid rgba(67,232,167,.3)';
    card.style.background = 'rgba(67,232,167,.04)';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:4px 0">
        <div style="font-size:20px">✅</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--b)">${nome} — Aprovado</div>
          ${senhaGerada ? `
          <div style="font-family:var(--fm);font-size:11px;color:var(--t2);margin-top:4px">Senha: <strong style="color:var(--b)">${senhaGerada}</strong></div>
          <div style="display:flex;gap:7px;margin-top:8px">
            <button class="btn B s" style="font-size:10px" onclick="navigator.clipboard?.writeText('${senhaGerada}').then(()=>mostrarToast('✓ Copiada!'))">📋 Copiar senha</button>
            ${wa ? `<a href="https://wa.me/${wa.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${nome}! Aqui está a tua senha ACADEMY:\n\n*${senhaGerada}*\n\nActivar em: Planos → "Activar com Senha"\n\nGrupo AGEA Comercial`)}" target="_blank" class="btn G s" style="font-size:10px;text-decoration:none">💬 Enviar WA</a>` : ''}
          </div>` : ''}
        </div>
      </div>`;
  }
}

/* ── Rejeitar pagamento ── */
async function adminRejeitar(id) {
  if (!confirm('Rejeitar este pagamento?')) return;
  const card = document.getElementById(`pag-${id}`);
  if (card) card.style.opacity = '.4';
  await sbRejeitar(id);
  mostrarToast('Pagamento rejeitado.');
  if (card) setTimeout(() => card.remove(), 800);
}

/* ════════════════════════════════════════════════════════════
   AUTH DO ADMIN (PIN via Edge Function)
════════════════════════════════════════════════════════════ */
function _abrirAdminAuth() {
  const modal = document.createElement('div');
  modal.id = 'adminAuthModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.85);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;padding:24px';
  modal.innerHTML = `
    <div style="background:var(--z2);border:1.5px solid rgba(251,191,36,.3);border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center">
      <div style="font-size:28px;margin-bottom:12px">🔐</div>
      <div style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:6px">Acesso Restrito</div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:18px">Introduz o PIN de administrador</div>
      <input id="adminPinInp" type="password" class="inp" placeholder="PIN de acesso"
        style="margin-bottom:14px;text-align:center;letter-spacing:.3em;font-size:20px"
        maxlength="10"
        onkeydown="if(event.key==='Enter')_verificarAdminPin()"/>
      <button class="btn B w" onclick="_verificarAdminPin()" id="adminPinBtn">Entrar →</button>
      <div id="adminPinErro" style="margin-top:10px;font-family:var(--fm);font-size:10px;color:#f87171;display:none">PIN incorrecto. Tenta novamente.</div>
      <button onclick="document.getElementById('adminAuthModal').remove()" class="btn G w" style="margin-top:8px">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('adminPinInp')?.focus(), 100);
}

async function _verificarAdminPin() {
  const inp = document.getElementById('adminPinInp');
  const btn = document.getElementById('adminPinBtn');
  const err = document.getElementById('adminPinErro');
  const pin = inp?.value?.trim();
  if (!pin) return;

  if (btn) { btn.disabled = true; btn.textContent = 'A verificar…'; }

  const ok = await _verificarCredenciaisAdmin('', pin);

  if (ok) {
    document.getElementById('adminAuthModal')?.remove();
    irPara('admin');
  } else {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar →'; }
    if (err) err.style.display = 'block';
    if (inp) { inp.value = ''; inp.focus(); }
  }
}
