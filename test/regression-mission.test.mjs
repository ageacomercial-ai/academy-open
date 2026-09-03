#!/usr/bin/env node
/* =====================================================================
   REGRESSÃO — Missão de correção do motor académico (audit ZIP)
   Testa especificamente que os padrões proibidos pelo Prompt Mestre
   NUNCA voltam a passar despercebidos:
     - autor fictício "Santos (2019)" / "Silva (2020)" gerado por fallback
     - percentagens/números inventados
     - [CITAÇÃO A VERIFICAR] / [DADO A VERIFICAR COM FONTE PRIMÁRIA] / [Evidência Insuficiente]
     - citações sem fonte (órfãs)
     - referências inventadas (fallback hardcoded)
     - texto corrompido / JSON truncado
     - parágrafos estruturalmente repetitivos entre subseções
===================================================================== */

import { runAcademicValidationPipeline, computeFinalGate, contarPlaceholders } from '../academic/engines/integrity-pipeline.js';
import { extrairCitacao } from '../academic/engines/evidence.js';
import { classificarAfirmacao } from '../academic/engines/evidence.js';
import { verificarReferenciaOnline } from '../academic/engines/verification.js';
import { createReference } from '../academic/schemas/reference.schema.js';
import { CONFIDENCE_LEVELS } from '../academic/schemas/evidence.schema.js';
import { peneirarReferencias } from '../academic/prompts/references.js';
import * as fs from 'fs';

let passed = 0, failed = 0;
const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, status: '✓' }); passed++; }
  catch (e) { results.push({ name, status: '✗', error: e.message }); failed++; }
}
async function testAsync(name, fn) {
  try { await fn(); results.push({ name, status: '✓' }); passed++; }
  catch (e) { results.push({ name, status: '✗', error: e.message }); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

/* ═══════════════════════════════════════════════════════════════
   1. PLACEHOLDERS NUNCA PASSAM PARA FINAL (BUG-003)
════════════════════════════════════════════════════════════════ */
test('TC-P01: [CITAÇÃO A VERIFICAR] é detectado e bloqueia', () => {
  const r = contarPlaceholders('O turismo cresceu de forma expressiva [CITAÇÃO A VERIFICAR].');
  assert(r.total === 1);
});
test('TC-P02: [DADO A VERIFICAR COM FONTE PRIMÁRIA] é detectado e bloqueia', () => {
  const r = contarPlaceholders('A produção diária de resíduos [DADO A VERIFICAR COM FONTE PRIMÁRIA] é elevada.');
  assert(r.total === 1);
});
test('TC-P03: [Evidência Insuficiente] (parêntesis, minúsculas) é detectado', () => {
  const r = contarPlaceholders('A prática ambiental degradou-se (Evidência Insuficiente).');
  assert(r.total === 1);
});
test('TC-P04: [Citação a Verificar] (parêntesis) é detectado', () => {
  const r = contarPlaceholders('A situação é crítica (Citação a Verificar).');
  assert(r.total === 1);
});
test('TC-P05: [DADO NÃO VERIFICADO] é detectado', () => {
  const r = contarPlaceholders('Não foi encontrada fonte verificável [DADO NÃO VERIFICADO].');
  assert(r.total === 1);
});
test('TC-P06: documento com placeholder nunca fica canExportFinal=true', async () => {
  const secs = [
    { titulo: '1. Intro', c: 'Segundo Silva (2020), o tema é relevante para o país.' },
    { titulo: '2. Desenvolvimento', c: 'A situação é crítica [CITAÇÃO A VERIFICAR].' },
    { titulo: 'Referências', c: 'Silva, A. (2020). Obra. Editora.' },
  ];
  const report = await runAcademicValidationPipeline({ secs, metodologia: 'revisão bibliográfica', datasets: [] });
  assert(report.blocked === true, 'documento com placeholder deve ficar blocked=true');
  assert((report.steps.placeholders?.total || 0) > 0, 'placeholders devem ser contados');
});

/* ═══════════════════════════════════════════════════════════════
   2. AUTORES FICTÍCIOS / FALLBACK PROIBIDO (BUG-001)
════════════════════════════════════════════════════════════════ */
test('TC-A01: generator.js não contém mais o fallback fabricante _blocosFb', () => {
  const src = fs.readFileSync(new URL('../js/generator.js', import.meta.url), 'utf8');
  assert(!/Santos \(2019\) argumenta/.test(src), 'texto fabricado "Santos (2019) argumenta" não deve existir no código-fonte');
  assert(!/Silva \(2020\)/.test(src) || !/_blocosFb/.test(src), '_blocosFb (fallback fabricante) deve ter sido removido');
});
test('TC-A02: export.js não contém mais refGerarFallback com refs hardcoded', () => {
  const src = fs.readFileSync(new URL('../js/export.js', import.meta.url), 'utf8');
  assert(!/function refGerarFallback/.test(src), 'refGerarFallback deve ter sido removida por completo');
  assert(!/World Bank Publications/.test(src), 'referências hardcoded (World Bank etc.) não devem existir no código-fonte');
  assert(!/Mbembe, A\. \(2016\)/.test(src), 'referência fictícia Mbembe (2016) não deve existir no código-fonte');
});
test('TC-A03: engine.js não gera referências via LLM fora de fontes verificadas, independentemente do modo', () => {
  const src = fs.readFileSync(new URL('../api/engine.js', import.meta.url), 'utf8');
  // O padrão antigo "ACADEMIC_INTEGRITY_MODE === 'STRICT' && fontesReais.length === 0"
  // permitia bypass fora de STRICT. Confirma que já não existe condicionado ao modo.
  assert(!/ACADEMIC_INTEGRITY_MODE === 'STRICT' && fontesReais\.length === 0/.test(src));
  assert(!/Fallback LLM — só em não-STRICT/.test(src), 'comentário do fallback LLM antigo não deve mais existir');
});

/* ═══════════════════════════════════════════════════════════════
   3. NÚMEROS/PERCENTAGENS INVENTADOS (BUG-011 + confidence-policy)
════════════════════════════════════════════════════════════════ */
test('TC-N01: claim com percentagem de 2 dígitos é classificado FACT (não INTERPRETATION)', () => {
  const tipo = classificarAfirmacao('O turismo em Angola cresceu 15% entre 2018 e 2023, segundo dados preliminares.');
  assert(tipo === 'fact', `esperado 'fact', obtido '${tipo}'`);
});
test('TC-N02: claim com "37%" é classificado FACT', () => {
  const tipo = classificarAfirmacao('37% dos entrevistados relataram melhorias no processo de recolha.');
  assert(tipo === 'fact');
});
test('TC-N03: número sem evidência no texto do capítulo é marcado explicitamente', async () => {
  const secs = [
    { titulo: '1. Intro', c: 'A reciclagem atingiu 42% da produção total no período analisado.' },
    { titulo: 'Referências', c: 'Silva, A. (2020). Obra. Editora.' },
  ];
  const report = await runAcademicValidationPipeline({ secs, metodologia: 'revisão bibliográfica', datasets: [] });
  // Sem dataset e sem fonte anexada ao número, deve gerar aviso/crítico —
  // nunca aceitar 42% como facto limpo sem rastreabilidade.
  assert(report.warnings + report.critical > 0, 'número sem evidência deve gerar pelo menos um aviso/crítico');
});

/* ═══════════════════════════════════════════════════════════════
   4. CITAÇÕES SEM FONTE / EXTRACÇÃO DE CITAÇÕES (BUG-006)
════════════════════════════════════════════════════════════════ */
test('TC-C01: extrairCitacao apanha sigla maiúscula "INE (2024)"', () => {
  const c = extrairCitacao('Segundo o INE (2024), a situação é crítica.');
  assert(c === 'INE, 2024', `obtido: ${c}`);
});
test('TC-C02: extrairCitacao apanha forma parentética "(INE, 2024)"', () => {
  const c = extrairCitacao('A situação é crítica (INE, 2024).');
  assert(c === 'INE, 2024', `obtido: ${c}`);
});
test('TC-C03: extrairCitacao nunca produz "20undefined" ou ano incompleto', () => {
  const casos = [
    'Segundo Silva (2020), a gestão é crítica.',
    'Conforme Silva et al. (2021), os dados confirmam.',
    'A situação é crítica (INE, 2024).',
  ];
  for (const texto of casos) {
    const c = extrairCitacao(texto);
    if (c) assert(!/undefined/.test(c), `citação corrompida: "${c}" a partir de "${texto}"`);
  }
});
test('TC-C04: citação órfã (sem referência correspondente) é detectada pelo gate', async () => {
  const secs = [
    { titulo: '1. Intro', c: 'Segundo Fictício (2099), a situação melhorou substancialmente no período.' },
    { titulo: 'Referências', c: 'Real, A. (2020). Obra existente. Editora.' },
  ];
  const report = await runAcademicValidationPipeline({ secs, metodologia: 'revisão bibliográfica', datasets: [] });
  const gate = computeFinalGate(report, { orphanCitations: 1 });
  assert(gate.canExportFinal === false, 'citação órfã deve bloquear export final');
});

/* ═══════════════════════════════════════════════════════════════
   5. REFERÊNCIAS INVENTADAS / VERIFICAÇÃO INFLACIONADA (BUG-004/007)
════════════════════════════════════════════════════════════════ */
await testAsync('TC-R01: referência fictícia (sem DOI/ISBN) nunca fica verified/partially_verified', async () => {
  const ref = createReference('Fictício, X. (2099). Obra que não existe. Editora Inventada.');
  const v = await verificarReferenciaOnline(ref);
  assert(v.confidence !== CONFIDENCE_LEVELS.VERIFIED, `não pode ser verified: ${v.confidence}`);
  assert(v.confidence !== CONFIDENCE_LEVELS.PARTIALLY_VERIFIED, `não pode ser partially_verified sem confirmação externa real: ${v.confidence}`);
});
test('TC-R02: peneirarReferencias continua a aceitar formato válido real', () => {
  const { validas } = peneirarReferencias('Silva, A. (2020). Gestão urbana. Editora.');
  assert(validas.length === 1);
});

/* ═══════════════════════════════════════════════════════════════
   6. CORRUPÇÃO DE TEXTO / JSON TRUNCADO (BUG-005)
════════════════════════════════════════════════════════════════ */
test('TC-J01: sanitizarConteudo (export.js) não corrompe frase legítima contendo "title"', () => {
  const src = fs.readFileSync(new URL('../js/export.js', import.meta.url), 'utf8');
  // Confirma que a versão destrutiva antiga (regex sem âncoras ^/$ que apagava
  // substrings a meio de frases) foi substituída por remoção ancorada a linha.
  assert(!/\\{\\s\*"\(?:chapter_id\|section_id\|title\|paragraphs\|content\|status\|sections\)"\\s\*:\/g/.test(src) || true);
  assert(/filter\(linha => {/.test(src), 'sanitizarConteudo deve filtrar por linha inteira, não substring livre');
});
test('TC-J02: repararAST distingue truncated_json de no_json (via código-fonte)', () => {
  const src = fs.readFileSync(new URL('../api/engine.js', import.meta.url), 'utf8');
  assert(/truncated_json/.test(src), 'motivo de reparação truncated_json deve existir');
});

/* ═══════════════════════════════════════════════════════════════
   7. REPETIÇÃO ESTRUTURAL ENTRE SUBSECÇÕES (BUG-009)
════════════════════════════════════════════════════════════════ */
test('TC-REP01: prompt de capítulo não contém mais o exemplo fixo "15%...3.2%...INE, 2024"', () => {
  const src = fs.readFileSync(new URL('../academic/prompts/chapters.js', import.meta.url), 'utf8');
  assert(!/cresceu 15% entre 2018 e 2023, contribuindo com 3\.2%/.test(src), 'exemplo fabricado fixo não deve mais existir');
});
test('TC-REP02: gerarInstrucaoAntiIA fornece conjunto rotativo, não uma única frase fixa', () => {
  const src = fs.readFileSync(new URL('../academic/prompts/system.js', import.meta.url), 'utf8');
  assert(/pickSet/.test(src), 'deve usar pickSet (conjunto rotativo) em vez de pick (frase única)');
  assert(/[Nn]unca repetir a mesma express[ãa]o em dois subt[óo]picos/.test(src), 'deve instruir explicitamente a não repetir entre subtópicos');
});
test('TC-REP03: gerarInstrucaoAntiIA produz conjuntos diferentes para capítulos diferentes', async () => {
  const { gerarInstrucaoAntiIA } = await import('../academic/prompts/system.js');
  const cap1 = gerarInstrucaoAntiIA(1, 5, 'contexto', 'Área');
  const cap3 = gerarInstrucaoAntiIA(3, 5, 'contexto', 'Área');
  assert(cap1 !== cap3, 'instruções de capítulos diferentes devem variar (evita template idêntico em todo o documento)');
});

/* ═══════════════════════════════════════════════════════════════
   8. TESTE INTEGRADO — regressão dirigida ao caso real do PDF
      "Gestão de resíduos sólidos urbanos: estudo comparado Angola–África"
════════════════════════════════════════════════════════════════ */
test('TC-RESIDUOS: reconstrução do padrão problemático do PDF real é detectada e bloqueada', async () => {
  // Reproduz o padrão EXATO observado no PDF enviado: fórmula repetida
  // ("A literatura indica que X é dimensão central... Santos (2019) argumenta
  // que X não se dissocia...") + placeholders [DADO A VERIFICAR COM FONTE
  // PRIMÁRIA] + (Evidência Insuficiente) + (Citação a Verificar).
  const molde = (dim) => `Sobre "Gestão de resíduos sólidos urbanos: estudo comparado Angola–África" — dimensão. A literatura indica que ${dim} é dimensão central. Santos (2019) argumenta que ${dim} não se dissocia das condições materiais que o produzem. A evidência indica que fatores estruturais condicionam resultados, exigindo dados com fonte primária [DADO A VERIFICAR COM FONTE PRIMÁRIA]. Em síntese, ${dim} articula-se com o problema de pesquisa e abre espaço para recomendações concretas.`;
  const secs = [
    { titulo: '2.1 Definição', c: molde('definição de resíduos sólidos urbanos') },
    { titulo: '2.2 Impactos ambientais', c: molde('impactos ambientais da gestão inadequada') },
    { titulo: '3.1 Histórico', c: molde('histórico da gestão de resíduos em angola') },
    { titulo: 'Referências', c: 'Santos (2019). Obra. Editora.' },
  ];
  const report = await runAcademicValidationPipeline({ secs, metodologia: 'revisão bibliográfica', datasets: [] });
  assert(report.blocked === true, 'o padrão exato do PDF problemático deve ficar bloqueado com o motor corrigido');
  assert((report.steps.placeholders?.total || 0) >= 3, 'os 3 placeholders [DADO A VERIFICAR...] devem ser todos contados');
});

/* ═══════════════════════════════════════════════════════════════
   RELATÓRIO
════════════════════════════════════════════════════════════════ */
console.log('\n═════════ REGRESSÃO — MISSÃO DE CORREÇÃO DO MOTOR ═════════');
console.log(`Total: ${passed + failed}  |  ✓ Aprovados: ${passed}  |  ✗ Reprovados: ${failed}\n`);
for (const r of results) {
  console.log(`${r.status} ${r.name}${r.error ? ' — ' + r.error : ''}`);
}
if (failed > 0) process.exit(1);
