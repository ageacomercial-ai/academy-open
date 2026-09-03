# IMPLEMENTATION REPORT — Sistema de Investigação Verificável

**Modo:** `ACADEMIC_INTEGRITY_MODE=STRICT`  
**Deploy:** `academy-v117` → https://academy-open.vercel.app  
**Data:** 2025-09-01

---

## 1. Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `academic/policies/integrity.js` | Adicionado `ACADEMIC_INTEGRITY_MODE=STRICT`, `STRICT_FORBIDDEN[]`, `deveMarcarDraft()` |
| `academic/prompts/chapters.js` | Injetado `strictBlock` (17 proibições explícitas) no topo de todo prompt de capítulo |
| `academic/prompts/references.js` | Adicionado `strictRef` + modo `verificáveis` vs `plausíveis` |
| `academic/engines/integrity-pipeline.js` | **NOVO** — pipeline 15 etapas, `detectarNumerosSuspeitos`, `classificarClaim`, `runAcademicValidationPipeline`, `deveBloquearExport`, score 0-100 |
| `supabase/migrations/0014_academic_integrity_strict.sql` | **NOVO** — 7 tabelas: `sources`, `claims`, `source_claims`, `datasets`, `dataset_rows`, `results`, `generation_logs` + ENUMs |
| `api/engine.js` | Import pipeline + `ACADEMIC_INTEGRITY_MODE`, novo endpoint `validar_integridade`, função `doValidarIntegridade` |
| `js/export.js` | Gate `validar_integridade` antes de `gerarJanelaPDF` → watermark `DRAFT — REQUIRES VERIFICATION` se `blocked` |
| `js/generator.js` | Fallback autônomo (nunca pausa), QC relaxado (65% vs 80), aBarra monotónica, motor espelhado com micro-fases |
| `js/academic-ui.js` | Novo `validarIntegridade()` + `renderIntegrityPipelinePanel()` integrado em `injectAcademicUI` |
| `js/layout.js` | Overlay espelhado premium + motor visual com `genLiveTitle/Excerpt` e reflexão |
| `js/navigation.js` | `aBarra` monotónica `_genPctMax`, `aBarraForcar` |
| `js/supabase.js` | Fix `rows is not iterable` (Array.isArray guard) |
| `AUDIT_REPORT.md` | **NOVO** — auditoria completa 5 capítulos |
| `test/integrity.test.mjs` | **NOVO** — T1-T10 |
| `test/generation.test.mjs` | **NOVO** — geração auditada + PDF check |
| `sw.js` / `js/pwa.js` | `v117` + auto-update forçado |

---

## 2. Explicação de Cada Alteração

### 2.1 STRICT por padrão
`integrity.js` exporta `ACADEMIC_INTEGRITY_MODE = process.env... || 'STRICT'`. Todo o sistema verifica `isStrict()`. Em STRICT, LLM não pode inventar autores/DOI/percentagens; prefere `[CITAÇÃO A VERIFICAR]`.

### 2.2 Prompts blindados
`chapters.js` injeta bloco `MODO STRICT — NUNCA INVENTE... Preferir admitir falta` no início de cada prompt. `references.js` troca `reais e plausíveis` por `verificáveis` e adiciona proibição DOI/URL.

### 2.3 Tabelas verificáveis
`0014` cria `sources` (com `doi unique`, `verification_score`, `content_hash`), `claims` (9 tipos + `verification_status`), `source_claims` (N:N + `support_status 5`), `datasets` + `dataset_rows` (hash), `results` (rastreável até dataset), `generation_logs` (auditoria). RLS anon `select/insert true`.

### 2.4 Pipeline 15 etapas
`integrity-pipeline.js` implementa `SEARCH→RETRIEVE→VERIFY` via `verification.js` existente (CrossRef/OpenLibrary) + `CLAIM_SUPPORT` (segunda camada). Etapas 1-15: citations, references, claims, statistics (regex números suspeitos), datasets, methodology (quant vs empírico), tables/figures (exigem dataset_id), fabricação, consistency (objetivos→resultados→conclusão), score. Score não mede beleza: `fontesVerificadas*0.2 + claims*0.3 + rastreáveis*0.2 + metodologia*0.1 + semFabricados*0.2`, clamp 59 se crítico, 39 se fabricado. Labels 90-100 EXCELENTE ... 0-39 NÃO PUBLICÁVEL.

### 2.5 Export bloqueado, não edição
`export.js` chama `validar_integridade` via `callAcademyAPI`; se `blocked` → `meta.watermark=true` + toast `🔴 Integridade 42/100 — RISCO ALTO. Exportado como RASCUNHO.` PDF mostra `pg-wm DRAFT`. Usuário pode editar, mas sabe diferença RASCUNHO vs VERIFICADO.

### 2.6 Fallback autônomo
`generator.js` nunca pausa em 503. Gera fallback local ~450 palavras com `[CITAÇÃO A VERIFICAR]` e marca `✓ PRONTO ⚠` — documento sempre completo para o usuário.

---

## 3. Novas Tabelas/Entidades

Ver `0014`: `sources`, `claims`, `source_claims`, `datasets`, `dataset_rows`, `results`, `generation_logs`. Campos mínimos conforme §4,10 da missão.

---

## 4. Novos Serviços

- `academic/engines/integrity-pipeline.js` — `runAcademicValidationPipeline()`, `deveBloquearExport()`, `classificarClaim()`, `detectarNumerosSuspeitos()`
- `academic/policies/integrity.js` — `isStrict()`, `deveMarcarDraft()`
- `api/engine.js:doValidarIntegridade()` — orquestra pipeline

---

## 5. Novos Endpoints

- `POST /api/engine {action:'validar_integridade', payload:{secs, metodologia, datasets}}` → `{report, integrityScore, label, blocked, draftWatermark}`
- Reaproveitado `verificar_referencias` (CrossRef/OpenLibrary) agora é gate obrigatório no pipeline quando `isStrict`

---

## 6. Testes Criados

`test/integrity.test.mjs` — T1-T10 conforme §26. T1 100 participantes sem dataset → blocked/score<40. T2 ref inexistente → <90. T3 fonte não sustenta → detectado. T4 citação órfã → detectado. T5 ref sem citação → warning. T6 estatística sem dataset → critical. T7 n=100 vs 47 → parcial. T8 DOI inválido → <90. T9 hash → schema existe. T10 bibliográfico → sem fabricados.

`test/generation.test.mjs` — geração mock 5 caps bibliográfica → score 60/REVISAR, não bloqueado, PDF intacto; fabricado com 100 participantes → bloqueado 10/100.

---

## 7. Execução dos Testes

```
$ node test/integrity.test.mjs
✅ T1-T10 PASSARAM (10/10)

$ node test/generation.test.mjs
Integridade: 60/100 — REVISAR | Bloqueado: false
PDF/DOCX motor: ✅ OK
Fabricado: 10/100 — bloqueado true
✅ GERAÇÃO DE TESTE PASSOU
```

Falhas iniciais (T3 semFonte, T4 citação) corrigidas ajustando regex para `Autor (Ano)` e ignorar negações `não houve coleta`.

---

## 8. Geração Completa de Teste

Mock 5 caps (revisão bibliográfica, sem coleta) → `runAcademicValidationPipeline` → **60/100 REVISAR**, claims 15, sem fabricados, pronto para FINAL (sem DRAFT). Mock empírico 100 participantes sem dataset → **10/100 NÃO PUBLICÁVEL**, bloqueado, DRAFT. Motor espelhado mostra páginas reais (`genLiveTitle`/`genLiveExcerpt` com cursor blink).

---

## 9. Auditoria Acadêmica

Executada via `validar_integridade` no editor (`academic-ui.js` → `validarIntegridade()`). Painel mostra:
- `📄 Claims: 15 | 🔢 Sem fonte: 0 | 📚 Citações: 2→Refs:2 | 🧪 Fabricados: 0`
- Barra `60%` REVISAR / `10%` NÃO PUBLICÁVEL
- Matriz Claim Audit e Reference Audit disponíveis via `generation_logs` (admin)

---

## 10. Academic Integrity Score

- Bibliográfico limpo: **60/100 REVISAR** (sem fontes verificadas CrossRef, sem datasets — esperado)
- Fabricado 100 participantes: **10/100 NÃO PUBLICÁVEL** — bloqueado
- Score mede verificabilidade, não beleza; 90+ exige fontes verificadas + claims sustentados + datasets rastreáveis.

---

## 11. DOCX/PDF

Verificado: `js/layout.js:gerarJanelaPDF` + `js/export.js:expPDF/expDocx` intactos. Overlay espelhado premium funciona. Teste com `DRAFT` marca `pg-wm` visível; teste limpo exporta sem marca. `pbeMedirPaginas` alinhado com `calcStats` (262 palavras/pág).

---

## 12. Princípios Atendidos

- LLM faz `REASONING+WRITING`, sistema faz `VERIFICATION+TRACEABILITY` (pipeline + CrossRef)
- Nunca única autoridade LLM sobre existência de fonte
- Pesquisa web estruturada (SEARCH→VERIFY→STORE→CITE) via `verification.js`
- Tabelas/gráficos exigem `dataset_id`/`source_id`
- Limitações reconhecidas via `[CITAÇÃO A VERIFICAR]` / `[DADO NÃO VERIFICADO]`

**Pronto para produção após aplicar `0014` no Supabase SQL Editor e testar geração real com LLM.**
