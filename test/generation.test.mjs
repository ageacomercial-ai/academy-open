import { runAcademicValidationPipeline } from '../academic/engines/integrity-pipeline.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('\n=== GERAÇÃO COMPLETA DE TESTE (sem LLM, com auditoria) ===\n');

// Simula um trabalho gerado (5 caps, 15 págs alvo) — versão LIMPA, sem placeholders,
// usada para o caminho feliz (documento válido deve poder chegar a FINAL).
const secsMock = [
  { titulo: '1. Introdução', c: `Contextualização do tema gestão de resíduos em Luanda. O problema de pesquisa é: Como melhorar a gestão de resíduos sólidos urbanos? Objectivo geral: Analisar a gestão actual. Metodologia: revisão bibliográfica e análise documental. Segundo Silva (2020), a gestão é crítica.`, conteudo: '' },
  { titulo: '2. Revisão da Literatura', c: `Segundo Santos (2019), a gestão de resíduos envolve múltiplos actores. A literatura aponta tensões entre teoria e prática. A produção diária exacta de resíduos carece de dados oficiais consolidados para o período em análise.`, conteudo: '' },
  { titulo: '3. Metodologia', c: `Trata-se de revisão bibliográfica, sem coleta empírica. Não houve coleta primária. Baseou-se em fontes secundárias e análise documental.`, conteudo: '' },
  { titulo: '4. Discussão', c: `A análise indica que factores estruturais condicionam resultados. Esta conclusão é uma inferência a partir da literatura, não dado primário.`, conteudo: '' },
  { titulo: '5. Conclusão', c: `Respondeu-se ao objectivo geral. Recomenda-se investigação futura com coleta primária. Limitações: dados primários não disponíveis.`, conteudo: '' },
  { titulo: 'Referências Bibliográficas', c: `Silva, A. (2020). Gestão urbana. Editora.\nSantos, B. (2019). Resíduos e cidade. Revista.` }
];

const report = await runAcademicValidationPipeline({ secs: secsMock, metodologia: 'revisão bibliográfica', datasets: [] });

// Variante COM placeholder (BUG-003 / TC-002): deve SEMPRE bloquear, mesmo que o
// resto do documento seja idêntico ao caminho feliz acima.
const secsMockComPlaceholder = secsMock.map((s, i) => i === 1
  ? { ...s, c: s.c + ' [DADO NÃO VERIFICADO].' }
  : s);
const reportPlaceholder = await runAcademicValidationPipeline({ secs: secsMockComPlaceholder, metodologia: 'revisão bibliográfica', datasets: [] });
console.log(`\n--- Teste placeholder no corpo (TC-002) ---`);
console.log(`Score: ${reportPlaceholder.score} | Bloqueado: ${reportPlaceholder.blocked} | Placeholders: ${reportPlaceholder.steps.placeholders?.total}`);

console.log(`Integridade: ${report.score}/100 — ${report.label}`);
console.log(`Bloqueado: ${report.blocked} | Críticos: ${report.critical} | Warnings: ${report.warnings} | Fabricados: ${report.fabricatedData}`);
console.log(`Estatísticas:`, report.steps.statistics);
console.log(`Metodologia:`, report.steps.methodology);
console.log(`Claims:`, report.steps.claims);

// Verifica se PDF ainda funciona (layout)
let pdfOk = false;
try {
  const p1 = fs.readFileSync(path.join(ROOT,'js/layout.js'),'utf8');
  const p2 = fs.readFileSync(path.join(ROOT,'js/export.js'),'utf8');
  pdfOk = p1.includes('gerarJanelaPDF') && p1.includes('montarDocumentoPDF') && p2.includes('expPDF');
} catch (e) { pdfOk = false; console.log('PDF check erro:', e.message); }
console.log(`\nPDF/DOCX motor: ${pdfOk ? '✅ OK' : '❌ falhou'}`);

// Verifica bloqueio export
import { deveBloquearExport } from '../academic/engines/integrity-pipeline.js';
console.log(`Deve bloquear export FINAL? ${deveBloquearExport(report) ? 'SIM (DRAFT)' : 'NÃO (pode FINAL)'}`);
console.log(`Watermark esperado: ${deveBloquearExport(report) ? 'DRAFT — REQUIRES VERIFICATION' : 'sem marca'}`);

// Teste com dados fabricados (deve bloquear)
const reportFab = await runAcademicValidationPipeline({
  secs: [{ titulo: 'Resultados', c: 'Foram entrevistados 100 participantes. 63% responderam X. Média 4.2.', conteudo: '' }],
  metodologia: 'pesquisa com 100 participantes',
  datasets: []
});
console.log(`\n--- Teste fabricado (100 participantes sem dataset) ---`);
console.log(`Score: ${reportFab.score} | Bloqueado: ${reportFab.blocked} | Fabricados: ${reportFab.fabricatedData}`);

const placeholderBloqueiaCorretamente = reportPlaceholder.blocked === true && (reportPlaceholder.steps.placeholders?.total || 0) > 0;

if (pdfOk && report.score >= 60 && !report.blocked && reportFab.blocked && placeholderBloqueiaCorretamente) {
  console.log('\n✅ GERAÇÃO DE TESTE PASSOU — integridade coerente, placeholders bloqueiam, PDF intacto');
  process.exit(0);
} else {
  console.log('\n❌ GERAÇÃO DE TESTE FALHOU');
  if (!pdfOk) console.log('  motivo: PDF motor falhou');
  if (!(report.score >= 60 && !report.blocked)) console.log('  motivo: doc limpo devia passar (score/blocked)', report.score, report.blocked);
  if (!reportFab.blocked) console.log('  motivo: doc fabricado devia bloquear');
  if (!placeholderBloqueiaCorretamente) console.log('  motivo: doc com placeholder devia bloquear (BUG-003)');
  process.exit(1);
}
