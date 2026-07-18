/* ═══════════════════════════════════════════════════════════
   ACADEMY v15 — ADMIN.JS
   Painel tabulado profissional. Áreas separadas, tipografia clara.
═══════════════════════════════════════════════════════════ */

let _adminSenhaActual = '';
let _adminTipoActual  = '';
let _adminAba = 'dashboard';

const _ADMIN_ABAS = [
  { id:'dashboard',  ic:'📊', n:'Dashboard' },
  { id:'pagamentos', ic:'💳', n:'Pagamentos' },
  { id:'senhas',     ic:'🔑', n:'Senhas' },
  { id:'precos',     ic:'💰', n:'Preços' },
  { id:'ia',         ic:'🤖', n:'IA' },
  { id:'parceiros',  ic:'🏫', n:'Parceiros' },
  { id:'relatorios', ic:'📋', n:'Relatórios' },
];

function mudarAdminAba(id) {
  _adminAba = id;
  renderizar();
}

/* ════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
════════════════════════════════════════════════════════════ */
function sAdmin() {
  const historico = LS.get('senhas_geradas') || [];
  const sbStatus  = _sbConectado === true ? '🟢 Ligado' : _sbConectado === false ? '🔴 Offline' : '⚪…';

  return `
  <div style="background:linear-gradient(135deg,rgba(251,191,36,.08),rgba(251,191,36,.02));border:.5px solid rgba(251,191,36,.18);border-radius:14px;padding:14px 16px;margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--t1)">⚡ Administração</div>
        <div style="font-size:12px;color:var(--t3);margin-top:2px">Grupo AGEA Comercial · CEO Adelino Graça</div>
      </div>
      <div style="font-family:var(--fm);font-size:10px;color:var(--t3);padding:4px 12px;background:var(--z3);border-radius:8px">${sbStatus}</div>
    </div>
  </div>

  <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:8px;margin-bottom:14px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
    ${_ADMIN_ABAS.map(a => `
    <div onclick="mudarAdminAba('${a.id}')" style="flex-shrink:0;padding:9px 14px;border-radius:10px;background:${_adminAba===a.id?'var(--b)':'var(--z3)'};color:${_adminAba===a.id?'var(--t-inv)':'var(--t2)'};font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap">
      ${a.ic} ${a.n}
    </div>`).join('')}
  </div>

  ${_adminAba === 'dashboard'   ? _adminSecDashboard() : ''}
  ${_adminAba === 'pagamentos'  ? _adminSecPagamentos() : ''}
  ${_adminAba === 'senhas'      ? _adminSecSenhas(historico) : ''}
  ${_adminAba === 'precos'      ? _adminSecPrecos() : ''}
  ${_adminAba === 'ia'          ? _adminSecIA() : ''}
  ${_adminAba === 'parceiros'   ? _adminSecParceiros() : ''}
  ${_adminAba === 'relatorios'  ? _adminSecRelatorios() : ''}

  ${RODAPE_HTML}`;
}

/* ════════════════════════════════════════════════════════════
   SECÇÕES
════════════════════════════════════════════════════════════ */

function _adminSecDashboard() {
  return `
  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--t1)">📊 Dashboard Global</div>
      <button onclick="carregarDashboard()" style="font-size:11px;color:var(--b);background:none;border:none;cursor:pointer;font-weight:600">↺ Actualizar</button>
    </div>
    <div id="adminDashboard" style="min-height:60px">
      <div style="font-size:13px;color:var(--t3);padding:20px;text-align:center">A carregar...</div>
    </div>
    <div style="margin-top:16px;padding-top:14px;border-top:.5px solid var(--e0)">
      <div style="font-size:12px;font-weight:600;color:var(--t3);margin-bottom:12px">💻 Sessão Actual</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[
          ['Documentos', getDocs().length],
          ['Plano', PLANOS_DEF[planoActivo()]?.n || 'Gratuito'],
          ['Utilizador', State.get('u')?.nome?.substring(0,18)||'—'],
          ['ID Supabase', sbUserId().substring(0,10)+'…'],
        ].map(([l,v]) => `
        <div style="background:var(--z3);border-radius:8px;padding:12px">
          <div style="font-size:9px;font-family:var(--fm);color:var(--t3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">${l}</div>
          <div style="font-size:14px;font-weight:700;color:var(--t1)">${v}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function _adminSecPagamentos() {
  return `
  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--t1)">💳 Pedidos de Pagamento</div>
      <button onclick="loadAdminPendentes()" style="font-size:11px;color:var(--b);background:none;border:none;cursor:pointer;font-weight:600">↺ Actualizar</button>
    </div>
    <div id="sb-pendentes" style="min-height:48px">
      <div style="font-size:13px;color:var(--t3);padding:20px;background:var(--z3);border-radius:8px;text-align:center">A carregar...</div>
    </div>
  </div>`;
}

function _adminSecSenhas(historico) {
  return `
  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:14px">🔑 Gerar Senha de Acesso</div>
    <label class="lbl" style="font-size:11px">Tipo</label>
    <select class="inp" id="adminTipo" style="margin-bottom:12px;font-size:13px;padding:10px 12px">
      ${Object.entries(SENHA_TIPOS).map(([id, t]) =>
        `<option value="${id}">${t.desc} — ${(t.preco||t.valor||PLANOS_DEF[t.plano]?.preco||0).toLocaleString()} Kz</option>`
      ).join('')}
    </select>
    <button class="btn B w" onclick="adminGerarSenha()" style="font-size:14px;padding:14px">⚡ Gerar Senha</button>
    <div id="adminSenhaGerada" style="display:none;margin-top:14px;background:var(--sf3);border:.5px solid var(--eb);border-radius:10px;padding:16px;text-align:center">
      <div style="font-size:10px;font-family:var(--fm);color:var(--t3);margin-bottom:8px;letter-spacing:.1em">SENHA GERADA</div>
      <div id="adminSenhaTexto" style="font-size:22px;font-weight:800;color:var(--b);letter-spacing:.1em;font-family:var(--fm);margin-bottom:12px;word-break:break-all"></div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn B s" onclick="adminCopiar()" style="font-size:12px;padding:8px 16px">📋 Copiar</button>
        <button class="btn G s" onclick="adminWhatsApp()" style="font-size:12px;padding:8px 16px">💬 WhatsApp</button>
      </div>
    </div>
  </div>

  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:#FBBF24;margin-bottom:12px">🎁 Código Promocional</div>
    <div style="display:flex;gap:10px;margin-bottom:10px">
      <input class="inp" id="adminPromoPags" type="number" min="1" max="9999" value="50" style="flex:1;font-size:14px;text-align:center;padding:10px" placeholder="Páginas bónus"/>
      <button class="btn B" onclick="adminGerarPromo()" style="font-size:13px;padding:10px 16px">Gerar</button>
    </div>
    <div id="adminPromoResult" style="display:none;background:var(--z3);border:.5px solid var(--eb);border-radius:8px;padding:14px;margin-top:10px;text-align:center">
      <div style="font-size:10px;font-family:var(--fm);color:var(--t3);margin-bottom:6px">CÓDIGO PROMOCIONAL</div>
      <div id="adminPromoTexto" style="font-size:18px;font-weight:800;color:var(--b);letter-spacing:.08em;font-family:var(--fm);margin-bottom:10px;word-break:break-all"></div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn B s" onclick="adminCopiarPromo()" style="font-size:12px;padding:8px 16px">📋 Copiar</button>
        <button class="btn G s" onclick="adminWAPromo()" style="font-size:12px;padding:8px 16px">💬 WhatsApp</button>
      </div>
    </div>
  </div>

  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px">
    <div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:12px">📜 Últimas Senhas</div>
    ${historico.slice(0,10).map(h => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--z3);border-radius:8px;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--b);font-family:var(--fm);letter-spacing:.04em">${h.senha}</div>
        <div style="font-size:10px;color:var(--t3);margin-top:2px">${h.desc} · ${h.data}</div>
      </div>
      <div style="font-size:10px;font-weight:600;color:${h.usada?'#f87171':'var(--b)'};background:${h.usada?'rgba(248,113,113,.12)':'rgba(67,232,167,.12)'};padding:4px 10px;border-radius:6px">${h.usada?'USADA':'OK'}</div>
    </div>`).join('') || '<div style="font-size:13px;color:var(--t3);padding:12px 0;text-align:center">Nenhuma senha gerada ainda</div>'}
  </div>`;
}

function _adminSecPrecos() {
  return `
  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px">
    <div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:14px">💰 Tabela de Preços</div>
    <div id="adminPrecosLista">
      ${(getPrecosCache()||[]).map(p => `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <span style="font-size:13px;color:var(--t3);width:100px;flex-shrink:0;font-weight:500">${p.faixa_inicio}-${p.faixa_fim} págs</span>
        <input class="inp" value="${p.preco}" style="flex:1;font-size:15px;margin:0;text-align:right;padding:10px 12px" id="precoInp_${p.faixa_inicio}_${p.faixa_fim}"/>
        <span style="font-size:12px;color:var(--t3);font-weight:600;width:35px">Kz</span>
      </div>`).join('')}
    </div>
    <button class="btn B s" onclick="adminGuardarPrecos()" style="font-size:13px;padding:12px 24px;margin-top:8px">💾 Guardar Alterações</button>
    <div id="adminPrecosStatus" style="font-size:11px;margin-top:10px;font-weight:500"></div>
  </div>`;
}

function _adminSecIA() {
  return `
  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--t1)">🤖 Monitorização IA</div>
      <button onclick="carregarMonitorIA()" style="font-size:11px;color:var(--b);background:none;border:none;cursor:pointer;font-weight:600">↺ Actualizar</button>
    </div>
    <div id="adminMonitorIA" style="min-height:48px">
      <div style="font-size:13px;color:var(--t3);padding:20px;text-align:center">A carregar...</div>
    </div>
  </div>`;
}

function _adminSecParceiros() {
  return `
  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px;margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--t1)">🤝 Parceiros</div>
      <button onclick="carregarParceirosAdmin()" style="font-size:11px;color:var(--b);background:none;border:none;cursor:pointer;font-weight:600">↺</button>
    </div>
    <div id="adminParceiros" style="min-height:24px;margin-bottom:12px">
      <div style="font-size:12px;color:var(--t3)">A carregar...</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input class="inp" id="adminParNome" placeholder="Nome" style="flex:2;min-width:120px;font-size:13px;margin:0;padding:9px 10px"/>
      <input class="inp" id="adminParWA" placeholder="WhatsApp" style="flex:2;min-width:120px;font-size:13px;margin:0;padding:9px 10px"/>
      <input class="inp" id="adminParPerc" type="number" placeholder="%" value="10" style="width:50px;font-size:13px;margin:0;padding:9px 10px"/>
      <input class="inp" id="adminParCod" placeholder="Código" style="flex:1;min-width:80px;font-size:13px;margin:0;padding:9px 10px"/>
      <button class="btn B s" onclick="adminCriarParceiro()" style="font-size:12px;padding:9px 14px">+ Adicionar</button>
    </div>
  </div>

  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px;margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--t1)">💰 Comissões</div>
      <button onclick="carregarComissoesAdmin()" style="font-size:11px;color:var(--b);background:none;border:none;cursor:pointer;font-weight:600">↺</button>
    </div>
    <div id="adminComissoes" style="min-height:24px">
      <div style="font-size:12px;color:var(--t3)">A carregar...</div>
    </div>
  </div>

  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--t1)">🏫 Instituições Parceiras</div>
      <button onclick="carregarInstituicoesAdmin()" style="font-size:11px;color:var(--b);background:none;border:none;cursor:pointer;font-weight:600">↺</button>
    </div>
    <div id="adminInstituicoes" style="min-height:24px;margin-bottom:12px">
      <div style="font-size:12px;color:var(--t3)">A carregar...</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input class="inp" id="adminInstNome" placeholder="Nome da instituição" style="flex:2;min-width:140px;font-size:13px;margin:0;padding:9px 10px"/>
      <input class="inp" id="adminInstSigla" placeholder="Sigla" style="flex:1;min-width:60px;font-size:13px;margin:0;padding:9px 10px"/>
      <input class="inp" id="adminInstDesc" type="number" placeholder="% desc" style="width:55px;font-size:13px;margin:0;padding:9px 10px"/>
      <button class="btn B s" onclick="adminCriarInst()" style="font-size:12px;padding:9px 14px">+ Adicionar</button>
    </div>
  </div>`;
}

function _adminSecRelatorios() {
  return `
  <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:18px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--t1)">📋 Relatórios</div>
      <button onclick="gerarRelatorio()" style="font-size:11px;color:var(--b);background:none;border:none;cursor:pointer;font-weight:600">↺ Gerar</button>
    </div>
    <div id="adminRelatorios" style="min-height:48px">
      <div style="font-size:13px;color:var(--t3);padding:20px;text-align:center">Carrega em "Gerar" para obter relatório</div>
    </div>
  </div>`;
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

/* ── Promo */
let _adminPromoActual = '';
function adminGerarPromo() {
  const inp = document.getElementById('adminPromoPags');
  const pags = parseInt(inp?.value);
  if (!pags || pags < 1 || pags > 9999) { mostrarToast('Insere um número de páginas válido (1-9999).'); return; }
  const senha = gerarSenhaPromo(pags);
  if (!senha) { mostrarToast('Erro ao gerar código.'); return; }
  _adminPromoActual = senha;
  document.getElementById('adminPromoResult').style.display = 'block';
  document.getElementById('adminPromoTexto').textContent = senha;
  const hist = LS.get('senhas_geradas') || [];
  hist.unshift({ senha, desc: `${pags} páginas bónus (promo)`, data: new Date().toLocaleDateString('pt-PT'), usada: false });
  LS.set('senhas_geradas', hist.slice(0, 50));
  mostrarToast(`✓ Código promocional de ${pags} páginas gerado!`);
}
function adminCopiarPromo() {
  navigator.clipboard?.writeText(_adminPromoActual).then(() => mostrarToast('✓ Código copiado!'));
}
function adminWAPromo() {
  const msg = encodeURIComponent(
    `🎁 Olá! Aqui está o teu código promocional ACADEMY:\n\n*${_adminPromoActual}*\n\n` +
    `✓ Adiciona páginas de crédito ao teu saldo!\n\n` +
    `Como activar:\n1. Abre o ACADEMY\n2. Vai a Planos → "Activar com Senha"\n3. Insere o código\n\n` +
    `Grupo AGEA Comercial`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
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
   PAGAMENTOS PENDENTES
════════════════════════════════════════════════════════════ */
async function loadAdminPendentes() {
  const el = document.getElementById('sb-pendentes');
  if (!el) return;

  el.innerHTML = `<div style="font-size:13px;color:var(--t3);padding:16px;background:var(--z3);border-radius:8px;text-align:center">🔄 A carregar pagamentos…</div>`;

  const rows = await sbGetPendentes();

  if (!rows || !rows.length) {
    el.innerHTML = `<div style="font-size:13px;color:var(--t3);padding:18px;background:var(--z3);border-radius:8px;text-align:center">✓ Nenhum pagamento pendente de aprovação</div>`;
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
    <div id="pag-${r.id}" style="background:var(--z3);border:.5px solid var(--e0);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:3px">${nome}</div>
          ${email ? `<div style="font-size:11px;color:var(--o)">✉ ${email}</div>` : ''}
          ${wa    ? `<div style="font-size:11px;color:var(--t3)">${wa}</div>` : ''}
          ${nivel ? `<div style="font-size:11px;color:var(--t3)">${nivel}</div>` : ''}
          <div style="font-size:10px;color:var(--t4);margin-top:3px;font-family:var(--fm)">${data}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:12px">
          <div style="font-size:22px;font-weight:800;color:var(--b);line-height:1">${valor.toLocaleString()} Kz</div>
          <div style="font-size:10px;color:var(--o);margin-top:4px;font-weight:600">${tipo}</div>
          <div style="font-size:9px;color:var(--t3);margin-top:2px;font-family:var(--fm)">${(r.ref || r.id || '').substring(0, 14)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        ${wa ? `<a href="https://wa.me/${wa.replace(/\D/g,'')}" target="_blank" class="btn B s" style="font-size:11px;text-decoration:none;padding:7px 12px">💬 WhatsApp</a>` : ''}
        <button class="btn B s" style="font-size:11px;padding:7px 14px" onclick="adminAprovar('${r.id}','${r.tipo || 'avulso'}','${r.plano || ''}',${r.num_pags || 15},${r.meses || 1},'${nome}','${wa || ''}')">✓ Aprovar</button>
        <button class="btn G s" style="font-size:11px;padding:7px 14px;border-color:rgba(248,113,113,.3);color:#f87171" onclick="adminRejeitar('${r.id}')">✕ Rejeitar</button>
      </div>
    </div>`;
  }).join('');
}

/* ── Aprovar ── */
async function adminAprovar(id, tipo, plano, numPags, meses, nome, wa) {
  const card = document.getElementById(`pag-${id}`);
  if (card) card.style.opacity = '.5';
  await sbAprovar(id);

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
  } catch (e) { console.warn('[ADMIN] gerarSenha err:', e); }

  if (senhaGerada) {
    const hist = LS.get('senhas_geradas') || [];
    hist.unshift({ senha: senhaGerada, desc: `Aprovação: ${nome}`, data: new Date().toLocaleDateString('pt-PT'), usada: false });
    LS.set('senhas_geradas', hist.slice(0, 50));
  }

  mostrarToast(`✓ Pagamento de ${nome} aprovado.`);

  if (card) {
    card.style.opacity  = '1';
    card.style.border   = '.5px solid var(--eb)';
    card.style.background = 'var(--sf3)';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:6px 0">
        <div style="font-size:24px">✅</div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--b)">${nome} — Aprovado</div>
          ${senhaGerada ? `
          <div style="font-size:12px;color:var(--t2);margin-top:6px">Senha: <strong style="color:var(--b);font-family:var(--fm)">${senhaGerada}</strong></div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn B s" style="font-size:11px;padding:6px 12px" onclick="navigator.clipboard?.writeText('${senhaGerada}').then(()=>mostrarToast('✓ Copiada!'))">📋 Copiar</button>
            ${wa ? `<a href="https://wa.me/${wa.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${nome}! Aqui está a tua senha ACADEMY:\n\n*${senhaGerada}*\n\nActivar em: Planos → "Activar com Senha"\n\nGrupo AGEA Comercial`)}" target="_blank" class="btn G s" style="font-size:11px;text-decoration:none;padding:6px 12px">💬 Enviar WA</a>` : ''}
          </div>` : ''}
        </div>
      </div>`;
  }
}

/* ── Rejeitar ── */
async function adminRejeitar(id) {
  if (!confirm('Rejeitar este pagamento?')) return;
  const card = document.getElementById(`pag-${id}`);
  if (card) card.style.opacity = '.4';
  await sbRejeitar(id);
  mostrarToast('Pagamento rejeitado.');
  if (card) setTimeout(() => card.remove(), 800);
}

/* ════════════════════════════════════════════════════════════
   MONITORIZAÇÃO IA
════════════════════════════════════════════════════════════ */
async function carregarMonitorIA() {
  const el = document.getElementById('adminMonitorIA');
  if (!el) return;
  try {
    const r = await fetch(SB_URL + '/rest/v1/academy_ai_logs?order=ts.desc&limit=8', { headers: SB_H() });
    if (!r.ok) { el.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:12px 0">Sem acesso aos logs</div>'; return; }
    const rows = await r.json();
    if (!rows.length) { el.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:12px 0">Nenhum registo de IA ainda</div>'; return; }
    el.innerHTML = `
      <div style="font-size:10px;color:var(--t3);margin-bottom:10px;font-family:var(--fm);letter-spacing:.06em">ÚLTIMAS ${rows.length} CHAMADAS</div>
      ${rows.map(r => `
      <div style="display:flex;align-items:center;gap:10px;background:var(--z3);border-radius:8px;padding:10px 12px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--b)">${r.model_used||'?'}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px">${new Date(r.ts).toLocaleString('pt-PT').substring(0,16)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          ${r.pages_requested ? `<div style="font-size:11px;color:var(--t2)">${r.pages_requested}p</div>` : ''}
          ${r.confidence ? `<div style="font-size:10px;color:var(--b)">${r.confidence}%</div>` : ''}
        </div>
      </div>`).join('')}`;
  } catch (e) {
    el.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:12px 0">Erro ao carregar monitorização</div>';
  }
}

/* ════════════════════════════════════════════════════════════
   GESTÃO DE PREÇOS
════════════════════════════════════════════════════════════ */
async function adminGuardarPrecos() {
  const status = document.getElementById('adminPrecosStatus');
  if (!status) return;
  status.textContent = 'A guardar…';
  status.style.color = 'var(--t3)';
  try {
    const tabela = getPrecosCache() || [];
    let atualizados = 0;
    for (const p of tabela) {
      const inp = document.getElementById(`precoInp_${p.faixa_inicio}_${p.faixa_fim}`);
      if (!inp) continue;
      const novoPreco = parseInt(inp.value);
      if (isNaN(novoPreco) || novoPreco < 0) continue;
      if (novoPreco === p.preco) continue;
      await fetch(SB_URL + `/rest/v1/precos?faixa_inicio=eq.${p.faixa_inicio}&faixa_fim=eq.${p.faixa_fim}`, {
        method: 'PATCH',
        headers: { ...SB_H(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ preco: novoPreco }),
      });
      p.preco = novoPreco;
      atualizados++;
    }
    if (atualizados > 0) {
      _precosCache = tabela;
      status.textContent = `✓ ${atualizados} preço(s) actualizado(s) com sucesso!`;
      status.style.color = 'var(--b)';
      mostrarToast('✓ Preços actualizados!');
    } else {
      status.textContent = 'Nenhuma alteração detectada.';
      status.style.color = 'var(--t3)';
    }
  } catch (e) {
    status.textContent = '✗ Erro ao guardar: ' + (e.message || '');
    status.style.color = '#f87171';
  }
}

/* ════════════════════════════════════════════════════════════
   PARCEIROS E COMISSÕES (ADMIN)
════════════════════════════════════════════════════════════ */
async function carregarParceirosAdmin() {
  const el = document.getElementById('adminParceiros');
  if (!el) return;
  const rows = await sbCarregarParceiros();
  if (!rows.length) { el.innerHTML = '<div style="font-size:12px;color:var(--t3)">Nenhum parceiro</div>'; return; }
  el.innerHTML = rows.map(r => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--z3);border-radius:8px;margin-bottom:4px;font-size:12px">
      <span style="flex:1;color:var(--t1);font-weight:500">${r.nome}</span>
      <span style="color:var(--t3);font-family:var(--fm);font-size:11px">${r.comissao_porcentagem||0}%</span>
      ${r.codigo ? `<span style="color:var(--b);font-family:var(--fm);font-size:10px">${r.codigo}</span>` : ''}
      <button onclick="if(confirm('Remover ${r.nome}?')){sbRemoverParceiro(${r.id});carregarParceirosAdmin()}" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:14px">✕</button>
    </div>`).join('');
}
async function carregarComissoesAdmin() {
  const el = document.getElementById('adminComissoes');
  if (!el) return;
  const rows = await sbCarregarComissoes();
  if (!rows.length) { el.innerHTML = '<div style="font-size:12px;color:var(--t3)">Nenhuma comissão registada</div>'; return; }
  el.innerHTML = rows.map(r => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--z3);border-radius:8px;margin-bottom:4px;font-size:12px">
      <span style="flex:1;color:var(--t1);font-weight:500">${r.parceiro_nome}</span>
      <span style="color:var(--b);font-weight:700">${r.valor_comissao.toLocaleString()} Kz</span>
      <span style="font-size:10px;font-weight:600;color:${r.estado==='pago'?'var(--b)':'#FBBF24'};background:${r.estado==='pago'?'rgba(67,232,167,.12)':'rgba(251,191,36,.12)'};padding:3px 8px;border-radius:6px">${r.estado==='pago'?'PAGO':'PENDENTE'}</span>
      ${r.estado==='pendente'?`<button onclick="sbPagarComissao(${r.id});carregarComissoesAdmin()" style="background:var(--b);color:var(--t-inv);border:none;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;padding:4px 10px">Pagar</button>`:''}
    </div>`).join('');
}
async function adminCriarParceiro() {
  const nome = document.getElementById('adminParNome')?.value?.trim();
  const wa = document.getElementById('adminParWA')?.value?.trim();
  const perc = parseInt(document.getElementById('adminParPerc')?.value) || 10;
  const cod = document.getElementById('adminParCod')?.value?.trim().toUpperCase() || ('PAR' + Date.now().toString(36).toUpperCase());
  if (!nome) { mostrarToast('Insere o nome do parceiro.'); return; }
  const ok = await sbCriarParceiro(nome, wa, perc, cod);
  if (ok) { mostrarToast(`✓ Parceiro ${nome} criado! Código: ${cod}`); document.getElementById('adminParNome').value=''; document.getElementById('adminParWA').value=''; document.getElementById('adminParPerc').value='10'; document.getElementById('adminParCod').value=''; carregarParceirosAdmin(); }
  else mostrarToast('Erro ao criar parceiro.');
}

/* ════════════════════════════════════════════════════════════
   INSTITUIÇÕES PARCEIRAS (ADMIN)
════════════════════════════════════════════════════════════ */
async function carregarInstituicoesAdmin() {
  const el = document.getElementById('adminInstituicoes');
  if (!el) return;
  const rows = await sbCarregarInstituicoes();
  if (!rows.length) { el.innerHTML = '<div style="font-size:12px;color:var(--t3)">Nenhuma instituição</div>'; return; }
  el.innerHTML = rows.map(r => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--z3);border-radius:8px;margin-bottom:4px;font-size:12px">
      <span style="flex:1;color:var(--t1);font-weight:500">${r.nome}</span>
      <span style="color:var(--t3);font-family:var(--fm);width:40px">${r.sigla||''}</span>
      <span style="color:var(--b);font-weight:700;width:35px;text-align:right">${r.desconto_porcentagem||0}%</span>
      <button onclick="if(confirm('Remover ${r.nome}?')){sbRemoverInstituicao(${r.id});carregarInstituicoesAdmin()}" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:14px">✕</button>
    </div>`).join('');
}
async function adminCriarInst() {
  const nome = document.getElementById('adminInstNome')?.value?.trim();
  const sigla = document.getElementById('adminInstSigla')?.value?.trim().toUpperCase();
  const desc = parseInt(document.getElementById('adminInstDesc')?.value) || 0;
  if (!nome) { mostrarToast('Insere o nome da instituição.'); return; }
  const ok = await sbCriarInstituicao(nome, sigla, desc);
  if (ok) { mostrarToast(`✓ ${nome} adicionada!`); document.getElementById('adminInstNome').value=''; document.getElementById('adminInstSigla').value=''; document.getElementById('adminInstDesc').value=''; carregarInstituicoesAdmin(); }
  else mostrarToast('Erro ao criar instituição.');
}

/* ════════════════════════════════════════════════════════════
   DASHBOARD GLOBAL
════════════════════════════════════════════════════════════ */
async function carregarDashboard() {
  const el = document.getElementById('adminDashboard');
  if (!el) return;
  el.innerHTML = '<div style="font-size:13px;color:var(--t3);padding:20px;text-align:center">A carregar métricas...</div>';
  try {
    const [uR, pR, dR] = await Promise.allSettled([
      fetch(SB_URL + '/rest/v1/utilizadores?select=id&limit=1000', { headers: SB_H() }),
      fetch(SB_URL + '/rest/v1/pagamentos?select=valor,estado&limit=1000', { headers: SB_H() }),
      fetch(SB_URL + '/rest/v1/documentos?select=uid&limit=1000', { headers: SB_H() }),
    ]);
    const users = uR.status === 'fulfilled' && uR.value.ok ? await uR.value.json() : [];
    const pags  = pR.status === 'fulfilled' && pR.value.ok ? await pR.value.json() : [];
    const docs  = dR.status === 'fulfilled' && dR.value.ok ? await dR.value.json() : [];
    const totalUsers = Array.isArray(users) ? users.length : 0;
    const totalDocs  = Array.isArray(docs) ? docs.length : 0;
    const totalPags  = Array.isArray(pags) ? pags.length : 0;
    const receita    = Array.isArray(pags) ? pags.filter(p => p.estado === 'aprovado' || p.estado === 'processado').reduce((s, p) => s + (parseInt(p.valor) || 0), 0) : 0;
    const uniqUsers  = Array.isArray(docs) ? new Set(docs.map(d => d.uid)).size : 0;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:var(--sf3);border-radius:10px;padding:14px">
          <div style="font-size:9px;font-family:var(--fm);color:var(--t3);letter-spacing:.08em;text-transform:uppercase">UTILIZADORES</div>
          <div style="font-size:24px;font-weight:800;color:var(--b);margin-top:4px">${totalUsers}</div>
        </div>
        <div style="background:var(--sf3);border-radius:10px;padding:14px">
          <div style="font-size:9px;font-family:var(--fm);color:var(--t3);letter-spacing:.08em;text-transform:uppercase">DOCUMENTOS</div>
          <div style="font-size:24px;font-weight:800;color:var(--b);margin-top:4px">${totalDocs}</div>
        </div>
        <div style="background:var(--sf3);border-radius:10px;padding:14px">
          <div style="font-size:9px;font-family:var(--fm);color:var(--t3);letter-spacing:.08em;text-transform:uppercase">PAGAMENTOS</div>
          <div style="font-size:24px;font-weight:800;color:var(--b);margin-top:4px">${totalPags}</div>
        </div>
        <div style="background:var(--sf3);border-radius:10px;padding:14px">
          <div style="font-size:9px;font-family:var(--fm);color:var(--t3);letter-spacing:.08em;text-transform:uppercase">RECEITA</div>
          <div style="font-size:20px;font-weight:800;color:var(--b);margin-top:4px">${receita.toLocaleString()} Kz</div>
        </div>
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--t3)">${uniqUsers} utilizadores activos · ${totalDocs} documentos totais</div>`;
  } catch (e) {
    el.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:12px 0">Erro ao carregar dashboard</div>';
  }
}

/* ════════════════════════════════════════════════════════════
   RELATÓRIOS
════════════════════════════════════════════════════════════ */
async function gerarRelatorio() {
  const el = document.getElementById('adminRelatorios');
  if (!el) return;
  el.innerHTML = '<div style="font-size:13px;color:var(--t3);padding:12px 0">A gerar relatório...</div>';
  try {
    const [uR, pR, dR, iR, cR] = await Promise.allSettled([
      fetch(SB_URL + '/rest/v1/utilizadores?select=nome,email,nivel,whatsapp,updated_at&limit=500', { headers: SB_H() }),
      fetch(SB_URL + '/rest/v1/pagamentos?order=criado_em.desc&limit=500', { headers: SB_H() }),
      fetch(SB_URL + '/rest/v1/documentos?select=uid,titulo,tipo,pags,updated_at&limit=500', { headers: SB_H() }),
      fetch(SB_URL + '/rest/v1/instituicoes?order=nome.asc', { headers: SB_H() }),
      fetch(SB_URL + '/rest/v1/comissoes?order=criado_em.desc&limit=100', { headers: SB_H() }),
    ]);
    const users = uR.status==='fulfilled'&&uR.value.ok ? await uR.value.json() : [];
    const pags  = pR.status==='fulfilled'&&pR.value.ok ? await pR.value.json() : [];
    const docs  = dR.status==='fulfilled'&&dR.value.ok ? await dR.value.json() : [];
    const insts = iR.status==='fulfilled'&&iR.value.ok ? await iR.value.json() : [];
    const coms  = cR.status==='fulfilled'&&cR.value.ok ? await cR.value.json() : [];

    const totalUsers = Array.isArray(users) ? users.length : 0;
    const totalPags  = Array.isArray(pags) ? pags.length : 0;
    const totalDocs  = Array.isArray(docs) ? docs.length : 0;
    const receita    = Array.isArray(pags) ? pags.filter(p => p.estado==='aprovado'||p.estado==='processado').reduce((s,p) => s+(parseInt(p.valor)||0),0) : 0;
    const comPend   = Array.isArray(coms) ? coms.filter(c => c.estado==='pendente').reduce((s,c) => s+(parseInt(c.valor_comissao)||0),0) : 0;
    const comPago   = Array.isArray(coms) ? coms.filter(c => c.estado==='pago').reduce((s,c) => s+(parseInt(c.valor_comissao)||0),0) : 0;

    const csvLinhas = [
      'Relatório ACADEMY,Valor',
      `Utilizadores,${totalUsers}`,
      `Documentos,${totalDocs}`,
      `Pagamentos,${totalPags}`,
      `Receita Total,${receita} Kz`,
      `Comissões Pendentes,${comPend} Kz`,
      `Comissões Pagas,${comPago} Kz`,
      `Instituições Parceiras,${Array.isArray(insts)?insts.length:0}`,
      '',
      'Documentos Recentes',
      'Utilizador,Título,Tipo,Páginas,Data',
      ...(Array.isArray(docs) ? docs.slice(0,20).map(d => `"${d.uid||''}","${(d.titulo||'').replace(/"/g,'""')}","${d.tipo||''}",${d.pags||0},"${d.updated_at?new Date(d.updated_at).toLocaleDateString('pt-PT'):''}"`) : []),
    ].join('\n');

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:var(--z3);border-radius:8px;padding:12px">
          <div style="font-size:9px;font-family:var(--fm);color:var(--t3);letter-spacing:.08em;text-transform:uppercase">UTILIZADORES</div>
          <div style="font-size:20px;font-weight:800;color:var(--t1);margin-top:2px">${totalUsers}</div>
        </div>
        <div style="background:var(--z3);border-radius:8px;padding:12px">
          <div style="font-size:9px;font-family:var(--fm);color:var(--t3);letter-spacing:.08em;text-transform:uppercase">DOCUMENTOS</div>
          <div style="font-size:20px;font-weight:800;color:var(--t1);margin-top:2px">${totalDocs}</div>
        </div>
        <div style="background:var(--z3);border-radius:8px;padding:12px">
          <div style="font-size:9px;font-family:var(--fm);color:var(--t3);letter-spacing:.08em;text-transform:uppercase">RECEITA</div>
          <div style="font-size:16px;font-weight:800;color:var(--b);margin-top:2px">${receita.toLocaleString()} Kz</div>
        </div>
        <div style="background:var(--z3);border-radius:8px;padding:12px">
          <div style="font-size:9px;font-family:var(--fm);color:var(--t3);letter-spacing:.08em;text-transform:uppercase">COM. PENDENTES</div>
          <div style="font-size:16px;font-weight:800;color:#FBBF24;margin-top:2px">${comPend.toLocaleString()} Kz</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn B s" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(csvLinhas)}')).then(()=>mostrarToast('✓ CSV copiado!'))" style="font-size:12px;padding:10px 18px">📋 Copiar CSV</button>
        <button class="btn G s" onclick="baixarCSV()" style="font-size:12px;padding:10px 18px">⬇ Baixar CSV</button>
      </div>`;
    window.__relatorioCSV = csvLinhas;
  } catch(e) {
    el.innerHTML = '<div style="font-size:12px;color:#f87171;padding:12px 0">Erro ao gerar relatório</div>';
  }
}
function baixarCSV() {
  if (!window.__relatorioCSV) return;
  const blob = new Blob([window.__relatorioCSV], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `academy_relatorio_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
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
      <div style="font-size:13px;color:var(--t3);margin-bottom:18px">Introduz o PIN de administrador</div>
      <input id="adminPinInp" type="password" class="inp" placeholder="PIN de acesso"
        style="margin-bottom:14px;text-align:center;letter-spacing:.3em;font-size:20px"
        maxlength="10"
        onkeydown="if(event.key==='Enter')_verificarAdminPin()"/>
      <button class="btn B w" onclick="_verificarAdminPin()" id="adminPinBtn">Entrar →</button>
      <div id="adminPinErro" style="margin-top:10px;font-family:var(--fm);font-size:11px;color:#f87171;display:none">PIN incorrecto. Tenta novamente.</div>
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
