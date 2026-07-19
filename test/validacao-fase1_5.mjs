#!/usr/bin/env node
/* =====================================================================
   Validação — Fase 1.5: Integrity Enforcement
   Testa a matriz de decisão, estados de integridade, cobertura
===================================================================== */

import {
  /* Políticas */
  avaliarAfirmacao, gerarRelatorioIntegridade, isEvidenciaConfirmada,
  gerarAcorrecao, DECISIONS, SEVERITY, getPolicies,
  /* Integridade */
  determinarEstadoDocumento, isProntoParaEntrega, getAcoesCorretivas,
  INTEGRITY_STATE,
  /* Cobertura */
  analisarCobertura,
  /* Schemas */
  CONFIDENCE_LEVELS, CLAIM_TYPES, createClaim,
  createDocumentSchema, createDiagnosticSchema,
  /* Scorecard actualizado */
  gerarScorecard, simularProfessor,
} from '../academic/index.js';

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: '✓' });
    passed++;
  } catch (e) {
    results.push({ name, status: '✗', error: e.message });
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertMatch(str, regex, msg) {
  if (!regex.test(str)) throw new Error(`${msg || ''} "${str}" não corresponde a ${regex}`);
}

/* ═══════════════════════════════════════════════════════════════
   TESTE 1: FACT + VERIFIED → ACCEPT (sem bloqueio)
════════════════════════════════════════════════════════════════ */

test('T1 FACT+VERIFIED → ACCEPT sem bloqueio', () => {
  const claim = createClaim({
    statement: 'Segundo o INE (2023), a taxa de desemprego é de 30%.',
    source: 'INE, 2023',
    confidence: CONFIDENCE_LEVELS.VERIFIED,
  });
  claim.classifiedAs = CLAIM_TYPES.FACT;

  const a = avaliarAfirmacao(claim);
  assertEqual(a.decision, DECISIONS.ACCEPT);
  assertEqual(a.severity, SEVERITY.LOW);
});

test('T1 isEvidenciaConfirmada retorna true', () => {
  const claim = createClaim({ statement: 'Facto verificado.', confidence: CONFIDENCE_LEVELS.VERIFIED });
  claim.classifiedAs = CLAIM_TYPES.FACT;
  assert(isEvidenciaConfirmada(claim) === true);
});

/* ═══════════════════════════════════════════════════════════════
   TESTE 2: FACT + UNVERIFIED + HIGH → REVIEW_REQUIRED ou BLOCKED
════════════════════════════════════════════════════════════════ */

test('T2 FACT+UNVERIFIED → REVIEW_REQUIRED', () => {
  const claim = createClaim({
    statement: '65% dos jovens angolanos estão desempregados.',
    confidence: CONFIDENCE_LEVELS.UNVERIFIED,
  });
  claim.classifiedAs = CLAIM_TYPES.FACT;
  claim.severity = SEVERITY.HIGH;

  const a = avaliarAfirmacao(claim);
  assertEqual(a.decision, DECISIONS.REVIEW_REQUIRED);
  assert(a.severity === SEVERITY.HIGH || a.severity === SEVERITY.CRITICAL);
});

test('T2 integridade com UNVERIFIED → review_required', () => {
  const claims = [
    createClaim({ statement: 'Dado sem fonte.', confidence: CONFIDENCE_LEVELS.UNVERIFIED }),
  ];
  claims[0].classifiedAs = CLAIM_TYPES.FACT;
  claims[0].severity = SEVERITY.HIGH;

  const rel = gerarRelatorioIntegridade(claims);
  assertEqual(rel.estado, 'review_required');
  assert(rel.reviewRequired > 0);
  assert(rel.integro === false);
});

test('T2 estado documento com UNVERIFIED → REVIEW_REQUIRED', () => {
  const claims = [
    createClaim({ statement: 'Dado crítico sem fonte.', confidence: CONFIDENCE_LEVELS.UNVERIFIED }),
  ];
  claims[0].classifiedAs = CLAIM_TYPES.FACT;
  claims[0].severity = SEVERITY.HIGH;

  const estado = determinarEstadoDocumento(claims);
  assertEqual(estado.state, INTEGRITY_STATE.REVIEW_REQUIRED);
  assert(isProntoParaEntrega(estado) === false);
  assert(estado.relatorio.reviewRequired > 0);
});

/* ═══════════════════════════════════════════════════════════════
   TESTE 3: RECOMMENDATION + UNVERIFIED → não bloqueia
════════════════════════════════════════════════════════════════ */

test('T3 RECOMMENDATION+UNVERIFIED → can_keep_as_recommendation', () => {
  const claim = createClaim({
    statement: 'Recomenda-se a criação de políticas públicas.',
    confidence: CONFIDENCE_LEVELS.UNVERIFIED,
  });
  claim.classifiedAs = CLAIM_TYPES.RECOMMENDATION;

  const a = avaliarAfirmacao(claim);
  assertEqual(a.decision, DECISIONS.CAN_KEEP_AS_RECOMMENDATION);
});

test('T3 recomendação não verificada não bloqueia o documento', () => {
  const claims = [
    createClaim({ statement: 'Recomendo investir em educação.', confidence: CONFIDENCE_LEVELS.UNVERIFIED }),
  ];
  claims[0].classifiedAs = CLAIM_TYPES.RECOMMENDATION;

  const estado = determinarEstadoDocumento(claims);
  assertEqual(estado.state, INTEGRITY_STATE.ACADEMICALLY_READY);
});

/* ═══════════════════════════════════════════════════════════════
   TESTE 4: USER_PROVIDED → aceite com identificação
════════════════════════════════════════════════════════════════ */

test('T4 FACT+USER_PROVIDED → ACCEPT_WITH_ALERT', () => {
  const claim = createClaim({
    statement: 'Dado fornecido pelo utilizador.',
    confidence: CONFIDENCE_LEVELS.USER_PROVIDED,
  });
  claim.classifiedAs = CLAIM_TYPES.FACT;

  const a = avaliarAfirmacao(claim);
  assertEqual(a.decision, DECISIONS.ACCEPT_WITH_ALERT);
});

test('T4 gerarAcorrecao para USER_PROVIDED → adicionar_alerta', () => {
  const claim = createClaim({ statement: 'Dado do utilizador.', confidence: CONFIDENCE_LEVELS.USER_PROVIDED });
  claim.classifiedAs = CLAIM_TYPES.FACT;
  const acao = gerarAcorrecao(claim);
  assertEqual(acao.acao, 'adicionar_alerta');
});

/* ═══════════════════════════════════════════════════════════════
   TESTE 5: OBJECTIVO SEM CAPÍTULO → falha de cobertura
════════════════════════════════════════════════════════════════ */

test('T5 objectivo sem capítulo → órfão detectado', () => {
  const doc = createDocumentSchema({ title: 'Teste', topic: 'Tema', type: 'tfc', level: 'licenciatura' });
  doc.diagnostic = createDiagnosticSchema({
    title: 'Teste', topic: 'Tema',
    specificObjectives: [
      'Analisar o impacto das redes sociais',
      'Propor recomendações para empresas',
    ],
  });
  doc.chapters = [
    { title: 'Introdução', sections: [{ title: 'Contexto', paragraphs: ['Texto introdutório.'] }] },
  ];

  const cov = analisarCobertura(doc);
  assert(cov.orfaos.length > 0, `Esperado objectivos órfãos, obtido ${cov.orfaos.length}`);
  assert(cov.totalObjectives === 2);
  assertMatch(cov.relatorio, /órfão/i);
});

/* ═══════════════════════════════════════════════════════════════
   TESTE 6: CAPÍTULO SEM OBJECTIVO → sinalização
════════════════════════════════════════════════════════════════ */

test('T6 capítulo sem objectivo → orfaosCapitulos', () => {
  const doc = createDocumentSchema({ title: 'Teste', topic: 'Tema', type: 'tfc', level: 'licenciatura' });
  doc.diagnostic = createDiagnosticSchema({
    title: 'Teste', topic: 'Tema',
    specificObjectives: ['Analisar o impacto'],
  });
  doc.chapters = [
    { title: 'Capítulo sobre Tópico Não Relacionado', sections: [{ title: 'Secção', paragraphs: ['Texto.'] }] },
    { title: 'Referências Bibliográficas', sections: [] },
  ];

  const cov = analisarCobertura(doc);
  assert(cov.orfaosCapitulos.length > 0, `Esperado capítulos órfãos`);
});

/* ═══════════════════════════════════════════════════════════════
   TESTE 7: OBJECTIVO NÃO RESPONDIDO NA CONCLUSÃO
════════════════════════════════════════════════════════════════ */

test('T7 objectivo não respondido na conclusão', () => {
  const doc = createDocumentSchema({ title: 'Teste', topic: 'Tema', type: 'tfc', level: 'licenciatura' });
  doc.diagnostic = createDiagnosticSchema({
    title: 'Teste', topic: 'Tema',
    specificObjectives: [
      'Analisar o impacto económico das políticas fiscais',
    ],
  });
  doc.chapters = [
    {
      title: 'Análise do Impacto',
      sections: [{ title: 'Secção', paragraphs: ['O impacto económico das políticas fiscais é significativo.'] }],
    },
    {
      title: 'Conclusão',
      sections: [{ title: 'Considerações Finais', paragraphs: ['A globalização transformou a economia mundial.'] }],
    },
  ];

  const cov = analisarCobertura(doc);
  assert(cov.naoRespondidos.length > 0, 'Conclusão não responde ao objectivo');
  assert(cov.estado === 'conclusao_incompleta' || cov.estado === 'incompleto');
});

/* ═══════════════════════════════════════════════════════════════
   TESTE 8: DOCUMENTO SEM AFIRMAÇÕES CRÍTICAS → ACADEMICALLY_READY
════════════════════════════════════════════════════════════════ */

test('T8 documento sem afirmações críticas → ACADEMICALLY_READY', () => {
  const claims = [
    createClaim({ statement: 'Facto verificado.', confidence: CONFIDENCE_LEVELS.VERIFIED }),
    createClaim({ statement: 'Recomendação baseada em evidência.', confidence: CONFIDENCE_LEVELS.VERIFIED }),
  ];
  claims[0].classifiedAs = CLAIM_TYPES.FACT;
  claims[1].classifiedAs = CLAIM_TYPES.RECOMMENDATION;

  const estado = determinarEstadoDocumento(claims);
  assertEqual(estado.state, INTEGRITY_STATE.ACADEMICALLY_READY);
  assert(isProntoParaEntrega(estado) === true);
});

test('T8 documento vazio → DRAFT', () => {
  const estado = determinarEstadoDocumento([]);
  assertEqual(estado.state, INTEGRITY_STATE.DRAFT);
  assert(isProntoParaEntrega(estado) === false);
});

/* ═══════════════════════════════════════════════════════════════
   TESTES ADICIONAIS — Edge Cases da Matriz
════════════════════════════════════════════════════════════════ */

test('MATRIZ: OPINION + UNVERIFIED → can_keep_as_opinion', () => {
  const claim = createClaim({ statement: 'Na minha opinião...', confidence: CONFIDENCE_LEVELS.UNVERIFIED });
  claim.classifiedAs = CLAIM_TYPES.OPINION;
  assertEqual(avaliarAfirmacao(claim).decision, DECISIONS.CAN_KEEP_AS_OPINION);
});

test('MATRIZ: HYPOTHESIS + VERIFIED → can_keep_as_hypothesis', () => {
  const claim = createClaim({ statement: 'Hipótese confirmada.', confidence: CONFIDENCE_LEVELS.VERIFIED });
  claim.classifiedAs = CLAIM_TYPES.HYPOTHESIS;
  assertEqual(avaliarAfirmacao(claim).decision, DECISIONS.CAN_KEEP_AS_HYPOTHESIS);
});

test('MATRIZ: INTERPRETATION + UNVERIFIED → can_keep_if_identified', () => {
  const claim = createClaim({ statement: 'Isto significa que...', confidence: CONFIDENCE_LEVELS.UNVERIFIED });
  claim.classifiedAs = CLAIM_TYPES.INTERPRETATION;
  assertEqual(avaliarAfirmacao(claim).decision, DECISIONS.CAN_KEEP_IF_IDENTIFIED);
});

test('MATRIZ: NEEDS_REVIEW + FACT → REVIEW_REQUIRED', () => {
  const claim = createClaim({ statement: 'Dado questionável.', confidence: CONFIDENCE_LEVELS.NEEDS_REVIEW });
  claim.classifiedAs = CLAIM_TYPES.FACT;
  const a = avaliarAfirmacao(claim);
  assertEqual(a.decision, DECISIONS.REVIEW_REQUIRED);
  assertEqual(a.severity, SEVERITY.HIGH);
});

test('MATRIZ: tipo desconhecido → REVIEW_REQUIRED', () => {
  const claim = createClaim({ statement: 'Tipo estranho.', confidence: CONFIDENCE_LEVELS.VERIFIED });
  claim.classifiedAs = 'tipo_desconhecido';
  const a = avaliarAfirmacao(claim);
  assertEqual(a.decision, DECISIONS.REVIEW_REQUIRED);
});

/* ═══════════════════════════════════════════════════════════════
   TESTES DE INTEGRAÇÃO — Scorecard
════════════════════════════════════════════════════════════════ */

test('SCORECARD integrity penaliza UNVERIFIED', () => {
  const sc = gerarScorecard({
    integrityReport: { total: 5, blocked: 0, reviewRequired: 3, alerts: 2, integro: false },
  });
  assert(sc.criteria.integrity.score < 100, 'Deveria ter penalidade');
  assert(sc.criteria.integrity.score >= 0);
});

test('SCORECARD coverage penaliza objectivos órfãos', () => {
  const sc = gerarScorecard({
    coverageAnalysis: {
      totalObjectives: 2, orfaos: [{ objective: 'Obj1' }],
      naoRespondidos: [], orfaosCapitulos: [],
    },
  });
  assert(sc.criteria.coverage.score < 95);
});

test('SCORECARD coverage sem objectivos → score baixo', () => {
  const sc = gerarScorecard({
    coverageAnalysis: { totalObjectives: 0 },
  });
  assert(sc.criteria.coverage.score <= 30);
});

test('PROFESSOR integra integrity state nas recomendações', () => {
  const sim = simularProfessor({
    metadata: { topic: 'Teste' },
    _scoreData: {
      integrityState: 'review_required',
      coverageState: 'incompleto',
      integrityReport: { total: 3, blocked: 1, reviewRequired: 1, alerts: 1 },
      coverageAnalysis: { totalObjectives: 2, orfaos: [{}], naoRespondidos: [{}], orfaosCapitulos: [] },
    },
  });
  assert(sim.recomendacoes.length > 0);
  assert(sim.nota);
  assert(typeof sim.overall === 'number');
});

/* ═══════════════════════════════════════════════════════════════
   TESTES DE ACÇÕES CORRECTIVAS
════════════════════════════════════════════════════════════════ */

test('ACCAO: FACT+UNVERIFIED → solicitar_fonte', () => {
  const claim = createClaim({ statement: 'Dado sem fonte.', confidence: CONFIDENCE_LEVELS.UNVERIFIED });
  claim.classifiedAs = CLAIM_TYPES.FACT;
  const acao = gerarAcorrecao(claim);
  assertEqual(acao.acao, 'solicitar_fonte');
});

test('ACCAO: INTERPRETATION+UNVERIFIED → reformular_como_interpretacao', () => {
  const claim = createClaim({ statement: 'Interpretação.', confidence: CONFIDENCE_LEVELS.UNVERIFIED });
  claim.classifiedAs = CLAIM_TYPES.INTERPRETATION;
  const acao = gerarAcorrecao(claim);
  assertEqual(acao.acao, 'reformular_como_interpretacao');
});

test('ACCAO: getAcoesCorretivas do integrity', () => {
  const claims = [
    createClaim({ statement: 'Facto sem fonte.', confidence: CONFIDENCE_LEVELS.UNVERIFIED }),
    createClaim({ statement: 'Recomendação.', confidence: CONFIDENCE_LEVELS.VERIFIED }),
  ];
  claims[0].classifiedAs = CLAIM_TYPES.FACT;
  claims[0].index = 0;
  claims[1].classifiedAs = CLAIM_TYPES.RECOMMENDATION;
  claims[1].index = 1;

  const estado = determinarEstadoDocumento(claims);
  const acoes = getAcoesCorretivas(estado);
  assert(acoes.length > 0);
});

/* ═══════════════════════════════════════════════════════════════
   TESTES DE COBERTURA — Edge Cases
════════════════════════════════════════════════════════════════ */

test('COBERTURA: sem objectivos → no_objectives', () => {
  const doc = createDocumentSchema({ title: 'T', topic: 'T', type: 'tfc' });
  doc.chapters = [{ title: 'Intro', sections: [] }];
  const cov = analisarCobertura(doc);
  assertEqual(cov.estado, 'no_objectives');
});

test('COBERTURA: objectivos correspondem a capítulos → coberto', () => {
  const doc = createDocumentSchema({ title: 'T', topic: 'T', type: 'tfc' });
  doc.diagnostic = createDiagnosticSchema({
    title: 'T', topic: 'T',
    specificObjectives: ['Analisar o empreendedorismo juvenil em Angola'],
  });
  doc.chapters = [
    {
      title: 'Empreendedorismo Juvenil',
      sections: [{ title: 'Contexto', paragraphs: ['O empreendedorismo juvenil em Angola é crescente.'] }],
    },
  ];
  const cov = analisarCobertura(doc);
  assert(cov.cobertura[0].matchingChapters.length > 0);
});

test('COBERTURA: relatório contém todos os elementos', () => {
  const doc = createDocumentSchema({ title: 'T', topic: 'T', type: 'tfc' });
  doc.diagnostic = createDiagnosticSchema({
    title: 'T', topic: 'T',
    specificObjectives: ['Obj1', 'Obj2', 'Obj3'],
  });
  doc.chapters = [
    { title: 'Capítulo 1', sections: [{ title: 'S1', paragraphs: ['Texto sobre Obj1.'] }] },
    { title: 'Conclusão', sections: [{ title: 'Final', paragraphs: ['Concluindo...'] }] },
  ];
  const cov = analisarCobertura(doc);
  assertMatch(cov.relatorio, /Objectivo/);
  assert(typeof cov.totalObjectives === 'number');
});

/* ═══════════════════════════════════════════════════════════════
   RELATÓRIO
════════════════════════════════════════════════════════════════ */

const total = passed + failed;
console.log(`\n═══════════ RELATÓRIO FASE 1.5 ═══════════`);
console.log(`Total: ${total}  |  ✓ Aprovados: ${passed}  |  ✗ Reprovados: ${failed}\n`);

const categorias = {
  'T1': 'TESTE 1 — FACT+VERIFIED → ACCEPT',
  'T2': 'TESTE 2 — FACT+UNVERIFIED → REVIEW_REQUIRED',
  'T3': 'TESTE 3 — RECOMMENDATION+UNVERIFIED → não bloqueia',
  'T4': 'TESTE 4 — USER_PROVIDED → aceite c/ alerta',
  'T5': 'TESTE 5 — Objectivo sem capítulo',
  'T6': 'TESTE 6 — Capítulo sem objectivo',
  'T7': 'TESTE 7 — Objectivo não respondido na conclusão',
  'T8': 'TESTE 8 — Documento sem críticas → ACADEMICALLY_READY',
  'MATRIZ': 'Matriz de decisão — edge cases',
  'SCORECARD': 'Scorecard integrado',
  'ACCAO': 'Acções correctivas',
  'COBERTURA': 'Cobertura — edge cases',
};

const reports = [];
for (const [prefix, label] of Object.entries(categorias)) {
  const filtered = results.filter(r => r.name.startsWith(prefix));
  if (filtered.length === 0) continue;
  const p = filtered.filter(r => r.status === '✓').length;
  const f = filtered.filter(r => r.status === '✗').length;
  reports.push(`  ${f === 0 ? '✓' : '✗'} ${label}: ${p}/${filtered.length}`);
  for (const r of filtered) {
    if (r.status === '✗') reports.push(`    ${r.name}: ${r.error}`);
  }
}

console.log('Por categoria:\n' + reports.join('\n'));
console.log(`\n${failed === 0 ? '✓ TODOS OS TESTES APROVADOS' : `✗ ${failed} TESTE(S) REPROVADO(S)`}`);
console.log(`\n══════════════ RESUMO ══════════════`);
console.log(`- Matriz de decisão: ${Object.keys(getPolicies()).length} tipos × ${Object.keys(CONFIDENCE_LEVELS).length} níveis`);
console.log(`- DECISÕES: ${Object.keys(DECISIONS).length} tipos`);
console.log(`- SEVERIDADES: ${Object.keys(SEVERITY).length} níveis`);
console.log(`- Estados de integridade: ${Object.keys(INTEGRITY_STATE).length} estados`);
console.log(`- CRITERIA scorecard: ${Object.keys(categorias).length} grupos de teste`);
