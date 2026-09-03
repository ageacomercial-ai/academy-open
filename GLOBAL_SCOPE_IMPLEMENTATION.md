# GLOBAL SCOPE IMPLEMENTATION — PLATFORM_SCOPE = GLOBAL

**Data:** 2025-09-01  
**Versão:** academy-v119  
**Deploy:** https://academy-open.vercel.app

---

## 1. Arquivos Alterados

| Arquivo | Função alterada | O que mudou |
|---------|-----------------|-------------|
| `academic/policies/scope.js` | **NOVO** | `PLATFORM_SCOPE='GLOBAL'`, `determinarEscopo()` retorna `{global_scope, geographic_scope[], topic_scope[], population_scope[], discipline_scope[], geoCtx}`, `HIERARQUIA_FONTES L1→L4`, helpers `idiomaNaoEhGeografia`, `usuarioNaoEhObjeto` |
| `academic/prompts/system.js` | `detectarContextoGeo` | Agora ignora `pais` (usuário) — `PLATFORM_SCOPE GLOBAL` — escopo só do `tema`. Adicionado `export const PLATFORM_SCOPE='GLOBAL'` |
| `academic/prompts/system.js` | `gerarInstrucaoGeo` | Prefixa `A ACADEMY É PLATAFORMA GLOBAL (PLATFORM_SCOPE=GLOBAL). NUNCA presuma Angola...` + ramifica `angola/brasil/portugal/eua` vs global com frase `use fontes locais + internacionais` |
| `academic/prompts/chapters.js` | `montarPromptCapitulo` | Import `isStrict`, injeta `strictBlock` + `escopo` JSON no topo do prompt: `Escopo: {global_scope, geographic_scope, platform_scope}. ${gerarInstrucaoGeo}` |
| `academic/prompts/references.js` | `montarPromptReferencias` | Import `isStrict`, adiciona `strictRef` (não invente DOI/URL) e troca `reais e plausíveis` por `verificáveis` quando STRICT |
| `api/engine.js` | `doCapitulo` | Import `determinarEscopo, PLATFORM_SCOPE`, calcula `escopo=determinarEscopo({tema, objetivos, problema})`, passa `geoCtx=escopo.geoCtx` e `escopo` para `montarPromptCapitulo` |
| `js/screens-flow.js` | ` _SUGESTOES_TEMA` | 8 temas 100% Angola → mix global (IA global, Brasil, Angola comparado, Portugal, Moçambique, etc.) |
| `js/screens-flow.js` | `_SUG_P5` | 12 `em Angola` → `no contexto global, na América Latina, em Angola, no Brasil, em Portugal...` |
| `js/pbe.js` | `_PBE_POOL` | Removido token `angola` (`contexto angola resultado` → `contexto resultado`) |
| `js/export.js` | `refGerarFallback` | 10 refs 90% Angola → 10 refs globais (World Bank, UNESCO, OECD, WHO, ITU, Porter, etc.) |
| `test/global-scope.test.mjs` | **NOVO** | G1-G6 + BUG Almeida (2021) |
| `sw.js` / `js/pwa.js` | `CACHE v119` | bump |

---

## 2. Regras Removidas / Alteradas

- **Removido:** `detectarContextoGeo` usava `if (p && p !== 'angola') return p` — usuário em Angola contaminava tema global. Agora `p` ignorado.
- **Removido:** `Sugestões 100% Angola` — ancoragem removida
- **Removido:** `PBE pool angola` — viés de calibração
- **Removido:** `Fallback 9/10 refs angolanas` — substituído por hierarquia L1/L2
- **Alterado:** `gerarInstrucaoGeo` antes retornava `O tema refere-se a Angola...` sem prefixo global; agora prefixa `PLATFORM_SCOPE=GLOBAL. NUNCA presuma Angola...` para todo `ctx`
- **Mantido mas condicionado:** `Angola`, `contexto angolano` só aparecem quando `tema` contém `angola` (via `detectarContextoGeo`), não por plataforma

---

## 3. Prompts Alterados

**Antes:**
```js
// chapters.js
`És um professor... sobre "${tema}"` + geoInstrucao (sem PLATFORM_SCOPE)
```

**Depois:**
```js
const strictBlock = isStrict() ? `MODO STRICT — NUNCA INVENTE...` : '';
const escopo = determinarEscopo({tema});
` ${strictBlock} Escopo: {"global_scope":true,"geographic_scope":[],"platform_scope":"GLOBAL"}. A ACADEMY É GLOBAL...`
```

**References:**
Antes: `gera exactamente ${numRefs} referências reais e plausíveis`
Depois: `MODO STRICT: Nunca invente DOI/URL...` + `verificáveis` quando STRICT

---

## 4. Funções Alteradas

- `detectarContextoGeo(tema, pais)` → ignora `pais`, PLATFORM_SCOPE GLOBAL
- `gerarInstrucaoGeo(tema,pais,geoCtx)` → prefixa `PLATFORM_SCOPE=GLOBAL` + 5 ramos (angola/brasil/portugal/eua vs global)
- `montarPromptCapitulo({..., escopo})` → novo param `escopo`
- `determinarEscopo({tema, objetivos, problema, populacao, disciplina})` **NOVA** — extrai `geographic_scope[]` via `MAPA_GEO` regex, `discipline_scope[]`, `isGlobal = scope.length==0`
- `doCapitulo(p)` → calcula `escopo` e passa para prompt

---

## 5. Testes Criados

`test/global-scope.test.mjs` — 7 suítes, 17 asserções:

- G0: `PLATFORM_SCOPE=GLOBAL`
- G1: global `Impacto IA` → `global_scope true, geographic_scope []` + instrução sem Angola
- G2: `Empreendedorismo Brasil` → `geographic_scope=[brasil]` + `fontes brasileiras + internacionais`
- G3: `Negócios digitais Angola` → `[angola]` + `angolanas + internacionais`
- G4: global + usuário Angola → `ctx global` (não injetada)
- G5: EUA → `eua` não Angola
- G6: global → prompt contém `PLATFORM_SCOPE=GLOBAL` + `internacional` sem forçar autor angolano
- BUG: `Almeida (2021)` prompt contém `NUNCA invente DOI`

**Resultado:** `✅ TODOS G1-G6 PASSARAM` (17/17)

---

## 6. Resultado dos Testes

```
$ node test/global-scope.test.mjs
PLATFORM_SCOPE=GLOBAL
✅ G0 ... ✅ G6 ... ✅ BUG
TODOS G1-G6 PASSARAM

$ node test/integrity.test.mjs
✅ T1-T10 PASSARAM

$ node test/generation.test.mjs
60/100 REVISAR — não bloqueado, PDF OK
```

---

## 7. Riscos Restantes

1. **CrossRef hierarquia L1→L4** ainda não é enforcement programático — `integrity-pipeline.js` detecta `semFonte` mas não bloqueia se `L1` existe mas fraca. Próximo: `ReferenceVerifier` escolher melhor fonte por claim.
2. **Sugestões _SUG_P2/_P3** ainda têm `das TIC, do turismo` sem país — ok (global), mas `_SUG_P1` neutro.
3. **Idioma pt-AO** ainda primeiro em `screens-secondary.js` — percepção pode persistir; próximo: reordenar para `pt` neutro primeiro.
4. **Fallback refs** agora globais, mas ainda LLM pode gerar `Silva (2020)` fictício em cap global — coberto por STRICT + `NOT_VERIFIED` na auditoria, mas precisa `verificarReferenciaOnline` obrigatório antes de `FINAL`.

---

## 8. Critério de Aceitação — Check

- [x] 1. ACADEMY explicitamente GLOBAL (`PLATFORM_SCOPE=GLOBAL` em `scope.js` + `system.js` + prompts)
- [x] 2. Angola deixou de ser padrão (sugestões, pbe pool, fallback, detectarContextoGeo)
- [x] 3. Escopo vem do trabalho (`determinarEscopo` tema→geographic_scope)
- [x] 4. Fontes internacionais permitidas (gerarInstrucaoGeo: `angolanas + internacionais`, `referencias` hierarquia)
- [x] 5. Angola + internacionais (G3)
- [x] 6. Outros países não recebem Angola (G4, G5)
- [x] 7. Global → literatura global (G1, G6)
- [x] 8. Idioma ≠ geografia (`idiomaNaoEhGeografia`, `pt` não implica país)
- [x] 9. Usuário ≠ objeto (`usuarioNaoEhObjeto`, `detectarContextoGeo` ignora `pais`)
- [x] 10. G1-G6 passam
- [x] 11. STRICT continua (`isStrict()` em chapters/references)
- [x] 12. Fonte existe vs sustenta separado (`source_claims` + `integrity-pipeline` `SOURCE_EXISTENCE` vs `CLAIM_SUPPORT`)

**Deploy:** `academy-v119` → https://academy-open.vercel.app (auto-update).
