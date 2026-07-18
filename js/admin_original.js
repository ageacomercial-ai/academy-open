/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   ACADEMY ÔÇö ADMIN.JS
   Painel de administrador: senhas, pagamentos, estat├¡sticas.
   Acesso por 7 toques no logo ÔåÆ autentica├º├úo por PIN.
   Depende de: state.js, supabase.js, auth.js, navigation.js
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */

let _adminSenhaActual = '';
let _adminTipoActual  = '';

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   ECR├â ADMIN ÔÇö RENDER PRINCIPAL
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
function sAdmin() {
  const historico = LS.get('senhas_geradas') || [];
  const sbStatus  = _sbConectado === true
    ? '­ƒƒó Supabase ligado'
    : _sbConectado === false
      ? '­ƒö┤ Supabase offline'
      : 'ÔÜ¬ A verificarÔÇª';

  return `
  <!-- Badge Admin -->
  <div style="background:rgba(251,191,36,.06);border:.5px solid rgba(251,191,36,.2);border-radius:var(--r2);padding:12px;margin-bottom:16px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.14em;color:#FBBF24;margin-bottom:4px">ÔÜí PAINEL DE ADMINISTRADOR</div>
    <div style="font-size:12px;color:var(--t3);margin-bottom:6px">Grupo AGEA Comercial ┬À CEO Adelino Gra├ºa</div>
    <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.06em">${sbStatus}</div>
  </div>

  <!-- Pagamentos Pendentes -->
  <div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.14em;color:var(--t3);text-transform:uppercase">ÔÅ│ Pedidos de Pagamento</div>
      <button onclick="loadAdminPendentes()" style="font-family:var(--fm);font-size:8px;color:var(--b);background:none;border:none;cursor:pointer;letter-spacing:.06em">Ôå║ Actualizar</button>
    </div>
    <div id="sb-pendentes" style="min-height:48px">
      <div style="font-size:12px;color:var(--t3);padding:12px;background:var(--z3);border-radius:var(--r2);text-align:center">A carregar...</div>
    </div>
  </div>

  <!-- Gerar Senha Padr├úo -->
  <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);margin-bottom:10px;text-transform:uppercase">­ƒöæ Gerar Senha de Acesso</div>
  <label class="lbl">Tipo de Acesso</label>
  <select class="inp" id="adminTipo" style="margin-bottom:12px">
    ${Object.entries(SENHA_TIPOS).map(([id, t]) =>
      `<option value="${id}">${t.desc} ÔÇö ${(t.preco || t.valor || PLANOS_DEF[t.plano]?.preco || 0).toLocaleString()} Kz</option>`
    ).join('')}
  </select>

  <button class="btn B w" onclick="adminGerarSenha()" style="font-size:15px;padding:14px;margin-bottom:6px">
    ÔÜí Gerar Nova Senha
  </button>

  <!-- Gerar Senha Promocional -->
  <div style="margin-top:16px;padding:14px;background:var(--sf3);border:.5px solid rgba(251,191,36,.2);border-radius:var(--r);margin-bottom:16px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:#FBBF24;margin-bottom:10px;text-transform:uppercase">­ƒÄü C├│digo Promocional (p├íginas b├│nus)</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input class="inp" id="adminPromoPags" type="number" min="1" max="9999" value="50" style="flex:1;text-align:center" placeholder="P├íginas"/>
      <button class="btn B" onclick="adminGerarPromo()">Gerar ÔåÆ</button>
    </div>
    <div id="adminPromoResult" style="display:none;background:var(--z2);border:.5px solid var(--eb);border-radius:var(--r);padding:10px;margin-top:8px;text-align:center">
      <div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-bottom:4px">C├ôDIGO PROMOCIONAL</div>
      <div id="adminPromoTexto" style="font-size:18px;font-weight:800;color:var(--b);letter-spacing:.1em;font-family:var(--fm);margin-bottom:6px;word-break:break-all"></div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn B s" onclick="adminCopiarPromo()">­ƒôï Copiar</button>
        <button class="btn G s" onclick="adminWAPromo()">­ƒÆ¼ WhatsApp</button>
      </div>
    </div>
  </div>

  <!-- Senha Gerada -->
  <div id="adminSenhaGerada" style="display:none;background:var(--sf3);border:.5px solid var(--eb);border-radius:var(--r);padding:16px;margin-bottom:20px;text-align:center">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.1em;color:var(--t3);margin-bottom:8px">SENHA GERADA</div>
    <div id="adminSenhaTexto" style="font-size:22px;font-weight:800;color:var(--b);letter-spacing:.12em;margin-bottom:12px;font-family:var(--fm)"></div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="btn B s" onclick="adminCopiar()">­ƒôï Copiar</button>
      <button class="btn G s" onclick="adminWhatsApp()">­ƒÆ¼ WhatsApp</button>
    </div>
  </div>

  <!-- Hist├│rico de Senhas -->
  <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);margin-bottom:10px;text-transform:uppercase">├Ültimas senhas geradas</div>
  <div style="display:flex;flex-direction:column;gap:6px">
    ${historico.slice(0, 10).map(h => `
    <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r2);padding:10px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-family:var(--fm);font-size:10px;color:var(--b);letter-spacing:.08em">${h.senha}</div>
        <div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-top:2px">${h.desc} ┬À ${h.data}</div>
      </div>
      <div style="font-size:9px;color:${h.usada ? '#f87171' : 'var(--b)'}">${h.usada ? 'USADA' : 'Ô£ô OK'}</div>
    </div>`).join('') || `<div style="font-size:13px;color:var(--t3)">Nenhuma senha gerada ainda.</div>`}
  </div>

  <!-- Gest├úo de Pre├ºos -->
  <div style="margin-bottom:20px;padding:16px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r)">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);margin-bottom:12px;text-transform:uppercase">­ƒÆ░ Gest├úo de Pre├ºos</div>
    <div id="adminPrecosLista">
      ${(getPrecosCache() || []).map(p => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-family:var(--fm);font-size:9px;color:var(--t3);width:80px;flex-shrink:0">${p.faixa_inicio}-${p.faixa_fim}p</span>
        <input class="inp" value="${p.preco}" style="flex:1;font-size:12px;margin:0;text-align:right" id="precoInp_${p.faixa_inicio}_${p.faixa_fim}"/>
        <span style="font-family:var(--fm);font-size:9px;color:var(--t3);width:30px">Kz</span>
      </div>`).join('')}
    </div>
    <button class="btn B s" onclick="adminGuardarPrecos()" style="margin-top:8px;font-size:11px">­ƒÆ¥ Guardar Pre├ºos</button>
    <div id="adminPrecosStatus" style="font-family:var(--fm);font-size:9px;color:var(--b);margin-top:6px"></div>
  </div>

  <!-- Monitoriza├º├úo IA -->
  <div style="margin-top:20px;padding:16px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);text-transform:uppercase">­ƒñû Monitoriza├º├úo IA</div>
      <button onclick="carregarMonitorIA()" style="font-family:var(--fm);font-size:8px;color:var(--b);background:none;border:none;cursor:pointer;letter-spacing:.06em">Ôå║ Actualizar</button>
    </div>
    <div id="adminMonitorIA" style="min-height:36px">
      <div style="font-size:12px;color:var(--t3);padding:8px;text-align:center">A carregar...</div>
    </div>
  </div>

  <!-- Parceiros e Comiss├Áes -->
  <div style="margin-bottom:20px;padding:16px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);text-transform:uppercase">­ƒñØ Parceiros e Comiss├Áes</div>
      <button onclick="carregarParceirosAdmin();carregarComissoesAdmin()" style="font-family:var(--fm);font-size:8px;color:var(--b);background:none;border:none;cursor:pointer;letter-spacing:.06em">Ôå║</button>
    </div>
    <div id="adminParceiros" style="min-height:20px;margin-bottom:8px">
      <div style="font-size:11px;color:var(--t3);padding:2px 0">A carregar parceiros...</div>
    </div>
    <div id="adminComissoes" style="min-height:20px">
      <div style="font-size:11px;color:var(--t3);padding:2px 0">A carregar comiss├Áes...</div>
    </div>
    <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">
      <input class="inp" id="adminParNome" placeholder="Nome" style="flex:2;font-size:10px;margin:0"/>
      <input class="inp" id="adminParWA" placeholder="WhatsApp" style="flex:2;font-size:10px;margin:0"/>
      <input class="inp" id="adminParPerc" type="number" placeholder="%" value="10" style="width:36px;font-size:10px;margin:0"/>
      <input class="inp" id="adminParCod" placeholder="C├│digo" style="flex:1;font-size:10px;margin:0"/>
      <button class="btn B s" onclick="adminCriarParceiro()" style="font-size:9px">+</button>
    </div>
  </div>

  <!-- Institui├º├Áes Parceiras -->
  <div style="margin-bottom:20px;padding:16px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);text-transform:uppercase">­ƒÅ½ Institui├º├Áes Parceiras</div>
      <button onclick="carregarInstituicoesAdmin()" style="font-family:var(--fm);font-size:8px;color:var(--b);background:none;border:none;cursor:pointer;letter-spacing:.06em">Ôå║</button>
    </div>
    <div id="adminInstituicoes" style="min-height:24px">
      <div style="font-size:11px;color:var(--t3);padding:4px 0">A carregar...</div>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      <input class="inp" id="adminInstNome" placeholder="Nome" style="flex:2;font-size:11px;margin:0"/>
      <input class="inp" id="adminInstSigla" placeholder="Sigla" style="flex:1;font-size:11px;margin:0"/>
      <input class="inp" id="adminInstDesc" type="number" placeholder="% desc" style="width:50px;font-size:11px;margin:0"/>
      <button class="btn B s" onclick="adminCriarInst()" style="font-size:10px">+</button>
    </div>
  </div>

  <!-- Relat├│rios -->
  <div style="margin-bottom:20px;padding:16px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);text-transform:uppercase">­ƒôï Relat├│rios</div>
      <button onclick="gerarRelatorio()" style="font-family:var(--fm);font-size:8px;color:var(--b);background:none;border:none;cursor:pointer;letter-spacing:.06em">Ôå║ Gerar</button>
    </div>
    <div id="adminRelatorios" style="min-height:36px">
      <div style="font-size:11px;color:var(--t3);padding:6px 0">Carrega em "Gerar" para obter relat├│rio</div>
    </div>
  </div>

  <!-- Dashboard Global (carregado do Supabase) -->
  <div style="margin-top:20px;padding:16px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);text-transform:uppercase">­ƒôè Dashboard Global</div>
      <button onclick="carregarDashboard()" style="font-family:var(--fm);font-size:8px;color:var(--b);background:none;border:none;cursor:pointer;letter-spacing:.06em">Ôå║ Actualizar</button>
    </div>
    <div id="adminDashboard" style="min-height:36px">
      <div style="font-size:12px;color:var(--t3);padding:8px;text-align:center">A carregar...</div>
    </div>
  </div>

  <!-- Estat├¡sticas da Sess├úo -->
  <div style="margin-top:20px;padding:16px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r)">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);margin-bottom:12px;text-transform:uppercase">­ƒÆ╗ Sess├úo Actual</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${[
        ['Documentos criados', getDocs().length],
        ['Plano activo',       PLANOS_DEF[planoActivo()]?.n || 'Gratuito'],
        ['Utilizador',        State.get('u')?.nome || 'ÔÇö'],
        ['ID Supabase',       sbUserId().substring(0, 12) + 'ÔÇª'],
      ].map(([l, v]) => `
      <div style="background:var(--z3);border-radius:var(--r2);padding:10px">
        <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em;margin-bottom:4px">${l.toUpperCase()}</div>
        <div style="font-size:12px;font-weight:600;color:var(--t1)">${v}</div>
      </div>`).join('')}
    </div>
  </div>

  ${RODAPE_HTML}`;
}

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   AC├ç├òES DE ADMIN
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
function adminGerarSenha() {
  const tipo  = document.getElementById('adminTipo')?.value;
  if (!tipo) return;
  const senha = gerarSenha(tipo);
  if (!senha) return;
  _adminSenhaActual = senha;
  _adminTipoActual  = tipo;

  document.getElementById('adminSenhaGerada').style.display = 'block';
  document.getElementById('adminSenhaTexto').textContent    = senha;

  /* Guardar no hist├│rico local */
  const hist = LS.get('senhas_geradas') || [];
  hist.unshift({
    senha, desc: SENHA_TIPOS[tipo]?.desc || tipo,
    data: new Date().toLocaleDateString('pt-PT'), usada: false,
  });
  LS.set('senhas_geradas', hist.slice(0, 50));
}

function adminCopiar() {
  navigator.clipboard?.writeText(_adminSenhaActual)
    .then(() => mostrarToast('Ô£ô Senha copiada!'));
}

/* ÔöÇÔöÇ Gerar c├│digo promocional personalizado ÔöÇÔöÇ */
let _adminPromoActual = '';
function adminGerarPromo() {
  const inp = document.getElementById('adminPromoPags');
  const pags = parseInt(inp?.value);
  if (!pags || pags < 1 || pags > 9999) { mostrarToast('Insere um n├║mero de p├íginas v├ílido (1-9999).'); return; }
  const senha = gerarSenhaPromo(pags);
  if (!senha) { mostrarToast('Erro ao gerar c├│digo.'); return; }
  _adminPromoActual = senha;
  document.getElementById('adminPromoResult').style.display = 'block';
  document.getElementById('adminPromoTexto').textContent = senha;
  const hist = LS.get('senhas_geradas') || [];
  hist.unshift({ senha, desc: `${pags} p├íginas b├│nus (promo)`, data: new Date().toLocaleDateString('pt-PT'), usada: false });
  LS.set('senhas_geradas', hist.slice(0, 50));
  mostrarToast(`Ô£ô C├│digo promocional de ${pags} p├íginas gerado!`);
}
function adminCopiarPromo() {
  navigator.clipboard?.writeText(_adminPromoActual).then(() => mostrarToast('Ô£ô C├│digo copiado!'));
}
function adminWAPromo() {
  const msg = encodeURIComponent(
    `­ƒÄü Ol├í! Aqui est├í o teu c├│digo promocional ACADEMY:\n\n*${_adminPromoActual}*\n\n` +
    `Ô£ô Adiciona p├íginas de cr├®dito ao teu saldo!\n\n` +
    `Como activar:\n1. Abre o ACADEMY\n2. Vai a Planos ÔåÆ "Activar com Senha"\n3. Insere o c├│digo\n\n` +
    `Grupo AGEA Comercial`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function adminWhatsApp() {
  const tipo = SENHA_TIPOS[_adminTipoActual];
  const msg  = encodeURIComponent(
    `Ol├í! Aqui est├í a tua senha de acesso ao ACADEMY:\n\n*${_adminSenhaActual}*\n\n` +
    `Ô£ô V├ílida para: ${tipo?.desc || 'Acesso'}\n\n` +
    `Como activar:\n1. Abre o ACADEMY\n2. Vai a Planos ÔåÆ "Activar com Senha"\n3. Insere o c├│digo acima\n\n` +
    `Grupo AGEA Comercial`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   CARREGAR PAGAMENTOS PENDENTES
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
async function loadAdminPendentes() {
  const el = document.getElementById('sb-pendentes');
  if (!el) return;

  el.innerHTML = `<div style="font-size:12px;color:var(--t3);padding:12px;background:var(--z3);border-radius:var(--r2);text-align:center">­ƒöä A carregar pagamentosÔÇª</div>`;

  const rows = await sbGetPendentes();

  if (!rows || !rows.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--t3);padding:14px;background:var(--z3);border-radius:var(--r2);text-align:center">Ô£ô Nenhum pagamento pendente de aprova├º├úo</div>`;
    return;
  }

  el.innerHTML = rows.map(r => {
    const data  = r.criado_em ? new Date(r.criado_em).toLocaleString('pt-PT') : 'ÔÇö';
    const tipo  = r.tipo === 'plano'
      ? `Plano ${(r.plano || '').toUpperCase()}`
      : `${r.num_pags || '?'} p├íginas (avulso)`;
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
          ${email ? `<div style="font-family:var(--fm);font-size:8px;color:var(--o)">Ô£ë ${email}</div>` : ''}
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
        ${wa ? `<a href="https://wa.me/${wa.replace(/\D/g,'')}" target="_blank" class="btn B s" style="font-size:10px;text-decoration:none">­ƒÆ¼ WhatsApp</a>` : ''}
        <button class="btn B s" style="font-size:10px" onclick="adminAprovar('${r.id}','${r.tipo || 'avulso'}','${r.plano || ''}',${r.num_pags || 15},${r.meses || 1},'${nome}','${wa || ''}')">Ô£ô Aprovar</button>
        <button class="btn G s" style="font-size:10px;border-color:rgba(248,113,113,.3);color:#f87171" onclick="adminRejeitar('${r.id}')">Ô£ò Rejeitar</button>
      </div>
    </div>`;
  }).join('');
}

/* ÔöÇÔöÇ Aprovar pagamento ÔöÇÔöÇ */
async function adminAprovar(id, tipo, plano, numPags, meses, nome, wa) {
  const card = document.getElementById(`pag-${id}`);
  if (card) card.style.opacity = '.5';
  await sbAprovar(id);

  /* Gerar senha autom├ítica para enviar ao cliente */
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

  /* Guardar senha no hist├│rico */
  if (senhaGerada) {
    const hist = LS.get('senhas_geradas') || [];
    hist.unshift({ senha: senhaGerada, desc: `Aprova├º├úo: ${nome}`, data: new Date().toLocaleDateString('pt-PT'), usada: false });
    LS.set('senhas_geradas', hist.slice(0, 50));
  }

  mostrarToast(`Ô£ô Pagamento de ${nome} aprovado.`);

  /* Actualizar UI do card */
  if (card) {
    card.style.opacity  = '1';
    card.style.border   = '.5px solid var(--eb)';
    card.style.background = 'var(--sf3)';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:4px 0">
        <div style="font-size:20px">Ô£à</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--b)">${nome} ÔÇö Aprovado</div>
          ${senhaGerada ? `
          <div style="font-family:var(--fm);font-size:11px;color:var(--t2);margin-top:4px">Senha: <strong style="color:var(--b)">${senhaGerada}</strong></div>
          <div style="display:flex;gap:7px;margin-top:8px">
            <button class="btn B s" style="font-size:10px" onclick="navigator.clipboard?.writeText('${senhaGerada}').then(()=>mostrarToast('Ô£ô Copiada!'))">­ƒôï Copiar senha</button>
            ${wa ? `<a href="https://wa.me/${wa.replace(/\D/g,'')}?text=${encodeURIComponent(`Ol├í ${nome}! Aqui est├í a tua senha ACADEMY:\n\n*${senhaGerada}*\n\nActivar em: Planos ÔåÆ "Activar com Senha"\n\nGrupo AGEA Comercial`)}" target="_blank" class="btn G s" style="font-size:10px;text-decoration:none">­ƒÆ¼ Enviar WA</a>` : ''}
          </div>` : ''}
        </div>
      </div>`;
  }
}

/* ÔöÇÔöÇ Rejeitar pagamento ÔöÇÔöÇ */
async function adminRejeitar(id) {
  if (!confirm('Rejeitar este pagamento?')) return;
  const card = document.getElementById(`pag-${id}`);
  if (card) card.style.opacity = '.4';
  await sbRejeitar(id);
  mostrarToast('Pagamento rejeitado.');
  if (card) setTimeout(() => card.remove(), 800);
}

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   MONITORIZA├ç├âO IA
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
async function carregarMonitorIA() {
  const el = document.getElementById('adminMonitorIA');
  if (!el) return;
  try {
    const r = await fetch(SB_URL + '/rest/v1/academy_ai_logs?order=ts.desc&limit=5', { headers: SB_H() });
    if (!r.ok) { el.innerHTML = '<div style="font-size:11px;color:var(--t3)">Sem acesso aos logs</div>'; return; }
    const rows = await r.json();
    if (!rows.length) { el.innerHTML = '<div style="font-size:11px;color:var(--t3)">Nenhum registo de IA ainda</div>'; return; }
    el.innerHTML = `
      <div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-bottom:6px">├Ültimas ${rows.length} chamadas:</div>
      ${rows.map(r => `
      <div style="background:var(--z3);border-radius:var(--r);padding:8px 10px;margin-bottom:4px;font-size:11px;color:var(--t2)">
        <span style="color:var(--t3)">${new Date(r.ts).toLocaleString('pt-PT').substring(0,16)}</span>
        <strong style="color:var(--b)">${r.model_used||'?'}</strong>
        ${r.pages_requested ? `┬À ${r.pages_requested}p` : ''}
        ${r.confidence ? `┬À ${r.confidence}%` : ''}
      </div>`).join('')}
      <div style="margin-top:6px;font-family:var(--fm);font-size:8px;color:var(--t3)">Total: ${rows.length} chamadas recentes</div>`;
  } catch (e) {
    el.innerHTML = '<div style="font-size:11px;color:var(--t3)">Erro ao carregar monitoriza├º├úo</div>';
  }
}

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   GEST├âO DE PRE├çOS
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
async function adminGuardarPrecos() {
  const status = document.getElementById('adminPrecosStatus');
  if (!status) return;
  status.textContent = 'A guardarÔÇª';
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
      status.textContent = `Ô£ô ${atualizados} pre├ºo(s) actualizado(s) com sucesso!`;
      status.style.color = 'var(--b)';
      mostrarToast('Ô£ô Pre├ºos actualizados!');
    } else {
      status.textContent = 'Nenhuma altera├º├úo detectada.';
      status.style.color = 'var(--t3)';
    }
  } catch (e) {
    status.textContent = 'Ô£ù Erro ao guardar: ' + (e.message || '');
    status.style.color = '#f87171';
  }
}

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   PARCEIROS E COMISS├òES (ADMIN)
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
async function carregarParceirosAdmin() {
  const el = document.getElementById('adminParceiros');
  if (!el) return;
  const rows = await sbCarregarParceiros();
  if (!rows.length) { el.innerHTML = '<div style="font-size:10px;color:var(--t3)">Nenhum parceiro</div>'; return; }
  el.innerHTML = rows.map(r => `
    <div style="display:flex;align-items:center;gap:4px;padding:3px 6px;background:var(--z3);border-radius:var(--r);margin-bottom:2px;font-size:10px">
      <span style="flex:1;color:var(--t1)">${r.nome}</span>
      <span style="font-family:var(--fm);color:var(--t3);font-size:9px">${r.comissao_porcentagem||0}%</span>
      <button onclick="if(confirm('Remover ${r.nome}?')){sbRemoverParceiro(${r.id});carregarParceirosAdmin()}" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:10px">Ô£ò</button>
    </div>`).join('');
}
async function carregarComissoesAdmin() {
  const el = document.getElementById('adminComissoes');
  if (!el) return;
  const rows = await sbCarregarComissoes();
  if (!rows.length) { el.innerHTML = '<div style="font-size:10px;color:var(--t3)">Nenhuma comiss├úo registada</div>'; return; }
  el.innerHTML = rows.map(r => `
    <div style="display:flex;align-items:center;gap:4px;padding:3px 6px;background:var(--z3);border-radius:var(--r);margin-bottom:2px;font-size:10px">
      <span style="flex:1;color:var(--t1)">${r.parceiro_nome}</span>
      <span style="color:var(--b)">${r.valor_comissao.toLocaleString()} Kz</span>
      <span style="font-family:var(--fm);color:${r.estado==='pago'?'var(--b)':'#FBBF24'};font-size:8px">${r.estado==='pago'?'Ô£ô PAGO':'ÔÅ│'}</span>
      ${r.estado==='pendente'?`<button onclick="sbPagarComissao(${r.id});carregarComissoesAdmin()" style="background:none;border:.5px solid var(--eb);color:var(--b);border-radius:6px;cursor:pointer;font-size:9px;padding:2px 6px">Pagar</button>`:''}
    </div>`).join('');
}
async function adminCriarParceiro() {
  const nome = document.getElementById('adminParNome')?.value?.trim();
  const wa = document.getElementById('adminParWA')?.value?.trim();
  const perc = parseInt(document.getElementById('adminParPerc')?.value) || 10;
  const cod = document.getElementById('adminParCod')?.value?.trim().toUpperCase() || ('PAR' + Date.now().toString(36).toUpperCase());
  if (!nome) { mostrarToast('Insere o nome do parceiro.'); return; }
  const ok = await sbCriarParceiro(nome, wa, perc, cod);
  if (ok) { mostrarToast(`Ô£ô Parceiro ${nome} criado! C├│digo: ${cod}`); document.getElementById('adminParNome').value=''; document.getElementById('adminParWA').value=''; document.getElementById('adminParPerc').value='10'; document.getElementById('adminParCod').value=''; carregarParceirosAdmin(); }
  else mostrarToast('Erro ao criar parceiro.');
}

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   INSTITUI├ç├òES PARCEIRAS (ADMIN)
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
async function carregarInstituicoesAdmin() {
  const el = document.getElementById('adminInstituicoes');
  if (!el) return;
  const rows = await sbCarregarInstituicoes();
  if (!rows.length) { el.innerHTML = '<div style="font-size:11px;color:var(--t3)">Nenhuma institui├º├úo</div>'; return; }
  el.innerHTML = rows.map(r => `
    <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--z3);border-radius:var(--r);margin-bottom:3px;font-size:11px">
      <span style="flex:1;color:var(--t1)">${r.nome}</span>
      <span style="font-family:var(--fm);color:var(--t3);width:40px">${r.sigla||''}</span>
      <span style="color:var(--b);width:30px;text-align:right">${r.desconto_porcentagem||0}%</span>
      <button onclick="if(confirm('Remover ${r.nome}?')){sbRemoverInstituicao(${r.id});carregarInstituicoesAdmin()}" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:12px">Ô£ò</button>
    </div>`).join('');
}
async function adminCriarInst() {
  const nome = document.getElementById('adminInstNome')?.value?.trim();
  const sigla = document.getElementById('adminInstSigla')?.value?.trim().toUpperCase();
  const desc = parseInt(document.getElementById('adminInstDesc')?.value) || 0;
  if (!nome) { mostrarToast('Insere o nome da institui├º├úo.'); return; }
  const ok = await sbCriarInstituicao(nome, sigla, desc);
  if (ok) { mostrarToast(`Ô£ô ${nome} adicionada!`); document.getElementById('adminInstNome').value=''; document.getElementById('adminInstSigla').value=''; document.getElementById('adminInstDesc').value=''; carregarInstituicoesAdmin(); }
  else mostrarToast('Erro ao criar institui├º├úo.');
}

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   DASHBOARD GLOBAL
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
async function carregarDashboard() {
  const el = document.getElementById('adminDashboard');
  if (!el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:8px;text-align:center">A carregar m├®tricas...</div>';
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
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--sf3);border-radius:var(--r2);padding:10px">
          <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em">UTILIZADORES</div>
          <div style="font-size:20px;font-weight:800;color:var(--b)">${totalUsers}</div>
        </div>
        <div style="background:var(--sf3);border-radius:var(--r2);padding:10px">
          <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em">DOCUMENTOS</div>
          <div style="font-size:20px;font-weight:800;color:var(--b)">${totalDocs}</div>
        </div>
        <div style="background:var(--sf3);border-radius:var(--r2);padding:10px">
          <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em">PAGAMENTOS</div>
          <div style="font-size:20px;font-weight:800;color:var(--b)">${totalPags}</div>
        </div>
        <div style="background:var(--sf3);border-radius:var(--r2);padding:10px">
          <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em">RECEITA (Kz)</div>
          <div style="font-size:16px;font-weight:800;color:var(--b)">${receita.toLocaleString()}</div>
        </div>
      </div>
      <div style="margin-top:8px;font-family:var(--fm);font-size:8px;color:var(--t3)">${uniqUsers} utilizadores activos ┬À ${totalDocs} documentos totais</div>`;
  } catch (e) {
    el.innerHTML = '<div style="font-size:11px;color:var(--t3)">Erro ao carregar dashboard</div>';
  }
}

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   RELAT├ôRIOS
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
async function gerarRelatorio() {
  const el = document.getElementById('adminRelatorios');
  if (!el) return;
  el.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:6px 0">A gerar relat├│rio...</div>';
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

    /* CSV */
    const csvLinhas = [
      'Relat├│rio ACADEMY,Valor',
      `Utilizadores,${totalUsers}`,
      `Documentos,${totalDocs}`,
      `Pagamentos,${totalPags}`,
      `Receita Total,${receita} Kz`,
      `Comiss├Áes Pendentes,${comPend} Kz`,
      `Comiss├Áes Pagas,${comPago} Kz`,
      `Institui├º├Áes Parceiras,${Array.isArray(insts)?insts.length:0}`,
      '',
      'Documentos Recentes',
      'Utilizador,T├¡tulo,Tipo,P├íginas,Data',
      ...(Array.isArray(docs) ? docs.slice(0,20).map(d => `"${d.uid||''}","${(d.titulo||'').replace(/"/g,'""')}","${d.tipo||''}",${d.pags||0},"${d.updated_at?new Date(d.updated_at).toLocaleDateString('pt-PT'):''}"`) : []),
    ].join('\n');

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:var(--z3);border-radius:var(--r);padding:8px">
          <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em">UTILIZADORES</div>
          <div style="font-size:18px;font-weight:800;color:var(--t1)">${totalUsers}</div>
        </div>
        <div style="background:var(--z3);border-radius:var(--r);padding:8px">
          <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em">DOCUMENTOS</div>
          <div style="font-size:18px;font-weight:800;color:var(--t1)">${totalDocs}</div>
        </div>
        <div style="background:var(--z3);border-radius:var(--r);padding:8px">
          <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em">RECEITA (Kz)</div>
          <div style="font-size:14px;font-weight:800;color:var(--b)">${receita.toLocaleString()}</div>
        </div>
        <div style="background:var(--z3);border-radius:var(--r);padding:8px">
          <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.06em">COMISS├òES PENDENTES</div>
          <div style="font-size:14px;font-weight:800;color:#FBBF24">${comPend.toLocaleString()} Kz</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn B s" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(csvLinhas)}')).then(()=>mostrarToast('Ô£ô CSV copiado!'))" style="font-size:10px">­ƒôï Copiar CSV</button>
        <button class="btn G s" onclick="baixarCSV()" style="font-size:10px">Ô¼ç Baixar CSV</button>
      </div>`;
    window.__relatorioCSV = csvLinhas;
  } catch(e) {
    el.innerHTML = '<div style="font-size:11px;color:#f87171">Erro ao gerar relat├│rio</div>';
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

/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
   AUTH DO ADMIN (PIN via Edge Function)
ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */
function _abrirAdminAuth() {
  const modal = document.createElement('div');
  modal.id = 'adminAuthModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.85);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;padding:24px';
  modal.innerHTML = `
    <div style="background:var(--z2);border:1.5px solid rgba(251,191,36,.3);border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center">
      <div style="font-size:28px;margin-bottom:12px">­ƒöÉ</div>
      <div style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:6px">Acesso Restrito</div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:18px">Introduz o PIN de administrador</div>
      <input id="adminPinInp" type="password" class="inp" placeholder="PIN de acesso"
        style="margin-bottom:14px;text-align:center;letter-spacing:.3em;font-size:20px"
        maxlength="10"
        onkeydown="if(event.key==='Enter')_verificarAdminPin()"/>
      <button class="btn B w" onclick="_verificarAdminPin()" id="adminPinBtn">Entrar ÔåÆ</button>
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

  if (btn) { btn.disabled = true; btn.textContent = 'A verificarÔÇª'; }

  const ok = await _verificarCredenciaisAdmin('', pin);

  if (ok) {
    document.getElementById('adminAuthModal')?.remove();
    irPara('admin');
  } else {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar ÔåÆ'; }
    if (err) err.style.display = 'block';
    if (inp) { inp.value = ''; inp.focus(); }
  }
}
