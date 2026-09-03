# EBOOK CREATOR — AUDITORIA COMPLETA

> **Projeto auditado:** `C:/Users/EXMO PRINS/Desktop/academy` (cópia ACADEMY v7.8.0 / academy-v81)  
> **Data:** 2026-09-02  
> **Destino:** `academy-livro/` (atualmente vazio — cópia ainda não efetuada)  
> **Auditor:** OpenCode · Muse Spark  
> **Regra:** Auditar antes de alterar. Nenhuma modificação destrutiva foi executada.

---

## 1. Arquitetura atual

### 1.1 Visão geral
```
ACADEMY v7.8.0
├── Frontend: SPA vanilla JS (sem framework, sem build, sem bundler)
│   ├── index.html (331 linhas) — shell + splash + PWA banners + <script> ordenados
│   ├── js/  (20 ficheiros, ~15-20k linhas)
│   ├── css/ (3 ficheiros: base.css, layout.css, components.css)
│   ├── icons/ + manifest.json + sw.js (PWA)
│   └── libs CDN: jszip, jspdf, html2canvas, html2pdf.js, chart.js
│
├── Backend: Node 20+ Express (server.js) + Vercel Functions
│   ├── api/engine.js   — handler único POST /api/engine (switch action)
│   ├── api/ai-router.js — AI Router (ollama → openrouter → groq)
│   ├── api/webhooks.js — Vanqir HMAC
│   ├── api/health.js
│   └── vercel.json (rewrites, maxDuration 300s)
│
├── academic/ (domínio académico blindado)
│   ├── engines/ (11 ficheiros)
│   ├── prompts/ (6 ficheiros)
│   ├── policies/ (4 ficheiros)
│   ├── schemas/ (4 ficheiros)
│   └── index.js barrel
│
├── Supabase (REST, sem SDK)
│   ├── supabase-schema.sql (130 linhas)
│   └── supabase/migrations (0001 … 0016)
│
├── Estado: localStorage prefixado `acy_` + State singleton (state.js)
├── Autenticação: pseudo-auth local (nome/email/whatsapp) + sbUserId()
└── Infra: Vercel + Supabase (avdzkucdehggueafyukw)
```

### 1.2 Frontend
- **Stack:** HTML5 + CSS3 variáveis + JS ES2020 vanilla. Zero framework (React/Vue/Svelte inexistentes). Zero TypeScript. Zero bundler (Vite/Webpack inexistentes). Carregamento por `<script>` ordenado manualmente no `index.html:258-276`.
- **Roteamento:** `navigation.js` — objeto `CFG_ECRAS` + `irPara(ecra)` + `renderizar()` que injeta HTML string no `.ecra`. Sidebar + bottom nav + topbar renderizados manualmente.
- **Estado:** `state.js:17-118` — singleton `State` com `_estado` mutável (cfg, plano, est, secs, qual, capa, lingua, etc.) + `LS` wrapper sobre `localStorage` prefixado `acy_`. Sem Redux/Zustand.
- **UI System:** Tokens CSS em `css/base.css:10-152` (z0-z5, b/o, t1-t4, e0-e2, shadows, blur). Light/dark via `[data-tema]`. Mobile-first definido, mas desktop sidebar acoplado.
- **PWA:** `manifest.json`, `sw.js`, `js/pwa.js`, splash cinematográfica (`#pwa-splash`), banners install/offline/update, cache vercel headers `no-cache` para sw.js.

### 1.3 Backend
- **server.js (96 linhas):** Express, `express.json` com `verify` para preservar `rawBody` (HMAC Vanqir), importa handlers `api/engine.js` e `api/webhooks.js` por `await import`, static frontend + SPA fallback.
- **api/engine.js (~1200 linhas):** Handler único `export default async function handler(req,res)` com `switch(action)` — 25+ actions (`ping`, `chat`, `gerar_capitulo`, `plano_academico`, `estrutura_academica`, `gerar_referencias`, `validar_integridade`, `save_history`, `criar_versao`, `__health`, etc.). CORS aberto `*`. Rate limit em memória `Map` (25 req/min por IP). Envelopes `{ok,data:{resposta}}`.
- **api/ai-router.js (596 linhas):** Abstração já existente! `CFG` com openrouterKey, groq, ollama. Providers: `ollama`, `openrouter` (só FREE), `existing_free_api` (Groq), `openaiDirect` (gpt-4o-mini via OR). Ordem forçada `openai_direct → existing_free_api → openrouter`. Cache de disponibilidade, cooldown 2min após 2 falhas, `generate(messages,opts)` com retry hierárquico, `health()`. `COST_MAP` e `estimateCost`. `modelForTier(cheap/balanced/strong)`. **Base excelente para reaproveitar** no Ebook Creator.
- **api/webhooks.js:** Validação HMAC Vanqir (via `rawBody`), atualização `pagamentos` no Supabase.
- **api/health.js:** Health do backend + Supabase + tabelas.
- **vercel.json:** `framework:null`, `buildCommand:null`, `maxDuration 300s` engine, rewrites `/api/(.*) → /api/engine`, `on_conflict` handling.

### 1.4 Banco de dados
- **Supabase** `https://avdzkucdehggueafyukw.supabase.co` — acesso via REST fetch manual (`js/supabase.js:23-27` headers `apikey` + `Authorization: Bearer ANON_KEY`). Chave anon embutida no JS (fragmentada em 3 partes para ofuscar). `service_role` só no backend.
- **Tabelas (supabase-schema.sql + 16 migrations):**
  - `utilizadores` (id TEXT PK, nome, email, whatsapp, nivel)
  - `pagamentos` (utilizador_id, tipo, plano, num_pags, valor, estado pendente/aprovado/rejeitado/processado, metodo, comprovativo)
  - `documentos` (uid, doc_id UNIQUE(uid,doc_id), titulo, tipo, pags, plano, dados JSONB)
  - `academy_ai_logs` (action, model, tokens, duration, success, user_id, pages_requested)
  - `academy_history` (user_id, tipo, tema, pags, metadata)
  - `avaliacoes` (uid, doc_id, nota 1-5, comentario, tags)
  - Migrações adicionais: `webhook_logs`, `transacoes`, `precos_planos_grafica`, `planos_utilizadores`, `senhas_usadas`, `pagamentos_vanqir`, `intervencoes_admin`, `producao_fundacao`, `seed_oficial`, `pagamentos_metodo`, `rpc_telefone_normalizado`, `grants_anon`, `academic_integrity_strict`, `jobs`, `jobs_evidence_first`
- **RLS:** Policies `anon_insert/select/update` com `USING true / WITH CHECK true` — permissivo (anti-segurança; ver §6).
- **Storage:** Nenhum bucket Supabase Storage usado; imagens/logos em base64 no localStorage (`State.capa.imagem`).

### 1.5 Autenticação & Sessão
- Sem Supabase Auth. `js/auth.js` + `navigation.js:fazerEntrada()` valida nome (≥2 palavras), email opcional, whatsapp opcional. `LS.set('u',u)` + `LS.set('sb_uid',id)` (`U`+timestamp+random). `sbUpsertUser()` faz `POST /rest/v1/utilizadores? Prefer=merge-duplicates`. Sidebar/BottomNav só após login. Admin via PIN 7 toques no logo → `_abrirAdminAuth()` → verifica `POST /api/engine {action:verificar_admin,pin}` contra `process.env.ADMIN_PIN`.

### 1.6 Armazenamento
- Primary: `localStorage` prefixado `acy_` — `u`, `sb_uid`, `docs` (array até 30), `tema`, `lingua`, `gen_prog`, `rascunho_pendente`. Documentos serializados completos (`cfg, secs, plano, est, qual`) em `LS.list('docs')`. Sync assíncrono para Supabase `sbSalvarDoc()` (5 recentes) + `sbSincronizarDocs()`.
- Sem IndexedDB, sem Supabase Storage, sem S3.

### 1.7 IA
- **Providers:** OpenRouter (modelos :free + `openai/gpt-4o-mini` pago barato $0.15/1M), Groq (`llama-3.3-70b-versatile`), Ollama local (`qwen2.5:1.5b`). Hierarquia no `ai-router.js`.
- **Abstração:** `ai-router.js` já é o `AI Provider → OpenRouter → Model Router` pedido. `generate()` + `health()` + `ordemProviders()` + `modelForTier()`.
- **Prompts:** `academic/prompts/` — `system.js` (anti-detecção IA), `chapters.js` (montarPromptCapitulo), `references.js`, `structure.js`, `editing.js`, `evaluation.js`. Centralizados, não espalhados.
- **Motores:** `academic/engines/` — `search.js`, `retrieval.js`, `verification.js`, `claims.js`, `evidence.js`, `diagnostic.js`, `argumentation.js`, `quality.js`, `references.js`, `integrity-pipeline.js`, `versioning.js`. Evidence-first pipeline completo.
- **Telemetria:** `registarTelemetria()` → `academy_ai_logs`, custo estimado, tokens.

### 1.8 Geração de documentos
- `js/generator.js` (~1400 linhas) — loop `iniciarGer(retomar)` por capítulo, `callAcademyAPI({action,payload})` envelope, `DOC_MEMORY` + `ARGUMENT_GRAPH`, `quality gate` por capítulo (health/readiness/confidence/completeness), `pbe.js` budget, `verificarQualidadeAcademica()` + `regenerarReferenciasCorretas()`, `genGuardarProgresso()` em LS, retries até 4 tentativas + 2 QC passes.
- `js/pbe.js` (377 linhas) — Page Budget Engine: `pbePlanear()`, `pbePalavrasPorPagina()`, `pbeMedirPaginas()`, `pbeResumir()`, `pbeExpandir()`, `pbeValidarEAjustar()` com tolerância ±2%.
- `js/layout.js` (~1500 linhas) — Motor PDF blindado: `PDF` constante A4 210×297mm @96dpi, 6 temas (Safira/Esmeralda/Rubi/Obsidiana/Bronze/Ametista), `LINE_MODEL` (24px/linha, 68 chars), `docEstruturarSemantico()`, `preRenderPipeline()` (agrupar → constraint → orphans → validate), TOC real, `gerarJanelaPDF()` via `html2pdf.js`. CSS PDF inline (`cssPDF()`).
- `js/export.js` (696 linhas) — Sanitização, gate APA (min 8 refs), `expPDF()`, `expDocx()` via JSZip, `expWord()` legacy, integridade STRICT gate antes de FINAL.

### 1.9 APIs & Infraestrutura
- Endpoints: `POST /api/engine` (único), `POST /api/webhooks/payment` (HMAC), `GET /api/health`, `GET /health`, `GET /ai/health`. Rewrites Vercel cobrem tudo.
- Rate limit: 25 req/min por IP, cooldown providers 2min.
- Timeouts: `AI_TIMEOUT_MS 90000`, `AI_TIMEOUT_OLLAMA_MS 60000`, `AbortController 300s` no frontend.
- Sem queue/jobs persistido além de tabela `jobs` (migrations 0015/0016).
- Env vars em `.env` (não commitado) + `.env.example` com PLACEHOLDERS.

---

## 2. Funcionalidades existentes

| Funcionalidade | Estado | Reutilizar? | Alterar? | Remover? | Notas |
|---|---|---|---|---|---|
| **Auth pseudo-local (nome/email/wa)** | Funcional | ✅ Adaptar | Renomear `u` → `user`, normalizar para `users` | — | Manter offline-first mas preparar Supabase Auth futura |
| **Dashboard / Início (sInicio)** | Funcional | ✅ Reutilizar | Trocar cards TFC/Mono → templates Ebook | — | `screens-flow.js:sInicio` |
| **Wizard 4 passos (tipo → tema → nivel → identidade)** | Funcional | ✅ Adaptar | Transformar em **Briefing** ebook (título, tema, público, tom, idioma, páginas, autor, categoria, estilo visual) | — | `navigation.js:CFG_ECRAS` |
| **plano_academico (IA)** | Funcional | 🔄 Alterar | → `outline_brief` / `ebook_brief`? Avaliar se necessário | Remover se Ebook não precisar de plano metodológico | `academic/prompts/structure.js` |
| **estrutura_academica (IA)** | Funcional | ✅ Reutilizar | → `Outline Generator` (capítulos/seções). Já entrega `est[]` editável | Renomear actions | `generator.js:gerarEst` |
| **Geração por capítulo (AST + quality gate)** | Funcional | ✅ Reutilizar | Adaptar prompts para Ebook (tom, não académico) | Remover citações APA obrigatórias | `generator.js:iniciarGer` |
| **Editor (contenteditable + blocos)** | Funcional | ✅ Reutilizar | Estender: capa, layouts, imagens opcionais, tabelas, checklists | Remover sanitização APA | `editor.js` + `doc-blocks.js` |
| **Blocos (doc-blocks.js)** | Funcional | ✅ Reutilizar | Adicionar tipos ebook: `quote`, `checklist`, `steps`, `timeline`, `statistics`, `comparison`, `key_takeaway`, `exercise` | — | Base sólida |
| **History / Undo** | Parcial | ✅ Reutilizar | Integrar com `blocks.history[]` | — | `doc-history.js` |
| **AI Editor (melhorar/expandir/regen)** | Funcional | ✅ Reutilizar | Adicionar ações: reescrever, resumir, simplificar, alterar tom, transformar em lista/checklist | Generalizar `editar_texto` subacoes | `editor.js:melhorarSec/expandirSec` + `academic/prompts/editing.js` |
| **Chat IA (ACADEMY IA)** | Funcional | ✅ Adaptar | → **Ebook Assistant**; manter `chat.js` + `montarPromptChat`; trocar shortcuts | Remover “hipóteses investigação” | `chat.js` + `engine:chat` |
| **DOC Memory + Argument Graph** | Funcional | ✅ Adaptar | Simplificar para `EbookMemory` (evitar repetição, coerência) | Remover extração autores APA | `generator.js:DOC_MEMORY` |
| **Qualidade académica (verificarQualidadeAcademica)** | Funcional | 🔄 Alterar | → **Content QA** ebook (capítulos vazios, repetições, títulos) | Remover validações metodologia/objetivos | `generator.js:338-509` |
| **Design / Temas PDF (6 paletas)** | Funcional | ✅ Reutilizar | Estender para 10 temas ebook (Modern, Minimal, Business, etc.) + `Design Engine` + `layouts` | Renomear `TEMAS` | `layout.js:TEMAS` |
| **PBE (Page Budget Engine)** | Funcional | ✅ Reutilizar | Manter como orçamentador páginas ebook | — | `pbe.js` |
| **Layout Engine (A4 constraints, TOC real, widow/orphan)** | Funcional | ✅ Reutilizar | Generalizar para layouts ebook (`cover`, `chapter_intro`, `quote`, etc.) | Remover margens A4 fixas se ebook usar outro formato | `layout.js` |
| **Export PDF (layout.js)** | Funcional | ✅ Reutilizar | Endurecer QA (overflow, clipping) + nova `Export Engine` | — | `export.js:expPDF` |
| **Export DOCX (JSZip)** | Funcional | ✅ Manter | Opcional para ebook (DOCX → EPUB depois) | Avaliar manter como “exportar rascunho” | `export.js:expDocx` |
| **Export Word .doc (html msword)** | Legacy | ❌ Remover | — | Remover | `export.js:expWord` |
| **Cover (imagem/logo + gerarCapaIA)** | Básico | ✅ Reutilizar | → **Cover Studio** dedicado (título, subtítulo, autor, estilo, cores, tipografia, múltiplas opções) | — | `editor.js:renderCapaPanel` |
| **Media (imagem/tabela/gráfico)** | Básico | ✅ Adaptar | → **Visual Strategy Engine** (imagem opcional, decide quando agrega valor) | Remover obrigatoriedade | `editor.js:_mediaAdd*` + `layout.js:htmlMediaItem` |
| **Pós-textuais (glossário, abreviaturas, apêndice, anexo)** | Académico | ❌ Remover | — | Remover / transformar em “Apêndice ebook” opcional | `editor.js:_posTextualAdd` |
| **Pré-textuais (dedicatória, agradecimentos, epígrafe)** | Académico | ❌ Remover | — | Remover | `layout.js:htmlPretextuais` |
| **Referências APA (peneirarReferencias, validarLista)** | Blindado | ❌ Remover* | *Manter motores `references.js` para bibliografia opcional ebook técnico, mas remover gate obrigatório | Gate bloqueia export — transformar em “Referências opcionais” | `academic/engines/references.js`, `academic/prompts/references.js` |
| **Evidence-first (search→verify→evidence→support)** | Blindado | ❌ Remover | — | Remover para ebook (custo/latência); reaproveitar só para ebooks técnicos se necessário | `engine.js:doCapitulo` evidence block |
| **Integrity pipeline STRICT** | Blindado | 🔄 Alterar | → **Design QA + Content QA** simplificado | Remover `blocked` FINAL para ebook; manter health/readiness | `academic/engines/integrity-pipeline.js` |
| **Exemplares (templates)** | Funcional | ✅ Adaptar | → **Templates Ebook** (Modern, Business, etc.) | Renomear | `modelos-doc.js`, `js/modelos-doc.js`, `EXEMPLARES` global |
| **Documentos (Meus Documentos)** | Funcional | ✅ Reutilizar | → **Meus Ebooks** (capa, título, progresso, status) | Renomear `documentos` → `ebooks`/`projects` | `supabase.js:documentos` + `screens-secondary.js:sDocs` |
| **Configuração** | Funcional | ✅ Reutilizar | Manter tema, língua | — | `screens-secondary.js:sConfig` |
| **Planos & Preços (Vanqir paywall)** | Funcional | ✅ Reutilizar | Adaptar preços para ebook (por ebook/páginas/exports) | Trocar `precos_planos_grafica` → `ebook_plans` | `auth.js:verificarExportacao`, `supabase.js:pagamentos` |
| **Admin (PIN + aprovar/rejeitar)** | Funcional | ✅ Reutilizar | Manter, trocar labels ACADEMY → EBOOK STUDIO | — | `admin.js` |
| **PWA (splash, offline, install, update)** | Funcional | ✅ Reutilizar | Trocar branding/logo | — | `pwa.js`, `sw.js` |
| **Supabase sync (documentos)** | Funcional | ✅ Reutilizar | Renomear tabela `documentos` → `ebook_projects` ou manter com view | — | `supabase.js` |
| **CV Generator (sCv)** | Experimental | ❌ Remover | — | Remover | `screens-secondary.js:sCv` |
| **Doc Livre** | Experimental | ❌ Remover | — | Remover | `navigation.js:doclivre` |

---

## 3. Código reutilizável (manter)

**Núcleo a preservar integralmente (não reescrever):**

- `api/ai-router.js` — já é a abstração `AI Provider → OpenRouter → Model Router` pedida. Tiers, COST_MAP, cooldown, health. **Zero reescrita, só estender `modelForTier` com tasks ebook** (`outline`, `writing`, `rewriting`, `cover`, `visual_strategy`).
- `academic/prompts/system.js` + `prompts/chapters.js` + `prompts/structure.js` + `prompts/editing.js` — estrutura de prompts; copiar e criar variantes `ebook-*`.
- `js/state.js` (LS + State singleton) — adaptar `cfg` para briefing ebook, manter padrão.
- `js/doc-blocks.js` — CRUD blocos (atualizar/inserir/remover/mover/dividir/unir) + history parcial. **Base do Editor ebook**.
- `js/layout.js` — preRenderPipeline, constraint engine, TOC real, cssPDF, 6 temas, A4 model. Base do Design Engine / Preview / PDF.
- `js/pbe.js` — Page Budget Engine (planejar/medir/resumir/validar). Reutilizar verbatim para ebook.
- `js/editor.js` — render sEditor, contenteditable, formatação, regen/melhoria, health panel, modo leitura.
- `js/supabase.js` — REST wrapper, sbUserId, sbSalvarDoc/Carregar/Sincronizar, sbCheckAprovados. Adaptar nomes tabela.
- `js/navigation.js` — irPara/renderizar/aTopbar/actualizarNav/autoGuardar. Manter skeleton e adaptar CFG_ECRAS.
- `js/generator.js: callAcademyAPI`, `astParaTexto`, `validarQualidadeCapitulo`, `validarIntegridadeLivro`, telemetria, retry/quota.
- `js/export.js` (sanitizarConteudo, ref helpers — remover gate, manter expPDF/expDocx).
- `css/base.css` + `layout.css` + `components.css` — tokens, tipografia, sombras, PWA.
- `server.js` + `vercel.json` — infra Express/Vercel.
- `manifest.json` + `sw.js` + `js/pwa.js` + `icons/` — PWA.
- `supabase/migrations` infra (jobs, grants, etc.)
- `academic/engines/quality.js`, `integrity-pipeline.js` (adaptar), `versioning.js`.

---

## 4. Código específico do ACADEMY (remover ou transformar)

**Tudo que existe apenas para trabalhos académicos e não pertence a Ebook Creator:**

- `academic/` inteiro (evidência, claims, search, verification, integrity STRICT, policies/scope=academic) — **remover** ou gatear atrás de `EBOOK_MODE != 'academic'`; manter apenas `quality.js`/`versioning.js`.
- `academic/prompts/references.js` + `academic/engines/evidence.js` + `search.js` + `retrieval.js` + `claims.js` + `verification.js` — zero uso em ebook lifestyle/negócios/lead magnet.
- `supabase-schema.sql: academy_ai_logs`, `academy_history`, `avaliacoes` — renomear para `ebook_ai_logs`, `ebook_projects`, `ebook_feedback` ou depreciar.
- `ESTRUTURAS_TIPO` (state.js:142-204) — 8 tipos TFC/Mono/Artigo/Seminário com capítulos fixos académico — **substituir** por `EBOOK_OUTLINE_TEMPLATES` (ex: Guia Prático, Manual, Lead Magnet, Relatório).
- `TIPOS` (state.js:131-140) — ids `tfc/mono/rel/art/sem/pre/out` — remover.
- `NIVEIS/TURMAS/ANOS_SUP` — `Ensino Médio … Doutoramento` — remover; ebook usa `idioma, tom, público, objetivo, categoria`.
- `PERFIL_NIVEL/PERFIL_AREA` (academic) — lógica `detectarNivel/ Area/ ContextoGeo` + `montarPromptCapitulo` com `nivelKey/areaKey/geoCtx` — remover geo/área académica.
- Referências APA gate (`export.js:66-170`, `layout.js:ref_item`) — `REF_MIN 8`, `refGateExportacao`, `refGerarAPA` obrigatório — remover bloqueio.
- Evidence-first block em `api/engine.js:642-742` (searchAll, verificarReferenciaOnline, source_claims) — remover.
- `doReferencias` modo `evidence-first` vs `strict-empty` — remover para MVP ebook.
- Integrity gate `mustBlockFinal`/`canExportFinal` → watermark `ACADEMY · RASCUNHO` — remover ou transformar em QA leve.
- Pré/pós-textuais (`layout.js:734-787`, `editor.js:_posTextualAdd`) — dedicatória/agradecimentos/epígrafe/glossário/abreviaturas — remover.
- Dedicatória/agradecimentos/epigrafe em `State.cfg` — remover; ebook usa `briefing` campos.
- `parceiros/comissoes/instituicoes` (supabase.js:237-328) — parcerias Angola desconto — remover para MVP ebook (reintroduzir depois como afiliados).
- `TIPOS → sigla` (TFC, MONO) no PDF capa — remover.
- Foco citações `(Autor, Ano)` em `generator.js:DOC_MEMORY.extrairAutoresCitados` — remover; ebook usa storytelling não citação académica.
- Gráficos/tabelas obrigatórios por dados numéricos (`layout.js:extrairDadosNumericos`) — opcionalizar.

---

## 5. Código morto / legado / experimental

| Arquivo / Símbolo | Diagnóstico | Ação |
|---|---|---|
| `js/admin_original.js` | Cópia backup do admin.js | **Remover** (duplicado) |
| `js/auth.js` vs `js/supabase.js` duplicação `sbUserId`/`LS` | Lógica auth espalhada | **Consolidar** |
| `expWord()` (.doc legacy) | Gera `application/msword` HTML — obsoleto | **Remover** |
| `sCv` (Curriculum Vitae) + `sDocLivre` | Telas experimentais sem rota marketing | **Remover** |
| `academic-academic-engine-audit.zip` (233 KB) na raiz | Artefacto zip de auditoria | **Remover** |
| `academic/` duplicado raiz (`academic/`) + `academy/` subpasta | Estrutura confusa: `/academic` + `/academy` + `/academy-livro` (vazio) | **Normalizar** — manter só `academic/` no nível correto |
| `vanqir-test.mjs` (31 KB), `test-*.mjs` (4 ficheiros) | Scripts manuais sem `npm test` | **Migrar** para `test/` vitest/jest ou remover |
| `tooling/` | Pasta sem uso aparente | **Auditar e remover** se vazia |
| `css/` + `icons/` + `js/` globais sem bundler | OK mas sem tree-shaking | **Manter** p/ MVP, avaliar Vite após Fase 8 |
| `package.json` sem scripts `build/test/lint` | Apenas `dev/start` | **Adicionar** `build`, `test`, `lint`, `typecheck` |
| `LOG_LOGO_SVG_RAW` inline em `index.html:221` | SVG gigante inline bloqueia parser | **Extrair** para `js/branding.js` |
| `*_RETRY_QUOTA 30000` + `AI_MAX_RETRIES=1` desalinhados | Constantes mágicas | **Unificar** em `CFG` |
| `EXISTING_FREE_API_*` vs `GROQ_API_KEY` vs `OLLAMA_*` | Três formas de configurar mesma coisa | **Simplificar** para `AI_PROVIDER_ORDER` única |
| `sbH()` anon key fragmentada `p.join('.')` | Ofuscação frágil, não segurança | **Mover** para env ou Supabase JS client |
| `DOC_MEMORY` conectores `Além disso …` + `ARGUMENT_GRAPH` | Não usados em ebook | **Depreciar** |
| `gerarCapaIA()` stub retorna JSON sem imagem | Mock | **Remover** até Cover Studio real |
| `.vercel-login.log`/`.vercel-login2.log` | Logs locais | **Gitignore** |
| `docs/RECUPERACAO_SUPABASE.md` | Doc operacional | **Manter** mas mover para `docs/runbooks/` |
| `AUDIT_REPORT.md`, `GLOBAL_SCOPE_AUDIT.md`, etc. (6 docs) | Auditorias anteriores dispersas | **Consolidar** neste documento + arquivar |

**Dependências desnecessárias:** Nenhuma directa além de `express`+`dotenv` — ok. CDN libs (`jszip`, `jspdf`, `html2canvas`, `html2pdf.js`, `chart.js`) — manter apenas `jszip` (DOCX) + `html2pdf.js` (PDF); `chart.js` remover se Visual Strategy não usar gráficos MVP.

**Imports mortos verificado:** `academic/index.js` re-exporta tudo mas `api/engine.js` importa apenas 20 símbolos — `searchAll/rankSources/extrairClaims/retrieveSource` são usados só no evidence block (a remover). Restante usado.

---

## 6. Riscos

### 6.1 Segurança — CRÍTICO
| Risco | Evidência | Mitigação Ebook |
|---|---|---|
| **RLS permissivo `USING true`** | `supabase-schema.sql:16-71` — `anon_select/insert/update USING true` em utilizadores/pagamentos/documentos | **Reescrever policies** — `auth.uid() = uid` + `service_role` só backend; validar ownership por `sbUserId` no backend, nunca confiar no `uid` do cliente |
| **Anon key exposta no frontend** | `js/supabase.js:14-21` — `SB_KEY` fragmentada mas presente | Mover para `VITE_SUPABASE_ANON_KEY` via backend proxy ou Supabase JS com `anon` publica é ok, mas `service_role` JAMAIS no frontend (hoje correto) |
| **ADMIN_PIN no env sem rate limit** | `api/engine.js:540-549` — compara string direta, sem throttling | Adicionar rate limit dedicado para `verificar_admin` (5 tent/min) + lockout |
| **HMAC Vanqir `rawBody` correto mas sem replay protection** | `server.js:25` OK mas `webhooks.js` não verifica timestamp/nonce | Adicionar janela 5min + idempotência por `payment.id` |
| **Injeção via `tema`/`capTitulo` no prompt** | `doCapitulo` trunca mas não sanitiza | Adicionar allowlist长度 + strip `{{ }}` + system prompt isolation |
| **CORS `*`** | `api/engine.js:53` `Access-Control-Allow-Origin: *` | Restringir para domínio prod + `vercel.app` preview |
| **LocalStorage sem criptografia** | `State` e `docs` em texto plano | OK para MVP, mas considerar `crypto.subtle` para dados sensíveis futuros |

### 6.2 Concorrência & Estado
- **Estado só em memória + localStorage:** `State._estado` mutável global, sem immer/immutable. `iniciarGer` corre com `let _genCancelado` flag sem AbortController por capítulo — race se usuário troca de ebook durante geração. **Risco:** `secs[i]` undefined se `resetDocumento()` durante loop (há defesa `if (!secs[i]) reconstruir` linha 742 mas frágil).
- **Sem lock por projeto:** `autoGuardar()` faz `LS.list('docs').findIndex(tema/tipo)` — colisão se dois ebooks com mesmo tema/tipo. Usar `projectId = crypto.randomUUID()`.
- **Rate limit em memória:** `Map` por instância Vercel (stateless) — não distribuído. Usar Upstash Redis para prod.

### 6.3 Custos IA
- **OpenRouter gratuito instável:** `PREFERIDOS_FREE_JSON` inclui `gemma-4-31b:free`, `nemotron-3-*` — quotas diárias baixas; fallback para `gpt-4o-mini` pago já existe (ordem `openai_direct` primeiro) — **bom**, mas custo pode escalar se todos os freelancers falharem. Estimativa `COST_MAP` cobre só 3 modelos.
- **Sem orçamento por projeto:** `registarTelemetria` loga mas não bloqueia. Ebook com 10 caps × 4K tokens ≈ $0.02 com gpt-4o-mini; com `nemotron-550b:free` custo zero mas latência 15-30s. **Mitigar:** budget por ebook (max $0.50), contador em `ebook_projects.ai_cost_cents`.
- **Chamadas duplicadas:** `gerarEst()` → `gerarPlano()` → `iniciarGer()` são 3 chamadas sequenciais; se retry QC 2× → 6+ chamadas. Adicionar dedup por `hash(tema+capNum)`.

### 6.4 Persistência
- **Projeto como `docs[]` sem `status`:** Não há `draft/planning/generating/reviewing/designing/ready/exporting/completed/failed`. Se geração falha, `genGuardarProgresso()` salva `secs:e='x'` mas UI não distingue `x` vs `p`. Ebook precisa `project.status` persistido em Supabase para retomar após fechar navegador.
- **Sem migrações para ebook:** `documentos.dados JSONB` é schemaless — bom para iterar, mas sem validação `zod` → corrupção silenciosa.

### 6.5 PDF & Export
- **Medição heurística vs DOM:** `pbe.js` + `layout.js: aeDetectarDispositivo()` — mobile força heurística, pode gerar páginas a mais/menos. Validar com `preRenderStressValidate`.
- **Overflow não detectado em imagens:** `htmlMediaItem` sem `max-height` rigoroso → imagem pode estourar `PAGE.HEIGHT`.
- **Fonte externa (Cormorant Garamond)** — não embedada no html2pdf → fallback Helvetica se offline.

### 6.6 Tratamento de erros
- **Mensagens genéricas demais:** `renderErroAPI` sempre mostra `Processamento temporariamente indisponível` — bom para não expor provider, mas oculta erros acionáveis (ex: tema vazio).
- **Sem retry controlado no frontend:** `generator.js` retry 4× com `sleep(tent*4000)` — sem backoff exponencial + jitter; pode amplificar 429.

---

## 7. Plano de migração

> Ordem estrita — não executar Fase N+1 antes de validar Fase N (build + smoke test).

### FASE 0 — Auditoria (esta fase) ✅ CONCLUÍDA
- [x] Auditar estrutura, package.json, supabase, AI router, PDF, editor, auth, storage, env, migrations, testes
- [x] Criar `docs/EBOOK_CREATOR_AUDIT.md`
- [x] Listar reutilizável / específico ACADEMY / morto / riscos
- [ ] **Próximo:** Revisão humana do audit + aprovação do plano

### FASE 1 — Limpeza segura + Arquitetura (sem quebrar)
**Objetivo:** Copiar `academy/` → `academy-livro/` e normalizar.
- `xcopy academy → academy-livro` (preservar git, remover `academic-academic-engine-audit.zip`, `.vercel-login*.log`, `admin_original.js`, `vanqir-test.mjs`, `expWord`)
- Adicionar `package.json` scripts: `build` (no-op hoje), `test` (vitest), `lint` (eslint), `typecheck` (tsc --noEmit se adicionar JSDoc)
- Criar `docs/EBOOK_CREATOR_AUDIT.md` (este arquivo) + mover docs legados para `docs/archive/`
- Criar abstração `AI Provider` em cima do existente: `js/ai-provider.js` (thin wrapper sobre `api/ai-router.js`) com `modelForTask(task)` map (`outline, writing, rewriting, cover, visual_strategy`) → `modelForTier`
- Validar: `npm run dev` + `node server.js` + `curl /health` + `curl /ai/health` OK

**Arquivos afetados:** `package.json`, `vercel.json` (add headers ebook), `.gitignore`, `js/ai-provider.js` (novo)  
**Risco:** BAIXO

### FASE 2 — Project model + Persistência
**Objetivo:** Ebook como projeto persistente com `status`.
```js
EbookProject {
  id: crypto.randomUUID(), // substituir auto-increment Date.now()
  metadata: { title, subtitle, language, category },
  settings: { tone, targetAudience, pageCount, author, visualStyle },
  briefing: { idea, description, objective, inputDocs[] },
  outline:  { chapters: [{num,title,subs[],status}] },
  chapters: [{ id, num, titulo, blocks[], ast, health, status: 'draft|generating|ready|failed' }],
  assets:   [{id, type:'image', src, chapterIdx}],
  cover:    { title, subtitle, author, style, image, colors, typography },
  theme:    { id:'modern', colors, fonts, layouts },
  versions: [],
  exports:  [{type:'pdf', url, created_at}],
  status: 'draft'|'planning'|'generating'|'reviewing'|'designing'|'ready'|'exporting'|'completed'|'failed',
  aiCostCents: 0,
  created_at, updated_at
}
```
- Migrar `State.cfg/est/secs/capa` → `State.project` (mantendo retrocompatibilidade via getter)
- Supabase: `CREATE TABLE ebook_projects (id uuid PK, user_id text FK, data jsonb, status text, ai_cost_cents int, updated_at timestamptz)` + RLS `user_id = sbUserId()` (temporário) + index `user_id, status`
- LS: `acy_projects: EbookProject[]` (30) + `acy_currentProjectId`
- Validar: criar/salvar/recuperar/editar/excluir projeto sem IA

**Arquivos:** `js/state.js`, `js/supabase.js`, `supabase/migrations/0017_ebook_projects.sql`  
**Risco:** MÉDIO (mexer em State propaga para layout/export)

### FASE 3 — Briefing
- Tela `sBriefing` (substitui `sNivel`+`sIdentidade`): inputs `título, tema, descrição, público-alvo, objetivo, idioma (pt-AO/pt-BR/en), tom (formal/descontraído/técnico/inspirador), páginas (5-100), autor, categoria, estilo visual`
- Import modular: `js/ebook-import.js` (PDF/DOCX/TXT/MD via `FileReader` + `jszip` + `pdf.js` opcional) → `briefing.inputDocs`
- Validar: briefing → localStorage → supabase

**Arquivos:** `js/screens-flow.js`, `js/ebook-import.js` (novo), `navigation.js:CFG_ECRAS`  
**Risco:** BAIXO

### FASE 4 — AI Orchestrator + OpenRouter
- Criar `api/ebook-orchestrator.js` (ou estender `engine.js`) com `EbookOrchestrator { selectModel(task), buildPrompt(task,ctx), execute(task,messages,opts), validate(res), retry, logCost }`
- Mapear tasks → tiers: `outline: cheap (gpt-4o-mini), writing: balanced, rewriting: cheap, cover: strong, visual_strategy: cheap`
- Garantir: nunca api key no frontend, timeout 90s, retry 1×, dedup por `hash(projectId+task+capNum)`, log em `ebook_ai_logs`
- Frontend `js/ai-client.js` → `callEbookAPI({action:'ebook_outline'|'ebook_chapter'|'ebook_rewrite', ...})`

**Arquivos:** `api/ai-router.js` (estender), `api/ebook-orchestrator.js` (novo), `js/ai-client.js` (novo)  
**Risco:** BAIXO (reaproveita router existente)

### FASE 5 — Outline Generator
- Engine `ebook_outline` → IA gera `{ titulo, introducao, capitulos: [{titulo, subs[]}], conclusao }`
- UI `sOutline`: lista editável (adicionar/remover/reordenar/renomear/regenerar capítulo) + aprovação `outline.status='approved'`
- Persistir `project.outline` + `project.status='planning' → 'ready'`

**Arquivos:** `academic/prompts/ebook-structure.js` (novo), `api/engine.js` (nova action), `js/screens-flow.js:sOutline`  
**Risco:** MÉDIO (prompt tuning)

### FASE 6 — Geração por capítulo
- Adaptar `generator.js:iniciarGer` → `ebookGenerateChapter(projectId, capIdx)` — uma chamada IA por capítulo, salva progressivo, `status='generating'` por capítulo
- Health/Readiness simplificado (sem APA): `health 0-100`, `readiness: ready se palavras ≥ 80% orçamento e sem placeholders`
- UI `sGeneration` (barra, % , tempo, preview vivo)

**Arquivos:** `js/ebook-generator.js` (refator de generator.js), `api/engine.js:doEbookChapter`  
**Risco:** MÉDIO

### FASE 7 — Editor (coração do produto)
- Estender `doc-blocks.js` tipos: `paragraph, heading, list, quote, checklist, table, image, statistics, comparison, exercise, key_takeaway`
- Toolbar por bloco: mover, duplicar, deletar, AI actions (melhorar, reescrever, expandir, resumir, simplificar, corrigir, continuar, alterar tom, transformar em lista/checklist, criar exemplo)
- `sEditor` já existe — adaptar para renderizar novos tipos + paginação + capa inline
- Persistir `project.chapters[].blocks` a cada edição (debounced 2s)

**Arquivos:** `js/doc-blocks.js`, `js/editor.js`, `js/ebook-editor.js`  
**Risco:** MÉDIO-ALTO (mais código)

### FASE 8 — Themes + Layout Engine
- Generalizar `layout.js:TEMAS` (6 → 10): `modern, minimal, business, editorial, education, finance, technology, luxury, dark, personal_development` — cada um com `{colors, fonts, headings, body, spacing, cards, quotes, tables, cover, layouts}`
- `Design Engine`: `pickLayout(blockType, contentLength)` → `layouts[]` (cover, chapter_intro, text, text_two_columns, image_text, quote, checklist, steps, timeline, statistics, comparison, table, exercise, summary, key_takeaway, conclusion)
- Persistir `project.theme` sem perder conteúdo

**Arquivos:** `js/layout.js`, `js/ebook-themes.js` (novo), `css/themes.css` (novo)  
**Risco:** MÉDIO

### FASE 9 — Cover Studio
- `sCoverStudio`: inputs título/subtítulo/autor/estilo/imagem/cores/tipografia → preview + gerar múltiplas opções (quando IA imagem disponível)
- Usa tema real do ebook, não genérico

**Arquivos:** `js/cover-studio.js` (novo), `api/engine.js:gerar_capa` (ativar)  
**Risco:** BAIXO-MÉDIO

### FASE 10 — Imagens opcionais (Visual Strategy)
- `VisualStrategyEngine`: `shouldAddVisual(block)` → boolean; `selectVisualType(block)` → `image|chart|table|none`
- Integração opcional com gerador imagem (pollinations / openrouter image) — feature flag

**Arquivos:** `js/visual-strategy.js` (novo)  
**Risco:** MÉDIO (depende de provider imagem)

### FASE 11 — Preview
- `sPreview`: paginação real via `preRenderPipeline`, capa, TOC, imagens, numeração — espelho do PDF

**Arquivos:** `js/ebook-preview.js` (novo)  
**Risco:** BAIXO (reusa layout.js)

### FASE 12 — PDF profissional (endurecer)
- Validar: margens, fontes, overflow, quebras, cabeçalho/rodapé, TOC offsets, links, resolução, tamanho
- Adicionar `Design QA` + `Content QA` antes de `gerarJanelaPDF`

**Arquivos:** `js/layout.js` (endurecer), `js/export.js` (gate QA)  
**Risco:** MÉDIO

### FASE 13 — Content QA + Design QA
- Content QA: capítulos vazios, repetições, títulos inconsistentes, estrutura, bloqueios
- Design QA: overflow, clipping, páginas vazias, imagens quebradas, sobreposição, espaçamento
- Impedir export se crítico, ou watermark `DRAFT`

**Arquivos:** `js/ebook-qa.js` (novo)  
**Risco:** BAIXO

### FASE 14 — Testes
- AI: outline, capítulo, retry, timeout, resposta inválida, modelo indisponível (vitest + msw)
- Projetos: criar/salvar/recuperar/editar/excluir
- Editor: criar bloco, editar, ordenar, remover
- Export: PDF válido, conteúdo completo, capa, paginação
- Segurança: usuário A não acessa projeto B (RLS)

**Arquivos:** `test/ebook-*.test.js`, `vitest.config.js`  
**Risco:** BAIXO

### FASE 15 — Limpeza final
- Remover `api/engine.js` actions legadas (`evidence-first`, `validar_integridade` STRICT), `academic/` não usado, `expWord`, `sCv`, `doclivre`, `parceiros`, `TR`/`TIPOS` académicos
- Atualizar `package.json`, `README`, `supabase-schema.sql`, `vercel.json`, `.env.example` → `EBOOK_*`

**Risco:** BAIXO (só após verde em prod)

### FASE 16 — Build + Produção
- `npm run build` (vite build → `dist/` se migrar) ou `vercel --prod`
- `tsc --noEmit` (se adicionar JSDoc/types), `eslint`, `vitest run`
- Smoke test fluxo completo: criar projeto → briefing → outline → aprovar → gerar caps → editar → tema → capa → preview → export PDF → abrir PDF

**Risco:** BAIXO

---

## 8. Inventário — o que será mantido / adaptado / removido

### 8.1 Manter (sem tocar)
`api/ai-router.js`, `js/doc-blocks.js`, `js/pbe.js`, `js/layout.js` (núcleo), `css/*`, `manifest.json`, `sw.js`, `js/pwa.js`, `server.js`, `vercel.json`, `supabase/migrations` base

### 8.2 Adaptar (renomear / estender)
`js/state.js` → `State.project`, `js/supabase.js` → `ebook_projects`, `js/generator.js` → `ebook-generator.js`, `js/editor.js` → + novos blocos/layouts, `js/export.js` → remover gate APA, `js/navigation.js` → `CFG_ECRAS` ebook, `js/layout.js:TEMAS` → 10 temas, `api/engine.js` → novas actions `ebook_*`, `index.html` branding ACADEMY → EBOOK STUDIO

### 8.3 Remover (após Fase 14 verde)
`js/admin_original.js`, `academic-academic-engine-audit.zip`, `.vercel-login*.log`, `vanqir-test.mjs` + `test-*.mjs` legados, `tooling/` (se vazio), `js/auth.js` duplicado, `expWord`, `sCv`, `doclivre`, `academic/engines/search|retrieval|verification|claims|evidence`, `academic/policies/scope`, `academic/prompts/references` (ou opcionalizar), `ESTRUTURAS_TIPO`/`TIPOS`/`NIVEIS`, `parceiros/comissoes/instituicoes`, `pre/postextuais`

### 8.4 Novas estruturas necessárias
```
js/ebook-import.js
js/ebook-themes.js
js/ebook-qa.js
js/visual-strategy.js
js/cover-studio.js
js/ebook-preview.js
js/ebook-generator.js (refator)
js/ai-client.js
js/ai-provider.js
api/ebook-orchestrator.js
academic/prompts/ebook-chapters.js
academic/prompts/ebook-structure.js
academic/prompts/ebook-editing.js
supabase/migrations/0017_ebook_projects.sql
supabase/migrations/0018_ebook_ai_logs.sql
test/ebook-outline.test.js
test/ebook-chapter.test.js
test/ebook-editor.test.js
test/ebook-export.test.js
test/ebook-security.test.js
docs/EBOOK_CREATOR_ROADMAP.md
```

### 8.5 Dependências desnecessárias / a adicionar
- **Remover:** `chart.js` CDN se não usar gráficos MVP
- **Adicionar:** `vitest` + `@testing-library/dom` + `msw` (testes), `zod` (validação project), `eslint` + `prettier` (DX), opcional `vite` (build) + `pdf.js` (import PDF)

### 8.6 Testes existentes vs. faltantes
- **Existem:** `test/` vazio, `vanqir-test.mjs`, `test-academic-quality.mjs`, `test-part1.mjs`, `test/academic/` (?) — scripts manuais, sem runner, sem CI, sem cobertura
- **Faltam:** Todos os testes unit/integration/E2E para MVP ebook (outline, chapter, retry, timeout, modelo indisponível, CRUD projeto, blocos, PDF, RLS). Ver Fase 14.

---

## 9. Decisão sobre `academy-livro` (vazio)

O diretório de destino `C:/Users/EXMO PRINS/Desktop/academy-livro` está **vazio** (0 arquivos). Isso confirma que a “cópia” mencionada no prompt ainda não foi materializada. Recomendação:

1. **Não auditar um diretório vazio** — a auditoria acima cobre o source real `academy/`.
2. Próximo passo Fase 1: `robocopy academy academy-livro /E /XD node_modules .git .vercel` + aplicar limpezas.
3. Este arquivo foi criado em `academy-livro/docs/EBOOK_CREATOR_AUDIT.md`; espelhar também em `academy/docs/EBOOK_CREATOR_AUDIT.md` para não perder a auditoria no source.

---

## 10. Critério de sucesso — NÃO é `npm run build`

O MVP só será considerado concluído quando:

```
criar projeto → briefing (título/tema/público/tom/páginas/autor) →
gerar outline → aprovar outline → gerar capítulos (um a um, com retry) →
editar conteúdo (blocos, AI editor) → escolher tema → gerar capa →
adicionar imagens quando apropriado → preview fidedigno → exportar PDF →
abrir PDF sem: texto cortado, sobreposição, páginas vazias, imagens deformadas
```

---

*Fim da auditoria. Próximo passo: aguardar aprovação humana e iniciar Fase 1 (limpeza segura + arquitetura AI Provider).*
