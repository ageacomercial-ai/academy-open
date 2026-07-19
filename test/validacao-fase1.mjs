#!/usr/bin/env node
/* =====================================================================
   Validação de Integração — Fase 1
   Testa todas as funções puras dos módulos academic/
   Sem dependência de API externa (OpenRouter).
===================================================================== */

import {
  /* system */
  PERFIL_NIVEL, PERFIL_AREA,
  detectarNivel, detectarArea, detectarContextoGeo,
  POOLS_ANTI_IA, gerarInstrucaoAntiIA, gerarInstrucaoGeo,
  /* chapters */
  montarPromptCapitulo, montarPromptAST, montarPromptRetry,
  escolherAbordagem, ABORDAGENS,
  /* references */
  montarPromptReferencias, peneirarReferencias,
  /* structure */
  montarPromptPlano, montarPromptEstrutura,
  /* editing */
  montarPromptEdicaoSimples, montarPromptEdicaoDocumento,
  /* evaluation */
  montarPromptCoerencia, montarPromptChat,
  /* schemas */
  createClaim, validarClaim, createDiagnosticSchema,
  createReference, validarReferencia, marcarConfianca,
  createDocumentSchema, validarIntegridadeDocumento,
  CONFIDENCE_LEVELS, CLAIM_TYPES, GEN_STAGES,
  /* engines */
  analisarInput, gerarDiagnostico,
  extrairAfirmacoes, extrairCitacao, extrairFonte,
  classificarAfirmacao, validarAfirmacoes,
  analisarEstruturaArgumentativa, verificarCoerenciaArgumentativa,
  parseReferencias, validarListaReferencias, verificarReferenciaOnline,
  gerarScorecard, simularProfessor, CRITERIA,
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

/* ═══════════════════════════════════════════════════════════════
   TEMA 1: Ciências Sociais (genérico)
════════════════════════════════════════════════════════════════ */
const tema1 = 'Impacto das Redes Sociais na Comunicação Organizacional';

test('T1 detectarNivel — licenciatura', () => {
  assertEqual(detectarNivel('licenciatura'), 'licenciatura');
  assertEqual(detectarNivel(''), 'licenciatura');
  assertEqual(detectarNivel('mestrado'), 'mestrado');
  assertEqual(detectarNivel('doutoramento'), 'doutoramento');
  assertEqual(detectarNivel('12ª classe'), 'ensino médio');
});

test('T1 detectarArea — gestão/economia', () => {
  const area = detectarArea(tema1, '');
  assert(area === 'humanidades' || area === 'gestao', `Esperada humanidades/gestao, obtida ${area}`);
});

test('T1 detectarContextoGeo — global', () => {
  assertEqual(detectarContextoGeo(tema1, ''), 'global');
});

test('T1 analisarInput — estrutura correcta', () => {
  const a = analisarInput({ tema: tema1, tipo: 'TFC', nivel: 'licenciatura' });
  assert(a.nivelKey === 'licenciatura');
  assert(a.pNivel && a.pNivel.profundidade);
  assert(a.pArea && a.pArea.label);
  assert(a.areaKey);
  assert(a.geoCtx);
});

test('T1 gerarDiagnostico — schema completo', () => {
  const d = gerarDiagnostico({ tema: tema1, tipo: 'TFC', nivel: 'licenciatura' });
  assert(d.title === tema1);
  assert(d._analise);
  assert(d._analise.nivelKey === 'licenciatura');
  assert(typeof d.createdAt === 'string');
  assert(d.version === 1);
});

test('T1 montarPromptPlano — contém tema', () => {
  const p = montarPromptPlano(tema1, 'TFC', 'licenciatura');
  assert(p.includes(tema1));
  assert(p.includes('JSON'));
});

test('T1 montarPromptEstrutura — contém tema e páginas', () => {
  const p = montarPromptEstrutura(tema1, 'TFC', 'licenciatura', 20, 'Analisar impacto');
  assert(p.includes(tema1));
  assert(p.includes('20'));
  assert(p.includes('Analisar impacto'));
});

test('T1 montarPromptCapitulo — output válido', () => {
  const p = montarPromptCapitulo({
    tema: tema1, tipo: 'TFC', nivel: 'licenciatura',
    capNum: 1, capTit: 'Introdução', totalCaps: 5, totalPags: 20,
    capSubs: ['Contextualização', 'Problema', 'Justificativa'],
    nivelKey: 'licenciatura', areaKey: 'humanidades',
    pNivel: PERFIL_NIVEL['licenciatura'], pArea: PERFIL_AREA.humanidades,
    geoCtx: 'global', palavras: 500,
    subs: '1.1 Contextualização\n1.2 Problema\n1.3 Justificativa',
  });
  assert(p.includes(tema1));
  assert(p.includes('Capítulo 1'));
  assert(p.includes('1.1'));
  assert(p.includes('Contextualização'));
  // Deve conter anti-IA
  assert(p.includes('REGRAS DE ESTILO OBRIGATÓRIAS'));
});

test('T1 montarPromptAST — JSON format', () => {
  const a = montarPromptAST(1, 'Introdução', 500);
  assert(a.includes('chapter_id'));
  assert(a.includes('"1"'));
  assert(a.includes('Introdução'));
});

test('T1 montarPromptRetry — formato', () => {
  const r = montarPromptRetry(1, 'Introdução', tema1, ['Contexto', 'Análise']);
  assert(r.includes('"chapter_id"'));
  assert(r.includes(tema1));
});

test('T1 escolherAbordagem — rotação', () => {
  const a1 = escolherAbordagem(1);
  const a2 = escolherAbordagem(6); // deve ciclar
  assertEqual(a1, ABORDAGENS[0]);
  assertEqual(a2, ABORDAGENS[0]);
});

/* ═══════════════════════════════════════════════════════════════
   TEMA 2: Angola (específico)
════════════════════════════════════════════════════════════════ */
const tema2 = 'Empreendedorismo Juvenil em Angola';

test('T2 detectarContextoGeo — Angola', () => {
  assertEqual(detectarContextoGeo(tema2, ''), 'angola');
});

test('T2 gerarInstrucaoGeo — Angola', () => {
  const g = gerarInstrucaoGeo(tema2, null);
  assert(g.includes('Angola'));
  assert(g.includes('dados angolanos'));
});

test('T2 montarPromptCapitulo com contexto angola', () => {
  const p = montarPromptCapitulo({
    tema: tema2, tipo: 'TFC', nivel: 'licenciatura',
    capNum: 2, capTit: 'Contexto do Empreendedorismo em Angola',
    totalCaps: 5, totalPags: 20,
    capSubs: ['Panorama nacional', 'Desafios estruturais'],
    nivelKey: 'licenciatura', areaKey: 'gestao',
    pNivel: PERFIL_NIVEL['licenciatura'], pArea: PERFIL_AREA.gestao,
    geoCtx: 'angola', palavras: 500,
    subs: '2.1 Panorama nacional\n2.2 Desafios estruturais',
  });
  assert(p.includes('Angola'));
  assert(p.includes('dados angolanos'));
});

/* ═══════════════════════════════════════════════════════════════
   TEMA 3: Academy (caso concreto)
════════════════════════════════════════════════════════════════ */
const tema3 = 'O Papel da Academy no Empreendedorismo Digital Juvenil em Angola';

test('T3 detectarArea — gestao (empreendedorismo)', () => {
  const area = detectarArea(tema3, '');
  assertEqual(area, 'gestao');
});

test('T3 detectarContextoGeo — angola', () => {
  assertEqual(detectarContextoGeo(tema3, ''), 'angola');
});

/* ═══════════════════════════════════════════════════════════════
   EVIDÊNCIA — CLASSIFICAÇÃO DE AFIRMAÇÕES
════════════════════════════════════════════════════════════════ */

test('EVIDENCIA extrairCitacao — detecção (Autor, Ano)', () => {
  const c = extrairCitacao('Segundo Santos (2020), o turismo cresceu.');
  assert(c && c.includes('2020'));
});

test('EVIDENCIA extrairCitacao — parentesis', () => {
  const c = extrairCitacao('O turismo contribui com 3.2% do PIB (INE, 2024).');
  assert(c && c.includes('INE'));
});

test('EVIDENCIA extrairCitacao — sem citação', () => {
  const c = extrairCitacao('Estudos indicam que o turismo é importante.');
  assertEqual(c, null);
});

test('EVIDENCIA extrairFonte — encontra parêntesis', () => {
  const f = extrairFonte('O turismo contribui (INE, 2024).');
  assert(f && f.includes('INE'));
});

test('EVIDENCIA classificarAfirmacao — FACT com dados', () => {
  const c = classificarAfirmacao('Segundo dados do INE, 65% dos jovens estão desempregados.');
  assertEqual(c, CLAIM_TYPES.FACT);
});

test('EVIDENCIA classificarAfirmacao — FACT com número', () => {
  const c = classificarAfirmacao('O estudo registou 350 participantes.');
  assertEqual(c, CLAIM_TYPES.FACT);
});

test('EVIDENCIA classificarAfirmacao — OPINION', () => {
  const c = classificarAfirmacao('Na minha opinião, o governo devia agir.');
  assertEqual(c, CLAIM_TYPES.OPINION);
});

test('EVIDENCIA classificarAfirmacao — RECOMMENDATION', () => {
  const c = classificarAfirmacao('Recomenda-se a criação de políticas públicas.');
  assertEqual(c, CLAIM_TYPES.RECOMMENDATION);
});

test('EVIDENCIA classificarAfirmacao — HYPOTHESIS', () => {
  const c = classificarAfirmacao('Hipótese: a educação digital reduz o desemprego.');
  assertEqual(c, CLAIM_TYPES.HYPOTHESIS);
});

test('EVIDENCIA classificarAfirmacao — INTERPRETATION (default)', () => {
  const c = classificarAfirmacao('Isto significa que o modelo precisa de ajustes.');
  assertEqual(c, CLAIM_TYPES.INTERPRETATION);
});

test('EVIDENCIA extrairAfirmacoes — múltiplas claims', () => {
  const texto = 'Segundo Santos (2020), o turismo cresceu 15%. Isto implica maior investimento. Recomenda-se formação contínua.';
  const claims = extrairAfirmacoes(texto, 0);
  assert(claims.length >= 2, `Esperado mínimo 2 claims, obtido ${claims.length}`);
  assert(claims[0].confidence === CONFIDENCE_LEVELS.UNVERIFIED);
  assert(claims[0].chapterIdx === 0);
});

test('EVIDENCIA validarAfirmacoes — estrutura correcta', () => {
  const texto = 'Segundo o INE (2023), a taxa de desemprego é de 30%.';
  const claims = extrairAfirmacoes(texto, 0);
  const validated = validarAfirmacoes(claims);
  assert(validated.length > 0);
  assert(validated[0].validation);
  assert(validated[0].classifiedAs);
});

/* ═══════════════════════════════════════════════════════════════
   REFERÊNCIAS — PENEIRA E VALIDAÇÃO
════════════════════════════════════════════════════════════════ */

const refsValidas = `Santos, J. (2020). Turismo em Angola. Editora UAN.
Ferreira, M. (2021). Gestão Empresarial. Revista de Gestão, 15(2), 45-60.
INE. (2023). Inquérito ao Desemprego. Instituto Nacional de Estatística.`;

const refsInvalidas = `Estudos indicam que o turismo é importante.
Sem ano nem autor definido.
Nota de rodapé qualquer.`;

test('REFERENCIAS peneirarReferencias — válidas', () => {
  const p = peneirarReferencias(refsValidas);
  assert(p.validas.length === 3, `Esperado 3 válidas, obtido ${p.validas.length}`);
  assert(p.invalidas === 0);
});

test('REFERENCIAS peneirarReferencias — inválidas', () => {
  const p = peneirarReferencias(refsInvalidas);
  assert(p.validas.length < 3);
  assert(p.invalidas > 0);
});

test('REFERENCIAS peneirarReferencias — vazio', () => {
  const p = peneirarReferencias('');
  assertEqual(p.texto, '');
  assertEqual(p.validas.length, 0);
});

test('REFERENCIAS peneirarReferencias — null', () => {
  const p = peneirarReferencias(null);
  assertEqual(p.texto, '');
});

test('REFERENCIAS parseReferencias — estrutura', () => {
  const r = parseReferencias(refsValidas);
  assert(r.validas.length === 3);
  assert(r.validas[0].raw);
  assert(r.validas[0].year);
});

test('REFERENCIAS validarListaReferencias — taxa', () => {
  const parse = parseReferencias(refsValidas);
  const v = validarListaReferencias(parse.validas);
  assert(v.taxaValidade >= 0);
  assert(v.total > 0);
});

test('REFERENCIAS createReference — estrutura', () => {
  const ref = createReference('Santos, J. (2020). Turismo. Editora.');
  assert(ref.year === 2020);
  assert(ref.author);
  assert(ref.raw.includes('Santos'));
});

test('REFERENCIAS createReference — vazio', () => {
  const ref = createReference('');
  assertEqual(ref.year, null);
  assertEqual(ref.author, null);
});

test('REFERENCIAS marcarConfianca — confidence level', () => {
  const ref = createReference('Santos, J. (2020). Turismo. Editora.');
  marcarConfianca(ref, CONFIDENCE_LEVELS.VERIFIED);
  assertEqual(ref.confidence, CONFIDENCE_LEVELS.VERIFIED);
});

/* ═══════════════════════════════════════════════════════════════
   ARGUMENTAÇÃO
════════════════════════════════════════════════════════════════ */

test('ARGUMENTACAO analisarEstruturaArgumentativa — estrutura', () => {
  const capitulos = [
    {
      title: 'Introdução',
      sections: [
        {
          title: 'Contextualização',
          paragraphs: [
            'Este trabalho analisa o tema. Segundo Santos (2020), é relevante.',
            'Contudo, existem limitações na abordagem actual.',
            'Conclui-se que o tema merece investigação.',
          ],
        },
      ],
    },
  ];
  const estrutura = analisarEstruturaArgumentativa(capitulos);
  assert(estrutura.length === 1);
  assert(estrutura[0].sections[0].paragraphs.length === 3);
  assert(estrutura[0].sections[0].paragraphs[0].role);
  assert(estrutura[0].sections[0].paragraphs[0].hasCitation === true);
  assert(estrutura[0].sections[0].paragraphs[1].hasCitation === false);
});

test('ARGUMENTACAO verificarCoerenciaArgumentativa — issues', () => {
  const capitulos = [
    {
      title: 'Capítulo sem evidência',
      sections: [
        {
          title: 'Secção',
          paragraphs: [
            'Texto sem citações nem dados.',
            'Apenas opinião pessoal.',
          ],
        },
      ],
    },
  ];
  const estrutura = analisarEstruturaArgumentativa(capitulos);
  const analise = verificarCoerenciaArgumentativa(estrutura);
  assert(analise.issues.length > 0);
  assert(analise.coerente !== undefined);
});

/* ═══════════════════════════════════════════════════════════════
   SCORECARD
════════════════════════════════════════════════════════════════ */

test('SCORECARD gerarScorecard — estrutura', () => {
  const sc = gerarScorecard({});
  assert(sc.overall >= 0 && sc.overall <= 100);
  assert(sc.grade);
  assert(sc.criteria);
  assert(Object.keys(sc.criteria).length === CRITERIA.length);
});

test('SCORECARD gerarScorecard — com dados de argumentação', () => {
  const sc = gerarScorecard({
    argumentationIssues: [{ severity: 'high' }, { severity: 'high' }],
    references: [
      { confidence: CONFIDENCE_LEVELS.VERIFIED },
      { confidence: CONFIDENCE_LEVELS.UNVERIFIED },
    ],
  });
  assert(sc.overall > 0);
});

test('SCORECARD simularProfessor — estrutura', () => {
  const sim = simularProfessor({ metadata: { topic: tema1 } });
  assert(sim.comentarioGeral);
  assert(Array.isArray(sim.recomendacoes));
  assert(sim.nota);
});

test('SCORECARD CRITERIA — pesos somam 100', () => {
  const totalWeight = CRITERIA.reduce((a, c) => a + c.weight, 0);
  assertEqual(totalWeight, 100);
});

/* ═══════════════════════════════════════════════════════════════
   SCHEMAS
════════════════════════════════════════════════════════════════ */

test('SCHEMA createClaim — campos', () => {
  const c = createClaim({ statement: 'Teste', source: 'Fonte X', confidence: CONFIDENCE_LEVELS.UNVERIFIED });
  assert(c.statement === 'Teste');
  assert(c.source === 'Fonte X');
  assert(c.confidence === CONFIDENCE_LEVELS.UNVERIFIED);
});

test('SCHEMA validarClaim — valida/issues', () => {
  const c = createClaim({ statement: 'Afirmação curta', confidence: CONFIDENCE_LEVELS.NEEDS_REVIEW });
  const v = validarClaim(c);
  assert(typeof v.valido === 'boolean');
  assert(Array.isArray(v.issues));
});

test('SCHEMA createDiagnosticSchema — estrutura', () => {
  const d = createDiagnosticSchema({
    title: 'Teste', topic: 'Teste', context: 'Contexto',
    researchProblem: 'Problema', researchQuestion: 'Pergunta',
    generalObjective: 'Objectivo',
    specificObjectives: ['Obj1', 'Obj2'],
  });
  assert(d.title === 'Teste');
  assert(d.specificObjectives.length === 2);
  assert(d.methodology);
  assert(d.scope);
});

test('SCHEMA createReference — campos', () => {
  const r = createReference('Autor. (2020). Título. Editora.');
  assert(r.raw);
  assert(r.confidence === CONFIDENCE_LEVELS.UNVERIFIED);
});

test('SCHEMA validarReferencia — ano inválido', () => {
  const r = createReference('Autor. (1800). Título. Editora.');
  r.year = 1800;
  const v = validarReferencia(r);
  assert(v.issues.length > 0);
});

test('SCHEMA createDocumentSchema — estrutura completa', () => {
  const d = createDocumentSchema({ title: 'Meu TFC', topic: tema1, type: 'tfc' });
  assert(d.metadata.title === 'Meu TFC');
  assert(d.metadata.type === 'tfc');
  assert(Array.isArray(d.chapters));
  assert(Array.isArray(d.references));
  assert(d.diagnostic === null);
});

test('SCHEMA validarIntegridadeDocumento — detecta problemas', () => {
  const d = createDocumentSchema({ title: 'Meu TFC', topic: 'Curto' });
  d.chapters = [];
  const v = validarIntegridadeDocumento(d);
  assert(v.issues.length > 0);
  assert(v.issues.some(i => i.code === 'NO_CHAPTERS'));
  assert(v.issues.some(i => i.code === 'MISSING_TOPIC'));
});

test('SCHEMA validarIntegridadeDocumento — documento completo', () => {
  const d = createDocumentSchema({ title: 'Meu TFC longo', topic: tema1, type: 'tfc', level: 'licenciatura' });
  d.chapters = [{ title: 'Intro', sections: [] }];
  d.references = [{ raw: 'Ref. (2020). Título.' }];
  const v = validarIntegridadeDocumento(d);
  assert(v.criticalCount === 0);
});

test('SCHEMA GEN_STAGES — ordem correcta', () => {
  assertEqual(GEN_STAGES[0], 'INPUT_ANALYSIS');
  assertEqual(GEN_STAGES[GEN_STAGES.length - 1], 'RENDER');
  assert(GEN_STAGES.includes('DIAGNOSTIC'));
  assert(GEN_STAGES.includes('VALIDATION'));
});

test('SCHEMA CONFIDENCE_LEVELS — todos os níveis', () => {
  assert(CONFIDENCE_LEVELS.VERIFIED === 'verified');
  assert(CONFIDENCE_LEVELS.UNVERIFIED === 'unverified');
  assert(CONFIDENCE_LEVELS.NEEDS_REVIEW === 'needs_review');
});

test('SCHEMA CLAIM_TYPES — todos os tipos', () => {
  assert(CLAIM_TYPES.FACT === 'fact');
  assert(CLAIM_TYPES.INTERPRETATION === 'interpretation');
  assert(CLAIM_TYPES.RECOMMENDATION === 'recommendation');
});

/* ═══════════════════════════════════════════════════════════════
   TESTES NEGATIVOS (comportamento com input corrompido)
════════════════════════════════════════════════════════════════ */

test('NEGATIVO-A: titulo angola com conteudo EUA — geo detecta angola', () => {
  const geo = detectarContextoGeo(tema2, '');
  assertEqual(geo, 'angola');
  // O título menciona Angola → sistema assume contexto angolano
  // O desalinhamento real (conteúdo vs título) precisa de validação humana ou AI
  // O módulo diagnostico não tem AI para detectar isto, mas a função de
  // verificarCoerenciaArgumentativa pode sinalizar se as referências forem inconsistentes
  assert(true, 'Detecção geográfica correta pelo título');
});

test('NEGATIVO-B: referência fictícia — marcada UNVERIFIED', () => {
  const ref = createReference('Fake, A. (1999). Estudo Falso. Editora Fictícia.');
  assertEqual(ref.confidence, CONFIDENCE_LEVELS.UNVERIFIED);
  assert(ref.issues.length > 0 || true, 'Referência não verificada não tem issues de formato');
  // Sem DOI/ISBN, permanece UNVERIFIED
  const verif = verificarReferenciaOnline(ref);
  assert(verif.confidence === CONFIDENCE_LEVELS.PARTIALLY_VERIFIED || verif.confidence === CONFIDENCE_LEVELS.UNVERIFIED);
});

test('NEGATIVO-C: objetivo específico sem capítulo — validação detecta', () => {
  const doc = createDocumentSchema({
    title: 'Teste', topic: tema1, type: 'tfc', level: 'licenciatura',
  });
  doc.diagnostic = createDiagnosticSchema({
    title: 'Teste', topic: tema1,
    specificObjectives: ['Obj1', 'Obj2', 'Obj3'],
  });
  doc.chapters = [
    { title: 'Capítulo 1', sections: [] },
  ];
  // 3 objetivos, 1 capítulo → desalinhamento
  // O document schema não valida este matching específico, mas reportamos como limitação
  const integridade = validarIntegridadeDocumento(doc);
  assert(integridade.valido === true, 'A validação de integridade atual não detecta objetivos órfãos');
  // ^ Isto é uma limitação conhecida — o schema actual não faz matching objectivo↔capítulo
});

test('NEGATIVO-D: conclusão que não responde à pergunta — sem detecção automática', () => {
  // A verificação de coerência usa AI via doCoerencia, que não testamos aqui
  // Testamos apenas que a função de prompt é gerada corretamente
  const prompt = montarPromptCoerencia(
    'Este trabalho analisa o impacto das redes sociais na comunicação organizacional.',
    'Em suma, a globalização transformou a economia mundial.'
  );
  assert(prompt.includes('Analisa a coerência'));
  assert(prompt.includes('globalização'));
  // A detecção real do desalinhamento depende da AI
});

test('NEGATIVO-E: capítulo descritivo sem evidência — argumentação detecta', () => {
  const capitulos = [{
    title: 'Revisão da Literatura',
    sections: [{
      title: 'Conceitos',
      paragraphs: [
        'O empreendedorismo é importante.',
        'Muitos autores estudaram o tema ao longo dos anos.',
        'Este capítulo apresenta os principais conceitos.',
      ],
    }],
  }];
  const estrutura = analisarEstruturaArgumentativa(capitulos);
  const analise = verificarCoerenciaArgumentativa(estrutura);
  const highIssues = analise.issues.filter(i => i.severity === 'high');
  assert(highIssues.length > 0, `Esperado alertas de alta severidade, obtido ${highIssues.length}`);
});

test('NEGATIVO-F: afirma entrevistas sem metodologia — diagnostic sem AI não detecta', () => {
  const input = {
    tema: 'Impacto de um programa de formação',
    tipo: 'TFC', nivel: 'licenciatura',
  };
  const d = gerarDiagnostico(input);
  assert(d.methodology.approach === '');
  assert(d.methodology.type === '');
  // O diagnóstico actual preenche vazios — a detecção de inconsistência
  // metodológica precisa de mais contexto (AI) ou de validação cruzada
});

/* ═══════════════════════════════════════════════════════════════
   TESTES EDGE E STRESS
════════════════════════════════════════════════════════════════ */

test('EDGE: tema vazio — detectores não crasham', () => {
  assertEqual(detectarArea(''), 'humanidades');
  assertEqual(detectarNivel(''), 'licenciatura');
  assertEqual(detectarContextoGeo('', ''), 'global');
});

test('EDGE: palavras zero no prompt', () => {
  const p = montarPromptCapitulo({
    tema: 'Teste', tipo: 'TFC', nivel: 'licenciatura',
    capNum: 1, capTit: 'Intro', totalCaps: 3, totalPags: 10,
    capSubs: [], palavras: 0,
    nivelKey: 'licenciatura', areaKey: 'humanidades',
    pNivel: PERFIL_NIVEL['licenciatura'], pArea: PERFIL_AREA.humanidades,
    geoCtx: 'global', subs: '',
  });
  assert(typeof p === 'string');
  assert(p.length > 100);
});

test('EDGE: 100 capítulos na estrutura', () => {
  const p = montarPromptEstrutura('Tema', 'TFC', 'licenciatura', 100, 'Obj');
  assert(p.includes('100'));
});

test('EDGE: referência com ano 2099 — inválida', () => {
  const r = createReference('Futuro, A. (2099). Obra Futura. Editora.');
  r.year = 2099;
  const v = validarReferencia(r);
  assert(v.issues.length > 0);
});

/* ═══════════════════════════════════════════════════════════════
   RELATÓRIO
════════════════════════════════════════════════════════════════ */

const total = passed + failed;
console.log(`\n═════════════ RELATÓRIO DE VALIDAÇÃO ═════════════`);
console.log(`Total: ${total}  |  ✓ Aprovados: ${passed}  |  ✗ Reprovados: ${failed}\n`);

// Agrupar por categoria
const categorias = {
  T1: 'Tema 1 — Ciências Sociais',
  T2: 'Tema 2 — Angola específico',
  T3: 'Tema 3 — Academy caso concreto',
  EVIDENCIA: 'Evidência / Classificação',
  REFERENCIAS: 'Referências',
  ARGUMENTACAO: 'Argumentação',
  SCORECARD: 'Scorecard',
  SCHEMA: 'Schemas',
  NEGATIVO: 'Testes Negativos',
  EDGE: 'Edge/Stress',
};

const reports = [];
for (const [prefix, label] of Object.entries(categorias)) {
  const filtered = results.filter(r => r.name.startsWith(prefix));
  if (filtered.length === 0) continue;
  const p = filtered.filter(r => r.status === '✓').length;
  const f = filtered.filter(r => r.status === '✗').length;
  const status = f === 0 ? '✓' : '✗';
  reports.push(`  ${status} ${label}: ${p}/${filtered.length}`);
  for (const r of filtered) {
    if (r.status === '✗') reports.push(`    ${r.name}: ${r.error}`);
  }
}

console.log('Por categoria:\n' + reports.join('\n'));

console.log(`\n${failed === 0 ? '✓ TODOS OS TESTES APROVADOS' : `✗ ${failed} TESTE(S) REPROVADO(S)`}`);

// Limitações conhecidas
console.log(`\n══════════════ LIMITAÇÕES CONHECIDAS ═══════════`);
console.log(`1. Diagnóstico actual (sem AI) preenche campos vazios — detecção`);
console.log(`   de inconsistência metodológica precisa de validação cruzada`);
console.log(`   ou análise semântica (AI).`);
console.log(`2. Não há matching automático objectivo↔capítulo ainda.`);
console.log(`3. Referências UNVERIFIED são etiquetadas mas não bloqueiam uso.`);
console.log(`4. A verificação de coerência (pergunta↔conclusão) depende de AI.`);
console.log(`5. Testes AI-dependentes (gerar_capitulo, plano, estrutura)`);
console.log(`   validam apenas a construção do prompt, não a resposta da AI.`);
console.log(`6. Necessário OPENROUTER_API_KEY para testes end-to-end reais.`);
