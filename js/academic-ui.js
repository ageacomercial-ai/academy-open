/* ═══════════════════════════════════════════════════════════
   ACADEMY — ACADEMIC-UI.JS
   Frontend components for Academic Document Intelligence:
   integrity badge, claim badges, coverage report, scorecard,
   professor feedback.
   Depende de: state.js, api.js
   ═══════════════════════════════════════════════════════════ */

/* ── Cache de análise ── */
let _ultimaAnalise = null;

/* ── Núcleo: chamar API ── */
async function analisarDocumento() {
  const secs = State.get('secs') || [];
  const cfg  = State.get('cfg') || {};
  const diagnostic = State.get('diagnostic') || null;
  const refs = State.get('refs') || [];

  const payload = {
    tema: cfg.tema || '',
    capitulos: secs.map(s => ({ titulo: s.titulo || '', c: s.c || s.conteudo || '' })),
    diagnostic,
    references: Array.isArray(refs) ? refs : [],
  };

  try {
    const r = await api('analisar_documento', payload);
    if (r && r.data) {
      _ultimaAnalise = r.data;
      return r.data;
    }
  } catch (e) {
    console.warn('[academic-ui] Erro na análise:', e);
  }
  return null;
}

/* ── Renderizar badge de integridade ── */
function renderIntegrityBadge(integrity) {
  if (!integrity) return '';
  const cores = {
    academically_ready: ['var(--g)', '✅'],
    review_required: ['#f5a623', '⚠️'],
    blocked: ['var(--e1)', '🚫'],
    draft: ['var(--t3)', '📄'],
  };
  const [cor, icone] = cores[integrity.state] || cores.draft;
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:${cor}08;border:1.5px solid ${cor}40;border-radius:10px;margin-bottom:14px">
      <div style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0;box-shadow:0 0 8px ${cor}"></div>
      <div style="flex:1">
        <div style="font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${cor}">${icone} ${integrity.label || integrity.state}</div>
        <div style="font-size:11px;color:var(--t2);margin-top:1px">${integrity.reason || ''}</div>
      </div>
      <div style="font-size:9px;color:var(--t3);text-align:right">
        ${integrity.report ? `
        <div>⚠ ${integrity.report.alerts}</div>
        <div>🚫 ${integrity.report.blocked}</div>
        ` : ''}
      </div>
    </div>`;
}

/* ── Renderizar scorecard completo (substitui qual simples) ── */
function renderScorecardPanel(scorecard) {
  if (!scorecard || !scorecard.criteria) return '';
  const total = scorecard.overall || 0;
  const grade = scorecard.grade || 'N/A';
  const corTotal = total >= 80 ? 'var(--g)' : total >= 50 ? '#f5a623' : 'var(--e1)';

  const criteriaLabels = {
    coherence: 'Coerência temática',
    argumentation: 'Estrutura argumentativa',
    integrity: 'Integridade evidências',
    citations: 'Citações/referências',
    coverage: 'Cobertura obj↔cap',
    methodology: 'Metodologia',
    literacy: 'Qualidade escrita',
    formatting: 'Formatação',
  };
  const criteriaList = Object.entries(scorecard.criteria).map(([key, val]) => ({
    label: criteriaLabels[key] || key,
    score: val.score || 0,
  }));

  return `
    <div style="flex:1">
      <div style="font-family:var(--fm);font-size:8.5px;color:var(--t3);letter-spacing:.12em;margin-bottom:10px">QUALIDADE ACADÉMICA</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
        <div style="text-align:center">
          <div style="font-size:28px;font-weight:800;color:${corTotal}">${total}%</div>
          <div style="font-size:10px;font-weight:600;color:${corTotal};font-family:var(--fm);letter-spacing:.05em">${typeof grade === 'object' ? grade.label : grade}</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:5px">
          ${criteriaList.map(c => {
            const pct = Math.min(100, c.score);
            const cor = pct >= 80 ? 'var(--g)' : pct >= 50 ? '#f5a623' : 'var(--e1)';
            return `
              <div class="qi" style="margin:0">
                <div class="qi-l">${c.label}</div>
                <div class="qi-b"><div class="qi-f" style="width:${pct}%;background:${cor}"></div></div>
                <div class="qi-v" style="color:${cor}">${pct}%</div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

/* ── Renderizar feedback do professor ── */
function renderProfessorFeedback(professor) {
  if (!professor || (!professor.comentario && !professor.recomendacoes)) return '';
  const nota = professor.nota || '';
  return `
    <div style="background:var(--sf3);border:1.5px solid var(--e0);border-radius:10px;padding:14px 16px;margin-bottom:14px">
      <div style="font-family:var(--fm);font-size:9px;font-weight:700;color:var(--t3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">👨‍🏫 Feedback do Professor</div>
      ${professor.comentario ? `<div style="font-size:12px;color:var(--t2);line-height:1.65;margin-bottom:8px">${professor.comentario}</div>` : ''}
      ${professor.recomendacoes && professor.recomendacoes.length ? `
        <div style="font-family:var(--fm);font-size:8px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Recomendações</div>
        <ul style="margin:0;padding-left:18px">
          ${professor.recomendacoes.map(r => `<li style="font-size:11px;color:var(--t2);margin-bottom:3px">${r}</li>`).join('')}
        </ul>` : ''}
      ${nota ? `<div style="margin-top:8px;display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:700;color:var(--t3)">Nota estimada:</span><span style="font-size:14px;font-weight:800;color:var(--b)">${typeof nota === 'object' ? nota.label + ' (' + nota.grade + ')' : nota}</span></div>` : ''}
    </div>`;
}

/* ── Renderizar relatório de cobertura ── */
function renderCoverageReport(coverage) {
  if (!coverage) return '';
  const estado = coverage.estado || 'indeterminado';
  const completo = ['completo', 'complete', 'completa'].includes(estado);
  const parcial = ['parcial', 'objectivos_orfaos', 'conclusao_incompleta', 'incompleto'].includes(estado);
  const cor = completo ? 'var(--g)' : parcial ? '#f5a623' : 'var(--e1)';
  const icone = completo ? '✅' : parcial ? '⚠️' : '❌';

  const orfaos = coverage.orfaos || [];
  const naoResp = coverage.naoRespondidos || [];
  const orfaosCap = coverage.orfaosCapitulos || [];

  return `
    <div style="background:var(--sf1);border:1.5px solid ${cor}40;border-radius:10px;padding:14px 16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${cor}">${icone} Cobertura: ${estado}</div>
        <div style="font-size:10px;color:var(--t3)">${coverage.totalObjectives || 0} objectivos</div>
      </div>
      ${coverage.relatorio ? `<div style="font-size:11px;color:var(--t2);line-height:1.6;margin-bottom:8px">${coverage.relatorio}</div>` : ''}
      ${orfaos.length ? `<div style="margin-bottom:6px"><span style="font-size:9px;font-weight:600;color:var(--t3)">📌 Objectivos não cobertos:</span><div style="font-size:10px;color:var(--e1);margin-top:2px">${orfaos.map(o => `• ${o}`).join('<br/>')}</div></div>` : ''}
      ${naoResp.length ? `<div style="margin-bottom:6px"><span style="font-size:9px;font-weight:600;color:var(--t3)">❓ Sem resposta nos capítulos:</span><div style="font-size:10px;color:#f5a623;margin-top:2px">${naoResp.map(n => `• ${n}`).join('<br/>')}</div></div>` : ''}
      ${orfaosCap.length ? `<div><span style="font-size:9px;font-weight:600;color:var(--t3)">📄 Capítulos órfãos:</span><div style="font-size:10px;color:#f5a623;margin-top:2px">${orfaosCap.map(c => `• ${c}`).join('<br/>')}</div></div>` : ''}
    </div>`;
}

/* ── Renderizar badges de tipo de afirmação por capítulo ── */
function renderClaimBadges(chapterIdx, claims) {
  if (!claims || !claims.length) return '';
  const chClaims = claims.filter(c => c.chapterIdx === chapterIdx);
  if (!chClaims.length) return '';

  const cores = {
    FACT: 'var(--g)',
    INTERPRETATION: 'var(--b)',
    OPINION: '#9b59b6',
    HYPOTHESIS: '#f5a623',
    RECOMMENDATION: '#e67e22',
  };
  const icones = {
    FACT: '📊',
    INTERPRETATION: '🔍',
    OPINION: '💬',
    HYPOTHESIS: '🔬',
    RECOMMENDATION: '📋',
  };

  const aggr = {};
  chClaims.forEach(c => {
    const tipo = c.type || c.classifiedAs || 'FACT';
    aggr[tipo] = (aggr[tipo] || 0) + 1;
  });

  return `
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
      ${Object.entries(aggr).map(([tipo, count]) => {
        const cor = cores[tipo] || 'var(--t3)';
        const ico = icones[tipo] || '📄';
        return `<span style="font-size:8px;font-family:var(--fm);font-weight:600;padding:2px 8px;border-radius:99px;background:${cor}12;border:1px solid ${cor}40;color:${cor}">${ico} ${tipo} ×${count}</span>`;
      }).join('')}
    </div>`;
}

/* ── Injectar análise académica completa no editor ── */
async function injectAcademicUI() {
  const panel = document.getElementById('docHealthPanel');
  if (!panel) return;

  const analysis = await analisarDocumento();
  if (!analysis) {
    panel.innerHTML = `
      <div style="text-align:center;padding:20px;background:var(--sf1);border-radius:10px;border:1px solid var(--e0);margin-bottom:14px">
        <div style="font-size:12px;color:var(--t3)">Análise académica indisponível no momento.</div>
        <button class="btn B s" style="margin-top:8px" onclick="injectAcademicUI()">↻ Tentar novamente</button>
      </div>`;
    return;
  }

  /* Construir HTML completo */
  let html = '';

  /* Badge de integridade */
  html += renderIntegrityBadge(analysis.integrity);

  /* Scorecard + professor lado a lado */
  html += `<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px">`;
  html += renderScorecardPanel(analysis.scorecard);

  /* Anel de progresso (preservar do editor original) */
  const secs = State.get('secs') || [];
  const pg = calcStats ? calcStats(secs).pags : 1;
  html += `<div class="anel">
      <svg width="80" height="80" viewBox="0 0 80 80" style="transform:rotate(-90deg)">
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(30,146,255,.08)" stroke-width="5"/>
        <circle cx="40" cy="40" r="34" fill="none" stroke="#1E92FF" stroke-width="5" stroke-linecap="round"
          stroke-dasharray="${Math.min(pg / 40, 1) * 2 * Math.PI * 34} ${2 * Math.PI * 34}"
          style="filter:drop-shadow(0 0 5px #1E92FF)"/>
      </svg>
      <div class="anel-c"><div class="anel-n">${pg}</div><div class="anel-l">PÁG</div></div>
    </div>`;
  html += `</div>`;

  /* Feedback do professor */
  html += renderProfessorFeedback(analysis.professor);

  /* Relatório de cobertura */
  html += renderCoverageReport(analysis.coverage);

  /* Verificação de referências (se já tivermos dados) */
  const refVerif = State.get('refVerification');
  if (refVerif) {
    html += renderReferenceVerificationPanel(refVerif);
  } else {
    /* Disparar verificação em background */
    verificarReferencias().then(r => {
      if (r) renderizar();
    });
  }

  /* Argumentação */
  if (analysis.argumentation) {
    const argCor = analysis.argumentation.coerente ? 'var(--g)' : '#f5a623';
    html += `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${argCor}08;border:1px solid ${argCor}40;border-radius:10px;margin-bottom:14px">
        <div style="font-size:14px">${analysis.argumentation.coerente ? '✅' : '⚠️'}</div>
        <div style="flex:1">
          <div style="font-family:var(--fm);font-size:9px;font-weight:700;color:${argCor};letter-spacing:.1em;text-transform:uppercase">Argumentação ${analysis.argumentation.coerente ? 'Coerente' : 'com Problemas'}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:1px">${analysis.argumentation.totalIssues || 0} questões identificadas</div>
        </div>
      </div>`;
  }

  /* Badges de tipo de afirmação por capítulo */
  if (analysis.claims) {
    secs.forEach((_, i) => {
      const badges = renderClaimBadges(i, analysis.claims);
      if (badges) {
        const secEl = document.getElementById(`sc-${i}`);
        if (secEl && !secEl.querySelector('.claim-badges')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'claim-badges';
          wrapper.innerHTML = badges;
          secEl.parentNode.insertBefore(wrapper, secEl.nextSibling);
        }
      }
    });
  }

  panel.innerHTML = html;

  /* Versões (append ao fim do painel) */
  _appendVersioningToPanel();

  /* Armazenar no State para outros usos */
  State.set('academicAnalysis', analysis);
}

/* ── Iniciar análise após geração ── */
function autoAnalisarAposGeracao() {
  setTimeout(async () => {
    await injectAcademicUI();
  }, 500);
}

/* ═══════════════════════════════════════════════════════════
   REFERENCE VERIFICATION UI
   ═══════════════════════════════════════════════════════════ */

/* ── Verificar referências via API ── */
async function verificarReferencias() {
  const refs = State.get('refs') || [];
  if (!refs.length) return null;

  const payload = {
    referencias: refs.map(r => ({ raw: r.raw || r })),
  };

  try {
    const r = await api('verificar_referencias', payload);
    if (r && r.data) {
      State.set('refVerification', r.data);
      return r.data;
    }
  } catch (e) {
    console.warn('[academic-ui] Erro na verificação de referências:', e);
  }
  return null;
}

/* ── Renderizar painel de verificação de referências ── */
function renderReferenceVerificationPanel(verification) {
  if (!verification) return '';

  const total = verification.total || 0;
  if (total === 0) return '';

  const verified = verification.verified || 0;
  const partial = verification.partiallyVerified || 0;
  const review = verification.needsReview || 0;
  const unverified = verification.unverified || 0;
  const taxa = verification.taxaVerificacao || 0;

  const cor = taxa >= 70 ? 'var(--g)' : taxa >= 30 ? '#f5a623' : 'var(--e1)';

  return `
    <div style="background:var(--sf1);border:1.5px solid ${cor}40;border-radius:10px;padding:14px 16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">📚 Verificação de Referências</div>
        <div style="font-size:10px;color:var(--t3)">${total} no total</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px">
        <div style="flex:1;text-align:center;padding:6px;background:var(--g)08;border-radius:8px">
          <div style="font-size:16px;font-weight:800;color:var(--g)">${verified}</div>
          <div style="font-size:8px;color:var(--t3);font-family:var(--fm)">VERIFICADAS</div>
        </div>
        <div style="flex:1;text-align:center;padding:6px;background:rgba(245,166,35,.08);border-radius:8px">
          <div style="font-size:16px;font-weight:800;color:#f5a623">${partial}</div>
          <div style="font-size:8px;color:var(--t3);font-family:var(--fm)">PARCIAL</div>
        </div>
        <div style="flex:1;text-align:center;padding:6px;background:rgba(248,113,113,.08);border-radius:8px">
          <div style="font-size:16px;font-weight:800;color:var(--e1)">${review + unverified}</div>
          <div style="font-size:8px;color:var(--t3);font-family:var(--fm)">POR REVER</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="flex:1;height:4px;background:var(--e0);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${taxa}%;background:linear-gradient(90deg,var(--e1),#f5a623,var(--g));border-radius:2px;transition:width .6s"></div>
        </div>
        <div style="font-size:10px;font-weight:700;color:${cor}">${taxa}%</div>
      </div>
      <button class="btn W s" onclick="verificarReferencias().then(r => { if (r) renderizar(); })" style="width:100%">↻ Re-verificar</button>
    </div>`;
}

/* ── Renderizar detalhes de verificação de uma referência ── */
function renderReferenceBadge(ref, confidence) {
  const cores = {
    verified: ['var(--g)', '✅'],
    partially_verified: ['#f5a623', '⚠️'],
    needs_review: ['var(--e1)', '🔍'],
    unverified: ['var(--t3)', '❓'],
  };
  const [cor, ico] = cores[confidence] || cores.unverified;
  return `<span style="font-size:8px;font-family:var(--fm);font-weight:600;padding:2px 8px;border-radius:99px;background:${cor}12;border:1px solid ${cor}40;color:${cor}">${ico} ${confidence.replace(/_/g, ' ')}</span>`;
}

/* ═══════════════════════════════════════════════════════════
   IMMUTABLE DOCUMENT VERSIONING UI
   ═══════════════════════════════════════════════════════════ */

/* ── Estado local de versões ── */
let _versoesCache = [];

/* ── Criar versão snapshot via API ── */
async function criarVersao(source, reason) {
  const secs = State.get('secs') || [];
  const cfg = State.get('cfg') || {};
  if (!cfg.tema) return null;

  const payload = {
    secs,
    cfg,
    diagnostic: State.get('diagnostic') || null,
    refs: State.get('refs') || [],
    qual: State.get('qual') || null,
    plano: State.get('plano') || null,
    est: State.get('est') || null,
    academicAnalysis: State.get('academicAnalysis') || null,
    refVerification: State.get('refVerification') || null,
    source: source || 'manual_save',
    reason: reason || '',
    docId: cfg.tema,
    parentVersion: _versoesCache[0]?.id || null,
  };

  try {
    const r = await api('criar_versao', payload);
    if (r && r.data) {
      _versoesCache.unshift(r.data.versao);
      State.set('versoes', _versoesCache);
      return r.data;
    }
  } catch (e) {
    console.warn('[academic-ui] Erro ao criar versão:', e);
  }
  return null;
}

/* ── Listar versões via API ── */
async function listarVersoes() {
  const cfg = State.get('cfg') || {};
  if (!cfg.tema) return [];

  const payload = { docId: cfg.tema, versoes: _versoesCache };

  try {
    const r = await api('listar_versoes', payload);
    if (r && r.data) {
      _versoesCache = r.data.versoes || [];
      State.set('versoes', _versoesCache);
    }
  } catch (e) {
    console.warn('[academic-ui] Erro ao listar versões:', e);
  }
  return _versoesCache;
}

/* ── Reverter para versão ── */
async function reverterVersao(versionId) {
  const payload = { versionId, versoes: _versoesCache };

  try {
    const r = await api('reverter_versao', payload);
    if (r && r.data && r.data.ok) {
      const estado = r.data.estado;
      if (estado.secs) State.set('secs', estado.secs);
      if (estado.cfg) State.set('cfg', estado.cfg);
      if (estado.diagnostic) State.set('diagnostic', estado.diagnostic);
      if (estado.refs) State.set('refs', estado.refs);
      if (estado.qual) State.set('qual', estado.qual);
      if (estado.plano) State.set('plano', estado.plano);
      if (estado.est) State.set('est', estado.est);
      if (estado.academicAnalysis) State.set('academicAnalysis', estado.academicAnalysis);
      if (estado.refVerification) State.set('refVerification', estado.refVerification);
      mostrarToast('Documento revertido com sucesso.');
      renderizar();
      return true;
    }
  } catch (e) {
    console.warn('[academic-ui] Erro ao reverter:', e);
  }
  return false;
}

/* ── Renderizar painel de versões ── */
function renderVersionHistoryPanel() {
  if (!_versoesCache.length) return '';

  const currentId = _versoesCache[0]?.id || '';

  return `
    <div style="background:var(--sf1);border:1.5px solid var(--e0);border-radius:10px;padding:14px 16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">🕒 Histórico de Versões</div>
        <div style="font-size:10px;color:var(--t3)">${_versoesCache.length} versão(ões)</div>
      </div>
      <div style="max-height:200px;overflow-y:auto">
        ${_versoesCache.map((v, i) => {
          const isCurrent = i === 0;
          const data = new Date(v.timestamp).toLocaleString('pt-PT');
          const icoMap = { generation: '⚡', user_edit: '✏️', ai_edit: '🤖', revert: '↩', manual_save: '💾' };
          const ico = icoMap[v.source] || '📄';
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:4px;border-radius:8px;background:${isCurrent ? 'var(--b)10' : 'transparent'};border:1px solid ${isCurrent ? 'var(--b)30' : 'transparent'}">
              <div style="font-size:14px">${ico}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:10px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.reason || v.source}</div>
                <div style="font-size:8px;color:var(--t3)">${data} · ${v.id.slice(0, 12)}</div>
              </div>
              ${isCurrent ? '<span style="font-size:8px;font-weight:700;color:var(--b);font-family:var(--fm)">ACTUAL</span>' : `<button class="btn W s" style="font-size:8px;padding:4px 8px" onclick="reverterVersao('${v.id}')">↩ Reverter</button>`}
            </div>`;
        }).join('')}
      </div>
      <button class="btn W s" style="margin-top:8px;width:100%" onclick="criarVersao('manual_save','Snapshot manual').then(r => { if (r) renderizar(); })">💾 Criar Snapshot</button>
    </div>`;
}

/* ── Integrar no injectAcademicUI (versão no final do painel) ── */
function _appendVersioningToPanel() {
  const panel = document.getElementById('docHealthPanel');
  if (!panel) return;

  /* Listar versões e adicionar ao fim */
  listarVersoes().then(() => {
    const vHtml = renderVersionHistoryPanel();
    if (vHtml) panel.insertAdjacentHTML('beforeend', vHtml);
  });

  /* Auto-snapshot se não existir ainda */
  if (_versoesCache.length === 0) {
    criarVersao('generation', 'Snapshot automático após geração');
  }
}
