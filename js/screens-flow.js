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
    <div onclick="irPara('planos')" style="margin-top:14px;background:var(--sf3);border:.5px solid var(--eb);border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .2s">
      <div style="width:38px;height:38px;border-radius:10px;background:var(--z2);border:.5px solid var(--eb);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">🎁</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px">SALDO</div>
        ${temCreditoActivo() ? `
          <div style="font-size:14px;font-weight:700;color:var(--t1)">${getCreditosPags()} páginas</div>
          <div style="font-size:11px;color:var(--t3);margin-top:1px">${diasRest !== null ? `Expira em ${diasRest} dia(s)` : 'Disponíveis'}</div>` : `
          <div style="font-size:14px;font-weight:700;color:var(--t1)">${creditos.gen_usada ? '0 páginas' : '1 geração gratuita'}</div>
          <div style="font-size:11px;color:var(--t3);margin-top:1px">${creditos.gen_usada ? 'Geração gratuita utilizada' : 'Disponível para o primeiro trabalho'}</div>`}
        ${!temCreditoActivo() && creditos.gen_usada ? `
        <div style="margin-top:6px;display:flex;gap:6px;align-items:center">
          <span style="font-family:var(--fm);font-size:8px;padding:2px 8px;border-radius:8px;background:var(--b);color:var(--t-inv);font-weight:700">${getPrecosCache()[0].preco.toLocaleString()} Kz</span>
          <span style="font-size:11px;color:var(--t2)">15 páginas · pacote inicial</span>
        </div>` : ''}
      </div>
      <div style="color:var(--t3);font-size:18px;flex-shrink:0">›</div>
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

function sTipo() {
  return `
  <div style="padding-bottom:32px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:6px">${_fluxoBarra(1)}</div>
    <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-.02em;margin-bottom:6px">Que trabalho vamos criar?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:22px;line-height:1.6">Selecciona o tipo de trabalho académico.</div>

    <div style="display:flex;flex-direction:column;gap:8px">
      ${TIPOS.map(t => {
        const selected = State.getCfg('tipo') === t.id;
        return `
      <div onclick="State.setCfg('tipo','${t.id}');irPara('tema_')"
        style="background:${selected ? 'var(--sf3)' : 'var(--z2)'};border:.5px solid ${selected ? 'var(--eb)' : 'var(--e1)'};border-radius:var(--r2);padding:15px 16px;cursor:pointer;display:flex;align-items:center;gap:14px;transition:all .2s">
        <div style="font-size:24px;width:36px;text-align:center;flex-shrink:0">${t.i}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600;color:var(--t1)">${t.n}</div>
          <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-top:2px;letter-spacing:.06em">${t.s}</div>
        </div>
        <div style="font-size:12px;color:${selected ? 'var(--b)' : 'var(--t4)'}">${selected ? '✓' : '›'}</div>
      </div>`;}).join('')}
    </div>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   BARRA DE PROGRESSO DO FLUXO (Fase 2 — onboarding)
   Passos: 1 Trabalho · 2 Tema · 3 Contexto · 4 Identidade
════════════════════════════════════════════════════════════ */
function _fluxoBarra(passo, total = 4) {
  const nomes = ['Trabalho', 'Tema', 'Contexto', 'Identidade'];
  const pct = Math.round((passo / total) * 100);
  return `
  <div style="margin:-2px 0 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3)">PASSO ${passo} DE ${total} · ${nomes[passo - 1] || ''}</div>
      <div style="font-family:var(--fm);font-size:8px;color:var(--b);font-weight:700">${pct}%</div>
    </div>
    <div style="display:flex;gap:5px">
      ${Array.from({ length: total }, (_, i) => `
      <div style="flex:1;height:4px;border-radius:3px;background:${i + 1 <= passo ? 'linear-gradient(90deg,var(--b),var(--bd))' : 'var(--z4)'};${i + 1 === passo ? 'box-shadow:0 0 8px rgba(67,232,167,.45)' : ''};transition:all .4s"></div>
      `).join('')}
    </div>
  </div>`;
}

/* Sugestão contextual de extensão por nível académico */
const _SUG_PAGS_NIVEL = {
  'Ensino Médio':        15, 'Ensino Secundário': 15,
  'Licenciatura':        30, 'Pós-Graduação':     40,
  'Mestrado':            50, 'Doutoramento':      100,
};

function _dicaPagsNivel() {
  const niv = State.getCfg('nivel');
  const pags = State.getCfg('pags');
  if (!niv) return '';
  const recom = _SUG_PAGS_NIVEL[niv];
  if (!recom) return '';
  const preco = calcPreco(recom);
  const jaUsado = pags === recom;
  return `
  <div style="background:var(--sf3);border:.5px solid var(--eb);border-radius:10px;padding:10px 12px;margin:-8px 0 14px;display:flex;align-items:center;gap:10px;animation:aparecer .25s">
    <div style="font-size:16px;flex-shrink:0">💡</div>
    <div style="flex:1;font-size:11.5px;color:var(--t2);line-height:1.55">
      Para <strong style="color:var(--t1)">${niv}</strong> o mais comum são <strong style="color:var(--b)">${recom} páginas</strong> · ${preco.toLocaleString()} Kz
    </div>
    ${jaUsado ? '' : `<button onclick="State.setCfg('pags',${recom});renderizar()" style="padding:6px 12px;border-radius:8px;background:linear-gradient(135deg,var(--b),var(--bd));border:none;color:var(--t-inv);font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0">Usar →</button>`}
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   ECRÃ 3 — TEMA
════════════════════════════════════════════════════════════ */
const _SUGESTOES_TEMA = [
  'Impacto da inteligência artificial no mercado de trabalho global',
  'Empreendedorismo digital no Brasil: inovação e competitividade',
  'Gestão de resíduos sólidos urbanos: estudo comparado Angola–África',
  'Qualidade do ensino superior em Portugal: desafios e perspectivas',
  'Saúde pública e acesso a serviços em Moçambique',
  'Microcrédito e empoderamento feminino no meio rural',
  'Turismo como motor do desenvolvimento económico',
  'Mudanças climáticas e impactos na agricultura familiar',
];

/* ── Sugestões em modo infinito (geradas localmente, sem repetir) ── */
const _SUG_P1 = ['A adopção','O impacto','O papel','A implementação','A avaliação','Os desafios','A contribuição','O crescimento','A expansão','As perspectivas','A influência','A regulação'];
const _SUG_P2 = ['das TIC','da inteligência artificial','das energias renováveis','do microcrédito','da banca digital','do comércio electrónico','da educação à distância','do empreendedorismo juvenil','da gestão de resíduos','do turismo','das redes sociais','do marketing digital','da telemedicina','da agricultura de precisão','da transformação digital','do teletrabalho','da economia informal','das startups locais'];
const _SUG_P3 = ['no desenvolvimento','na melhoria da qualidade','no crescimento','na redução da pobreza','no acesso aos serviços','na modernização','na inclusão financeira','na sustentabilidade','no fortalecimento','na dinamização','na optimização','na digitalização'];
const _SUG_P4 = ['económico e social','académico','do sector empresarial','do sector agrário','dos serviços públicos','do ensino superior','do comércio local','da saúde','do ambiente','da juventude','do emprego','das PME'];
const _SUG_P5 = ['no contexto global','na América Latina','em Angola','no Brasil','em Portugal','em Moçambique','em Cabo Verde','na África Austral','na Europa','na Ásia','em estudo comparado',''];

let _seedSug = 0;
const _sugUsadas = new Set(_SUGESTOES_TEMA);
let _sugAtuais = null;

function _mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _sugestaoPorSeed(seed) {
  const r = _mulberry32(seed);
  const p = a => a[Math.floor(r() * a.length)];
  return `${p(_SUG_P1)} ${p(_SUG_P2)} ${p(_SUG_P3)} ${p(_SUG_P4)} ${p(_SUG_P5)}`;
}

function _novasSugestoes(n = 3) {
  const res = [];
  let tent = 0;
  while (res.length < n && tent < 300) {
    tent++;
    const s = _sugestaoPorSeed(_seedSug++);
    if (!_sugUsadas.has(s)) { _sugUsadas.add(s); res.push(s); }
  }
  return res;
}

function _maisSugestoesTema() {
  _sugAtuais = _novasSugestoes();
  renderizar();
}

function sTema() {
  const tp = tipoActual() || { n: 'Trabalho Académico' };
  const temaAtual = State.getCfg('tema') || '';
  return `
  <div style="padding-bottom:32px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:6px">${_fluxoBarra(2)}</div>
    <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-.02em;margin-bottom:6px">Qual é o tema?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:22px;line-height:1.6">${tp.n} — escreve o tema ou título provisório.</div>

    <label class="lbl">Tema / Título do trabalho *</label>
    <textarea class="inp" id="temaInp" placeholder="Ex: O impacto das tecnologias de informação no sector bancário angolano"
      style="min-height:90px;resize:vertical;margin-bottom:16px"
      oninput="State.setCfg('tema',this.value.trim())">${temaAtual}</textarea>

    <!-- Sugestões -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.1em;color:var(--t3);text-transform:uppercase">💡 Sugestões de tema</div>
      <button onclick="_maisSugestoesTema()"
        style="background:var(--z2);border:.5px solid var(--e0);color:var(--b);border-radius:var(--r2);padding:5px 10px;font-family:var(--fu);font-size:11px;font-weight:600;cursor:pointer">
        🎲 Ver outras sugestões
      </button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px">
      ${(_sugAtuais || _SUGESTOES_TEMA.slice(0,3)).map(s => `
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
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:6px">${_fluxoBarra(3)}</div>
    <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-.02em;margin-bottom:6px">Contexto do trabalho</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:22px;line-height:1.6">Nível académico, turma, área e extensão.</div>

    <label class="lbl">Nível Académico *</label>
    <select class="inp" id="sNiv" style="margin-bottom:14px" onchange="State.setCfg('nivel',this.value);renderizar()">
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

    ${_dicaPagsNivel()}

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
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:6px">${_fluxoBarra(4)}</div>
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

  if (load || !Array.isArray(est) || !est.length) {
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
  const pctCalc   = total ? Math.round(pron / total * 100) : 0;
  const pct       = typeof _genPctMax !== 'undefined' ? Math.max(_genPctMax, pctCalc) : pctCalc;
  if (typeof _genPctMax !== 'undefined') _genPctMax = Math.max(_genPctMax, pct);
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
    const totalTime = _genStartTime ? Math.floor((Date.now() - _genStartTime) / 1000) : 0;
    const tMin = Math.floor(totalTime / 60);
    const tSec = totalTime % 60;
    const tempoStr = tMin > 0 ? `${tMin}min ${tSec}s` : `${tSec}s`;
    const pagsTxt = stats.pagsAlvo && Math.abs(stats.pags - stats.pagsAlvo) > 1
      ? `${stats.pags} págs <span style="color:var(--t3)">(alvo ${stats.pagsAlvo})</span>`
      : `${stats.pags} páginas`;
    const fbHTML = (typeof fbCardHTML === 'function' ? fbCardHTML() : '');
    return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:18px;text-align:center;padding:28px">
      <div style="font-size:56px;filter:drop-shadow(0 0 20px var(--b));animation:flutuar 2.5s ease-in-out infinite">🎓</div>
      <div style="font-size:22px;font-weight:700;color:var(--t1)">${nome ? `Trabalho pronto, ${nome}!` : 'Trabalho concluído!'}</div>
      <div style="font-family:var(--fm);font-size:9px;color:var(--b);letter-spacing:.14em">● ACADEMY · GERADO COM SUCESSO · ${stats.ppp} palavras/pág</div>
      <div style="display:flex;gap:16px;font-family:var(--fm);font-size:10px;color:var(--t3);flex-wrap:wrap;justify-content:center">
        <span>${stats.palavras} palavras</span><span>·</span>
        <span>${pagsTxt}</span><span>·</span>
        <span>~${stats.tempoLeit} min leitura</span><span>·</span>
        <span>⏱ ${tempoStr}</span>
      </div>
      <button class="btn O w" onclick="docConcluido()" style="max-width:300px;font-size:15px;padding:16px">🎓 Ver o meu Trabalho →</button>
      ${fbHTML ? fbHTML : ''}
      <div onclick="togChat()" style="cursor:pointer;padding:10px 18px;border:1px solid var(--eo);border-radius:var(--r);background:rgba(56,189,248,.05);color:var(--o);font-family:var(--fm);font-size:9px;letter-spacing:.08em">⚡ Treinar a defesa com o ACADEMY →</div>
    </div>`;
  }

  /* ── Ecrã de progresso ── */
  const temProg = genTemProgresso();
  return `
  <div style="display:flex;flex-direction:column;padding:28px 18px 48px">
    <div class="fase" style="margin-bottom:14px"><div class="fase-p b"></div>ACADEMY · A ESCREVER</div>
    <div style="font-size:17px;font-weight:700;color:var(--t1);margin-bottom:4px;letter-spacing:-.015em">${cfg.tema?.substring(0, 60) || 'O teu trabalho'}</div>
    <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-bottom:18px" id="estimG">${estimativa} · ${pron}/${total} capítulos</div>

    ${temProg && pron > 0 && pron < total ? `
    <div style="background:rgba(251,191,36,.07);border:.5px solid rgba(251,191,36,.25);border-radius:var(--r);padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <div style="font-size:20px">⏸</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--t1)">Geração pausada — ${pron}/${total} capítulos</div>
        <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-top:2px">Podes continuar de onde paraste</div>
      </div>
      <button class="btn B s" onclick="iniciarGer(true)" style="font-size:12px;padding:8px 14px;flex-shrink:0">▶ Continuar</button>
    </div>` : ''}

    <!-- Motor Espelhado Premium -->
    <div class="card-b" style="padding:16px 14px 14px;margin-bottom:14px;overflow:hidden;position:relative;background:linear-gradient(180deg, var(--z2), var(--z1));border:1px solid var(--e0)">
      <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg, transparent, var(--b) 50%, transparent);opacity:.5"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:7px;height:7px;border-radius:50%;background:var(--b);box-shadow:0 0 8px var(--b);animation:genPulse 1.4s infinite"></span>
          <span style="font-family:var(--fm);font-size:8px;letter-spacing:.14em;color:var(--b);font-weight:700">MOTOR ESPELHADO</span>
          <span id="genFaseTxt" style="font-family:var(--fm);font-size:8px;color:var(--t3);margin-left:6px">A escrever…</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-family:var(--fm);font-size:10px;color:var(--o);font-variant-numeric:tabular-nums" id="genTimer">0:00</div>
          <div style="font-size:22px;font-weight:800;color:var(--b);letter-spacing:-.02em" id="pctN">${pct}%</div>
        </div>
      </div>
      <!-- Palco de páginas -->
      <div style="position:relative;height:112px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;perspective:600px">
        <!-- Página de fundo 1 -->
        <div style="position:absolute;width:120px;height:84px;background:#fff;border:1px solid #e9ecef;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.08);transform:rotate(-3deg) translateX(-18px) translateY(4px);opacity:.7"></div>
        <!-- Página de fundo 2 -->
        <div style="position:absolute;width:120px;height:84px;background:#fff;border:1px solid #e9ecef;border-radius:4px;box-shadow:0 4px 16px rgba(0,0,0,.1);transform:rotate(2deg) translateX(12px) translateY(2px);opacity:.85"></div>
        <!-- Página activa — conteúdo real com escrita visível -->
        <div id="genPageActive" style="position:relative;width:142px;height:98px;background:#fff;border:1px solid #e0e7ff;border-radius:5px;box-shadow:0 8px 24px rgba(0,0,0,.14), 0 0 0 1px rgba(67,232,167,.08) inset;padding:8px 9px 8px;display:flex;flex-direction:column;gap:4px;transform:rotate(0deg);transition:transform .4s;overflow:hidden">
          <div style="height:3px;background:linear-gradient(90deg, var(--b), var(--o));border-radius:2px;width:68%;flex-shrink:0"></div>
          <div id="genLiveTitle" style="font-family:Georgia,serif;font-size:6px;font-weight:700;color:var(--b);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:8px">${(secs[pron]?.titulo || est[pron]?.titulo || 'A preparar…').substring(0,32)}</div>
          <div id="genLiveLines" style="display:flex;flex-direction:column;gap:3px;flex:1;overflow:hidden;position:relative">
            <div id="genTypingLine" style="height:4px;background:#111;border-radius:2px;width:0%;transition:width 1.2s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden"><span style="position:absolute;right:-1px;top:50%;transform:translateY(-50%);width:2px;height:6px;background:var(--b);animation:genBlink 1s infinite;border-radius:1px"></span></div>
            <div class="genLinha" style="height:4px;background:#e5e7eb;border-radius:2px;width:92%;opacity:.7"></div>
            <div class="genLinha" style="height:4px;background:#e5e7eb;border-radius:2px;width:88%;opacity:.5"></div>
            <div style="height:1px;background:#eee;margin:1px 0;flex-shrink:0"></div>
            <div id="genLiveExcerpt" style="font-family:Georgia,serif;font-size:4.5px;color:#888;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:12px;font-style:italic;position:relative">A compor as primeiras linhas…<span id="genCursor" style="display:inline-block;width:4px;height:6px;background:var(--b);margin-left:1px;vertical-align:middle;animation:genBlink 1s step-end infinite;border-radius:1px"></span></div>
            <!-- Pena a escrever -->
            <div id="genPen" style="position:absolute;right:8px;bottom:22px;font-size:9px;transform:rotate(-18deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.2));animation:genPenMove 2.2s ease-in-out infinite">✎</div>
          </div>
          <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:var(--b);color:var(--t-inv);font-family:var(--fm);font-size:6px;padding:2px 7px;border-radius:10px;letter-spacing:.06em;white-space:nowrap" id="genPageLabel">PÁG. ${pron || 1} · CAP. ${(secs[pron]?.num || pron+1)}</div>
        </div>
        <!-- Reflexo espelhado -->
        <div style="position:absolute;bottom:-10px;left:50%;transform:translateX(-50%) scaleY(-1);opacity:.14;filter:blur(.7px);width:132px;height:34px;overflow:hidden;pointer-events:none;mask-image:linear-gradient(180deg, rgba(0,0,0,.6), transparent 85%);-webkit-mask-image:linear-gradient(180deg, rgba(0,0,0,.6), transparent 85%);background:#fff;border:1px solid #e9ecef;border-radius:5px"></div>
      </div>
      <div class="barra" style="height:6px;border-radius:10px;background:rgba(0,0,0,.06);border:1px solid rgba(255,255,255,.06);overflow:hidden"><div class="barra-az" id="barraG" style="width:${pct}%;height:100%;background:linear-gradient(90deg, var(--b), var(--o), #FFD700);box-shadow:0 0 10px var(--b);transition:width .5s cubic-bezier(.16,1,.3,1)"></div></div>
      <!-- Barra espelhada reflexo -->
      <div style="height:4px;margin-top:3px;transform:scaleY(-1);opacity:.18;filter:blur(.5px);background:rgba(0,0,0,.04);border-radius:10px;overflow:hidden;mask-image:linear-gradient(180deg, rgba(0,0,0,.5), transparent);-webkit-mask-image:linear-gradient(180deg, rgba(0,0,0,.5), transparent)"><div id="genBarEspelhada" style="height:100%;width:${pct}%;background:linear-gradient(90deg, var(--b), var(--o));transition:width .5s"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;align-items:center">
        <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.06em"><span id="genPctEspelhado" style="color:var(--b);font-weight:700">${pct}%</span> · ${pron} de ${total} capítulos</div>
        <div style="font-family:var(--fm);font-size:8px;color:var(--t3)"><span id="anp">${nPags()}</span> págs estimadas</div>
      </div>
      <style>@keyframes genPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.85)}}@keyframes genWrite{0%{opacity:.7}50%{opacity:1}100%{opacity:.7}}@keyframes genBlink{0%,50%{opacity:1}51%,100%{opacity:0}}@keyframes genPenMove{0%,100%{transform:rotate(-18deg) translateX(0)}50%{transform:rotate(-18deg) translateX(2px) translateY(-1px)}}</style>
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
