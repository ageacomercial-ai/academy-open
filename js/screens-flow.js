/* ═══════════════════════════════════════════════════════════
   ACADEMY — SCREENS-FLOW.JS
   Ecrãs do fluxo de criação de documentos:
   Entrada → Início → Tipo → Tema → Nível → Identidade
   → Preview → Plano → Estrutura → Geração
   Depende de: state.js, navigation.js, auth.js, generator.js
═══════════════════════════════════════════════════════════ */

/* ── Rodapé padrão ── */
const RODAPE_HTML = `
<div style="padding:28px 0 8px;text-align:center">
  <div style="font-family:var(--fm);font-size:9px;color:var(--t4);letter-spacing:.1em">
    GRUPO AGEA COMERCIAL · CEO ADELINO GRAÇA
  </div>
</div>`;

/* ════════════════════════════════════════════════════════════
   ECRÃ 0 — ENTRADA (registo / boas vindas)
════════════════════════════════════════════════════════════ */
function sEntrada() {
  return `
  <div class="entrada-ecra">
    <div style="text-align:center;margin-bottom:20px;width:180px;margin-left:auto;margin-right:auto">
      ${LOGO_SVG_RAW}
    </div>
    <div class="entrada-titulo">A tua plataforma de<br/><strong>desempenho académico</strong></div>
    <div class="entrada-sub">ACADEMY · A tua plataforma académica</div>

    <div class="entrada-form">
      <label class="lbl">Nome completo *</label>
      <input class="inp" id="en" placeholder="Como te chamas?" maxlength="60"
        style="margin-bottom:10px"
        oninput="document.getElementById('nomeErr').style.display='none'"
        onkeydown="if(event.key==='Enter')document.getElementById('eEmail').focus()"/>
      <div id="nomeErr" style="display:none;color:#f87171;font-family:var(--fm);font-size:11px;margin-bottom:10px;padding:6px 10px;background:rgba(248,113,113,.07);border:.5px solid rgba(248,113,113,.25);border-radius:var(--r3)"></div>

      <label class="lbl">E-mail <span style="color:var(--t4)">(opcional)</span></label>
      <input class="inp" id="eEmail" type="email" placeholder="teu@email.com"
        style="margin-bottom:10px"
        onkeydown="if(event.key==='Enter')document.getElementById('eWA').focus()"/>

      <label class="lbl">WhatsApp <span style="color:var(--t4)">(opcional)</span></label>
      <input class="inp" id="eWA" type="tel" placeholder="+244 9XX XXX XXX"
        style="margin-bottom:10px"
        onkeydown="if(event.key==='Enter')document.getElementById('eniv').focus()"/>

      <label class="lbl">Nível Académico</label>
      <select class="inp" id="eniv" style="margin-bottom:22px">
        ${NIVEIS.map(n => `<option>${n}</option>`).join('')}
      </select>

      <button class="btn B w" onclick="fazerEntrada()" style="font-size:15px;padding:14px">
        Entrar na plataforma →
      </button>
    </div>

    <div class="entrada-pv" style="margin-top:14px">
      <div class="entrada-pt"></div>
      <strong>Gratuito</strong> · Sessão guardada automaticamente
    </div>
    <div style="margin-top:20px;padding-bottom:24px;text-align:center">
      <div style="font-family:var(--fm);font-size:10px;color:var(--t3);letter-spacing:.1em">
        GRUPO AGEA COMERCIAL · CEO ADELINO GRAÇA
      </div>
    </div>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 1 — INÍCIO (dashboard)
════════════════════════════════════════════════════════════ */
function sInicio() {
  const docs       = getDocs();
  const creditos   = getCreditos();
  const nome       = State.get('u')?.nome?.split(' ')[0] || '';
  const cfg        = State.get('cfg');
  const diasRest   = getDiasRestantes();
  const expCor     = diasRest === null ? '' : diasRest <= 3 ? '#f87171' : diasRest <= 7 ? '#FBBF24' : 'var(--t3)';

  /* Toast de expiração se <3 dias */
  if (diasRest !== null && diasRest > 0 && diasRest <= 3 && !sessionStorage.getItem('expWarn')) {
    sessionStorage.setItem('expWarn', '1');
    setTimeout(() => mostrarToast(`⚠️ Teu crédito expira em ${diasRest} dia(s). Adquire mais páginas em Planos →`), 800);
  }
  if (diasRest !== null && diasRest <= 0 && !sessionStorage.getItem('expWarn')) {
    sessionStorage.setItem('expWarn', '1');
    setTimeout(() => mostrarToast(`⚠️ Teu crédito expirou. Adquire novas páginas para continuares.`), 800);
  }

  return `
  <!-- SAUDAÇÃO -->
  <div style="padding:4px 0 20px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--b);margin-bottom:6px">ACADEMY · DESEMPENHO ACADÉMICO</div>
    <div style="font-size:26px;font-weight:800;color:var(--t1);letter-spacing:-.025em;line-height:1.15">
      Olá${nome ? `, <strong style="color:var(--b)">${nome}</strong>` : ''}!<br/>
      <span style="color:var(--t2);font-size:20px;font-weight:600">O que criamos hoje?</span>
    </div>

    <!-- Badge do saldo -->
    <div onclick="irPara('planos')" style="margin-top:14px;background:var(--sf3);border:.5px solid var(--eb);border-radius:var(--r2);padding:10px 14px;display:flex;align-items:center;gap:10px;cursor:pointer">
      <div style="font-size:16px">🎁</div>
      <div style="flex:1">
        <div style="font-family:var(--fm);font-size:8px;color:var(--b);letter-spacing:.1em">SALDO</div>
        <div style="font-size:12px;color:var(--t2);margin-top:1px">
          ${temCreditoActivo()
            ? `${getCreditosPags()} páginas de crédito disponíveis`
            : (creditos.gen_usada
                ? `Geração gratuita utilizada · <span style="color:var(--b)">Adquirir páginas →</span>`
                : `1 geração gratuita disponível · <span style="color:var(--b)">Usar agora →</span>`)}
        </div>
        ${diasRest !== null ? `<div style="font-family:var(--fm);font-size:8px;color:${expCor};margin-top:2px">${diasRest <= 0 ? '⚠️ Crédito expirado' : `⏳ ${diasRest} dia(s) restantes · até ${getSaldoExpiracao()}`}</div>` : ''}
      </div>
      <div style="color:var(--t3);font-size:16px">›</div>
    </div>
  </div>

  <div class="inicio-cards-grid">
  <!-- MÓDULO 1: TRABALHOS ACADÉMICOS -->
  <div onclick="irPara('tipo')" style="background:linear-gradient(135deg,var(--eb),transparent);border:.5px solid var(--eb);border-radius:var(--r4);padding:20px;margin-bottom:12px;cursor:pointer;transition:all .22s">
    <div style="display:flex;align-items:flex-start;gap:14px">
      <div style="width:48px;height:48px;border-radius:14px;background:var(--eb);border:.5px solid var(--eb);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="var(--b)" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="var(--b)" stroke-width="1.8"/>
          <path d="M8 7h8M8 11h6" stroke="var(--b)" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:17px;font-weight:700;color:var(--t1)">Trabalhos Académicos</div>
          <div style="font-family:var(--fm);font-size:8px;background:var(--b);color:var(--t-inv);padding:3px 8px;border-radius:10px;font-weight:700">01</div>
        </div>
        <div style="font-size:12.5px;color:var(--t2);line-height:1.6;margin-bottom:10px">TFC · Monografia · Artigo Científico · Trabalho Investigativo · Seminário · Relatório e muito mais.</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['TFC','Monografia','Artigo','Investigativo','Seminário'].map(t =>
            `<span style="font-family:var(--fm);font-size:8px;background:var(--eb);border:.5px solid var(--eb);color:var(--b);padding:3px 8px;border-radius:10px">${t}</span>`
          ).join('')}
          <span style="font-family:var(--fm);font-size:8px;color:var(--t3);padding:3px 8px">+ outros →</span>
        </div>
      </div>
    </div>
  </div>

  <!-- MÓDULO 2: DOCUMENTOS -->
  <div onclick="nav('documentos')" style="background:linear-gradient(135deg,rgba(34,211,238,.08),rgba(34,211,238,.03));border:.5px solid rgba(34,211,238,.2);border-radius:var(--r4);padding:20px;margin-bottom:20px;cursor:pointer;transition:all .22s">
    <div style="display:flex;align-items:flex-start;gap:14px">
      <div style="width:48px;height:48px;border-radius:14px;background:rgba(34,211,238,.1);border:.5px solid rgba(34,211,238,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#22D3EE" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M14 2v6h6" stroke="#22D3EE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 13h8M8 17h5" stroke="#22D3EE" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:17px;font-weight:700;color:var(--t1)">Documentos</div>
          <div style="font-family:var(--fm);font-size:8px;background:var(--o);color:#03090E;padding:3px 8px;border-radius:10px;font-weight:700">02</div>
        </div>
        <div style="font-size:12.5px;color:var(--t2);line-height:1.6;margin-bottom:10px">Curriculum Vitae · Contratos · Ofícios · Declarações · Actas · Requerimentos.</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['CV','Contrato','Ofício','Declaração','Acta'].map(t =>
            `<span style="font-family:var(--fm);font-size:8px;background:rgba(34,211,238,.07);border:.5px solid rgba(34,211,238,.18);color:var(--o);padding:3px 8px;border-radius:10px">${t}</span>`
          ).join('')}
          <span style="font-family:var(--fm);font-size:8px;color:var(--t3);padding:3px 8px">+ outros →</span>
        </div>
      </div>
    </div>
  </div>
  </div><!-- /inicio-cards-grid -->


  ${(() => {
    const rd = temRascunhoPendente();
    if (!rd || cfg?.tema === rd.cfg?.tema) return '';
    const tp = TIPOS.find(t => t.id === rd.cfg?.tipo);
    return `
    <div id="banner-rascunho" style="background:linear-gradient(135deg,rgba(251,191,36,.09),rgba(251,191,36,.04));border:.5px solid rgba(251,191,36,.35);border-radius:var(--r4);padding:14px 16px;margin-bottom:14px;position:relative">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:22px;flex-shrink:0">📋</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--fm);font-size:7px;letter-spacing:.14em;color:rgba(251,191,36,.8);text-transform:uppercase;margin-bottom:3px">Trabalho guardado — aguarda pagamento</div>
          <div style="font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${rd.cfg.tema.substring(0, 52)}</div>
          <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-top:2px">${tp?.n || 'Trabalho Académico'} · ${rd.est?.length || '?'} capítulos</div>
        </div>
        <button onclick="document.getElementById('banner-rascunho').remove();limparRascunhoPendente()" style="width:22px;height:22px;border-radius:6px;background:transparent;border:.5px solid rgba(255,255,255,.1);color:var(--t3);font-size:13px;cursor:pointer">✕</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn G s" style="flex:1;font-size:12px" onclick="_retornarRascunho()">↺ Continuar trabalho →</button>
      </div>
    </div>`;
  })()}

  <!-- TRABALHO EM CURSO -->
  ${cfg.tema && cfg.tipo && !State.get('genFim') ? `
  <div style="background:rgba(56,189,248,.06);border:.5px solid rgba(56,189,248,.2);border-radius:var(--r2);padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="irPara('geracao')">
    <div style="font-size:16px">⚡</div>
    <div style="flex:1">
      <div style="font-family:var(--fm);font-size:7px;color:var(--o);letter-spacing:.1em;margin-bottom:2px">EM PROGRESSO</div>
      <div style="font-size:13px;color:var(--t1);font-weight:500">${cfg.tema.substring(0, 50)}…</div>
    </div>
    <div style="color:var(--o);font-size:13px">›</div>
  </div>` : ''}

  <!-- RECENTES -->
  ${docs.length > 0 ? `
  <div style="font-family:var(--fm);font-size:8px;letter-spacing:.12em;color:var(--t3);text-transform:uppercase;margin-bottom:8px">Documentos recentes</div>
  <div style="display:flex;flex-direction:column;gap:1px;background:var(--e0);border-radius:var(--r2);overflow:hidden;margin-bottom:16px">
    ${docs.slice(0, 3).map(d => `
    <div style="background:var(--z2);padding:11px 14px;cursor:pointer;display:flex;align-items:center;gap:10px" onclick="abrirDoc(${d.id})">
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-bottom:2px">${d.tipo || 'TFC'} · ${d.em}</div>
        <div style="font-size:13px;font-weight:500;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.tema || 'Sem título'}</div>
      </div>
      <div style="color:var(--t4);font-size:13px">›</div>
    </div>`).join('')}
  </div>` : ''}

  ${RODAPE_HTML}`;
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 2 — TIPO DE TRABALHO
════════════════════════════════════════════════════════════ */
let _modoProfAberto = false;

function sTipo() {
  const selTipo = State.getCfg('tipo');
  return `
  <div style="padding-bottom:32px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:6px">PASSO 1 DE 4</div>
    <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-.02em;margin-bottom:6px">Que trabalho vamos criar?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:22px;line-height:1.6">Selecciona o tipo de trabalho académico.</div>

    <div style="display:flex;flex-direction:column;gap:8px">
      ${TIPOS.map(t => {
        const selected = selTipo === t.id;
        return `
      <div onclick="State.setCfg('tipo','${t.id}');renderizar()"
        style="background:${selected ? 'var(--sf3)' : 'var(--z2)'};border:.5px solid ${selected ? 'var(--eb)' : 'var(--e1)'};border-radius:var(--r2);padding:15px 16px;cursor:pointer;display:flex;align-items:center;gap:14px;transition:all .2s">
        <div style="font-size:24px;width:36px;text-align:center;flex-shrink:0">${t.i}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600;color:var(--t1)">${t.n}</div>
          <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-top:2px;letter-spacing:.06em">${t.s}</div>
        </div>
        <div style="font-size:12px;color:${selected ? 'var(--b)' : 'var(--t4)'}">${selected ? '✓' : '›'}</div>
      </div>`;}).join('')}
    </div>

    ${selTipo ? `
    <!-- Pré-visualização da estrutura -->
    <div style="margin-top:16px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r2);padding:14px 16px">
      <div style="font-family:var(--fm);font-size:7px;letter-spacing:.14em;color:var(--b);text-transform:uppercase;margin-bottom:8px">ESTRUTURA — ${(TIPOS.find(t=>t.id===selTipo)?.s||'').toUpperCase()}</div>
      <div style="font-size:12px;color:var(--t2);line-height:2">
        ${(ESTRUTURAS_TIPO[selTipo] || ['Introdução','Desenvolvimento','Conclusão','Referências Bibliográficas']).map(e => `· ${e}`).join('<br/>')}
      </div>
    </div>

    <!-- Modo Professor -->
    <div style="margin-top:12px;background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r2);overflow:hidden">
      <div onclick="_modoProfAberto=!_modoProfAberto;renderizar()"
        style="padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">🎓</span>
        <span style="flex:1;font-size:13px;font-weight:600;color:var(--t1)">Modo Professor</span>
        <span style="font-family:var(--fm);font-size:8px;background:rgba(251,191,36,.12);color:#FBBF24;padding:2px 6px;border-radius:6px;font-weight:600">NOVO</span>
        <span style="color:var(--t3);font-size:14px">${_modoProfAberto ? '▲' : '▼'}</span>
      </div>
      <div style="display:${_modoProfAberto ? 'block' : 'none'};padding:0 14px 14px">
        <div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:10px">O professor exige estrutura específica? No próximo passo, cola a estrutura que o professor pediu — a ACADEMY vai respeitar exactamente essa estrutura.</div>
      </div>
    </div>

    <button class="btn B w" style="margin-top:16px" onclick="if(!State.getCfg('tipo')){mostrarToast('Selecciona um tipo de trabalho.','erro');return;}irPara('tema_')">Continuar →</button>
    ` : ''}
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 3 — TEMA
════════════════════════════════════════════════════════════ */
const _SUGESTOES_TEMA = [
  'Impacto das TIC no rendimento académico em Angola',
  'Empreendedorismo juvenil e redução do desemprego em Angola',
  'Gestão de resíduos sólidos urbanos na cidade de Luanda',
  'Qualidade do ensino superior em Angola: desafios e perspectivas',
  'Saúde pública em Angola: acesso e qualidade dos serviços',
  'Microcrédito e empoderamento feminino no meio rural angolano',
  'Turismo como motor do desenvolvimento económico em Angola',
  'Mudanças climáticas e impactos na agricultura familiar angolana',
];

function sTema() {
  const tp = tipoActual() || { n: 'Trabalho Académico' };
  const temaAtual = State.getCfg('tema') || '';
  return `
  <div style="padding-bottom:32px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:6px">PASSO 2 DE 4</div>
    <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-.02em;margin-bottom:6px">Qual é o tema?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:22px;line-height:1.6">${tp.n} — escreve o tema ou título provisório.</div>

    <label class="lbl">Tema / Título do trabalho *</label>
    <textarea class="inp" id="temaInp" placeholder="Ex: O impacto das tecnologias de informação no sector bancário angolano"
      style="min-height:90px;resize:vertical;margin-bottom:16px"
      oninput="State.setCfg('tema',this.value.trim())">${temaAtual}</textarea>

    <!-- Sugestões -->
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.1em;color:var(--t3);margin-bottom:8px;text-transform:uppercase">💡 Sugestões de tema</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px">
      ${_SUGESTOES_TEMA.map(s => `
      <span onclick="document.getElementById('temaInp').value='${s.replace(/'/g, "\\'")}';State.setCfg('tema','${s.replace(/'/g, "\\'")}');renderizar()"
        style="padding:6px 12px;border-radius:var(--r2);background:${s === temaAtual ? 'var(--eb)' : 'var(--z2)'};border:.5px solid ${s === temaAtual ? 'var(--eb)' : 'var(--e0)'};color:${s === temaAtual ? 'var(--b)' : 'var(--t2)'};font-size:11px;cursor:pointer;transition:all .15s">${s}</span>
      `).join('')}
    </div>

    <label class="lbl">Estrutura definida pelo professor <span style="color:var(--t4)">(opcional)</span></label>
    <textarea class="inp" id="estProfInp" placeholder="Cola aqui a estrutura que o professor pediu. A ACADEMY vai respeitar exactamente essa estrutura."
      style="min-height:70px;resize:vertical;margin-bottom:22px"
      oninput="State.setCfg('estruturaProf',this.value)">${State.getCfg('estruturaProf') || ''}</textarea>

    <button class="btn B w" onclick="
      const v=document.getElementById('temaInp').value.trim();
      if(v.length<10){mostrarToast('O tema deve ter pelo menos 10 caracteres.','erro');return;}
      State.setCfg('tema',v);
      State.setCfg('estruturaProf',document.getElementById('estProfInp').value);
      irPara('nivel')">
      Continuar →
    </button>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 4 — NÍVEL E PÁGINAS
════════════════════════════════════════════════════════════ */
function sNivel() {
  return `
  <div style="padding-bottom:32px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:6px">PASSO 3 DE 4</div>
    <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-.02em;margin-bottom:6px">Contexto do trabalho</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:22px;line-height:1.6">Nível académico, turma, área e extensão.</div>

    <label class="lbl">Nível Académico *</label>
    <select class="inp" id="sNiv" style="margin-bottom:14px" onchange="State.setCfg('nivel',this.value)">
      <option value="">— Selecciona —</option>
      ${NIVEIS.map(n => `<option ${State.getCfg('nivel') === n ? 'selected' : ''}>${n}</option>`).join('')}
    </select>

    <label class="lbl">Turma / Ano <span style="color:var(--t4)">(opcional)</span></label>
    <select class="inp" id="sTurma" style="margin-bottom:14px" onchange="State.setCfg('turma',this.value)">
      <option value="">— Selecciona —</option>
      ${[...TURMAS, ...ANOS_SUP].map(t => `<option ${State.getCfg('turma') === t ? 'selected' : ''}>${t}</option>`).join('')}
    </select>

    <label class="lbl">Área / Curso <span style="color:var(--t4)">(opcional)</span></label>
    <input class="inp" id="sArea" placeholder="Ex: Gestão de Empresas, Direito, Engenharia…"
      value="${State.getCfg('area') || ''}" style="margin-bottom:14px"
      oninput="State.setCfg('area',this.value)"/>

    <label class="lbl">Número de páginas</label>
    <select class="inp" id="sPags" style="margin-bottom:22px" onchange="State.setCfg('pags',+this.value)">
      ${PAGS.map(p => `<option value="${p}" ${State.getCfg('pags') === p ? 'selected' : ''}>${p} páginas</option>`).join('')}
    </select>

    <button class="btn B w" onclick="
      const niv=document.getElementById('sNiv').value;
      if(!niv){mostrarToast('Selecciona o nível académico.','erro');return;}
      State.setCfg('nivel',niv);
      irPara('identidade')">
      Continuar →
    </button>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 5 — IDENTIDADE (prof, inst, membros, modo grupo)
════════════════════════════════════════════════════════════ */
function sIdentidade() {
  const mbs = State.getCfg('mbs') || [];
  const isGrupo = mbs.length > 0;
  return `
  <div style="padding-bottom:32px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:6px">PASSO 4 DE 4</div>
    <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-.02em;margin-bottom:6px">Identidade do trabalho</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:22px;line-height:1.6">Estes dados aparecem na capa e nos cabeçalhos do documento.</div>

    <!-- Modo Individual / Grupo -->
    <label class="lbl">Modalidade</label>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <div onclick="toggleModo(false)" id="modIndBtn" style="flex:1;padding:12px;text-align:center;border-radius:var(--r);cursor:pointer;background:${!isGrupo?'var(--b)':'var(--z2)'};color:${!isGrupo?'var(--t-inv)':'var(--t2)'};border:.5px solid var(--e1);font-weight:600;font-size:13px;transition:all .2s">Individual</div>
      <div onclick="toggleModo(true)" id="modGrpBtn" style="flex:1;padding:12px;text-align:center;border-radius:var(--r);cursor:pointer;background:${isGrupo?'var(--b)':'var(--z2)'};color:${isGrupo?'var(--t-inv)':'var(--t2)'};border:.5px solid var(--e1);font-weight:600;font-size:13px;transition:all .2s">Grupo</div>
    </div>

    <!-- Membros do grupo (visível apenas se grupo) -->
    <div id="grupoCampos" style="display:${isGrupo?'block':'none'}">
      <label class="lbl">Número de integrantes</label>
      <select class="inp" id="iNumMbs" style="margin-bottom:14px" onchange="actualizarMembros(+this.value)">
        ${[2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${mbs.length===n?'selected':''}>${n} integrantes</option>`).join('')}
      </select>
      <div id="membrosLista" style="margin-bottom:16px">
        ${mbs.map((m, i) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-family:var(--fm);font-size:9px;color:var(--t3);width:20px;flex-shrink:0">${i+1}.</span>
          <input class="inp" placeholder="Nome do integrante ${i+1}" value="${m.nome||''}" style="flex:1;font-size:12px;margin:0" oninput="mbsNome(${i},this.value)"/>
        </div>`).join('')}
      </div>
    </div>

    <label class="lbl">Nome do Autor</label>
    <input class="inp" id="iAutor" placeholder="Ex: José Maria dos Santos"
      value="${State.getCfg('autor') || ''}" style="margin-bottom:14px"
      oninput="State.setCfg('autor',this.value)"/>

    <label class="lbl">Nome do Orientador/Professor</label>
    <input class="inp" id="iProf" placeholder="Ex: Prof. Dr. João Silva"
      value="${State.getCfg('prof') || ''}" style="margin-bottom:14px"
      oninput="State.setCfg('prof',this.value)"/>

    <label class="lbl">Nome da Instituição</label>
    <input class="inp" id="iInst" placeholder="Ex: Universidade Agostinho Neto"
      value="${State.getCfg('inst') || ''}" style="margin-bottom:14px"
      oninput="State.setCfg('inst',this.value)"/>

    <label class="lbl">Número de capítulos</label>
    <select class="inp" id="iCaps" style="margin-bottom:14px" onchange="State.setCfg('numCaps',+this.value)">
      ${[3,4,5,6,7,8].map(n => `<option value="${n}" ${State.getCfg('numCaps') === n ? 'selected' : ''}>${n} capítulos</option>`).join('')}
    </select>

    <label class="lbl">Estilo de referências</label>
    <select class="inp" id="iRef" style="margin-bottom:22px" onchange="State.setCfg('refStyle',this.value)">
      ${['APA','ABNT','Vancouver','MLA','Chicago','ISO 690'].map(s =>
        `<option ${State.getCfg('refStyle') === s ? 'selected' : ''}>${s}</option>`
      ).join('')}
    </select>

    <button class="btn B w" onclick="
      State.setCfg('prof', document.getElementById('iProf').value);
      State.setCfg('inst', document.getElementById('iInst').value);
      gerarEst()">
      Gerar Estrutura →
    </button>
  </div>`;
}

/* ── Helpers do ecrã de identidade ── */
function toggleModo(isGrupo) {
  const indBtn = document.getElementById('modIndBtn');
  const grpBtn = document.getElementById('modGrpBtn');
  const campos = document.getElementById('grupoCampos');
  if (!indBtn || !grpBtn) return;
  if (isGrupo) {
    indBtn.style.background = 'var(--z2)'; indBtn.style.color = 'var(--t2)';
    grpBtn.style.background = 'var(--b)';  grpBtn.style.color = 'var(--t-inv)';
    campos.style.display = 'block';
    if (!State.getCfg('mbs')?.length) actualizarMembros(2);
  } else {
    indBtn.style.background = 'var(--b)';  indBtn.style.color = 'var(--t-inv)';
    grpBtn.style.background = 'var(--z2)'; grpBtn.style.color = 'var(--t2)';
    campos.style.display = 'none';
    State.setCfg('mbs', []);
  }
}
function actualizarMembros(n) {
  const mbs = State.getCfg('mbs') || [];
  while (mbs.length < n) mbs.push({ nome: '' });
  while (mbs.length > n) mbs.pop();
  State.setCfg('mbs', mbs);
  const div = document.getElementById('membrosLista');
  if (!div) return;
  div.innerHTML = mbs.map((m, i) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-family:var(--fm);font-size:9px;color:var(--t3);width:20px;flex-shrink:0">${i+1}.</span>
      <input class="inp" placeholder="Nome do integrante ${i+1}" value="${m.nome||''}" style="flex:1;font-size:12px;margin:0" oninput="mbsNome(${i},this.value)"/>
    </div>`
  ).join('');
}
function mbsNome(i, nome) {
  const mbs = State.getCfg('mbs') || [];
  mbs[i] = mbs[i] || { nome: '' };
  mbs[i].nome = nome;
  State.setCfg('mbs', mbs);
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 6 — PREVIEW DA GERAÇÃO
════════════════════════════════════════════════════════════ */
function sPreviewGen() {
  const cfg    = State.get('cfg');
  const tp     = tipoActual() || { n: 'Trabalho Académico' };
  const est    = State.get('est') || [];
  const numCap = est.length;
  const numSub = est.reduce((a, c) => a + (c.subs?.length || 0), 0);
  const pags   = cfg.pags || 15;
  const pac    = calcPacote(pags);
  const saldo  = getSaldoDisponivel();
  const saldoOk = saldo >= pags;
  const exp    = getSaldoExpiracao();
  const descInst = getDescontoInst();

  return `
  <div style="padding-bottom:32px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--b);margin-bottom:6px">CONFIRMAR</div>
    <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-.02em;margin-bottom:18px">O teu trabalho está pronto para gerar</div>

    <!-- Saldo -->
    <div style="background:var(--z2);border:.5px solid var(--e1);border-radius:var(--r2);padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
      <div style="font-size:20px">${saldo > 0 ? '✅' : '⚠️'}</div>
      <div style="flex:1">
        <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.1em;text-transform:uppercase">Teu saldo</div>
        <div style="font-size:14px;font-weight:700;color:${saldoOk ? 'var(--b)' : '#f87171'}">
          ${saldo >= 9999 ? 'Gratuito (1 geração)' : `${saldo} páginas disponíveis`}
        </div>
        ${exp ? `<div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-top:1px">Válido até ${exp}</div>` : ''}
        ${!saldoOk ? `<div style="font-family:var(--fm);font-size:9px;color:#f87171;margin-top:2px">Precisas de ${pags - saldo} páginas adicionais</div>` : ''}
      </div>
    </div>

    <!-- Resumo -->
    <div style="background:var(--z2);border:.5px solid var(--e1);border-radius:var(--r2);padding:16px;margin-bottom:12px">
      <div style="font-family:var(--fm);font-size:8px;color:var(--b);letter-spacing:.1em;margin-bottom:12px">RESUMO DO TRABALHO</div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--t2)">
        <div><span style="color:var(--t3)">Tipo:</span> <strong style="color:var(--t1)">${tp.n}</strong></div>
        <div style="border-left:2px solid var(--eb);padding-left:10px;color:var(--t1);font-style:italic">"${(cfg.tema || '').substring(0, 80)}"</div>
        <div><span style="color:var(--t3)">Nível:</span> ${cfg.nivel || '—'} ${cfg.turma ? `· ${cfg.turma}` : ''}</div>
        <div><span style="color:var(--t3)">Estrutura:</span> ${numCap} capítulos · ${numSub} subcapítulos</div>
        <div><span style="color:var(--t3)">Extensão:</span> ${pags} páginas · estilo ${cfg.refStyle || 'APA'}</div>
        ${cfg.prof ? `<div><span style="color:var(--t3)">Orientador:</span> ${cfg.prof}</div>` : ''}
        ${cfg.inst ? `<div><span style="color:var(--t3)">Instituição:</span> ${cfg.inst}</div>` : ''}
        ${(cfg.mbs || []).length > 0 ? `<div><span style="color:var(--t3)">Modalidade:</span> Grupo · ${cfg.mbs.length} integrantes</div>` : `<div><span style="color:var(--t3)">Modalidade:</span> Individual</div>`}
      </div>
    </div>

    <!-- Custo -->
    <div style="background:linear-gradient(135deg,var(--eb),transparent);border:.5px solid var(--eb);border-radius:var(--r2);padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
      <div style="font-size:28px">📄</div>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:700;color:var(--t1)">${pac.label}</div>
        <div style="font-family:var(--fm);font-size:10px;color:var(--t3);margin-top:2px">${pags} páginas · ${pac.preco.toLocaleString()} Kz · válido 30 dias</div>
        ${descInst > 0 ? `<div style="font-family:var(--fm);font-size:9px;color:var(--b);margin-top:4px">🏫 Desconto institucional ${descInst}% aplicado!</div>` : ''}
      </div>
    </div>

    ${!saldoOk ? `
    <!-- Opções rápidas de páginas -->
    <div style="margin-bottom:12px">
      <div style="font-family:var(--fm);font-size:8px;color:var(--b);letter-spacing:.1em;margin-bottom:8px">ADQUIRIR PÁGINAS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${getPrecosCache().filter(f => f.faixa_fim >= pags - saldo).slice(0, 4).map(f => {
          const p = f.faixa_fim;
          const preco = calcPreco(p);
          return `<div style="background:var(--z2);border:.5px solid var(--eb);border-radius:var(--r2);padding:10px;text-align:center;cursor:pointer" onclick="_iniciarPagamentoAvulso(${p},${preco})">
            <div style="font-size:15px;font-weight:700;color:var(--t1)">${p}p</div>
            <div style="font-family:var(--fm);font-size:9px;color:var(--t3)">${preco.toLocaleString()} Kz</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <button class="btn G w" onclick="irPara('planos',{numPags:${pags}})" style="font-size:13px;margin-bottom:22px">
      🚀 Ver todos os planos
    </button>` : ''}

    <button class="btn B w" id="btnGerarFinal" onclick="btnGerarFinalClick()" style="font-size:15px;padding:16px;margin-bottom:10px">
      Gerar o meu trabalho →
    </button>
    <button class="btn G w" onclick="irPara('identidade')" style="font-size:13px">
      ← Editar detalhes
    </button>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 7 — PLANO (aguardar IA)
════════════════════════════════════════════════════════════ */
function sPlano() {
  const load = State.get('load');
  const plano = State.get('plano');

  if (load || !plano) {
    return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:20px;text-align:center;padding:28px">
      <div class="pts"><span></span><span></span><span></span></div>
      <div style="font-size:16px;font-weight:600;color:var(--t1)">A analisar o teu tema…</div>
      <div style="font-size:13px;color:var(--t2);max-width:260px;line-height:1.65">
        A ACADEMY está a criar o plano académico para o teu trabalho.
      </div>
    </div>`;
  }

  return `
  <div style="padding-bottom:32px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--b);margin-bottom:6px">PLANO ACADÉMICO</div>
    <div style="font-size:20px;font-weight:800;color:var(--t1);margin-bottom:18px">${plano.titulo || State.getCfg('tema') || 'O teu trabalho'}</div>

    ${plano.objetivo ? `<div style="background:var(--z2);border:.5px solid var(--e1);border-radius:var(--r2);padding:14px;margin-bottom:12px"><div style="font-family:var(--fm);font-size:8px;color:var(--b);margin-bottom:6px;letter-spacing:.08em">OBJECTIVO</div><div style="font-size:13px;color:var(--t2);line-height:1.65">${plano.objetivo}</div></div>` : ''}
    ${plano.hipotese ? `<div style="background:var(--z2);border:.5px solid var(--e1);border-radius:var(--r2);padding:14px;margin-bottom:12px"><div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-bottom:6px;letter-spacing:.08em">HIPÓTESE</div><div style="font-size:13px;color:var(--t2);line-height:1.65">${plano.hipotese}</div></div>` : ''}
    ${plano.metodologia ? `<div style="background:var(--z2);border:.5px solid var(--e1);border-radius:var(--r2);padding:14px;margin-bottom:20px"><div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-bottom:6px;letter-spacing:.08em">METODOLOGIA</div><div style="font-size:13px;color:var(--t2);line-height:1.65">${plano.metodologia}</div></div>` : ''}

    <button class="btn B w" onclick="gerarEst()" style="margin-bottom:10px">Gerar Estrutura →</button>
    <button class="btn G w" onclick="irPara('nivel')">← Ajustar detalhes</button>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 8 — ESTRUTURA (edição e aprovação)
════════════════════════════════════════════════════════════ */
function sEst() {
  const load = State.get('load');
  const est  = State.get('est');

  if (load || !est) {
    return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:20px;text-align:center;padding:28px">
      <div class="pts"><span></span><span></span><span></span></div>
      <div style="font-size:16px;font-weight:600;color:var(--t1)">A construir a estrutura académica…</div>
      <div style="font-size:13px;color:var(--t2);max-width:260px;line-height:1.65">
        A ACADEMY está a definir os capítulos e subcapítulos do teu trabalho.
      </div>
    </div>`;
  }

  return `
  <div style="padding-bottom:32px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--b);margin-bottom:6px">ESTRUTURA DO TRABALHO</div>
    <div style="font-size:20px;font-weight:800;color:var(--t1);margin-bottom:6px">${State.getCfg('tema') || 'O teu trabalho'}</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:20px;line-height:1.6">${est.length} capítulos · ${est.reduce((a, c) => a + (c.subs?.length || 0), 0)} subcapítulos</div>

    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:22px">
      ${est.map((cap, i) => `
      <div style="background:var(--z2);border:.5px solid var(--e1);border-radius:var(--r2);padding:14px 16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:${cap.subs?.length ? '10px' : '0'}">
          <div style="font-family:var(--fm);font-size:9px;color:var(--b);width:24px;flex-shrink:0">${cap.num || i + 1}.</div>
          <div style="font-size:14px;font-weight:600;color:var(--t1);flex:1">${cap.titulo}</div>
        </div>
        ${cap.subs?.length ? `
        <div style="display:flex;flex-direction:column;gap:4px;padding-left:34px">
          ${cap.subs.map(s => `<div style="font-size:12px;color:var(--t3)">· ${s}</div>`).join('')}
        </div>` : ''}
      </div>`).join('')}
    </div>

    <button class="btn B w" id="btnGerarFinal" onclick="btnGerarFinalClick()" style="font-size:15px;padding:16px;margin-bottom:10px">
      Confirmar e Gerar →
    </button>
    <button class="btn G w" onclick="gerarEst()">↺ Regenerar estrutura</button>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 9 — GERAÇÃO (progresso em tempo real)
════════════════════════════════════════════════════════════ */
function sGeracao() {
  const secs      = State.get('secs');
  const est       = State.get('est') || [];
  const genFim    = State.get('genFim');
  const cfg       = State.get('cfg');
  const total     = secs.length || est.length || 0;
  const pron      = secs.filter(s => s.e === 'p').length;
  const pct       = total ? Math.round(pron / total * 100) : 0;
  const restantes = total - pron;
  const estimativa = restantes > 0 ? `~${restantes * 8}s` : 'a concluir…';
  const nome      = State.get('u')?.nome?.split(' ')[0] || '';

  const factos = [
    'Sabia que trabalhos com hipótese clara têm 40% mais probabilidade de aprovação?',
    'Os revisores académicos valorizam a coerência entre a introdução e a conclusão.',
    'Usar o estilo APA correctamente pode aumentar a nota do teu trabalho.',
    'A metodologia é o capítulo mais analisado pelos orientadores.',
    'Trabalhos com revisão de literatura sólida demonstram domínio do tema.',
  ];
  const factoIdx = Math.floor(Date.now() / 15000) % factos.length;

  /* ── Ecrã de conclusão ── */
  if (genFim) {
    const stats = calcStats(secs);
    return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:20px;text-align:center;padding:28px">
      <div style="font-size:56px;filter:drop-shadow(0 0 20px var(--b));animation:flutuar 2.5s ease-in-out infinite">🎓</div>
      <div style="font-size:22px;font-weight:700;color:var(--t1)">${nome ? `Trabalho pronto, ${nome}!` : 'Trabalho concluído!'}</div>
      <div style="font-family:var(--fm);font-size:9px;color:var(--b);letter-spacing:.14em">● ACADEMY · GERADO COM SUCESSO</div>
      <div style="display:flex;gap:16px;font-family:var(--fm);font-size:10px;color:var(--t3)">
        <span>${stats.palavras} palavras</span><span>·</span>
        <span>${stats.pags} páginas</span><span>·</span>
        <span>~${stats.tempoLeit} min leitura</span>
      </div>
      <button class="btn O w" onclick="docConcluido()" style="max-width:300px;font-size:15px;padding:16px">🎓 Ver o meu Trabalho →</button>
      <div onclick="togChat()" style="cursor:pointer;padding:10px 18px;border:1px solid var(--eo);border-radius:var(--r);background:rgba(56,189,248,.05);color:var(--o);font-family:var(--fm);font-size:9px;letter-spacing:.08em">⚡ Treinar a defesa com o ACADEMY →</div>
    </div>`;
  }

  /* ── Ecrã de progresso ── */
  const temProg = genTemProgresso();
  return `
  <div style="display:flex;flex-direction:column;padding:28px 18px 48px">
    <div class="fase" style="margin-bottom:14px"><div class="fase-p b"></div>ACADEMY · A ESCREVER</div>
    <div style="font-size:17px;font-weight:700;color:var(--t1);margin-bottom:4px;letter-spacing:-.015em">${cfg.tema?.substring(0, 60) || 'O teu trabalho'}</div>
    <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-bottom:18px" id="estimG">${estimativa}</div>

    ${temProg && pron > 0 && pron < total ? `
    <div style="background:rgba(251,191,36,.07);border:.5px solid rgba(251,191,36,.25);border-radius:var(--r);padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <div style="font-size:20px">⏸</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--t1)">Geração pausada — ${pron}/${total} capítulos</div>
        <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-top:2px">Podes continuar de onde paraste</div>
      </div>
      <button class="btn B s" onclick="iniciarGer(true)" style="font-size:12px;padding:8px 14px;flex-shrink:0">▶ Continuar</button>
    </div>` : ''}

    <!-- Barra de progresso -->
    <div class="card-b" style="padding:14px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-family:var(--fm);font-size:9px;color:var(--t2);letter-spacing:.1em">PROGRESSO</div>
        <div style="font-size:22px;font-weight:700;color:var(--b)" id="pctN">${pct}%</div>
      </div>
      <div class="barra"><div class="barra-az" id="barraG" style="width:${pct}%"></div></div>
      <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-top:6px">${pron} de ${total} capítulos · <span id="anp">${nPags()}</span> páginas estimadas</div>
    </div>

    <!-- Lista de capítulos -->
    <div id="ls" style="display:flex;flex-direction:column;gap:6px;margin-bottom:18px">
      ${(secs.length ? secs : est).map((s, i) => {
        const e    = secs[i]?.e || 'a';
        const prev = secs[i]?.c
          ? `<div style="font-size:11px;color:var(--t3);padding:8px 0 4px;border-top:1px solid var(--e0);line-height:1.6;font-style:italic">${(secs[i].c || '').substring(0, 100)}…</div>`
          : '';
        return `
        <div class="sec${e === 'p' ? ' pronto' : e === 'g' ? ' ativo' : ''}" id="sg-${i}">
          <div class="sec-cab" id="sgp-${i}">
            <div class="sec-num" style="font-family:var(--fm);font-size:9px">${s.num || i + 1}</div>
            <div style="flex:1;font-size:13px;color:var(--t2)">${s.titulo}</div>
            <div class="etq ${e === 'p' ? 'etq-v' : e === 'g' ? 'etq-o' : 'etq-b'}" id="setq-${i}" style="font-size:8px">${e === 'p' ? '✓ PRONTO' : e === 'g' ? 'EM CURSO' : '—'}</div>
          </div>
          ${e === 'p' ? prev : ''}
          ${e === 'g' ? `<div style="padding:8px 12px;display:flex;align-items:center;gap:8px;font-family:var(--fm);font-size:10px;color:var(--t3)"><div class="pts"><span></span><span></span><span></span></div>Academy está a construir…</div>` : ''}
        </div>`;
      }).join('')}
    </div>

    <!-- Facto académico -->
    <div style="padding:14px;background:var(--z3);border:1px solid var(--e0);border-radius:var(--r);margin-bottom:16px">
      <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.1em;margin-bottom:6px">💡 SABIA QUE…</div>
      <div style="font-size:12px;color:var(--t2);line-height:1.65">${factos[factoIdx]}</div>
    </div>

    <!-- Detalhes finais (enquanto aguarda) -->
    <div style="padding:14px;background:var(--z2);border:1px solid var(--e0);border-radius:var(--r)">
      <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.1em;margin-bottom:10px">ENQUANTO AGUARDAS — DETALHES FINAIS</div>

      <label class="lbl" style="margin-bottom:4px">Dedicatória <span style="color:var(--t4)">(opcional)</span></label>
      <textarea class="inp" placeholder="Ex: Dedico este trabalho à minha família…" style="margin-bottom:8px;font-size:12px;min-height:48px;resize:vertical" oninput="State.setCfg('dedicatoria',this.value)">${cfg.dedicatoria || ''}</textarea>

      <label class="lbl" style="margin-bottom:4px">Agradecimentos <span style="color:var(--t4)">(opcional)</span></label>
      <textarea class="inp" placeholder="Ex: Agradeço ao meu orientador, aos colegas e à minha família…" style="margin-bottom:8px;font-size:12px;min-height:60px;resize:vertical" oninput="State.setCfg('agradecimentos',this.value)">${cfg.agradecimentos || ''}</textarea>

      <label class="lbl" style="margin-bottom:4px">Epígrafe <span style="color:var(--t4)">(opcional)</span></label>
      <input class="inp" placeholder="Frase ou citação inspiradora…" value="${cfg.epigrafe || ''}" style="margin-bottom:2px;font-size:12px" oninput="State.setCfg('epigrafe',this.value)"/>
      <input class="inp" placeholder="Autor da epígrafe" value="${cfg.epigrafAutor || ''}" style="margin-bottom:8px;font-size:11px;color:var(--t3)" oninput="State.setCfg('epigrafAutor',this.value)"/>
    </div>
  </div>`;
}
