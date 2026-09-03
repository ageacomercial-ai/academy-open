# AUDIT REPORT — ACADEMY Gerador Acadêmico

**Data:** 2025-09-01  
**Versão:** academy-v116 (7.8.0)  
**Stack:** Vanilla JS SPA (sem build) + Vercel Serverless (Node 20) + Supabase (Postgres + RLS) + OpenRouter/Groq (LLM)  
**Missão:** Transformar gerador LLM-only em sistema de investigação verificável

---

## 1. Arquitetura Atual

### 1.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (SPA) — index.html + js/* + css/* + icons/*           │
│  js/state.js (fonte única de verdade, LS acy_* + State global)  │
│  js/navigation.js (router 18 ecrãs, aBarra, autoGuardar)         │
│  js/generator.js (loop geração capítulos, DOC_MEMORY, QC gates)  │
│  js/layout.js (motor tipográfico A4, 6 temas, paginação)         │
│  js/pbe.js (Page Budget Engine, 262 palavras/pág, resumir)       │
│  js/export.js (PDF via html2canvas+jsPDF, DOCX via JSZip)        │
│  academic/prompts/* (system, chapters, references, structure)    │
│  academic/engines/* + schemas/* + policies/* (quality, coverage) │
└────────────────────────┬────────────────────────────────────────┘
                         │ POST /api/engine {action, payload}
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND — api/engine.js (handler único, ~1300 linhas)          │
│  api/ai-router.js (openai_direct → groq → openrouter :free)     │
│  academic/index.js (barrel compartilhado frontend/backend)       │
│  server.js (Express dev) / Vercel serverless prod               │
└────────────────────────┬────────────────────────────────────────┘
                         │ Supabase REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE — 16 tabelas (ver §1.3) — RLS anon (parcial)          │
│  LS localStorage (docs, sb_uid, acy_*) como cache primário      │
└─────────────────────────────────────────────────────────────────┘
```

**CDNs:** `jszip`, `jspdf`, `html2canvas`, `html2pdf`, `chart.js`, Google Fonts.

**Deploy:** `vercel.json` → `rewrites /api/(.*) → /api/engine`, `headers /sw.js: no-cache`, `maxDuration 300s` engine.

### 1.2 Frontend

| Módulo | Papel no fluxo |
|--------|----------------|
| `js/state.js` | `State {u, ecra, cfg{tema, tipo, nivel, pags, numCaps, mbs[], refStyle, estruturaProf, mediaItems[]}, plano, est, secs[], qual}`. `nPags()` usa `palavras/320` (diverge do PBE 262). |
| `js/screens-flow.js` | 9 ecrãs: `sEntrada → sInicio → sTipo → sTema → sNivel → sIdentidade → sPreviewGen → sPlano → sEst → sGeracao` (motor espelhado) + `sEditor` (editor.js). |
| `js/generator.js` | `callAcademyAPI` (único fetch), `DOC_MEMORY` (extrai autores 3 regex), `verificarQualidadeAcademica` (10 checks), `iniciarGer` loop capítulos, `aBarra` monotónica. Fallback local autônomo se 503. |
| `js/layout.js` | `PDF 794×1123, LINE_MODEL 24px/68chars`, `docEstruturarSemantico` (sanitiza, extrai citações, auto-detecta `12.3%` → `data_table`), `preRenderPipeline` (agrupar→constraint→fixOrphans), `montarDocumentoPDF` (capa + TOC real + pgs + anexos). |
| `js/pbe.js` | `pbePalavrasPorPagina≈262`, `pbePlanear` (pesos refs 0.55), `pbeResumir` (corta frases), `pbeExpandir` (desativado pós-v114). |
| `js/export.js` | `sanitizarConteudo`, `refDetectar/Validar` (regex APA), `refGerarFallback` (10 refs fictícias hard-coded), `expPDF`→`gerarJanelaPDF` (html2canvas scale 2-2.4), `expDocx` (JSZip). |
| `js/academic-ui.js` | `analisarDocumento` → `analisar_documento` (orquestra claims/integrity/coverage/scorecard), `verificarReferencias` (CrossRef opcional). |
| `js/chat.js` | `chat` + Documento Vivo (`editar_bloco`, `editar_documento_completo`) + STT/TTS. |
| `academic/prompts` | `system.js` (PERFIL_NIVEL/AREA, POOLS_ANTI_IA 20 regras), `chapters.js` (ABORDAGENS 5, REGRAS 1-4 citações/dados), `references.js` (numRefs=pags*0.6), `structure.js`. |
| `academic/engines` | `evidence.js` (extrairAfirmacoes), `verification.js` (único com fetch real CrossRef/OpenLibrary), `quality.js`, `argumentation.js`, `versioning.js`. |
| `academic/policies` | `integrity.js` (draft→blocked), `coverage.js` (objetivos↔capítulos), `confidence-policy.js` (FACT→severity). |

### 1.3 Banco de Dados (Supabase)

**Schema base (`supabase-schema.sql`) + 13 migrations:**

- `utilizadores(id TEXT PK, nome, email, whatsapp)` — RLS `anon_insert/select/update true`
- `pagamentos(id UUID, utilizador_id, tipo, num_pags, valor, estado)` — migration 0001 corrige `anon_insert CHECK estado='pendente'` (previne auto-aprovação)
- `documentos(id UUID, uid, doc_id UNIQUE(uid,doc_id), titulo, dados JSONB)` — doc completo serializado
- `academy_ai_logs`, `academy_history`, `avaliacoes(uid, nota 1-5, tags[])` — RLS anon
- `instituicoes, parceiros, comissoes, precos, planos_grafica, planos_utilizadores, senhas_usadas, webhook_logs, transacoes, intervencoes_admin, audit_log` — resto só `service_role`

**Auth:** `sbUserId()` = `LS sb_uid` (`U<ts><rand>`), sem Supabase Auth/JWT. Admin = `ADMIN_PIN` env.

**Cache:** `Map` memória em `ai-router.js` (5min free list, 2min cooldown), `localStorage acy_*` (docs, qual, plano). Sem Redis.

---

## 2. Fluxo Atual de Geração

```
1. sTema/sNivel/sIdentidade → State.cfg
2. gerarPlano() → POST plano_academico (montarPromptPlano) → State.plano {objetivo, hipotese, metodologia}
3. gerarEst() → POST estrutura_academica (montarPromptEstrutura + estruturaPadrao 8 caps) → State.est [{num,titulo,subs}]
4. btnGerarFinalClick → verificarAntesDeGerar → iniciarGer(loop):
   a. pbePlanear(est, totalPags) → palavrasPorCap, wordBudget
   b. Para cada cap i:
      - aSecDOM 'g', callAcademyAPI gerar_capitulo (capSubs + palavrasPorCap + memoriaDocumento)
        → retry 4× (backoff 4-20s) + QC gate 2× (validarQualidadeCapitulo)
      - Se falhar 4× e generic (503) → fallback local ~450 palavras com [CITAÇÃO A VERIFICAR] (autônomo)
      - Se QC fraco mas ≥80 palavras → entrega como 'p' com aviso (v114)
      - Senão 'x' (só se vazio)
      - astParaTexto → secs[i].c, DOC_MEMORY.registar, genGuardarProgresso
   c. pbeValidarEAjustar (só resumir, não expandir via IA desde v114) — calibrar ±2%
   d. verificarQualidadeAcademica + regenerarReferenciasCorretas (envia autoresCitados)
   e. validarIntegridadeLivro (todos 'p') → State.genFim=true, qual, addDoc, sbSalvarDoc
5. sGeracao motor espelhado (live title/excerpt + página reflexo + barra monotónica) → sEditor
6. export: refGateExportacao (≥8 refs) → _expPDFExecutar (ajuste ratio) → gerarJanelaPDF (html2canvas → jsPDF, overlay espelhado) / expDocx (JSZip)
```

**Onde cada artefato é criado:**
- **Planejamento:** `api/engine.js:doPlano/doEstrutura` (LLM)
- **Fontes:** **Nenhuma busca prévia** — LLM alucina citações inline `(Autor, Ano)` (chapters.js REGRA 1)
- **Conteúdo:** `doCapitulo` (LLM JSON AST)
- **Citações:** `chapters.js` exige 1-2/parágrafo + `DOC_MEMORY.extrairAutoresCitados` (3 regex)
- **Referências:** `doReferencias` (LLM gera `numRefs` entradas APA `Apelido (Ano). Título...` sem consulta) → `peneirarReferencias` (regex) → auditoria cruza `refsFaltantes`
- **Resultados/Tabelas:** `layout.js:extrairDadosNumericos` regex `Label: 12.3%` → `gerarBlocoGrafico` cria `data_table` sem fonte; `mea_grafico` (LLM) gera `Chart.js` fictício
- **PDF/DOCX:** `layout.js:montarDocumentoPDF` + `export.js:expPDF/expDocx`

---

## 3. Pontos de Risco — Análise Crítica

### 3.1 Fontes podem ser inventadas

| Local | Risco | Severidade |
|-------|-------|------------|
| `academic/prompts/chapters.js:60-68` REGRA 1 | `NUNCA inventes nome+ano sem Bibliografia` é **instrução textual** sem enforcement; LLM inventa `Silva (2020)` para cumprir `OBRIGATÓRIO ≥2 citações/parágrafo` (system.js:14, chapters.js:68) | **CRÍTICA** |
| `academic/prompts/references.js:31` | `gera exactamente ${numRefs} referências reais e plausíveis` — eufemismo para alucinação; `real e plausível` sem verificação é fonte de 10-18 refs fictícias por trabalho | **CRÍTICA** |
| `academic/engines/verification.js` | **Único verificador real** (CrossRef/OpenLibrary, score 0.7) é **opcional** (`verificar_referencias` só se frontend chama), não gateia geração | **ALTA** |
| `js/generator.js:862` fallback local | Gera `Sobre "tema" — Segundo Silva (2020)... [CITAÇÃO A VERIFICAR]` — placeholder pedagógico mas entrega como `p` com aviso, sem bloquear export | MÉDIA |
| `js/export.js:93` `refGerarFallback` | 10 refs hard-coded fictícias (`Graça, A. (2020)... Edições Maianga`) usadas se LLM falhar — marca como real | **ALTA** |

### 3.2 Dados podem ser inventados

| Local | Risco |
|-------|-------|
| `chapters.js:95` + `system.js:214` | `Cada parágrafo: 3-5 frases, com dados concretos (%, anos)` + `Inclui ≥1 dado quantitativo por subtópico` **força** invenção |
| `chapters.js:70-75` REGRA 2 | `NUNCA fabricar %/toneladas sem fonte → usa estima-se...[DADO A VERIFICAR]` **conflita** com obrigação acima; LLM cumpre obrigação e ignora proibição |
| `layout.js:218-258` | `extrairDadosNumericos` extrai `12.3%` alucinado e `gerarBlocoGrafico` cria tabela `Dados Estatísticos` oficializando número sem fonte |
| `api/engine.js:doMEA` + `js/editor.js` mediaItems | `mea_grafico/tabela` gera `{label,valor}` fictício via LLM sem dataset |
| `js/generator.js:392` | Conta `12%` mas não verifica origem — `unsupported_statistic` nunca é marcado |
| `export.js`/`pbe.js` | Nenhuma validação de dataset hash/origem |

**Exemplo fabricável:** Pedido `Faça pesquisa com 100 pessoas` hoje gera `63% responderam X` sem dataset — viola §8 Missão.

### 3.3 Citações sem referência

- **Causa:** `DOC_MEMORY` extrai `(Autor, Ano)` via 3 regex e envia `autoresCitados` para `doReferencias`, mas `peneirarReferencias` valida **forma** `Apelido (Ano).` não **correspondência**. Se LLM cita `Mabiala (2019)` no cap 2 mas `montarPromptReferencias` gera outra lista (ex: `Smith (2021)`), `verificarQualidadeAcademica` detecta `refsFaltantes` e tenta `regenerarReferenciasCorretas` (1 retry), mas se falhar, trabalho exporta com **citações órfãs**.
- **Detecção:** `js/generator.js:408-453` cruza regex APA; `academic/policies/coverage.js` não cobre citações.
- **Não bloqueia:** `validarIntegridadeLivro` só checa `e==='p'`, não `refsFaltantes`; PDF exporta mesmo com órfãs.

### 3.4 Referências sem citação

- **Causa:** `doReferencias` gera `numRefs = pags*0.6` independente das citações reais; `peneirarReferencias` mantém todas `validas`; `verificarQualidadeAcademica` avisa `refsNaoUsadas>2` mas não erro.
- **ABNT/APA:** `academic/schemas/reference.schema.js` separa `createReference` (metadata) de renderer, mas LLM gera texto já formatado, não metadados → renderer não é usado.
- **Risco:** Bibliografia inchada para cumprir `refs_min 8-15` sem leitura real.

### 3.5 Concorrência / Cache

- **Rate limit:** `api/engine.js` `Map 25 req/min/IP` em memória — perde-se a cada cold start Vercel, não é distribuído. `ai-router` cache `Map` idem, cooldown 2min por provedor.
- **Geração concorrente:** `localStorage` + `sbSalvarDoc` sem lock; `genGuardarProgresso` sobrescreve `acy_gen_prog` a cada capítulo — 2 tabs gerando mesmo `uid` causam race (último vence). `documentos UNIQUE(uid,doc_id)` com `on_conflict merge-duplicates` mitiga parcialmente.
- **PWA cache:** `sw.js CACHE academy-v116` cache-first para assets, network-first para `/api/*` — mas `index.html` sem `no-cache` (vercel.json só `/sw.js`) pode servir HTML velho.

### 3.6 Segurança

- **RLS parcial:** `pagamentos` corrigido (0001), mas `utilizadores/documentos/avaliacoes` `USING true` — qualquer anon pode ler/escrever docs de outro `uid` se souber `uid` (adivinhável `U<ts><rand>`). Sem row-level por `auth.uid()`.
- **PIN admin:** `ADMIN_PIN` env em plaintext, comparado `===` em `doVerificarAdmin` sem rate limit específico, sem hash, sem 2FA.
- **Chave anon exposta:** `SB_KEY` no frontend é esperado (anon), mas `SUPABASE_SERVICE_KEY` nunca vai ao frontend (ok).
- **Sem validação de upload:** `js/editor.js` `mediaItems` aceita `src` data URI sem sanitização de tamanho/tipo.
- **Logs sensíveis:** `console.log[TELEMETRIA]` com `tema` pode vazar PII para Vercel logs.
- **HMAC webhook Vanqir:** `server.js` verifica `rawBody` com `VANQIR_HOTTOK`, ok, mas sem replay protection.

---

## 4. Alterações Recomendadas (Missão STRICT)

### 4.1 Princípio Arquitetural

**ACADEMIC_INTEGRITY_MODE = STRICT** — `ia-router` gera `REASONING+WRITING`, sistema gera `VERIFICATION+TRACEABILITY`.

### 4.2 Entidades Novas (Supabase)

```sql
-- Fontes verificáveis
sources(id UUID PK, title TEXT, authors TEXT[], year INT, publisher TEXT,
  journal TEXT, doi TEXT UNIQUE, url TEXT, source_type ENUM, verification_status ENUM,
  verification_score FLOAT, raw_metadata JSONB, content_hash TEXT, retrieved_at TIMESTAMPTZ)

-- Reivindicações
claims(id UUID PK, doc_id UUID FK, text TEXT, claim_type ENUM, source_type ENUM,
  source_id UUID FK, verification_status ENUM, confidence FLOAT, evidence TEXT, created_at)

-- Ligação fonte↔claim
source_claims(id UUID PK, source_id FK, claim_id FK, support_status ENUM, evidence_text TEXT, confidence FLOAT)

-- Datasets
datasets(id UUID PK, name TEXT, origin ENUM, row_count INT, hash TEXT, status ENUM)
dataset_rows(id UUID PK, dataset_id FK, data JSONB)

-- Resultados rastreáveis
results(id UUID PK, claim_id FK, dataset_id FK, type TEXT, value TEXT, unit TEXT, calculation TEXT, verification_status ENUM)
```

### 4.3 Pipeline Obrigatório

`SEARCH → RETRIEVE → VERIFY → STORE → CITE` antes de escrever. `VERIFIED` só com `DOI+CrossRef score ≥0.7` ou `OpenLibrary ISBN` ou `gov/INE` fetch.

Dois níveis: `SOURCE_EXISTENCE` vs `CLAIM_SUPPORT` (DIRECTLY/PARTIALLY/DOES_NOT_SUPPORT).

### 4.4 Validador Final (ACADEMIC_VALIDATION_PIPELINE)

15 etapas: citations→references→claims→statistics→datasets→methodology→results→tables→figures→bibliography→unsupported→fabricatedRefs→fabricatedData→mismatch→report. Se `CRITICAL` → `DRAFT — REQUIRES VERIFICATION` no PDF, bloqueio `FINAL/VERIFIED`, score 0-39 `NÃO PUBLICÁVEL`.

### 4.5 Implementação Mínima Viável (sem reescrever tudo)

1. **Feature flag** `ACADEMIC_INTEGRITY_MODE=STRICT` em `academic/policies/integrity.js`
2. **ReferenceVerifier** (`verifyReference/resolveDOI/compareMetadata`) já existe em `verification.js` — torná-lo **gate** em `doCapitulo/doReferencias` (rejeitar `confidence<0.4`)
3. **Números** → `unsupported_statistic` detector regex `\d+[.,]?\d*\s*(%|toneladas|habitantes)` antes de citar; se sem `source_id` → marcar `[DADO NÃO VERIFICADO]` e não renderizar como fato
4. **Empíricos** → distinguir `A) PROJETO` (gera questionário) vs `C) DADOS REAIS` (só se `datasets.row_count ≥ n`); bloquear `B) FABRICAÇÃO`
5. **Tabelas/Gráficos** → exigir `dataset_id` ou `source_id` em `htmlMediaItem`/`gerarBlocoGrafico`
6. **Score** → `integrityScore = (fontesVerificadas*0.3 + claimsSustentados*0.3 + rastreáveis*0.2 + metodologia*0.1 + transparência*0.1) * (1 - fabricados*0.5)`

---

## 5. Conclusão

Arquitetura atual é **LLM-only com prompts tentando mitigar alucinação via texto**, sem verificação estruturada, sem armazenamento de fontes, com conflitos normativos que forçam invenção para cumprir métricas de qualidade (citação/parágrafo, dado/subtópico, 8-15 refs). Verificação real existe (CrossRef) mas é opcional. Alteração recomendada é **tornar verificação obrigatória, separar tipos de conhecimento, criar tabelas de fontes/claims/datasets e bloquear exportação FINAL quando integridade <60**, mantendo stack existente (Supabase + Vercel) sem reescrever SPA.

**Próximo passo:** Implementar fase 1 (flag STRICT + gates + tabelas) e depois testes T1-T10.
