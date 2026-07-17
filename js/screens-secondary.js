/* ═══════════════════════════════════════════════════════════
   ACADEMY — SCREENS-SECONDARY.JS
   Ecrãs secundários: Documentos · Config · Exemplares
   Sobre · Documento Livre · Planos & Preços · Admin
   Depende de: state.js, navigation.js, auth.js, supabase.js
═══════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   DOCUMENTOS (arquivo pessoal)
════════════════════════════════════════════════════════════ */
function sDocs() {
  const lista    = getDocs();
  const cfg      = State.get('cfg');
  const genFim   = State.get('genFim');
  const secs     = State.get('secs');
  const emCurso  = cfg.tema && !genFim && secs.length === 0 && cfg.tipo;

  return `
  <div class="fase"><div class="fase-p b"></div>ARQUIVO PESSOAL</div>
  <div class="T1">Os teus<br/><strong>documentos</strong></div>

  ${emCurso ? `
  <div style="padding:14px;margin-bottom:14px;border-radius:var(--r);border:1px solid var(--eo);background:rgba(56,189,248,.06);cursor:pointer;display:flex;align-items:center;gap:10px" onclick="irPara('tema_')">
    <div style="font-size:18px">⚡</div>
    <div style="flex:1">
      <div style="font-family:var(--fm);font-size:8px;color:var(--o);letter-spacing:.1em;margin-bottom:2px">TENS UM TRABALHO POR TERMINAR</div>
      <div style="font-size:13px;color:var(--t1)">${cfg.tema.substring(0, 50)}${cfg.tema.length > 50 ? '…' : ''}</div>
    </div>
    <div style="color:var(--o);font-size:14px">→</div>
  </div>` : ''}

  ${lista.length === 0 ? `
  <div style="text-align:center;padding:50px 20px">
    <div style="font-size:44px;margin-bottom:16px;opacity:.3">◈</div>
    <div style="font-family:var(--fd);font-size:20px;font-style:italic;color:var(--t2);margin-bottom:8px">Arquivo vazio</div>
    <div class="desc" style="margin-bottom:24px">Cria o teu primeiro trabalho académico.</div>
    <button class="btn B" onclick="State.resetDocumento();irPara('tipo')">Criar trabalho →</button>
  </div>` : lista.map(d => {
    const emCursoDoc = d.secs?.length > 0 && d.secs.some(s => !s.c || s.c.length < 50);
    const estado     = d.exportado ? 'Exportado' : d.qual && d.secs?.length > 0 ? 'Gerado' : d.secs?.length > 0 ? 'Em curso' : 'Incompleto';
    const estadoCor  = estado === 'Exportado' ? 'var(--b)' : estado === 'Gerado' ? 'var(--o)' : estado === 'Em curso' ? '#38BDF8' : 'var(--t3)';
    const progresso  = d.secs?.length > 0 ? Math.round((d.secs.filter(s => s.c && s.c.length > 50).length / d.secs.length) * 100) : 0;

    return `
    <div style="margin-bottom:10px">
      <div class="dc" onclick="abrirDoc(${d.id})" style="cursor:pointer;margin-bottom:0;border-radius:var(--r) var(--r) 0 0;border-bottom:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div class="dc-tipo">${d.tipo || 'TFC'}</div>
          <div style="font-family:var(--fm);font-size:8px;color:${estadoCor};letter-spacing:.06em">● ${estado.toUpperCase()}</div>
        </div>
        <div class="dc-titulo">${d.tema || 'Sem título'}</div>
        <div class="dc-meta">
          <span>${d.em}</span><span>·</span><span>${d.pags || 1} pág.</span>
          ${d.secs?.length > 0 ? `<span>·</span><span style="font-family:var(--fm);font-size:8px;color:var(--t3)">${d.secs.filter(s => s.c && s.c.length > 50).length}/${d.secs.length} cap.</span>` : ''}
          ${d.qual ? `<span>·</span><span class="etq etq-v">${d.qual}%</span>` : ''}
        </div>
        ${estado === 'Em curso' ? `
        <div style="margin-top:8px;height:3px;background:var(--z4);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${progresso}%;background:linear-gradient(90deg,var(--b),var(--o));border-radius:2px;transition:width .3s"></div>
        </div>` : ''}
      </div>
      <div style="display:flex;gap:0;border:1px solid var(--e0);border-top:none;border-radius:0 0 var(--r) var(--r);overflow:hidden">
        <button onclick="abrirDoc(${d.id})" style="flex:1;padding:9px;background:var(--z2);border:none;border-right:1px solid var(--e0);color:var(--b);font-family:var(--fm);font-size:9px;letter-spacing:.06em;cursor:pointer;transition:background .14s"
          onmouseover="this.style.background='var(--z3)'" onmouseout="this.style.background='var(--z2)'">
          ${estado === 'Em curso' ? '▶ Continuar' : '◉ Abrir'}
        </button>
        <button onclick="apagarDoc(${d.id})" style="width:44px;padding:9px;background:var(--z2);border:none;color:var(--t3);font-size:13px;cursor:pointer;transition:all .14s"
          onmouseover="this.style.background='rgba(239,68,68,.08)';this.style.color='#f87171'"
          onmouseout="this.style.background='var(--z2)';this.style.color='var(--t3)'" title="Apagar documento">🗑</button>
      </div>
    </div>`;
  }).join('')}
  ${RODAPE_HTML}`;
}

/* ── Abrir documento guardado ── */
function abrirDoc(id) {
  const lista = getDocs();
  const d     = lista.find(x => x.id === id);
  if (!d) { mostrarToast('Documento não encontrado.'); return; }

  State.set('secs',  d.secs  || []);
  State.set('plano', d.plano || null);
  State.set('est',   d.est   || null);
  State.mergeCfg(d.cfg ? { ...d.cfg } : { tipo: d.tipo, tema: d.tema, pags: d.pags || 15, mbs: [] });
  State.set('qual',  d.qual
    ? { total: d.qual, itens: [['Coerência', d.qual + 2], ['Profundidade', d.qual - 1], ['Rigor', d.qual - 3], ['Argumentação', d.qual + 1]] }
    : null);
  State.set('genFim', (d.secs?.length || 0) > 0);
  irPara('editor');
}

/* ════════════════════════════════════════════════════════════
   EXEMPLARES OFICIAIS
════════════════════════════════════════════════════════════ */
function sExViewer() {
  const ex = (typeof EXEMPLARES !== 'undefined' ? EXEMPLARES : []).find(e => e.id === State.get('exAberto'));
  if (!ex) return `<div style="padding:40px;text-align:center;color:var(--t3)">Exemplar não encontrado.</div>`;
  return sEditor(ex.secs,
    { tema: ex.titulo, nivel: ex.nivel, inst: ex.inst, prof: ex.prof, mbs: [] },
    { total: ex.qual, itens: [['Coerência', ex.qual + 2], ['Profundidade', ex.qual - 1], ['Rigor', ex.qual - 3], ['Argumentação', ex.qual + 1]] },
    ex
  );
}

function abrirExemplar(id) {
  State.set('exAberto', id);
  irPara('exViewer');
}

function sExemplares() {
  const EXEM     = typeof EXEMPLARES !== 'undefined' ? EXEMPLARES : [];
  const filtro   = window._exFiltro || 'todos';
  const lista    = filtro === 'todos' ? EXEM : EXEM.filter(e => e.sigla === filtro);
  const tipos    = [...new Set(EXEM.map(e => e.sigla))];

  return `
  <div class="fase"><div class="fase-p"></div>EXEMPLARES OFICIAIS</div>
  <div class="T1">Trabalhos<br/><strong>exemplares</strong></div>
  <div class="desc" style="margin-bottom:14px">Documentos reais prontos a descarregar. Usa como referência ou base para o teu trabalho.</div>

  <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px">
    <div class="etq ${filtro === 'todos' ? 'etq-v' : 'etq-b'}" style="padding:7px 14px;font-size:11px;cursor:pointer;border-radius:20px" onclick="window._exFiltro='todos';irPara('exemplares')">Todos</div>
    ${tipos.map(t => `<div class="etq ${filtro === t ? 'etq-v' : 'etq-b'}" style="padding:7px 14px;font-size:11px;cursor:pointer;border-radius:20px" onclick="window._exFiltro='${t}';irPara('exemplares')">${t}</div>`).join('')}
  </div>

  ${lista.map(ex => `
  <div class="dc ex" style="margin-bottom:12px">
    <div class="dc-tipo">${ex.sigla} · ${ex.pags} PÁG · ${(ex.area || '').toUpperCase()}</div>
    <div class="dc-titulo">${ex.titulo}</div>
    <div class="dc-meta" style="margin-bottom:12px">
      <span>${(ex.nivel || '').split('—')[0].trim()}</span><span>·</span>
      <span>${ex.inst}</span><span>·</span>
      <span class="etq etq-v">${ex.qual}%</span>
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap">
      <button class="btn B s" onclick="abrirExemplar('${ex.id}')">👁 Ver</button>
      <button class="btn G s" onclick="expPDF('${ex.id}')">📄 PDF</button>
      <button class="btn G s" onclick="expDocx('${ex.id}')">📝 DOCX</button>
      <button class="btn O s" onclick="usarBaseExemplar('${ex.id}')" style="margin-left:auto">Usar como base →</button>
    </div>
  </div>`).join('')}
  ${RODAPE_HTML}`;
}

function usarBaseExemplar(id) {
  const EXEM = typeof EXEMPLARES !== 'undefined' ? EXEMPLARES : [];
  const ex   = EXEM.find(e => e.id === id);
  if (!ex) return;
  const tipoMap = { TFC: 'tfc', Monografia: 'mono', 'Artigo Científico': 'art', Relatório: 'rel', Artigo: 'art', Seminário: 'sem', 'Pré-Projecto': 'pre' };
  State.resetDocumento();
  State.setCfg('tipo',  tipoMap[ex.sigla] || tipoMap[ex.tipo] || 'tfc');
  State.setCfg('nivel', ex.nivel?.split('—')[0].trim() || '');
  mostrarToast('✓ Tipo pré-preenchido com o exemplar. Adiciona o teu tema!');
  irPara('tema_');
}

/* ════════════════════════════════════════════════════════════
   CONFIGURAÇÃO
════════════════════════════════════════════════════════════ */
function sConfig() {
  const isClaro  = State.get('tema') === 'claro';
  const u        = State.get('u');
  const lingua   = State.get('lingua') || 'pt-AO';

  return `
  <div class="fase"><div class="fase-p b"></div>CONFIGURAÇÃO</div>
  <div class="T1">Configurar<br/><strong>Academy</strong></div>

  <!-- CONTA -->
  <div class="card" style="padding:20px;margin-bottom:12px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--t3);margin-bottom:14px">● CONTA</div>
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,var(--bd),var(--b));display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;color:#fff;flex-shrink:0">
        ${(u?.nome || '?')[0].toUpperCase()}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:17px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u?.nome || '—'}</div>
        <div style="font-family:var(--fm);font-size:10px;color:var(--t3);margin-top:3px">${u?.nivel || 'Estudante'}</div>
      </div>
    </div>
  </div>

  <!-- APARÊNCIA -->
  <div class="card" style="padding:20px;margin-bottom:12px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--t3);margin-bottom:14px">● APARÊNCIA</div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:14px;font-weight:600;color:var(--t1);margin-bottom:3px">${isClaro ? 'Modo Claro' : 'Modo Escuro'}</div>
        <div style="font-family:var(--fm);font-size:9px;color:var(--t3)">${isClaro ? 'Interface clara · Ideal para leitura diurna' : 'Interface escura · Confortável para a visão'}</div>
      </div>
      <div onclick="togTema()" style="width:52px;height:28px;border-radius:14px;background:${isClaro ? 'var(--b)' : 'var(--z4)'};border:1px solid ${isClaro ? 'var(--bd)' : 'var(--e1)'};position:relative;cursor:pointer;transition:all .3s;flex-shrink:0">
        <div style="position:absolute;top:3px;${isClaro ? 'right:3px' : 'left:3px'};width:20px;height:20px;border-radius:50%;background:#fff;transition:all .3s;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,.25)">
          ${isClaro ? '☀️' : '🌙'}
        </div>
      </div>
    </div>
  </div>

  <!-- LÍNGUA -->
  <div class="card" style="padding:20px;margin-bottom:12px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--t3);margin-bottom:14px">● LÍNGUA</div>
    ${[['pt-AO','🇦🇴 Português (Angola)'], ['en','🇬🇧 English'], ['fr','🇫🇷 Français']].map(([l, nome]) => {
      const sel = lingua === l;
      return `<div onclick="State.set('lingua','${l}');LS.set('lingua','${l}');mostrarToast('✓ Língua alterada');renderizar()"
        style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-radius:var(--r2);border:.5px solid ${sel ? 'var(--eb)' : 'var(--e0)'};background:${sel ? 'rgba(63,255,160,.06)' : 'transparent'};cursor:pointer;margin-bottom:7px;transition:all .18s">
        <div style="font-size:14px;color:${sel ? 'var(--b)' : 'var(--t2)'}">${nome}</div>
        ${sel ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--b)"></div>' : ''}
      </div>`;
    }).join('')}
  </div>

  <!-- LIGAÇÃO À IA -->
  <div class="card" style="padding:20px;margin-bottom:12px">
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--t3);margin-bottom:14px">● LIGAÇÃO À INTELIGÊNCIA ARTIFICIAL</div>
    <div style="background:rgba(63,255,160,.06);border:1px solid var(--eb);border-radius:var(--r2);padding:13px 14px;margin-bottom:12px">
      <div style="font-family:var(--fm);font-size:9px;color:var(--b);letter-spacing:.08em;margin-bottom:5px;text-transform:uppercase">✓ Chave da operadora — Automática</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.65">
        O ACADEMY gere automaticamente a ligação à IA. <strong style="color:var(--t1)">Não precisas de inserir nenhuma chave.</strong>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:7px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--z3);border-radius:var(--r2);border:.5px solid var(--e0)">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--t1)">Motor de IA</div>
          <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-top:2px">OpenRouter via /api/engine</div>
        </div>
        <div style="font-family:var(--fm);font-size:8px;padding:4px 9px;border-radius:20px;background:rgba(63,255,160,.1);border:1px solid var(--eb);color:var(--b)">✓ ACTIVO</div>
      </div>
    </div>
    <button class="btn G w" onclick="testarAPI()" style="margin-top:12px;font-size:13px">⚡ Testar ligação ao servidor</button>
    <div id="cfgMsg" style="margin-top:8px"></div>
  </div>

  <!-- SAIR -->
  <button class="btn B w" onclick="trocarConta()" style="margin-bottom:8px">↩ Trocar de Conta</button>
  <div style="font-family:var(--fm);font-size:10px;color:var(--t3);text-align:center;margin-bottom:14px">Volta ao ecrã inicial — os teus documentos ficam guardados</div>
  <button class="btn G w" onclick="sairConta()" style="margin-bottom:8px;border-color:rgba(239,68,68,.25);color:#f87171">⬡ Apagar tudo e sair</button>
  <div style="font-family:var(--fm);font-size:10px;color:var(--t3);text-align:center;margin-bottom:16px">Apaga todos os dados deste dispositivo</div>
  ${RODAPE_HTML}`;
}

/* ── Testar API ── */
async function testarAPI() {
  const el = document.getElementById('cfgMsg');
  if (el) { el.innerHTML = `<div style="font-family:var(--fm);font-size:10px;color:var(--t3)">A testar ligação…</div>`; }
  try {
    const r = await fetch(ACADEMY_ENGINE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping', payload: {} }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    if (el) el.innerHTML = `<div style="font-family:var(--fm);font-size:10px;color:var(--b)">✓ Ligação OK · ${d?.data?.model || 'engine activo'}</div>`;
  } catch (e) {
    if (el) el.innerHTML = `<div style="font-family:var(--fm);font-size:10px;color:#f87171">✕ Falha — ${e.message || 'sem resposta'}</div>`;
  }
}

/* ── Trocar e sair de conta ── */
function trocarConta() {
  LS.del('u');
  LS.del('sb_uid');
  State.set('u', null);
  document.getElementById('navbaixo')?.style && (document.getElementById('navbaixo').style.display = 'none');
  irPara('entrada');
}

function sairConta() {
  if (!confirm('Apagar todos os dados deste dispositivo? Esta acção não pode ser desfeita.')) return;
  Object.keys(localStorage).filter(k => k.startsWith('acy_')).forEach(k => localStorage.removeItem(k));
  State.set('u', null);
  State.resetDocumento();
  irPara('entrada');
}

/* ════════════════════════════════════════════════════════════
   SOBRE
════════════════════════════════════════════════════════════ */
function sSobre() {
  const docs  = getDocs();
  const hoje  = new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' });

  return `
  <div style="min-height:100%;display:flex;flex-direction:column;gap:12px;padding-bottom:16px">

    <!-- Hero -->
    <div class="sobre-hero">
      <div class="sobre-stars"></div>
      <div onclick="adminTap()" style="cursor:default;margin:0 auto 20px;display:flex;justify-content:center;animation:float 3.5s ease-in-out infinite">
        ${LOGO_SVG_RAW.replace(/(<svg[^>]*)/, '$1 style="width:200px;height:auto;display:block;filter:drop-shadow(0 0 32px rgba(0,184,207,0.22))"')}
      </div>
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.22em;color:var(--t3);text-transform:uppercase;margin-bottom:8px">ACADEMY · v78</div>
      <div style="font-size:26px;font-weight:800;letter-spacing:-.03em;color:var(--t1);line-height:1.1;margin-bottom:6px">
        A tua plataforma de<br/><span style="color:var(--b)">Desempenho Académico</span>
      </div>
      <div style="font-family:var(--fm);font-size:9px;color:var(--t3);letter-spacing:.06em">
        Powered by OpenRouter · ${hoje}
      </div>
    </div>

    <!-- Missão -->
    <div style="background:rgba(63,255,160,.04);border:.5px solid rgba(63,255,160,.16);border-radius:14px;padding:16px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--b);margin-bottom:9px;text-transform:uppercase">● Missão</div>
      <div style="font-size:13.5px;color:var(--t2);line-height:1.82;font-style:italic">"Democratizar a excelência académica em Angola e nos países lusófonos através de inteligência artificial. Cada estudante merece uma plataforma de nível mundial para o seu desempenho académico."</div>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${[
        ['Documentos', docs.length || 0, 'criados', 'var(--b)'],
        ['Modelos',    3,                'disponíveis', 'var(--o)'],
        ['Acções',     17,               'no engine', '#A78BFA'],
      ].map(([l, n, s, c]) => `
      <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:12px;padding:14px 8px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:${c};letter-spacing:-.03em;line-height:1">${n}</div>
        <div style="font-family:var(--fm);font-size:7px;color:var(--t3);letter-spacing:.1em;margin-top:5px;text-transform:uppercase">${l}</div>
        <div style="font-size:10px;color:var(--t4);margin-top:2px">${s}</div>
      </div>`).join('')}
    </div>

    <!-- Tecnologia -->
    <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:14px;padding:16px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:12px;text-transform:uppercase">● Tecnologia</div>
      ${[
        ['Motor IA',   'Modelos de linguagem de última geração com raciocínio académico avançado', 'var(--b)'],
        ['Plataforma', 'Aplicação web progressiva (PWA) · Funciona offline · Instalável', 'var(--o)'],
        ['Exportação', 'PDF de alta qualidade · DOCX compatível com Word · Formatação académica', '#A78BFA'],
        ['Segurança',  'Dados armazenados localmente no teu dispositivo · Privacidade garantida', '#F472B6'],
      ].map(([k, v, c]) => `
      <div class="sobre-tech-row">
        <div class="sobre-tech-key" style="color:${c}">${k}</div>
        <div class="sobre-tech-val">${v}</div>
      </div>`).join('')}
    </div>

    <!-- Funcionalidades -->
    <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:14px;padding:16px">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--t3);margin-bottom:12px;text-transform:uppercase">● Funcionalidades</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${['Trabalho Académico','Monografia','Artigo Científico','Chat com IA','Modo Orientador','Voz para texto','Texto para voz','Gráficos académicos','Capa IA','PDF Profissional','Exportar Word (.docx)','Exemplares Oficiais','Modo Escuro','Instalável no telemóvel','Modo Offline'].map(f =>
          `<div style="padding:4px 10px;border-radius:20px;background:rgba(255,255,255,.04);border:.5px solid var(--e0);font-family:var(--fm);font-size:8px;color:var(--t2);letter-spacing:.04em">${f}</div>`
        ).join('')}
      </div>
    </div>

    <!-- Créditos -->
    <div style="text-align:center;padding:20px 0 8px;border-top:.5px solid var(--e0);margin-top:4px">
      <div style="font-family:var(--fm);font-size:7px;letter-spacing:.2em;color:var(--t4);text-transform:uppercase;margin-bottom:14px">Desenvolvido com orgulho em Angola 🇦🇴</div>
      <div style="display:flex;justify-content:center;margin-bottom:14px">
        ${LOGO_SVG_RAW.replace(/(<svg[^>]*)/, '$1 style="width:120px;height:auto;display:block;opacity:0.85"')}
      </div>
      <div style="font-size:16px;font-weight:800;color:var(--t1);letter-spacing:-.025em">Grupo AGEA Comercial</div>
      <div style="font-family:var(--fm);font-size:10px;color:var(--b);margin-top:5px;letter-spacing:.06em">CEO · Adelino Graça</div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
        <button class="btn G s" onclick="nav('inicio')" style="font-size:11px">← Início</button>
        <button class="btn B s" onclick="togChat()" style="font-size:11px">⊙ Falar com o ACADEMY</button>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;justify-content:center">
        <button class="btn G s" onclick="trocarConta()" style="font-size:11px;border-color:rgba(56,189,248,.3);color:var(--o)">⇄ Trocar utilizador</button>
        <button class="btn G s" onclick="sairConta()" style="font-size:11px;border-color:rgba(239,68,68,.25);color:#f87171">⬡ Apagar e sair</button>
      </div>
    </div>
    ${RODAPE_HTML}
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   PLANOS & PREÇOS
════════════════════════════════════════════════════════════ */
function sPlanosPrecos(opts) {
  const planoAtual = planoActivo();
  const creditos   = getCreditos();
  const temCred    = temCreditoActivo();
  const creditoPags = getCreditosPags();

  return `
  <div style="padding-bottom:32px">
    <div class="fase"><div class="fase-p b"></div>PLANOS & PREÇOS</div>
    <div class="T1">Escolhe o teu<br/><strong>plano</strong></div>
    <div class="desc" style="margin-bottom:20px">Paga por Multicaixa Express. Recebe activação automática.</div>

    <!-- Estado actual -->
    <div style="background:var(--z2);border:.5px solid var(--e1);border-radius:var(--r2);padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
      <div style="font-size:22px">${PLANOS_DEF[planoAtual]?.ic || '🎁'}</div>
      <div style="flex:1">
        <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.1em;margin-bottom:3px">PLANO ACTUAL</div>
        <div style="font-size:14px;font-weight:700;color:var(--t1)">${PLANOS_DEF[planoAtual]?.n || 'Gratuito'}</div>
        <div style="font-size:12px;color:var(--t3);margin-top:2px">
          ${planoAtual === 'gratuito'
            ? (creditos.gen_usada ? 'Geração gratuita já utilizada' : '1 geração gratuita disponível')
            : `${creditos.pags || 0} / ${PLANOS_DEF[planoAtual]?.pags_mes} páginas este mês`}
          ${temCred ? ` · 📄 ${creditoPags} págs crédito` : ''}
        </div>
      </div>
    </div>

    <!-- Pacotes de crédito -->
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.14em;color:var(--b);margin-bottom:10px;text-transform:uppercase">● Pacotes de Crédito (páginas)</div>
    <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r2);overflow:hidden;margin-bottom:20px">
      ${[
        { pags: 15,   preco: 950,   desc: 'Pacote Base',         popular: false },
        { pags: 30,   preco: 1650,  desc: 'Pacote Essencial',    popular: true  },
        { pags: 200,  preco: 12000, desc: 'Pacote Avançado',     popular: false },
        { pags: 500,  preco: 29500, desc: 'Pacote Profissional', popular: false },
        { pags: 1000, preco: 60000, desc: 'Pacote Premium',      popular: false },
      ].map((p, i, arr) => `
      <div style="padding:12px 16px;${i < arr.length - 1 ? 'border-bottom:.5px solid var(--e0);' : ''}display:flex;align-items:center;gap:12px;${p.popular ? 'background:rgba(63,255,160,.04);' : ''}">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--t1)">${p.desc} ${p.popular ? '<span style="font-family:var(--fm);font-size:8px;background:var(--b);color:#04090F;padding:2px 6px;border-radius:8px;margin-left:4px">POPULAR</span>' : ''}</div>
          <div style="font-family:var(--fm);font-size:9px;color:var(--t3);margin-top:2px">${p.pags} páginas · válido 30 dias</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700;color:var(--b)">${p.preco.toLocaleString()} Kz</div>
          <button class="btn B s" onclick="_iniciarPagamentoAvulso(${p.pags},${p.preco})" style="margin-top:4px;font-size:10px;padding:5px 10px">Comprar →</button>
        </div>
      </div>`).join('')}
    </div>

    <!-- Activar com senha -->
    <div style="font-family:var(--fm);font-size:8px;letter-spacing:.14em;color:var(--t3);margin-bottom:10px;text-transform:uppercase">● Activar com Senha</div>
    <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r2);padding:16px;margin-bottom:16px">
      <div style="font-size:13px;color:var(--t2);margin-bottom:12px;line-height:1.6">
        Tens uma senha de activação? Insere abaixo para activar o teu plano ou créditos de imediato.
      </div>
      <div style="display:flex;gap:8px">
        <input class="inp" id="senhaInp" placeholder="ACAD-XXXX-XXX-XXXX" style="flex:1;text-transform:uppercase;letter-spacing:.05em;font-family:var(--fm)"
          oninput="this.value=this.value.toUpperCase()"
          onkeydown="if(event.key==='Enter')activarSenhaUI()"/>
        <button class="btn B" onclick="activarSenhaUI()">Activar</button>
      </div>
      <div id="senhaMsg" style="margin-top:8px;font-family:var(--fm);font-size:11px"></div>
    </div>

    ${RODAPE_HTML}
  </div>`;
}

/* ── Activar senha pela UI ── */
async function activarSenhaUI() {
  const inp = document.getElementById('senhaInp');
  const msg = document.getElementById('senhaMsg');
  const senha = (inp?.value || '').trim();
  if (!senha) { if (msg) { msg.style.color = '#f87171'; msg.textContent = '✕ Insere uma senha.'; } return; }

  const resultado = validarSenha(senha);
  if (!resultado) {
    if (msg) { msg.style.color = '#f87171'; msg.textContent = '✕ Senha inválida. Verifica e tenta novamente.'; }
    return;
  }

  resultado._senha = senha;
  if (msg) { msg.style.color = 'var(--t3)'; msg.textContent = 'A verificar…'; }
  const ok = await aplicarSenha(resultado, { redirect: false });
  if (ok) {
    if (msg) { msg.style.color = 'var(--b)'; msg.textContent = `✓ ${resultado.desc} activado!`; }
    setTimeout(() => renderizar(), 1500);
  } else {
    if (msg) { msg.style.color = '#f87171'; msg.textContent = '✕ Esta senha já foi utilizada.'; }
  }
}

/* ── Iniciar pagamento avulso via Supabase ── */
async function _iniciarPagamentoAvulso(numPags, valor) {
  const ref = 'ACY-' + Date.now().toString(36).toUpperCase();
  const ok  = await sbInsertPagamento({
    ref,
    uid:           sbUserId(),
    utilizador_id: sbUserId(),
    nome:          State.get('u')?.nome || 'Desconhecido',
    whatsapp:      State.get('u')?.whatsapp || null,
    tipo:          'avulso',
    num_pags:      numPags,
    valor,
    estado:        'pendente',
    criado_em:     new Date().toISOString(),
  });

  if (ok) {
    mostrarToast(`✓ Pedido registado! Referência: ${ref}`);
    _mostrarInstrucoesPagamento(ref, valor, numPags);
  } else {
    mostrarToast('Erro ao registar pedido. Tenta novamente.', 'erro');
  }
}

function _mostrarInstrucoesPagamento(ref, valor, numPags) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.8);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:24px';
  div.innerHTML = `
    <div style="background:var(--z1);border:.5px solid var(--e1);border-radius:16px;padding:24px;max-width:360px;width:100%">
      <div style="font-family:var(--fm);font-size:8px;letter-spacing:.18em;color:var(--b);margin-bottom:12px">INSTRUÇÕES DE PAGAMENTO</div>
      <div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:16px">${numPags} páginas · ${valor.toLocaleString()} Kz</div>
      <div style="background:var(--z3);border-radius:var(--r2);padding:14px;margin-bottom:16px;font-size:12px;color:var(--t2);line-height:1.8">
        1. Abre o teu app de banking ou Multicaixa Express<br/>
        2. Transfere <strong style="color:var(--t1)">${valor.toLocaleString()} Kz</strong> para o número do ACADEMY<br/>
        3. Na descrição/referência coloca: <strong style="color:var(--b);font-family:var(--fm)">${ref}</strong><br/>
        4. Aguarda confirmação — activação automática em minutos
      </div>
      <div style="font-family:var(--fm);font-size:10px;color:var(--t3);margin-bottom:16px;text-align:center">
        Referência do pedido: <strong style="color:var(--t1)">${ref}</strong>
      </div>
      <button onclick="this.closest('div[style]').remove()" class="btn B w">OK, vou pagar →</button>
    </div>`;
  document.body.appendChild(div);
}

/* ════════════════════════════════════════════════════════════
   DOCUMENTO LIVRE
════════════════════════════════════════════════════════════ */
const TIPOS_DOC_LIVRE = [
  { id: 'contrato',   n: 'Contrato',        i: '📄', ex: 'contrato de arrendamento entre…' },
  { id: 'oficio',     n: 'Ofício',           i: '📮', ex: 'ofício ao Ministério da Educação sobre…' },
  { id: 'acta',       n: 'Acta de Reunião',  i: '📋', ex: 'acta da reunião do dia… sobre…' },
  { id: 'cv',         n: 'Curriculum Vitae', i: '👤', ex: 'CV para engenheiro informático com…' },
  { id: 'carta',      n: 'Carta',            i: '✉️', ex: 'carta de apresentação para candidatura a…' },
  { id: 'req',        n: 'Requerimento',     i: '📝', ex: 'requerimento de equivalência académica…' },
  { id: 'relatorio',  n: 'Relatório',        i: '📊', ex: 'relatório de actividades do mês de…' },
  { id: 'declaracao', n: 'Declaração',       i: '✅', ex: 'declaração de residência para…' },
  { id: 'outro',      n: 'Outro Documento',  i: '◈',  ex: 'descreve o documento que precisas…' },
];

const _docLivre = { tipo: '', descricao: '', resultado: null, loading: false };

function sDocLivre() {
  const tp = TIPOS_DOC_LIVRE.find(t => t.id === _docLivre.tipo) || TIPOS_DOC_LIVRE[0];

  if (_docLivre.loading) {
    return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:20px;text-align:center;padding:28px">
      <div class="pts"><span></span><span></span><span></span></div>
      <div style="font-size:16px;font-weight:600;color:var(--t1)">A gerar o teu documento…</div>
      <div style="font-size:13px;color:var(--t2);max-width:260px;line-height:1.65">Aguarda enquanto o ACADEMY prepara o teu ${tp.n}.</div>
    </div>`;
  }

  if (_docLivre.resultado) {
    return `
    <div class="fase"><div class="fase-p b"></div>DOCUMENTO LIVRE</div>
    <div class="T1">${tp.i} ${tp.n}</div>
    <div style="background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r2);padding:16px;margin-bottom:16px;font-size:13px;color:var(--t2);line-height:1.8;white-space:pre-wrap">${_docLivre.resultado}</div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn B" style="flex:1" onclick="_docLivreExportarPDF()">📄 PDF</button>
      <button class="btn G" style="flex:1" onclick="_docLivreExportarDocx()">📝 DOCX</button>
    </div>
    <button class="btn G w" onclick="_docLivre.resultado=null;renderizar()">↺ Novo documento</button>`;
  }

  return `
  <div class="fase"><div class="fase-p b"></div>DOCUMENTO LIVRE</div>
  <div class="T1">Qualquer<br/><strong>documento</strong></div>
  <div class="desc" style="margin-bottom:20px">Descreve o que precisas em linguagem natural e o ACADEMY gera.</div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px">
    ${TIPOS_DOC_LIVRE.map(t => `
    <div onclick="_docLivre.tipo='${t.id}';renderizar()"
      style="padding:14px 10px;background:${_docLivre.tipo === t.id ? 'rgba(63,255,160,.08)' : 'var(--z2)'};border:.5px solid ${_docLivre.tipo === t.id ? 'var(--eb)' : 'var(--e0)'};border-radius:var(--r2);text-align:center;cursor:pointer;transition:all .18s">
      <div style="font-size:22px;margin-bottom:6px">${t.i}</div>
      <div style="font-family:var(--fm);font-size:8px;color:${_docLivre.tipo === t.id ? 'var(--b)' : 'var(--t2)'};letter-spacing:.04em">${t.n}</div>
    </div>`).join('')}
  </div>

  <label class="lbl">Descreve o documento que precisas *</label>
  <textarea class="inp" id="dlDesc" placeholder="${tp.ex}"
    style="min-height:90px;resize:vertical;margin-bottom:20px"
    oninput="_docLivre.descricao=this.value">${_docLivre.descricao || ''}</textarea>

  <button class="btn B w" onclick="_gerarDocLivre()">Gerar documento →</button>`;
}

async function _gerarDocLivre() {
  const desc = (document.getElementById('dlDesc')?.value || _docLivre.descricao || '').trim();
  if (desc.length < 10) { mostrarToast('Descreve melhor o que precisas.', 'erro'); return; }
  const tp = TIPOS_DOC_LIVRE.find(t => t.id === _docLivre.tipo) || TIPOS_DOC_LIVRE[0];
  _docLivre.descricao = desc;
  _docLivre.loading   = true;
  renderizar();
  try {
    const res = await callAcademyAPI({
      acao:      'documento_livre',
      tipoDoc:   tp.n,
      descricao: desc,
      lingua:    State.get('lingua') || 'pt-AO',
    });
    _docLivre.resultado = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
  } catch (e) {
    _docLivre.resultado = null;
    mostrarToast('Erro ao gerar documento: ' + (e.message || ''), 'erro');
  }
  _docLivre.loading = false;
  renderizar();
}

/* ════════════════════════════════════════════════════════════
   CURRICULUM VITAE
════════════════════════════════════════════════════════════ */
function sCv() {
  const u   = State.get('u') || {};
  const cfg = State.get('cfg') || {};

  return `
  <div class="fase"><div class="fase-p b"></div>CURRICULUM VITAE</div>
  <div class="T1">O teu<br/><strong>Curriculum Vitae</strong></div>
  <div class="desc" style="margin-bottom:22px">Preenche os teus dados e gera um CV profissional pronto a usar.</div>

  <label class="lbl">Nome completo</label>
  <input class="inp" id="cvNome" placeholder="Ex: João Manuel Silva" value="${u.nome || ''}" style="margin-bottom:12px"/>

  <label class="lbl">Profissão / Cargo pretendido</label>
  <input class="inp" id="cvProfissao" placeholder="Ex: Engenheiro Informático" style="margin-bottom:12px"/>

  <label class="lbl">E-mail</label>
  <input class="inp" id="cvEmail" type="email" placeholder="email@exemplo.com" value="${u.email || ''}" style="margin-bottom:12px"/>

  <label class="lbl">Telefone / WhatsApp</label>
  <input class="inp" id="cvTel" type="tel" placeholder="+244 9XX XXX XXX" value="${u.whatsapp || ''}" style="margin-bottom:12px"/>

  <label class="lbl">Localização</label>
  <input class="inp" id="cvLocal" placeholder="Ex: Luanda, Angola" style="margin-bottom:12px"/>

  <label class="lbl">Resumo profissional</label>
  <textarea class="inp" id="cvResumo" placeholder="Descreve brevemente o teu perfil profissional, experiência e objectivos…" style="min-height:80px;resize:vertical;margin-bottom:12px"></textarea>

  <label class="lbl">Experiência profissional</label>
  <textarea class="inp" id="cvExp" placeholder="Ex: 2022–2024 · Técnico de TI · Empresa XYZ · Luanda" style="min-height:70px;resize:vertical;margin-bottom:12px"></textarea>

  <label class="lbl">Formação académica</label>
  <textarea class="inp" id="cvForm" placeholder="Ex: Licenciatura em Gestão · Universidade Agostinho Neto · 2020" style="min-height:60px;resize:vertical;margin-bottom:12px"></textarea>

  <label class="lbl">Competências</label>
  <input class="inp" id="cvComp" placeholder="Ex: Microsoft Office, Gestão de Projectos, Inglês B2…" style="margin-bottom:22px"/>

  <button class="btn B w" onclick="_gerarCv()" style="font-size:15px;padding:14px;margin-bottom:10px">
    ⚡ Gerar CV com IA →
  </button>
  <button class="btn G w" onclick="irPara('inicio')">← Voltar</button>
  ${RODAPE_HTML}`;
}

async function _gerarCv() {
  const dados = {
    nome:      document.getElementById('cvNome')?.value?.trim()     || State.get('u')?.nome || '',
    profissao: document.getElementById('cvProfissao')?.value?.trim() || '',
    email:     document.getElementById('cvEmail')?.value?.trim()    || '',
    tel:       document.getElementById('cvTel')?.value?.trim()      || '',
    local:     document.getElementById('cvLocal')?.value?.trim()    || '',
    resumo:    document.getElementById('cvResumo')?.value?.trim()   || '',
    exp:       document.getElementById('cvExp')?.value?.trim()      || '',
    form:      document.getElementById('cvForm')?.value?.trim()     || '',
    comp:      document.getElementById('cvComp')?.value?.trim()     || '',
  };

  if (!dados.nome) { mostrarToast('Preenche o nome completo.', 'erro'); return; }

  mostrarToast('⏳ A gerar CV profissional…');
  try {
    const res = await callAcademyAPI({
      acao:    'documento_livre',
      tipoDoc: 'Curriculum Vitae',
      descricao: `Cria um CV profissional completo para:\nNome: ${dados.nome}\nProfissão: ${dados.profissao}\nEmail: ${dados.email}\nTelefone: ${dados.tel}\nLocalização: ${dados.local}\nResumo: ${dados.resumo}\nExperiência: ${dados.exp}\nFormação: ${dados.form}\nCompetências: ${dados.comp}`,
      lingua: State.get('lingua') || 'pt-AO',
    });
    const texto = typeof res === 'string' ? res : JSON.stringify(res);
    /* Mostrar resultado */
    const ecrasEl = document.getElementById('ecras');
    if (ecrasEl) {
      ecrasEl.innerHTML = `<div class="ecra"><div style="padding:20px">
        <div class="fase"><div class="fase-p b"></div>CURRICULUM VITAE GERADO</div>
        <div style="background:var(--z2);border:1px solid var(--e0);border-radius:var(--r);padding:16px;margin-bottom:16px;font-family:Georgia,serif;font-size:14px;line-height:1.9;color:var(--t2);white-space:pre-wrap">${texto}</div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button class="btn B" style="flex:1" onclick="_expCvPDF()">📄 PDF</button>
          <button class="btn G" style="flex:1" onclick="_expCvDocx()">📝 DOCX</button>
        </div>
        <button class="btn G w" onclick="irPara('cv')">↺ Novo CV</button>
      </div></div>`;
    }
    window._cvTextoGerado = texto;
  } catch (e) {
    mostrarToast('✗ Erro ao gerar CV: ' + (e.message || ''), 'erro');
  }
}

function _expCvPDF() {
  if (!window._cvTextoGerado) return;
  const secs = [{ num: 1, titulo: 'Curriculum Vitae', c: window._cvTextoGerado }];
  const u    = State.get('u') || {};
  gerarJanelaPDF(secs, { titulo: 'Curriculum Vitae — ' + (u.nome || ''), tipo: 'CV', sigla: 'CV', inst: '', prof: '', nivel: '', autor: u.nome || '', watermark: false });
}

function _expCvDocx() {
  if (!window._cvTextoGerado) return;
  const secs = [{ num: 1, titulo: 'Curriculum Vitae', c: window._cvTextoGerado }];
  const u    = State.get('u') || {};
  _expDocxExecutar(secs, { titulo: 'Curriculum Vitae', tipo: 'CV', sigla: 'CV', inst: '', prof: '', nivel: '', autor: u.nome || '' });
}
