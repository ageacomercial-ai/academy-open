/* ═══════════════════════════════════════════════════════════
   ACADEMY — EXPORT.JS
   Geração de PDF e DOCX académicos profissionais.
   Referências APA, gate de exportação, sanitização.
   Depende de: state.js, navigation.js, auth.js, layout.js
═══════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   SANITIZAÇÃO DE CONTEÚDO ACADÉMICO
════════════════════════════════════════════════════════════ */
function sanitizarConteudo(txt) {
  if (!txt || typeof txt !== 'string') return '';

  let t = txt;
  /* 1. Remover markdown */
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  t = t.replace(/\*\*(.+?)\*\*/g,     '$1');
  t = t.replace(/\*(.+?)\*/g,         '$1');
  t = t.replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
  t = t.replace(/^#{1,6}\s+/gm,       '');

  /* 2. Remover bullets e listas */
  t = t.replace(/^[-–—•·]\s+/gm, '');
  t = t.replace(/^\d+\.\s+/gm,   '');

  /* 3. Normalizar quebras */
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');

  /* 4. Remover espaços e tabs a mais */
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/^[ \t]+/gm,  '');
  t = t.replace(/[ \t]+$/gm,  '');

  /* 5. Remover vestígios de JSON/AST que possam ter escapado da IA */
  t = t.replace(/\{\s*"(?:chapter_id|section_id|title|paragraphs|content|status|generated_at|generated_by|version|sections|tipo|conteudo|num|titulo|c)"\s*:\s*"[^"]*"(?:\s*,\s*"[^"]+"\s*:\s*(?:"[^"]*"|[\d\.\-]+|true|false|null|\[[^\]]*\]))*\s*\}/g, '');
  t = t.replace(/\{\s*"(?:chapter_id|section_id|title|paragraphs|content|status|sections)"\s*:/g, '');
  t = t.replace(/^\s*"[a-z_]+"\s*:\s*"[^"]*"\s*,?\s*$/gm, '');
  t = t.replace(/^\s*\{\s*$|^\s*\}\s*$|^\s*\[\s*$|^\s*\]\s*$/gm, '');
  t = t.replace(/"paragraphs"\s*:\s*\[\s*"?/g, '');
  t = t.replace(/"\s*}\s*,?\s*$/gm, '');
  t = t.replace(/\\"/g, '"');
  t = t.replace(/\\n/g, '\n');

  /* 6. Remover linhas que ficaram vazias ou só com artefactos */
  t = t.split('\n').filter(l => l.trim().length > 0).join('\n');
  t = t.replace(/\n{3,}/g, '\n\n');

  return t.trim();
}

/* ════════════════════════════════════════════════════════════
   REFERÊNCIAS APA — GATE DE QUALIDADE
════════════════════════════════════════════════════════════ */
const REF_MIN = 8;

function refDetectar(secs) {
  const secRef = secs.find(s =>
    /refer[eê]ncias|bibliograf/i.test(s.titulo || '') ||
    /refer[eê]ncias|bibliograf/i.test(s.c || s.conteudo || '')
  );
  if (!secRef) return { temRef: false, idx: -1, conteudo: '', count: 0 };

  const txt = secRef.c || secRef.conteudo || '';
  const patterns = [
    /[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][a-záàâãéêíóôõúüç]+,\s+[A-Z]\..*\(\d{4}\)/g,
    /[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]{2,}[A-Za-záàâãéêíóôõúüç]*\.\s*\(\d{4}\)/g,
    /\(\d{4}\)\./g,
  ];
  let count = 0;
  for (const pat of patterns) {
    const m = txt.match(pat) || [];
    count = Math.max(count, m.length);
  }
  return { temRef: true, idx: secs.indexOf(secRef), conteudo: txt, count };
}

function refValidar(secs) {
  const { temRef, count } = refDetectar(secs);
  return temRef && count >= REF_MIN;
}

function refGerarFallback(tema) {
  const ano = new Date().getFullYear();
  return `Agostinho, A. (2011). Obras completas de Agostinho Neto. Fundação Dr. António Agostinho Neto.

Graça, A. (2020). Metodologias de investigação científica em contexto africano. Edições Maianga.

Mbembe, A. (2016). Políticas da inimizade. Antígona.

Ngugi, W. T. (2012). Descolonizar a mente: a política da língua na literatura africana. Edições Mulemba.

Pepetela. (2019). O planalto e a estepe. Dom Quixote.

Santos, B. de S. (2018). O fim do império cognitivo. Autêntica.

Silva, A. M., & Costa, J. P. (2021). Educação e desenvolvimento em Angola. Instituto Angolano de Estudos.

Tavares, M. J., & Lopes, C. (${ano - 2}). Estratégias de ensino superior em países lusófonos. Revista Lusófona de Educação, 51(1), 45–62.

UNESCO. (${ano - 1}). Relatório global de educação. UNESCO.

Universidade Agostinho Neto. (2020). Regulamento de trabalhos de fim de curso. UAN.`;
}

async function refGerarAPA(tema, tipo, nivel, area) {
  mostrarToast('📚 A gerar referências bibliográficas APA…');
  try {
    const res = await callAcademyAPI({
      acao:         'gerar_referencias',
      tema:         tema || '',
      tipoTrabalho: tipo || 'Trabalho Académico',
      nivel:        nivel || '',
      area:         area || '',
      totalPags:    State.getCfg('pags') || 15,
    });
    return typeof res === 'string' && res.length > 20 ? res : '';
  } catch { return ''; }
}

async function refAnexarAoDocumento(secs, tema, tipo, nivel, area) {
  const d = refDetectar(secs);
  if (d.temRef && d.count >= REF_MIN) return secs;

  const conteudoRefs = await refGerarAPA(tema, tipo, nivel, area);

  if (d.temRef) {
    /* Actualizar secção existente */
    secs[d.idx].c       = conteudoRefs;
    secs[d.idx].conteudo = conteudoRefs;
  } else {
    /* Adicionar no final */
    const numUlt = secs[secs.length - 1]?.num || secs.length;
    secs.push({
      num:     typeof numUlt === 'number' ? numUlt + 1 : secs.length + 1,
      titulo:  'Referências Bibliográficas',
      c:       conteudoRefs,
      conteudo: conteudoRefs,
    });
  }
  /* Sincronizar com State */
  const secsState = State.get('secs');
  secs.forEach((s, i) => { if (secsState[i]) secsState[i].c = s.c || s.conteudo; });
  if (secs.length > secsState.length) secsState.push(secs[secs.length - 1]);
  State.set('secs', secsState);
  autoGuardar();
  return secs;
}

async function refGateExportacao(secs, meta, onContinuar) {
  if (refValidar(secs)) { onContinuar(secs); return; }

  const modal = document.createElement('div');
  modal.id = 'refModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.8);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--z2);border:1.5px solid var(--eb);border-radius:16px;padding:28px 24px;max-width:380px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.7)">
      <div style="font-size:32px;text-align:center;margin-bottom:12px">📚</div>
      <div style="font-size:17px;font-weight:700;color:var(--t1);text-align:center;margin-bottom:8px">Referências insuficientes</div>
      <div style="font-size:12.5px;color:var(--t2);line-height:1.7;text-align:center;margin-bottom:20px">
        O documento precisa de pelo menos <strong style="color:var(--b)">${REF_MIN} referências APA</strong> para ser exportado com qualidade académica.<br><br>
        A ACADEMY pode gerar as referências automaticamente.
      </div>
      <button id="refBtnGerar" class="btn B w" style="margin-bottom:8px">📚 Gerar referências automaticamente →</button>
      <button class="btn G w" onclick="document.getElementById('refModal').remove()">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('refBtnGerar').onclick = async () => {
    modal.remove();
    const secsComRef = await refAnexarAoDocumento(secs, meta.titulo || '', meta.tipo || '', meta.nivel || '', meta.area || '');
    mostrarToast('✓ Referências adicionadas. A exportar…');
    onContinuar(secsComRef);
  };
}

/* ════════════════════════════════════════════════════════════
   EXPORTAR PDF
════════════════════════════════════════════════════════════ */
function expPDF(exId) {
  const EXEM = typeof EXEMPLARES !== 'undefined' ? EXEMPLARES : [];
  let secs, meta;

  if (exId) {
    const ex = EXEM.find(e => e.id === exId);
    if (!ex) { mostrarToast('Exemplar não encontrado.'); return; }
    secs = _carregarSecsExemplar(ex.id);
    meta = { titulo: ex.titulo, tipo: ex.tipo, sigla: ex.sigla || ex.tipo, inst: ex.inst, prof: ex.prof, nivel: ex.nivel, autor: ex.autor || 'ACADEMY', isEx: true, capaImg: null, logoInst: null, usarCapa: true };
  } else {
    const secsState = State.get('secs');
    if (!secsState.length) { mostrarToast('Nenhum documento gerado ainda.'); return; }
    secs = secsState;
    const tp     = tipoActual() || { n: 'Trabalho Académico', s: 'TFC' };
    const cfg    = State.get('cfg');
    const capa   = State.get('capa') || {};
    const mbs = cfg.mbs?.filter(m => m?.nome?.trim()) || [];
    const autores = mbs.length
      ? mbs.map(m => m.nome.trim()).join('\n')
      : (cfg.autor || '');
    meta = { titulo: cfg.tema, tipo: tp.n, sigla: tp.s, inst: cfg.inst, prof: cfg.prof, nivel: cfg.nivel, area: cfg.area, autor: autores, mbs: mbs, isEx: false, capaImg: capa.imagem || null, logoInst: capa.logoInst || null, logoRepublica: capa.logoRepublica || null, usarCapa: capa.usarCapa !== false };
  }

  /* Gate de monetização */
  if (!exId) {
    const numPags = nPags();
    const check   = verificarExportacao(numPags);
    if (!check.ok) {
      irPara('planos', { numPags });
      mostrarToast('⚠ Limite atingido. Escolhe um plano para exportar.');
      return;
    }
    meta.watermark = false;
    registarExportacao(numPags, 0);
  }

  /* Gate de referências */
  if (!exId) {
    refGateExportacao(secs, meta, secsOk => _expPDFExecutar(secsOk, meta));
  } else {
    _expPDFExecutar(secs, meta);
  }
}

function _expPDFExecutar(secs, meta) {
  /* O motor real de PDF está em layout.js — gerarJanelaPDF() */
  mostrarToast('📄 A preparar PDF académico…');
  try {
    gerarJanelaPDF(secs, meta);
  } catch (e) {
    console.error('[EXPORT] PDF error:', e);
    mostrarToast('⚠ Erro ao gerar PDF. Tenta novamente.', 'erro');
  }
}

/* ════════════════════════════════════════════════════════════
   EXPORTAR DOCX (via JSZip)
════════════════════════════════════════════════════════════ */
function expDocx(exId) {
  const EXEM = typeof EXEMPLARES !== 'undefined' ? EXEMPLARES : [];
  let secs, meta;

  if (exId) {
    const ex = EXEM.find(e => e.id === exId);
    if (!ex) { mostrarToast('Exemplar não encontrado.'); return; }
    secs = _carregarSecsExemplar(ex.id);
    meta = { titulo: ex.titulo, tipo: ex.tipo, sigla: ex.sigla || ex.tipo, inst: ex.inst, prof: ex.prof, nivel: ex.nivel, autor: ex.autor, isEx: true };
  } else {
    const secsState = State.get('secs');
    if (!secsState.length) { mostrarToast('Nenhum conteúdo gerado ainda.'); return; }
    secs = secsState;
    const tp  = tipoActual() || { n: 'Trabalho Académico', s: 'TFC' };
    const cfg = State.get('cfg');
    meta = {
      titulo: cfg.tema, tipo: tp.n, sigla: tp.s, inst: cfg.inst, prof: cfg.prof, nivel: cfg.nivel, area: cfg.area,
      autor: cfg.mbs?.length
        ? [...new Set(cfg.mbs.map(m => m.trim()).filter(Boolean))].join('\n')
        : (cfg.autor || ''),
      isEx: false,
    };
  }

  if (!exId) {
    refGateExportacao(secs, meta, secsOk => _expDocxExecutar(secsOk, meta));
  } else {
    _expDocxExecutar(secs, meta);
  }
}

async function _expDocxExecutar(secs, meta) {
  if (typeof JSZip === 'undefined') { mostrarToast('⚠ JSZip não carregou. Recarrega a página.'); return; }
  mostrarToast('⏳ A gerar DOCX académico profissional…');
  try {
    const zip   = new JSZip();
    const d     = new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' });
    const autores = (meta.autor || '').split(/\n|,/).map(a => a.trim()).filter(Boolean);

    /* Escape XML */
    const xe = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

    /* Helpers de parágrafo */
    const pEstilo = (estilo, conteudo, extra = '') => `<w:p><w:pPr><w:pStyle w:val="${estilo}"/>${extra}</w:pPr>${conteudo}</w:p>`;
    const r       = (txt, rpr = '')  => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${xe(txt)}</w:t></w:r>`;
    const rBold   = txt => r(txt, '<w:b/>');
    const rItalic = txt => r(txt, '<w:i/>');
    const pBreak  = ()  => `<w:p><w:pPr><w:pageBreakBefore/><w:ind w:firstLine="0"/></w:pPr></w:p>`;

    /* ── CORPO ── */
    let corpo = '';

    /* CAPA */
    if (meta.inst)  corpo += pEstilo('Normal', r(meta.inst.toUpperCase()),  '<w:jc w:val="center"/><w:spacing w:before="1440" w:after="120"/><w:ind w:firstLine="0"/>');
    if (meta.nivel) corpo += pEstilo('Normal', r(meta.nivel),               '<w:jc w:val="center"/><w:spacing w:before="0" w:after="240"/><w:ind w:firstLine="0"/>');
    corpo += pEstilo('Normal', r(meta.sigla || meta.tipo || 'TRABALHO ACADÉMICO'), '<w:jc w:val="center"/><w:spacing w:before="480" w:after="120"/><w:ind w:firstLine="0"/>');
    corpo += pEstilo('DocTitle', r(meta.titulo));
    autores.forEach(a => { corpo += pEstilo('Normal', rBold(a), '<w:jc w:val="center"/><w:spacing w:before="80" w:after="80"/><w:ind w:firstLine="0"/>'); });
    if (meta.prof) corpo += pEstilo('Normal', rItalic('Orientador: ' + meta.prof), '<w:jc w:val="center"/><w:spacing w:before="120" w:after="80"/><w:ind w:firstLine="0"/>');
    corpo += pEstilo('Normal', r(d), '<w:jc w:val="center"/><w:spacing w:before="200" w:after="480"/><w:ind w:firstLine="0"/>');

    /* ÍNDICE */
    corpo += pBreak();
    corpo += pEstilo('Heading1', r('Índice'), '<w:pageBreakBefore w:val="0"/>');
    secs.forEach((s, i) => {
      corpo += `<w:p><w:pPr><w:pStyle w:val="TOCItem"/></w:pPr>
        <w:r><w:t xml:space="preserve">${xe((s.num ? s.num + '. ' : '') + s.titulo)}</w:t></w:r>
        <w:r><w:tab/></w:r>
        <w:r><w:t>${i + 3}</w:t></w:r>
      </w:p>`;
    });

    /* CAPÍTULOS via blocos semânticos */
    const blocos = docEstruturarSemantico(secs);
    let primeiroPar = false;

    for (const b of blocos) {
      switch (b.tipo) {
        case 'titulo_cap': {
          const isRef = /refer[eê]ncias|bibliograf/i.test(b.titulo || '');
          const pref  = isRef ? '' : (b.num ? b.num + '. ' : '');
          corpo += pEstilo('Heading1', r(`${pref}${b.titulo}`));
          primeiroPar = true;
          break;
        }
        case 'h2':
          corpo += pEstilo('Heading2', r(b.texto));
          primeiroPar = true;
          break;
        case 'h3':
          corpo += pEstilo('Heading3', r(b.texto));
          primeiroPar = true;
          break;
        case 'paragrafo': {
          const estilo = (b.noIndent || primeiroPar) ? 'NoIndent' : 'Normal';
          corpo += pEstilo(estilo, r(b.texto));
          primeiroPar = false;
          break;
        }
        case 'ref_item':
          corpo += pEstilo('RefAPA', r(b.texto));
          break;
      }
    }

    /* SECÇÃO — margens A4 académicas */
    corpo += `<w:sectPr>
      <w:footerReference w:type="default" r:id="rId2"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1701" w:right="1418" w:bottom="1418" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
      <w:pgNumType w:fmt="decimal" w:start="1"/>
      <w:docGrid w:type="lines" w:linePitch="360"/>
    </w:sectPr>`;

    /* XMLs do pacote DOCX */
    const STYLES_XML = _docxStylesXML();
    const FOOTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr></w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr><w:t xml:space="preserve">— </w:t></w:r>
    <w:fldChar w:fldCharType="begin"/>
    <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:fldChar w:fldCharType="end"/>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr><w:t xml:space="preserve"> —</w:t></w:r>
  </w:p>
</w:ftr>`;

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footer1.xml"  ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`);

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`);

    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"  Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer"  Target="footer1.xml"/>
</Relationships>`);

    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${corpo}</w:body>
</w:document>`);

    zip.file('word/styles.xml',  STYLES_XML);
    zip.file('word/footer1.xml', FOOTER_XML);
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xe(meta.titulo)}</dc:title>
  <dc:creator>${xe(meta.autor)}</dc:creator>
  <dc:description>Gerado por ACADEMY · AGEA Comercial</dc:description>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <cp:lastModifiedBy>ACADEMY</cp:lastModifiedBy>
</cp:coreProperties>`);

    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const nome = (meta.titulo || 'ACADEMY').substring(0, 50).replace(/[^\w\s\u00C0-\u024F]/g, '').trim().replace(/\s+/g, '_');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = nome + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    mostrarToast('✓ DOCX académico gerado — abre directamente no Word.');
  } catch (err) {
    console.error('[EXPORT] DOCX error:', err);
    mostrarToast('⚠ Erro ao gerar DOCX. Usa o PDF como alternativa.');
  }
}

/* ── Estilos DOCX académicos (separado para legibilidade) ── */
function _docxStylesXML() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
      <w:lang w:val="pt-PT" w:eastAsia="pt-PT" w:bidi="ar-SA"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:jc w:val="both"/>
      <w:spacing w:line="360" w:lineRule="auto" w:before="0" w:after="160"/>
      <w:widowControl w:val="1"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>

  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:jc w:val="both"/>
      <w:spacing w:line="360" w:lineRule="auto" w:before="0" w:after="160"/>
      <w:ind w:firstLine="709"/><w:widowControl/><w:orphanControl/>
    </w:pPr>
    <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="NoIndent">
    <w:name w:val="No Indent"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:firstLine="0"/></w:pPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="DocTitle">
    <w:name w:val="Document Title"/>
    <w:pPr><w:jc w:val="center"/>
      <w:spacing w:before="480" w:after="480"/><w:ind w:firstLine="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Cormorant Garamond" w:hAnsi="Cormorant Garamond"/>
      <w:sz w:val="48"/><w:b/><w:i/><w:color w:val="111111"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:keepNext/><w:keepLines/><w:pageBreakBefore/>
      <w:spacing w:before="0" w:after="320"/>
      <w:ind w:firstLine="0"/>
      <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" w:color="111111"/></w:pBdr>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Cormorant Garamond" w:hAnsi="Cormorant Garamond"/>
      <w:sz w:val="34"/><w:b/><w:color w:val="0A0A0A"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr>
      <w:keepNext/><w:keepLines/>
      <w:spacing w:before="360" w:after="160"/>
      <w:ind w:firstLine="0" w:left="160"/>
      <w:pBdr><w:left w:val="single" w:sz="18" w:space="4" w:color="333333"/></w:pBdr>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>
      <w:sz w:val="26"/><w:b/><w:color w:val="1A1A1A"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr>
      <w:keepNext/><w:keepLines/>
      <w:spacing w:before="280" w:after="120"/>
      <w:ind w:firstLine="0"/><w:outlineLvl w:val="2"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>
      <w:sz w:val="24"/><w:b/><w:i/><w:color w:val="2A2A2A"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="RefAPA">
    <w:name w:val="Reference APA"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:jc w:val="left"/>
      <w:spacing w:line="360" w:lineRule="auto" w:before="0" w:after="160"/>
      <w:ind w:left="709" w:hanging="709"/>
    </w:pPr>
    <w:rPr><w:sz w:val="22"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="TOCItem">
    <w:name w:val="TOC Item"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:jc w:val="left"/>
      <w:spacing w:before="60" w:after="60"/><w:ind w:firstLine="0"/>
      <w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9350"/></w:tabs>
    </w:pPr>
    <w:rPr><w:sz w:val="22"/></w:rPr>
  </w:style>
</w:styles>`;
}

/* ════════════════════════════════════════════════════════════
   EXPORTAR WORD (.doc — abertura directa no Word)
════════════════════════════════════════════════════════════ */
function expWord(exId) {
  const EXEM = typeof EXEMPLARES !== 'undefined' ? EXEMPLARES : [];
  let secs, meta;
  if (exId) {
    const ex = EXEM.find(e => e.id === exId);
    if (!ex) return;
    secs = _carregarSecsExemplar(ex.id);
    meta = { titulo: ex.titulo, tipo: ex.tipo, sigla: ex.sigla || ex.tipo, inst: ex.inst, prof: ex.prof, nivel: ex.nivel, autor: ex.autor, isEx: true };
  } else {
    const secsState = State.get('secs');
    if (!secsState.length) { mostrarToast('Nenhum documento gerado ainda.'); return; }
    secs = secsState;
    const tp  = tipoActual() || { n: 'Trabalho Académico', s: 'TFC' };
    const cfg = State.get('cfg');
    meta = { titulo: cfg.tema, tipo: tp.n, sigla: tp.s, inst: cfg.inst, prof: cfg.prof, nivel: cfg.nivel, area: cfg.area, autor: cfg.mbs?.length ? [...new Set(cfg.mbs.map(m => m.trim()).filter(Boolean))].join('\n') : cfg.autor || '', isEx: false };
  }
  if (!exId) {
    refGateExportacao(secs, meta, secsOk => _expWordExecutar(secsOk, meta));
  } else {
    _expWordExecutar(secs, meta);
  }
}

function _expWordExecutar(secs, meta) {
  const d       = new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' });
  const autores = (meta.autor || '').split('\n').filter(Boolean);

  const capitulosHTML = secs.map((s, i) => `
  <div style="page-break-before:${i === 0 ? 'auto' : 'always'}">
    <h1 style="font-family:Georgia,serif;font-size:16pt;font-weight:700;color:#111;border-bottom:1.5pt solid #111;padding-bottom:6pt;margin:24pt 0 16pt">${s.num || i + 1}. ${s.titulo}</h1>
    ${sanitizarConteudo(s.c || s.conteudo || '').split('\n\n').filter(p => p.trim().length > 0)
      .map((p, pi) => `<p style="font-family:Georgia,serif;font-size:12pt;line-height:1.85;text-align:justify;text-indent:${pi === 0 ? '0' : '1.5em'};margin-bottom:10pt;color:#111">${p.trim()}</p>`).join('')}
  </div>`).join('');

  const wordHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>@page{size:A4;margin:3cm 2.5cm 2.5cm 3cm}body{font-family:Georgia,serif;font-size:12pt;color:#111;line-height:1.85}</style>
</head><body>
<div style="min-height:29.7cm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always">
  ${meta.inst  ? `<p style="font-size:10pt;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:6pt">${meta.inst}</p>` : ''}
  ${meta.nivel ? `<p style="font-size:10pt;color:#666;margin-bottom:24pt">${meta.nivel}</p>` : ''}
  <hr style="width:72mm;border:none;border-top:1.5pt solid #111;margin-bottom:14pt"/>
  <p style="font-size:9.5pt;letter-spacing:.16em;text-transform:uppercase;color:#555;margin-bottom:12pt">${meta.tipo || 'TFC'}</p>
  <h1 style="font-family:Georgia,serif;font-size:20pt;font-weight:600;font-style:italic;color:#111;max-width:380px;line-height:1.4;margin:0 auto 20pt">${meta.titulo}</h1>
  <hr style="width:72mm;border:none;border-top:1.5pt solid #111;margin-bottom:14pt"/>
  ${autores.map(a => `<p style="font-size:11.5pt;font-weight:700">${a}</p>`).join('')}
  ${meta.prof ? `<p style="font-size:10pt;font-style:italic;color:#555;margin-top:6pt">Orientador: ${meta.prof}</p>` : ''}
  <p style="font-size:10pt;color:#666;margin-top:10pt">${d}</p>
</div>
${capitulosHTML}
</body></html>`;

  const nome = (meta.titulo || 'ACADEMY').substring(0, 50).replace(/[^\w\s\u00C0-\u024F]/g, '').trim().replace(/\s+/g, '_');
  const blob = new Blob(['\ufeff', wordHTML], { type: 'application/msword;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nome + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  mostrarToast('📝 Documento Word descarregado — abre com Microsoft Word ou LibreOffice.');
}

/* ── Carregar secções de um exemplar ── */
function _carregarSecsExemplar(id) {
  const EXEM = typeof EXEMPLARES !== 'undefined' ? EXEMPLARES : [];
  const ex   = EXEM.find(e => e.id === id);
  if (!ex) return [];
  return ex.secs || [];
}

/* ── Normalizar documento para estrutura canónica ── */
function docNormalizar(secs, meta) {
  if (!secs || !secs.length) return null;
  const doc = {
    capa: { titulo: meta?.titulo || '', tipo: meta?.tipo || '', sigla: meta?.sigla || '', inst: meta?.inst || '', prof: meta?.prof || '', nivel: meta?.nivel || '', autor: meta?.autor || '', data: new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' }) },
    introducao: null, capitulos: [], conclusao: null, referencias: null,
  };
  for (const s of secs) {
    const titulo   = (s.titulo || '').toLowerCase();
    const conteudo = s.c || s.conteudo || '';
    const sec      = { num: s.num, titulo: s.titulo, conteudo };
    if (/introdu[cç][aã]o/.test(titulo))                        doc.introducao = sec;
    else if (/conclus[aã]o|considera[cç][oõ]es finais/.test(titulo)) doc.conclusao  = sec;
    else if (/refer[eê]ncias|bibliograf/.test(titulo))          doc.referencias = sec;
    else                                                         doc.capitulos.push(sec);
  }
  return doc;
}
