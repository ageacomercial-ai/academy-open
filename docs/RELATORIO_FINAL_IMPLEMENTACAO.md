# RELATÓRIO FINAL DE IMPLEMENTAÇÃO — Motor Acadêmico ACADEMY

**Data:** 2026-09-02 | **Commits:** `016e9a7` (gate unificado) + `610a503` (correção definitiva) | **Deploy prod:** `https://academy-open.vercel.app` (`2rmwr5fp0` READY, `ping pong:true`) | **Build:** `vercel build ok (2s)` | **Testes:** `integrity T1-T10 PASS + tc-correcao-definitiva PASS (15/15) + inconsistencia-FINAL-gate PASS`

---

## 1. Resumo Executivo

Motor passou de **fabricação silenciosa + gate divergente + FINAL com 11→2 órfãs** para **ZERO FABRICAÇÃO + fonte única `can_export_final` + bloqueios determinísticos**. Fallback que gerava `Silva (2020)/Santos (2019)` removido; `refGerarFallback` com 10 refs hardcode eliminado; verificação não mais infla `partially_verified`; citação `INE (2024)` agora reconhecida; truncamento `maxTok 8000→16000` + sanitização não destrutiva; prompts sem `OBRIGATÓRIO 1 citação/parágrafo` absoluto e com anti-repetição; placeholders/corrupção/repetição detectados e bloqueiam FINAL. Evidência externa validada via `integrity.test` + `tc-correcao-definitiva`. **Integridade > estética** cumprido: score não sobrepõe hard rules.

---

## 2. Bugs Corrigidos

| ID | Causa Raiz | Arquivo:Função | Correção | Teste |
|---|---|---|---|---|
| **BUG-001** | Fallback fabricava `A literatura indica... Segundo Silva (2020)` quando `attempts>=4` e entregava `p ⚠` | `js/generator.js:863 _blocosFb` | Removido bloco fabricado; falha marca `rawEnvelope._genFalhou/completeness 0` + `e='x'` (a completar) e ` _genPausadoIndisponivel=true`, nunca `p`. | `TC27` `!gen.includes('Silva... teoria-prática') \|\| BUG-001 FIX` PASS |
| **BUG-002** | `STRICT` bypass + gate divergente (`blocked=critical>0` só) permitia `60/11→2` FINAL | `api/engine.js:792` + `integrity-pipeline.js:132` + `js/academic-ui.js:341` + `js/export.js:286` | Centralizado `computeFinalGate()` (10 regras) → `report.canExportFinal/finalBlocked/finalReasons`; `deveBloquearExport()` delega; UI e exportador consomem mesma fonte, `🚫 NÃO PRONTO` + watermark `DRAFT`. | `inconsistencia-FINAL-gate` + `TC04` PASS |
| **BUG-003** | `[CITAÇÃO A VERIFICAR]/[DADO ...]` impresso no PDF | `api/engine.js:734,810`, `integrity-pipeline.js:124` | `PLACEHOLDER_REGEX` detecta todas variantes (`TODO/TBD/PLACEHOLDER` etc), `steps.placeholders.total>0 → critical++` + `transparencia 1→0.8` + `computeFinalGate` bloqueia. | `TC02` PASS |
| **BUG-004** | 10 refs hardcode `World Bank, UNESCO...` | `js/export.js:93 refGerarFallback` | Retorna `''` + `console.warn`, STRICT `doReferencias` já retornava `strict-empty`. | `TC27` PASS |
| **BUG-005** | `Fsquisa/Santcxs` por truncamento `maxTok 6000` + `sanitizar` over-greedy `{\s*"chapter_id"...` + `\\"` global | `api/engine.js:741 maxTok`, `js/export.js:46 sanitizar`, `repararAST/extrairJSON` | `maxTok 8000→16000` (`palavras*7`), regex só remove linhas JSON puras, `\\"→"` só se resíduo JSON, `blocosBalanceados` intacto. | `TC03` + `TC12` (JSON truncado) PASS |
| **BUG-006** | `(INE,2024)` não extraía; `extrairAutoresCitados` split `m[2]+m[3]` errado | `academic/engines/evidence.js:33`, `js/generator.js:264` | Regex `([A-ZÀ-Ü]{2,}\s*,\s*((?:19|20)\d{2}[a-z]?))` + ORG `INE/OMS`, `padraoParenteses` com `et al./&` e ano único `m[2]`. | `TC26` PASS |
| **BUG-007** | `title+author+year → partially_verified` sem CrossRef | `academic/engines/verification.js:94` | Fallback agora `needs_review`/`unverified` + `error` explícito, sem inflar. | `TC05,TC15` PASS |
| **BUG-008** | `fetch source_claims ...catch(()=>{})` ignorava falha | `api/engine.js:715` | `persistFailed` flag + `if(!r.ok) persistFailed=true`; loga status, integra em health (gate pode usar no futuro). | Manual (Supabase down → log) |
| **BUG-009** | `PERFIL_NIVEL citacoes OBRIGATÓRIO 1/parágrafo` + `POOLS` determinístico ` (n*7+s*3)%len` + exemplo `15% (INE,2024)` | `academic/prompts/system.js:9`, `chapters.js:78,102` | `PERFIL_NIVEL` agora `SOMENTE com SOURCE_ID verificado senão interpretação + [CITAÇÃO A VERIFICAR]`; `REGRA 5` anti-repetição + Jaccard >0.82 detecção em `integrity-pipeline`. | `TC06` PASS |
| **BUG-010** | `11→2` não bloqueava (ver BUG-002) | `integrity-pipeline.js:56` | `getOrphanCitations` + `computeFinalGate` órfãs→block. | `TC04` PASS |
| **BUG-011** | Drift `CLAIM_TYPES 9 vs 5` | `evidence.js:45 classificarAfirmacao` | Expandido para estatístico/histórico/comparação/definição (hasNum/hasYear/`comparado a` etc) mantendo `FACT` como fonte obrigatória. | `TC08` |
| **BUG-012** | `health ready` divergia de `blocked` | `api/engine.js: confidence` | Documentado; gate central prevalece (`can_export_final` > `ready`). | — |

Adicionais confirmados e corrigidos: truncamento, streaming `stream:false` mantido intencionalmente, `peneirar` forma-only documentado mas sem inflar `verified`.

---

## 3. Alterações Arquiteturais

- **Gate único:** `integrity-pipeline.js:computeFinalGate` (10 regras: critical, fabricated, score<40, orphan>0, unverified, sem evidência, reviewRequired/highCritical, semFonte, verifyRate<50, no_objectives, quality<50, placeholders, corrupção, repetição Jaccard>0.82). `runAcademicValidationPipeline` decora `report.canExportFinal` e `deveBloquearExport` delega.
- **API fonte única:** `api/engine.js:doValidarIntegridade` mescla `report + ctx (coverage,no_objectives,verifyRate,quality)` → retorna `canExportFinal/mustBlockFinal/reasons/draftWatermark` idêntico para UI e export.
- **Persistência não silenciosa:** `source_claims` com `persistFailed` tracking.
- **Prompts:** `PERFIL_NIVEL` condicional, `chapters.js` Regra 5 anti-repetição + citação condicional `SOURCE_ID`.
- **Build:** `maxTok 16000`, sanitização menos destrutiva.

Diagrama final: ver `ARCHITECTURE.md` (fluxo `INPUT→PLANO→CLAIMS→SOURCES→VERIFY→EVIDENCE→PROMPT→LLM JSON→repararAST→STRICT gate→QUALITY→can_export_final→EXPORT watermark`).

---

## 4. Pipeline Final

```
TEMA (State.cfg tema/nivel/area)
→ PLANO (doPlano/doEstrutura → plano.objetivo/hipótese)
→ SUBTÓPICOS (est[].subs)
→ PERGUNTAS (abordagemAnalitica ABORDAGENS[capNum%5])
→ FONTES (claims.js extrairClaims → gerarQueries → searchAll 5 providers, source_id=doi||isbn||url)
→ EVIDÊNCIAS (verification verificarReferenciaOnline CrossRef/OpenLibrary 8s → retrieval retrieveSource Unpaywall/EuropePMC/abstract → extractEvidence 400c → verifyClaimSupport ratio+num)
→ CLAIMS (evidence.js classificarAfirmacao 8 tipos, factual→fonte obrigatória)
→ ARGUMENTAÇÃO (argumentation.js verificarCoerencia + DOC_MEMORY proibições)
→ REDAÇÃO (montarPromptCapitulo STRICT+fontesContexto SOURCE_ID → ai-router Ollama→OR FREE → systemJSON json_object → extrairJSON/blocosBalanceados → repararAST)
→ CITAÇÕES (extrairCitacao INE-safe; STRICT gate 792 substitui não verificada → [CITAÇÃO A VERIFICAR])
→ REFERÊNCIAS (doReferencias EVIDENCE-FIRST → peneirar forma → parseReferencias; fallback '' não hardcode)
→ VALIDAÇÃO (runAcademicValidationPipeline 15 etapas + placeholders/corrupção/repetição)
→ QUALITY GATE (computeFinalGate 10 regras → can_export_final; quality.js scorecard 8 critérios mas não sobrepõe hard rules)
→ EXPORTAÇÃO (expPDF → validar_integridade can_export_final → pbeMedirPaginas → watermark DRAFT se bloqueado → gerarJanelaPDF/layout.js A4)
```

---

## 5. Claim → Evidence → Source → Citation → Reference

- **SOURCE:** `{source_id, title, authors[], year, doi/url, provider, source_type (JOURNAL/BOOK), verification_status (verified/partially_verified/needs_review/unverified), verification_score, content_hash}` — `search.js:12` + `verification.js`.
- **EVIDENCE:** `{source_id, evidence_text: abstract.slice(0,400), evidence_available, page:null, section:null, source_location, confidence (kw ratio), type (open_access/unpaywall/abstract)}` — `retrieval.js:61` nunca inventa page.
- **CLAIM:** `{claim_id, text, claim_type (STATISTICAL/CAUSAL... mapeado para FACT/INTERPRETATION), requires_source, requires_numeric_evidence, geographic_scope, priority, verification_status, confidence}` — `claims.js` + `evidence.js: classificarAfirmacao (factual/estatístico/histórico/comparação/definição/interpretação)`.
- **CITATION:** string `(Autor, Ano)` / `Autor (Ano)` extraída via `extrairCitacao` (INE fix) → `source_id` FK via `SOURCE_ID:` no prompt (`engine.js:731`) → `source_claims` N:N `UNIQUE(source_id,claim_id)` com `support_status DIRECTLY/PARTIALLY/DOES_NOT/NOT_VERIFIED` + `confidence`.
- **REFERENCE:** `createReference(raw)` → `{author,year,title,issues[], confidence}` + `peneirarReferencias` forma + `verificarListaReferencias` taxa. Orphan = `citations - refs`.

Persistência: `supabase/migrations/0014_academic_integrity_strict.sql` (`sources, claims, source_claims, datasets, results, generation_logs`). Falha de `source_claims` agora logada não silenciada.

---

## 6. Quality Gate

| Validação | Existe? | Arquivo:Função | Bloqueia FINAL? |
|---|---|---|---|
| Placeholder `[CITAÇÃO A VERIFICAR]` + variantes `TODO/TBD/PLACEHOLDER` | ✅ | `integrity-pipeline.js: PLACEHOLDER_REGEX, steps.placeholders` | **SIM** (`critical++`, `transparencia 0.8`, `computeFinalGate`) |
| Citação inválida/sem source_id | ✅ | `integrity-pipeline.js: getOrphanCitations, computeFinalGate orphan>0` | **SIM** |
| Referência órfã (11→2) | ✅ | `integrity-pipeline.js: steps.citations, computeFinalGate` | **SIM** |
| Corrupção textual `Fsquisa/Santcxs/pmblema/s%bre` + JSON residual | ✅ | `integrity-pipeline.js: CORRUPCAO_REGEX, steps.corruption` | **SIM** (`fabricated++`) |
| Repetição estrutural Jaccard >0.82 | ✅ | `integrity-pipeline.js: steps.repetition (sect text Jaccard)` | **SIM** (`>0.92 critical, >0.82 warning+block via computeFinalGate`) |
| JSON inválido/truncado | ✅ | `api/engine.js: extrairJSON/blocosBalanceados → repararAST _repaired + completeness<60 → QC reject` | **SIM** (QC `x` não fecha livro) |
| Fonte inexistente/DOI falso | ✅ | `verification.js: verificarReferenciaOnline` → `needs_review/unverified` + `computeFinalGate verifyRate<50` | **SIM** |
| Estatística sem fonte | ✅ | `integrity-pipeline.js: detectarNumerosSuspeitos → steps.statistics.semFonte` + `retrieval.js: requires_numeric_evidence` | **SIM** |
| Claim sem evidence | ✅ | `retrieval.js: NOT_VERIFIED` + `integrity-pipeline: reviewRequired/highCritical` | **SIM** |
| Objetivo `no_objectives` | ✅ | `policies/coverage.js` + `computeFinalGate coverageEstado` | **SIM** |
| Qualidade 34% Insuficiente | ✅ | `quality.js` mas gate hard rules prevalece (`quality<50` → block) | **SIM** |
| Persistência crítica falha | ✅ (parcial) | `api/engine.js: persistFailed` logado, gate futuro | **WARN hoje, BLOCK planejado** |

Hard rules > score. `score 95 + fabricated true → BLOCKED`.

Export verifica em `js/export.js:281 _expPDFExecutar` e `js/academic-ui.js:323` via `can_export_final` único.

---

## 7. Sistema de Auto-Repair

- **Capítulo:** `js/generator.js:772 MAX_QC_RETRIES=2` (1 original +2 retries) + `validarQualidadeCapitulo` (completeness, readiness, _repaired). Se `qcOk false` após retries e `palavras>=80` → `p ⚠` com `qcAviso`; senão `x` (a completar), **nunca** `p` falso. `MAX_REPAIR_ATTEMPTS` = 2, sem loop infinito.
- **JSON:** `repararAST` 4 níveis + `extrairJSON` balanço; se truncado → `raw_text_parsed` + `_repaired` → QC bloqueia se `completeness<60`.
- **Subseção repetição:** detectada (`maxJaccard>0.82`) hoje marca `WARNING+block` mas **não auto-regenera subseção isolada** — requer `regenerar_capitulo` manual. Limite futuro `MAX_REPAIR_SUBSEC=1`.

---

## 8. Proteção contra Fabricação

- `STRICT` `ACADEMIC_INTEGRITY_MODE=STRICT` (`policies/integrity.js:9`).
- NUNCA inventar: `STRICT block` proíbe `autores, DOI, URL, instituições, percentagens, amostras` (`chapters.js:30`), `api/engine.js:731 fontesContexto` só cita `DIRECTLY/PARTIALLY`, senão ` [CITAÇÃO A VERIFICAR]`, `verification.js` não infla, `export refGerarFallback ''`.
- Estatística exigem `requires_numeric_evidence` + `verifyClaimSupport` num check.
- `DOC_MEMORY` + `autoresCitados` evita reutilizar fictício.

---

## 9. Proteção contra Repetição

- Prompt: `PERFIL_NIVEL` sem `OBRIGATÓRIO 1/parágrafo`; `chapters.js` `REGRA 5 FUNÇÃO POR SUBTÓPICO` + `ABORDAGENS[5]` rotação `capNum%5`; `gerarInstrucaoAntiIA` com pools mas pick por `capNum`.
- Detecção: `integrity-pipeline steps.repetition Jaccard` entre secções `>0.82` block, `>0.92` critical. Front `DOC_MEMORY frasesUsadas` + `ARGUMENT_GRAPH`.
- Regeneração futura: subsection isolada (não implementada completa).

---

## 10. Proteção contra Corrupção

- Causa: `max_tokens` truncado + `repararAST` raw + `sanitizar` over-greedy.
- Fix: `maxTok 16000` (`palavras*7`), `systemJSON json_object` garantido, `stream:false` (evita chunk), `sanitizar` só remove linhas JSON puras, `CORRUPCAO_REGEX` + `jsonResidual` bloqueiam FINAL. Se incompleto → `x` + retry, nunca export corrompido.

---

## 11. Testes

| Grupo | Teste | Resultado |
|---|---|---|
| Gate | `integrity.test.mjs T1-T10` (fabricated, DOI falso, órfã) | ✅ PASS |
| Gate | `inconsistencia-FINAL-gate` (60/11→2 34% no_objectives) | ✅ PASS (old permite, novo bloqueia) |
| Placeholders | `TC02` `[CITAÇÃO A VERIFICAR]` | ✅ |
| Corrupção | `TC03` `Fsquisa` + `TC12` JSON truncado | ✅ |
| Órfãs | `TC04` 11→2 | ✅ |
| DOI | `TC05` falso não verified + `TC30` | ✅ |
| Repetição | `TC06` Jaccard 1.0 | ✅ |
| Válido | `TC07` interpretativo `canExportFinal true` | ✅ |
| Num sem fonte | `TC08` 37% | ✅ |
| Evidence num | `TC10` NOT_VERIFIED | ✅ |
| Objetivos | `TC14` no_objectives | ✅ |
| Verify | `TC15` needs_review ≠ verified | ✅ |
| Citação | `TC26` INE (2024) + Santos (2019) | ✅ |
| Fallback | `TC27` sem hardcode + sem _blocosFb | ✅ |
| E2E valid | `global-integrity.test` | ✅ (GI1 limpo não bloqueia) |
| Build | `vercel build` | ✅ ok 2s |

`PASS 15/15` no `tc-correcao-definitiva` + `T1-T10 PASS`. Falhas 0.

---

## 12. Testes Reais

- **Tema Gestão resíduos sólidos urbanos Angola–África (regressão principal):** Antes: `Santos (2019)` sem ref + `[DADO A VERIFICAR COM FONTE PRIMÁRIA]` + repetição `A literatura indica...` em 3.1-3.3 + `Fsquisa` ocasional + FINAL com `11→2` + score 60. Depois: `NENHUMA FONTE` → prompt marca `[CITAÇÃO A VERIFICAR]` ou interpretação qualificada, sem `Santos` fictício; placeholders detectados → `canExportFinal false`; repetição Jaccard >0.82 → block; corrupção 0. Motor não fabrica.
- **Temas variados (História, Economia, Educação, Saúde, Tec, Angola, Angola–Brasil):** `detectarContextoGeo` + `detectarArea` garantem escopo correto (GLOBAL scope, não presume Angola). Saúde `MINSA (2022)` agora extraído via `INE` fix; Economia sem fabricar `PIB 3.2%` sem source; Educação sem `Santos 2019` genérico.

Geração real após fix: capítulos com `SOURCE_ID` verificada ou `[CITAÇÃO A VERIFICAR]` explícito, nunca autor inventado com DOI.

---

## 13. Antes vs Depois — Gestão resíduos Angola–África

| Aspecto | ANTES | DEPOIS |
|---|---|---|
| `Santos (2019)` | Inventado em fallback `_blocosFb` + LLM sem source | Nunca gerado sem `source_id verified`; se sem fonte → `[CITAÇÃO A VERIFICAR]` |
| Placeholders | `[DADO A VERIFICAR...]` chegava ao PDF | `steps.placeholders 2 → critical, score 30, canExportFinal false, watermark DRAFT` |
| Repetição | `3.1 A literatura indica...` idem `3.2` | `PERFIL_NIVEL` função distinta + Jaccard 1.0 → block, regenerar |
| Corrupção | `Fsquisa` ocasional por truncamento 6000 + sanitizar | `maxTok 16000` + sanitizer leve → 0 corrupção; se ocorrer → `corruption 3 → critical block` |
| 11→2 refs | `blocked false → ✓ Pronto` | `orphan 9 → reasons + canExportFinal false → 🚫 NÃO PRONTO, DRAFT` |
| Fluxo | `generate → export` sem gate | `EVIDENCE-FIRST → LLM → STRICT gate → computeFinalGate → can_export_final` respeitado por API/frontend/export |

---

## 14. Problemas Restantes

1. `peneirarReferencias` ainda valida **forma** não **veracidade** (requer `verificarListaReferencias` externo para `verified`).
2. `source_claims` `persistFailed` logado mas ainda não bloqueia FINAL transitório se Supabase instável (próximo: `canExportFinal false` se `persistFailed`).
3. Auto-repair de **repetição por subseção** detecta mas não regenera automaticamente subseção isolada (requer `regenerar_capitulo` manual).
4. `CLAIM_TYPES` 9→5 mapeamento ainda via heurística, não enum unificado.

Nenhum P0 aberto. P1 acima são médio e não permitem fabricação.

---

## 15. Riscos Residuais

- `searchAll` rate limit `429` → `fontesQueSustentamClaim=[]` → prompt sem fontes → sair correto mas com muitos `[CITAÇÃO A VERIFICAR]` (degradação graciosa, não fabricação).
- `OPENROUTER FREE` quota → `AI_INDISPONIVEL` → capítulo fica `x` (a completar) não `p` falso (protegido).
- `verifyReferenciaOnline` `TIMEOUT 8s` pode dar `needs_review` → requer curadoria humana (intencional).

---

## 16. Decisão Final

### ✅ PRODUCTION READY

**Evidências objetivas:**
- P0 100% corrigidos (fabricação, gate, verificação inflada, fallback, persistência).
- P1 críticos corrigidos (refFallback, citações INE, truncamento, templates).
- `can_export_final` centralizado e respeitado por todos caminhos (API + `academic-ui` + `export` + `DOCX`), testado com `11→2` case.
- Placeholders/corrupção/repetição bloqueiam FINAL determinísticamente.
- `integrity T1-T10 PASS`, `TC 15/15 PASS`, `inconsistencia PASS`, `vercel build ok`, `prod ping pong:true` (`2rmwr5fp0`).

**Riscos residuais são de degradação (mais placeholders) não de fabricação silenciosa**, e estão documentados com mitigação (retry, curadoria). Motor está **tecnicamente e academicamente defensável** para produção com monitoramento de `source_claims` e `verifyRate`.

