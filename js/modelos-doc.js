/* ═══════════════════════════════════════════════════════════
   ACADEMY — MODELOS-DOC.JS
   Documentos pré-formatados (formulário → documento em tempo real)
   Requerimento · Declaração · Ofício · Termo de Responsabilidade
   Carta de Apresentação · Ata de Reunião · Contrato
   IA mínima: "✨ Melhorar texto" apenas para polir redação.
   Grátis — não consome páginas/créditos.
   Depende de: navigation.js, layout.js, export.js, generator.js
╚═══════════════════════════════════════════════════════════ */

function _mdocData() {
  const d = new Date();
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

const MODELOS_DOC = [
  {
    id: 'requerimento', n: 'Requerimento', i: '📝', d: 'Pedidos formais a instituições', cat: '📋 Oficial',
    campos: [
      { id: 'nome',      l: 'Nome completo', ph: 'Ex: João Manuel Silva', v: State.get('u')?.nome || '' },
      { id: 'bi',        l: 'Nº do Bilhete de Identidade', ph: 'Ex: 003456789LA041' },
      { id: 'curso',     l: 'Curso / Ocupação', ph: 'Ex: Licenciatura em Direito' },
      { id: 'inst',      l: 'Instituição', ph: 'Ex: Universidade Agostinho Neto' },
      { id: 'assunto',   l: 'O que requer?', ph: 'Ex: a emissão da declaração de frequência do 3º ano…', ia: true },
      { id: 'local',     l: 'Local', ph: 'Ex: Luanda', v: 'Luanda' },
    ],
    montar: (f) => {
      const data = _mdocData();
      return `REQUERIMENTO
${f.inst || 'À Instituição'}

Assunto: ${f.assunto || '—'}

${f.inst ? `Exmo(a). Sr(a). Director(a) do ${f.inst},\n\n` : 'Exmo(a). Sr(a). Director(a),\n\n'}Eu, ${f.nome || '__________'}, portador(a) do Bilhete de Identidade nº ${f.bi || '__________'}, ${f.curso ? `estudante do curso de ${f.curso}, ` : ''}venho respeitosamente requerer a Vossa Excelência, nos termos e para os efeitos legais, o seguinte:

${f.assunto || '…'}

Nestes termos, peço deferimento.

${f.local || '__________'}, ${data}

Atentamente,

${f.nome || '__________'}
${f.bi ? `BI nº ${f.bi}` : ''}`;
    },
  },
  {
    id: 'declaracao', n: 'Declaração', i: '✅', d: 'Declarações simples e formais', cat: '📋 Oficial',
    campos: [
      { id: 'nome',    l: 'Nome completo', ph: 'Ex: Ana Domingos Fernandes', v: State.get('u')?.nome || '' },
      { id: 'bi',      l: 'Nº do Bilhete de Identidade', ph: 'Ex: 003456789LA041' },
      { id: 'ocup',    l: 'Ocupação / Situação', ph: 'Ex: estudante do 4º ano de Gestão' },
      { id: 'dec',     l: 'O que se declara?', ph: 'Ex: que frequenta o 4º ano e não tem dívidas à instituição', ia: true },
      { id: 'local',   l: 'Local', ph: 'Ex: Luanda', v: 'Luanda' },
    ],
    montar: (f) => `DECLARAÇÃO

Eu, ${f.nome || '__________'}, portador(a) do Bilhete de Identidade nº ${f.bi || '__________'}, ${f.ocup ? `${f.ocup}, ` : ''}declaro, para os devidos efeitos, que ${f.dec || '…'}.

Por ser verdade e me ter sido pedido, passo a presente declaração, em ${f.local || '__________'}, aos ${_mdocData()}.

${f.nome || '__________'}
${f.bi ? `BI nº ${f.bi}` : ''}`,
  },
  {
    id: 'oficio', n: 'Ofício', i: '📮', d: 'Comunicação oficial entre entidades', cat: '📋 Oficial',
    campos: [
      { id: 'emit',     l: 'Remetente (quem envia)', ph: 'Ex: Associação de Estudantes' },
      { id: 'cargoE',   l: 'Cargo do remetente', ph: 'Ex: Presidente' },
      { id: 'dest',     l: 'Destinatário', ph: 'Ex: Magnífico Reitor' },
      { id: 'cargoD',   l: 'Cargo do destinatário', ph: 'Ex: Reitor da Universidade' },
      { id: 'assunto',  l: 'Assunto', ph: 'Ex: solicitação de sala para a conferência do dia…', ia: true },
      { id: 'local',    l: 'Local', ph: 'Ex: Luanda', v: 'Luanda' },
    ],
    montar: (f) => `OFÍCIO

${f.local || '__________'}, ${_mdocData()}

Ao Exmo(a). Sr(a). ${f.dest || '__________'}
${f.cargoD || ''}

Assunto: ${f.assunto || '—'}

${f.emit || '__________'}, na qualidade de ${f.cargoE || '__________'}, vem por este meio apresentar a Vossa Excelência o seguinte:

${f.assunto || '…'}

Com os melhores cumprimentos,

${f.emit || '__________'}
${f.cargoE ? `(${f.cargoE})` : ''}`,
  },
  {
    id: 'termo', n: 'Termo de Responsabilidade', i: '🛡️', d: 'Compromissos formais', cat: '📋 Oficial',
    campos: [
      { id: 'nome',    l: 'Nome completo', ph: 'Ex: Pedro Miguel dos Santos', v: State.get('u')?.nome || '' },
      { id: 'bi',      l: 'Nº do Bilhete de Identidade', ph: 'Ex: 003456789LA041' },
      { id: 'ent',     l: 'Perante quem?', ph: 'Ex: a Direcção da Instituição' },
      { id: 'comp',    l: 'Compromisso', ph: 'Ex: a zelar pela preservação dos equipamentos do laboratório', ia: true },
      { id: 'local',   l: 'Local', ph: 'Ex: Luanda', v: 'Luanda' },
    ],
    montar: (f) => `TERMO DE RESPONSABILIDADE

Eu, ${f.nome || '__________'}, portador(a) do Bilhete de Identidade nº ${f.bi || '__________'}, comprometo-me perante ${f.ent || '__________'} a:

${f.comp || '…'}

Declaro estar ciente das obrigações acima mencionadas e responsabilizo-me pelo cumprimento integral das mesmas, sujeitando-me às consequências legais e disciplinares aplicáveis.

${f.local || '__________'}, ${_mdocData()}

${f.nome || '__________'}
${f.bi ? `BI nº ${f.bi}` : ''}`,
  },
  {
    id: 'carta', n: 'Carta de Apresentação', i: '✉️', d: 'Candidaturas a emprego / estágio', cat: '💼 Profissional',
    campos: [
      { id: 'nome',    l: 'Nome completo', ph: 'Ex: Carla Sebastião André', v: State.get('u')?.nome || '' },
      { id: 'cargo',   l: 'Cargo pretendido', ph: 'Ex: Assistente Administrativa' },
      { id: 'emp',     l: 'Empresa / Instituição', ph: 'Ex: Empresa XYZ, Lda.' },
      { id: 'motivo',  l: 'Porquê tu?', ph: 'Ex: tenho 3 anos de experiência em secretariado e domínio de Office', ia: true },
      { id: 'contacto', l: 'Contacto (tel/email)', ph: 'Ex: +244 923 456 789 · nome@email.com' },
      { id: 'local',   l: 'Local', ph: 'Ex: Luanda', v: 'Luanda' },
    ],
    montar: (f) => `CARTA DE APRESENTAÇÃO

${f.local || '__________'}, ${_mdocData()}

Exmo(a). Sr(a).
${f.emp || '__________'}

Assunto: Candidatura ao cargo de ${f.cargo || '__________'}

Eu, ${f.nome || '__________'}, venho por este meio apresentar a minha candidatura ao cargo de ${f.cargo || '__________'} na vossa instituição.

${f.motivo ? `${f.motivo}. ` : ''}Tenho disponibilidade imediata e grande interesse em integrar a vossa equipa, contribuindo com dedicação e responsabilidade.

Contactos: ${f.contacto || '__________'}

Sem outro assunto, subscrevo-me atenciosamente.

${f.nome || '__________'}`,
  },
  {
    id: 'ata', n: 'Ata de Reunião', i: '📋', d: 'Registos formais de reuniões', cat: '📋 Oficial',
    campos: [
      { id: 'org',      l: 'Órgão / Assembleia', ph: 'Ex: Assembleia de Estudantes' },
      { id: 'pres',     l: 'Quem presidiu', ph: 'Ex: João Manuel Silva' },
      { id: 'presentes', l: 'Presentes', ph: 'Ex: 15 membros (lista em anexo)' },
      { id: 'pauta',    l: 'Ordem de trabalhos', ph: 'Ex: aprovação do plano de actividades do semestre', ia: true },
      { id: 'decisoes', l: 'Deliberações', ph: 'Ex: aprovado o plano por unanimidade', ia: true },
      { id: 'local',    l: 'Local', ph: 'Ex: Luanda', v: 'Luanda' },
    ],
    montar: (f) => `ACTA DA REUNIÃO DA ${(f.org || '__________').toUpperCase()}

Aos ${_mdocData()}, realizou-se a reunião da ${f.org || '__________'} no ${f.local || '__________'}, presidida por ${f.pres || '__________'}, com a presença de ${f.presentes || '__________'}.

Ordem de trabalhos:
${f.pauta || '…'}

Após análise e discussão, deliberou-se o seguinte:
${f.decisoes || '…'}

Nada mais havendo a tratar, encerrou-se a reunião e eu lavrei a presente acta, que vai assinada.

${f.pres || '__________'}
(Presidente)

${f.local || '__________'}, ${_mdocData()}`,
  },
  {
    id: 'contrato', n: 'Contrato de Serviços', i: '🤝', d: 'Prestação de serviços simples', cat: '💼 Profissional',
    campos: [
      { id: 'cont',   l: 'Contratante', ph: 'Ex: Empresa XYZ, Lda., representada por…' },
      { id: 'pres',   l: 'Prestador', ph: 'Ex: Maria da Luz Neto' },
      { id: 'serv',   l: 'Serviço', ph: 'Ex: desenvolvimento de 5 artigos de blog sobre gestão', ia: true },
      { id: 'valor',  l: 'Valor (Kz)', ph: 'Ex: 150.000' },
      { id: 'prazo',  l: 'Prazo de entrega', ph: 'Ex: 30 dias a contar da assinatura' },
      { id: 'local',  l: 'Local', ph: 'Ex: Luanda', v: 'Luanda' },
    ],
    montar: (f) => `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Entre ${f.cont || '__________'}, adiante designado(a) por CONTRATANTE, e ${f.pres || '__________'}, adiante designado(a) por PRESTADOR(A), celebra-se o presente contrato, que se rege pelas seguintes cláusulas:

CLÁUSULA 1ª — OBJECTO
O(A) PRESTADOR(A) compromete-se a executar: ${f.serv || '…'}.

CLÁUSULA 2ª — REMUNERAÇÃO
Pela prestação do serviço, o(a) CONTRATANTE pagará o valor de ${f.valor ? `${f.valor} Kz` : '__________'}.

CLÁUSULA 3ª — PRAZO
O serviço deverá ser concluído em ${f.prazo || '__________'}.

CLÁUSULA 4ª — OBRIGAÇÕES
O(A) PRESTADOR(A) obriga-se a executar o serviço com qualidade e no prazo estipulado; o(a) CONTRATANTE obriga-se a efectuar o pagamento acordado.

CLÁUSULA 5ª — FORO
Para dirimir qualquer litígio, é competente o foro de ${f.local || '__________'}.

${f.local || '__________'}, ${_mdocData()}

____________________________________
CONTRATANTE — ${f.cont || ''}

____________________________________
PRESTADOR(A) — ${f.pres || ''}`,
  },
];

/* ── Estado do editor ── */
const _mdoc = { sel: null, campos: {} };

function _mdocCampoVal(modeloId, campoId) {
  const modelo = MODELOS_DOC.find(m => m.id === modeloId);
  const campo  = modelo?.campos.find(c => c.id === campoId);
  if (_mdoc.campos[campoId] === undefined) {
    const inicial = campo?.v || '';
    _mdoc.campos[campoId] = inicial;
  }
  return _mdoc.campos[campoId] ?? '';
}

function _mdocTexto() {
  const modelo = MODELOS_DOC.find(m => m.id === _mdoc.sel);
  if (!modelo) return '';
  const f = {};
  for (const c of modelo.campos) f[c.id] = _mdocCampoVal(modelo.id, c.id);
  return modelo.montar(f);
}

function _mdocPreview() {
  const el = document.getElementById('mdoc-preview');
  if (!el) return;
  const modelo = MODELOS_DOC.find(m => m.id === _mdoc.sel);
  const alvo = el.firstElementChild || el;
  alvo.innerHTML = `<div style="font-family:Georgia,'Times New Roman',serif;font-size:13.5px;line-height:1.9;color:#1c1c1c;white-space:pre-wrap">${_mdocTexto()}</div>`;
  window._mdocTextoGerado = _mdocTexto();
  if (modelo) document.getElementById('mdoc-titulo') && (document.getElementById('mdoc-titulo').textContent = `${modelo.i} ${modelo.n}`);
}

function _mdocAbrir(id) {
  _mdoc.sel = id;
  _mdoc.campos = {};
  irPara('modelosdoc');
}

/* ── Exportar (reutiliza o motor PDF/DOCX da app) ── */
function _mdocExportarPDF() {
  const modelo = MODELOS_DOC.find(m => m.id === _mdoc.sel);
  const texto  = _mdocTexto();
  const u      = State.get('u') || {};
  gerarJanelaPDF([{ num: 1, titulo: modelo.n, c: texto }], {
    titulo: modelo.n, tipo: 'Documento', sigla: 'DOC', inst: '', prof: '', nivel: '',
    autor: u.nome || '', watermark: false,
  });
}

function _mdocExportarDocx() {
  const modelo = MODELOS_DOC.find(m => m.id === _mdoc.sel);
  const texto  = _mdocTexto();
  const u      = State.get('u') || {};
  _expDocxExecutar([{ num: 1, titulo: modelo.n, c: texto }], {
    titulo: modelo.n, tipo: 'Documento', sigla: 'DOC', inst: '', prof: '', nivel: '', autor: u.nome || '',
  });
}

/* ── IA mínima: polir apenas o texto do campo ── */
async function _mdocPolir(campoId) {
  const texto = (_mdoc.campos[campoId] || '').trim();
  if (texto.length < 10) { mostrarToast('Escreve primeiro o texto do campo.', 'erro'); return; }
  mostrarToast('✨ A melhorar o texto…');
  try {
    const res = await callAcademyAPI({
      acao:      'documento_livre',
      tipoDoc:   'Revisão de texto',
      descricao: 'Melhora apenas a redação do texto abaixo: corrige erros de português, torna-o formal e claro, mantém o sentido e não inventa factos.\n\n' + texto,
      lingua:    State.get('lingua') || 'pt-AO',
    });
    _mdoc.campos[campoId] = typeof res === 'string' ? res.trim() : JSON.stringify(res);
    _mdocPreview();
    const inp = document.getElementById('mdoc-campo-' + campoId);
    if (inp) inp.value = _mdoc.campos[campoId];
    mostrarToast('✓ Texto melhorado.');
  } catch (e) {
    mostrarToast('IA indisponível: ' + (e.message || ''), 'erro');
  }
}

function _mdocProgresso() {
  const modelo = MODELOS_DOC.find(m => m.id === _mdoc.sel);
  if (!modelo) return 0;
  let preenchidos = 0;
  for (const c of modelo.campos) {
    if (String(_mdocCampoVal(modelo.id, c.id) || '').trim().length > 1) preenchidos++;
  }
  return Math.round((preenchidos / modelo.campos.length) * 100);
}

/* ── Ecrã ── */
function sModelosDoc() {
  const modelo = MODELOS_DOC.find(m => m.id === _mdoc.sel);

  /* Grelha de modelos */
  if (!modelo) {
    const cats = [...new Set(MODELOS_DOC.map(m => m.cat))];
    return `
    <div class="fase"><div class="fase-p b"></div>MODELOS DE DOCUMENTOS</div>
    <div class="T1">Documentos<br/><strong>prontos</strong></div>
    <div class="desc" style="margin-bottom:18px">Escolhe um modelo, preenche os dados e o documento fica pronto — grátis.</div>

    ${cats.map(cat => `
      <div style="font-family:var(--fm);font-size:9px;letter-spacing:.1em;color:var(--t3);text-transform:uppercase;margin:2px 0 8px">${cat}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
        ${MODELOS_DOC.filter(m => m.cat === cat).map(m => `
        <div onclick="_mdocAbrir('${m.id}')" style="background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r2);padding:14px;cursor:pointer;transition:all .18s;position:relative"
          onmouseover="this.style.borderColor='var(--eb)';this.style.background='var(--sf3)'" onmouseout="this.style.borderColor='var(--e0)';this.style.background='var(--z2)'">
          ${m.campos.some(c => c.ia) ? `<div style="position:absolute;top:10px;right:10px;font-family:var(--fm);font-size:7px;background:var(--eb);color:var(--b);padding:2px 7px;border-radius:8px;font-weight:700">✨ IA</div>` : ''}
          <div style="font-size:22px;margin-bottom:8px">${m.i}</div>
          <div style="font-size:12.5px;font-weight:700;color:var(--t1);margin-bottom:3px;padding-right:26px">${m.n}</div>
          <div style="font-size:10.5px;color:var(--t3);line-height:1.5">${m.d}</div>
        </div>`).join('')}
      </div>`).join('')}

    <button class="btn G w" style="margin-top:8px" onclick="irPara('documentos')">← Voltar aos documentos</button>
    ${RODAPE_HTML}`;
  }

  /* Editor: formulário + documento ao vivo */
  const prog = _mdocProgresso();
  return `
  <div class="fase"><div class="fase-p b"></div>MODELO · ${modelo.i} ${modelo.n}</div>

  <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">

    <!-- Formulário -->
    <div style="flex:1 1 300px;min-width:270px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <div style="flex:1;height:5px;background:var(--z4);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${prog}%;background:linear-gradient(90deg,var(--b),var(--bd));border-radius:3px;transition:width .3s"></div>
        </div>
        <span style="font-family:var(--fm);font-size:9px;color:${prog === 100 ? 'var(--b)' : 'var(--t3)'};font-weight:700">${prog}%</span>
      </div>
      ${modelo.campos.map(c => `
      <label class="lbl">${c.l}</label>
      <div style="display:flex;gap:6px;margin-bottom:${c.ia ? '4px' : '12px'}">
        <input class="inp" id="mdoc-campo-${c.id}" placeholder="${c.ph}"
          value="${_mdocCampoVal(modelo.id, c.id).replace(/"/g, '&quot;')}"
          oninput="_mdoc.campos['${c.id}']=this.value;_mdocPreview()" style="flex:1"/>
        ${c.ia ? `
        <button onclick="_mdocPolir('${c.id}')" title="Melhorar texto com IA"
          style="background:var(--z2);border:.5px solid var(--e0);border-radius:var(--r2);color:var(--b);padding:0 12px;font-size:14px;cursor:pointer;flex-shrink:0">✨</button>` : ''}
      </div>
      ${c.ia ? `<div style="font-family:var(--fm);font-size:8px;color:var(--t3);margin:-6px 0 12px">✨ Melhora a redação deste texto com IA</div>` : ''}
      `).join('')}

      ${prog === 100 ? `
      <div style="background:var(--sf3);border:.5px solid var(--eb);border-radius:10px;padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--b)">
        <span>✓</span><span><strong>Documento pronto.</strong> Exporta em PDF ou Word.</span>
      </div>` : ''}

      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn B" style="flex:1" onclick="_mdocExportarPDF()">📄 PDF</button>
        <button class="btn G" style="flex:1" onclick="_mdocExportarDocx()">📝 DOCX</button>
      </div>
      <button class="btn G w" style="margin-top:8px" onclick="_mdoc.sel=null;irPara('modelosdoc')">↺ Outro modelo</button>
      <button class="btn G w" style="margin-top:8px" onclick="irPara('documentos')">← Voltar aos documentos</button>
    </div>

    <!-- Documento (papel) -->
    <div style="flex:1 1 340px;min-width:300px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-family:var(--fm);font-size:8px;color:var(--t3);letter-spacing:.1em;text-transform:uppercase">📄 Documento pronto</div>
        <div style="font-family:var(--fm);font-size:8px;color:var(--b);letter-spacing:.06em" id="mdoc-titulo">${modelo.i} ${modelo.n}</div>
      </div>
      <div id="mdoc-preview" style="background:#ffffff;border:.5px solid var(--e1);border-radius:6px;padding:8px;box-shadow:0 6px 24px rgba(0,0,0,.25)">
        <div style="background:#ffffff;border:.5px solid #EEE;border-radius:2px;padding:26px 24px;aspect-ratio:210/277;overflow:auto"></div>
      </div>
    </div>
  </div>
  ${RODAPE_HTML}`;
}
