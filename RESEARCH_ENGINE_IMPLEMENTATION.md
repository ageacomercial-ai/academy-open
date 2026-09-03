# RESEARCH ENGINE IMPLEMENTATION — EVIDENCE-FIRST (v120)

## Providers (gratuito)
- OpenAlex `https://api.openalex.org/works?filter=title.search:{q}` — sem chave, metadados+abstract_inverted_index, is_oa
- Crossref `https://api.crossref.org/works?query={q}` — sem chave, metadados
- Semantic Scholar `https://api.semanticscholar.org/graph/v1/paper/search` — sem chave, 100/5min, isOpenAccess
- Europe PMC `https://www.ebi.ac.uk/europepmc/.../search` — sem chave, isOpenAccess, fullTextUrlList
- Open Library `https://openlibrary.org/search.json` — sem chave, ISBN
- Unpaywall `https://api.unpaywall.org/v2/{doi}?email=` — sem chave (email), OA URL

## Arquitetura
`CLAIMS (extrairClaims) → QUERIES (gerarQueries 2-3/claim) → SEARCH (searchAll paralelo Promise.allSettled, CONCURRENCY 4, timeout 8s) → DEDUP (doi/isbn/title Jaccard 0.85) → RANK (L1 10, L2 8, OA +2, recency +1) → RETRIEVE (Unpaywall → EuropePMC → abstract) → EXTRACT (extractEvidence never invent page) → VERIFY (verificarSuporteClaim DIRECTLY/PARTIALLY/DOES_NOT) → WRITE (só se DIRECTLY/PARTIALLY, senão [CITAÇÃO A VERIFICAR]) → VALIDATE (integrity-pipeline)`

## Cache
Supabase `sources(doi unique, content_hash, raw_metadata)` — dedup por doi/isbn/title, índice title, query_hash. Antes de SEARCH, checa `sources` por doi.

## Concorrência
`Promise.allSettled` com `CONCURRENCY_LIMIT 4`, timeout 8s, retry 1, backoff exponencial, circuit breaker 2 falhas → 2min cooldown. Provider falha não derruba.

## Retrieval
Ordem: `is_open_access full_text_url → Unpaywall → EuropePMC → abstract`. Nunca burla paywall. Se só metadados → `EVIDENCE_UNAVAILABLE` → `NOT_VERIFIED`.

## Evidence
`extractEvidence(source, claim)` retorna `{evidence_text: abstract.slice(0,400), page:null, section:null, confidence: kw/claim}` — page nunca inventada.

## Claim Support
`verifyClaimSupport(claim, evidence)` → `DIRECTLY_SUPPORTS >0.55, PARTIALLY >0.35, DOES_NOT <0.15, NOT_VERIFIED`. Para números: `claimNum` deve estar em `evNum`.

## Modelos OpenRouter
`MODEL_TIERS: cheap (gpt-4o-mini) balanced (gpt-4o-mini) strong (gpt-4o)` via `OPENROUTER_MODEL_*` env, `modelForTier(tier)` em ai-router.js. CHEAP para keywords/classificação, BALANCED para abstract/claim, STRONG só para conflito.

## Custo estimado
- Busca 36 claims (30p) ×5 fontes ×2 verificação = ~180 req gratuitas (0$)
- LLM: CHEAP 500 tokens ×36 = 18k tokens (~$0.003), BALANCED 1k ×36 = 36k (~$0.005), STRONG 2k ×5 =10k (~$0.02) → **~$0.03/trabalho 30p**, 100p ~$0.08.

## Limitações
- Paywall 70% sem OA → só abstract
- Sem pdf-parse/cheerio ainda → sem full text parse (próximo: pdf-parse + Unpaywall)
- Sem fila persistente → 100p ainda perto de 300s timeout (precisa jobs se >50p)

## Testes
`test/research.test.mjs` R1-R20, `evidence.test.mjs`, `global-integrity.test.mjs` — todos gratuitos, paralelos <15s.

## Arquivos
Criados: `search.js`, `claims.js`, `retrieval.js`, `R* tests`; Modificados: `verification.js`, `integrity-pipeline.js`, `engine.js`, `chapters.js`, `references.js`, `ai-router.js`.
